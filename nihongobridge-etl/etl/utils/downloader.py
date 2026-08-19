from __future__ import annotations

import asyncio
import gzip
import hashlib
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import httpx
from tqdm.auto import tqdm

LOGGER = logging.getLogger(__name__)
_SHA256_PATTERN: Final = re.compile(r"\b([a-fA-F0-9]{64})\b")
_RETRYABLE_STATUS_CODES: Final = {408, 425, 429, 500, 502, 503, 504}


class DownloadError(RuntimeError):
    """Base exception for source download failures."""


class ChecksumMismatchError(DownloadError):
    """Raised when a downloaded artifact does not match its trusted digest."""


@dataclass(frozen=True, slots=True)
class DownloadResult:
    path: Path
    sha256: str
    size_bytes: int
    used_cache: bool
    checksum_verified: bool
    verification_source: str


async def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    def _calculate() -> str:
        digest = hashlib.sha256()
        with path.open("rb") as source:
            while chunk := source.read(chunk_size):
                digest.update(chunk)
        return digest.hexdigest()

    return await asyncio.to_thread(_calculate)


async def validate_gzip_file(path: Path, chunk_size: int = 1024 * 1024) -> None:
    """Read through gzip data so its trailer/CRC is validated before parsing."""

    def _validate() -> None:
        with gzip.open(path, "rb") as source:
            while source.read(chunk_size):
                pass

    try:
        await asyncio.to_thread(_validate)
    except (OSError, EOFError) as exc:
        raise DownloadError(f"Invalid or truncated gzip archive: {path}") from exc


class Downloader:
    """Atomic streaming downloader with retries and SHA-256 verification."""

    def __init__(
        self,
        *,
        timeout_seconds: float = 120,
        connect_timeout_seconds: float = 20,
        retries: int = 4,
        backoff_seconds: float = 1,
        user_agent: str = "NihongoBridge-ETL/1.0",
    ) -> None:
        self.retries = retries
        self.backoff_seconds = backoff_seconds
        self.client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(timeout_seconds, connect=connect_timeout_seconds),
            headers={"User-Agent": user_agent},
        )

    async def __aenter__(self) -> Downloader:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.client.aclose()

    async def fetch_checksum(self, url: str) -> str:
        response = await self.client.get(url)
        response.raise_for_status()
        match = _SHA256_PATTERN.search(response.text)
        if not match:
            raise DownloadError(f"No SHA-256 digest found at {url}")
        return match.group(1).lower()

    async def download(
        self,
        url: str,
        destination: Path,
        *,
        expected_sha256: str | None = None,
        checksum_url: str | None = None,
        require_checksum: bool = False,
        force: bool = False,
        validate_gzip: bool = False,
    ) -> DownloadResult:
        destination.parent.mkdir(parents=True, exist_ok=True)
        sidecar = destination.with_suffix(destination.suffix + ".sha256")

        trusted_digest = expected_sha256.lower() if expected_sha256 else None
        verification_source = "explicit JMDICT_SHA256" if trusted_digest else ""
        if not trusted_digest and checksum_url:
            trusted_digest = await self.fetch_checksum(checksum_url)
            verification_source = checksum_url

        recorded_digest: str | None = None
        if sidecar.exists():
            match = _SHA256_PATTERN.search(sidecar.read_text(encoding="utf-8"))
            if match:
                recorded_digest = match.group(1).lower()

        if require_checksum and not trusted_digest:
            raise DownloadError(
                "A trusted checksum is required. Set JMDICT_SHA256 or "
                "JMDICT_CHECKSUM_URL before downloading."
            )

        if await asyncio.to_thread(destination.exists) and not force:
            current_digest = await sha256_file(destination)
            expected_cache_digest = trusted_digest or recorded_digest
            if expected_cache_digest and current_digest != expected_cache_digest:
                LOGGER.warning("Cached source checksum mismatch; downloading a clean copy")
            else:
                if validate_gzip:
                    await validate_gzip_file(destination)
                if trusted_digest:
                    cache_verification_source = verification_source
                else:
                    sidecar.write_text(
                        f"{current_digest}  {destination.name}\n",
                        encoding="utf-8",
                    )
                    cache_verification_source = "trust-on-first-use local sidecar"
                return DownloadResult(
                    path=destination,
                    sha256=current_digest,
                    size_bytes=(await asyncio.to_thread(destination.stat)).st_size,
                    used_cache=True,
                    checksum_verified=trusted_digest is not None,
                    verification_source=cache_verification_source,
                )

        temporary = destination.with_suffix(destination.suffix + ".part")
        last_error: Exception | None = None

        for attempt in range(1, self.retries + 1):
            temporary.unlink(missing_ok=True)
            try:
                result = await self._download_once(
                    url,
                    temporary,
                    destination,
                    trusted_digest,
                    verification_source,
                )
                if validate_gzip:
                    await validate_gzip_file(destination)
                sidecar.write_text(
                    f"{result.sha256}  {destination.name}\n",
                    encoding="utf-8",
                )
                if not trusted_digest:
                    result = DownloadResult(
                        path=result.path,
                        sha256=result.sha256,
                        size_bytes=result.size_bytes,
                        used_cache=False,
                        checksum_verified=False,
                        verification_source="trust-on-first-use local sidecar",
                    )
                return result
            except (httpx.HTTPError, OSError, DownloadError) as exc:
                last_error = exc
                temporary.unlink(missing_ok=True)
                if attempt == self.retries:
                    break
                delay = self.backoff_seconds * (2 ** (attempt - 1))
                LOGGER.warning(
                    "Download attempt %s/%s failed (%s); retrying in %.1fs",
                    attempt,
                    self.retries,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)

        if isinstance(last_error, ChecksumMismatchError):
            raise last_error
        raise DownloadError(
            f"Failed to download {url} after {self.retries} attempts"
        ) from last_error

    async def _download_once(
        self,
        url: str,
        temporary: Path,
        destination: Path,
        trusted_digest: str | None,
        verification_source: str,
    ) -> DownloadResult:
        digest = hashlib.sha256()
        size_bytes = 0

        async with self.client.stream("GET", url) as response:
            if response.status_code in _RETRYABLE_STATUS_CODES:
                raise httpx.HTTPStatusError(
                    f"Retryable HTTP status {response.status_code}",
                    request=response.request,
                    response=response,
                )
            response.raise_for_status()
            total = int(response.headers.get("Content-Length", 0)) or None
            with (
                temporary.open("wb") as output,
                tqdm(
                    total=total,
                    unit="B",
                    unit_scale=True,
                    unit_divisor=1024,
                    desc=f"Downloading {destination.name}",
                    dynamic_ncols=True,
                ) as progress,
            ):
                async for chunk in response.aiter_bytes(1024 * 1024):
                    output.write(chunk)
                    digest.update(chunk)
                    size_bytes += len(chunk)
                    progress.update(len(chunk))
                output.flush()
                os.fsync(output.fileno())

        actual_digest = digest.hexdigest()
        if trusted_digest and actual_digest != trusted_digest:
            raise ChecksumMismatchError(
                f"SHA-256 mismatch for {destination.name}: expected "
                f"{trusted_digest}, got {actual_digest}"
            )

        await asyncio.to_thread(temporary.replace, destination)
        return DownloadResult(
            path=destination,
            sha256=actual_digest,
            size_bytes=size_bytes,
            used_cache=False,
            checksum_verified=trusted_digest is not None,
            verification_source=verification_source,
        )
