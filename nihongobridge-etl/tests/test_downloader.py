from __future__ import annotations

import gzip
import hashlib
from pathlib import Path

import httpx
import pytest

from etl.utils.downloader import ChecksumMismatchError, Downloader


@pytest.mark.asyncio
async def test_downloader_streams_and_verifies_sha256(tmp_path: Path) -> None:
    body = gzip.compress(b"<JMdict/>")
    digest = hashlib.sha256(body).hexdigest()

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://example.test/JMdict_e.gz"
        return httpx.Response(200, content=body, headers={"Content-Length": str(len(body))})

    downloader = Downloader(retries=1)
    await downloader.client.aclose()
    downloader.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    destination = tmp_path / "JMdict_e.xml.gz"
    try:
        result = await downloader.download(
            "https://example.test/JMdict_e.gz",
            destination,
            expected_sha256=digest,
            require_checksum=True,
            validate_gzip=True,
        )
    finally:
        await downloader.client.aclose()

    assert destination.read_bytes() == body
    assert result.checksum_verified is True
    assert result.sha256 == digest
    assert destination.with_suffix(".gz.sha256").exists()


@pytest.mark.asyncio
async def test_downloader_rejects_checksum_mismatch(tmp_path: Path) -> None:
    body = gzip.compress(b"<JMdict/>")

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=body)

    downloader = Downloader(retries=1)
    await downloader.client.aclose()
    downloader.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    try:
        with pytest.raises(ChecksumMismatchError):
            await downloader.download(
                "https://example.test/JMdict_e.gz",
                tmp_path / "JMdict_e.xml.gz",
                expected_sha256="0" * 64,
            )
    finally:
        await downloader.client.aclose()


@pytest.mark.asyncio
async def test_force_download_allows_upstream_change_after_tofu(tmp_path: Path) -> None:
    destination = tmp_path / "JMdict_e.xml.gz"
    old_body = gzip.compress(b"<old/>")
    new_body = gzip.compress(b"<new/>")
    destination.write_bytes(old_body)
    destination.with_suffix(".gz.sha256").write_text(
        f"{hashlib.sha256(old_body).hexdigest()}  {destination.name}\n",
        encoding="utf-8",
    )

    downloader = Downloader(retries=1)
    await downloader.client.aclose()
    downloader.client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=new_body))
    )
    try:
        result = await downloader.download(
            "https://example.test/JMdict_e.gz",
            destination,
            force=True,
            validate_gzip=True,
        )
    finally:
        await downloader.client.aclose()

    assert destination.read_bytes() == new_body
    assert result.checksum_verified is False
    assert result.verification_source == "trust-on-first-use local sidecar"
