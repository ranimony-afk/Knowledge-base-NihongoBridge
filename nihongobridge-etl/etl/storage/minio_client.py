from __future__ import annotations

import asyncio
import json
from pathlib import Path
from urllib.parse import quote, urlparse

from minio import Minio
from minio.error import S3Error


class MinioStorage:
    """Small async facade around MinIO's blocking Python client."""

    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        *,
        public_url: str | None = None,
    ) -> None:
        parsed = urlparse(endpoint if "://" in endpoint else f"http://{endpoint}")
        if not parsed.netloc:
            raise ValueError(f"Invalid MinIO endpoint: {endpoint}")
        self._scheme = parsed.scheme or "http"
        self._endpoint = parsed.netloc
        self._public_url = public_url.rstrip("/") if public_url else None
        self.client = Minio(
            self._endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=self._scheme == "https",
        )

    async def ensure_bucket(self, bucket: str, *, public_read: bool = False) -> None:
        exists = await asyncio.to_thread(self.client.bucket_exists, bucket)
        if not exists:
            try:
                await asyncio.to_thread(self.client.make_bucket, bucket)
            except S3Error as exc:
                if exc.code not in {"BucketAlreadyExists", "BucketAlreadyOwnedByYou"}:
                    raise
        if public_read:
            policy = json.dumps(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": ["*"]},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{bucket}/*"],
                        }
                    ],
                }
            )
            await asyncio.to_thread(self.client.set_bucket_policy, bucket, policy)

    async def object_exists(self, bucket: str, object_name: str) -> bool:
        try:
            await asyncio.to_thread(self.client.stat_object, bucket, object_name)
            return True
        except S3Error as exc:
            if exc.code in {"NoSuchKey", "NoSuchObject", "NotFound"}:
                return False
            raise

    async def remove_object(self, bucket: str, object_name: str) -> None:
        await asyncio.to_thread(self.client.remove_object, bucket, object_name)

    async def upload_file(
        self,
        bucket: str,
        object_name: str,
        path: Path,
        *,
        content_type: str,
    ) -> str:
        await asyncio.to_thread(
            self.client.fput_object,
            bucket,
            object_name,
            str(path),
            content_type,
        )
        return self.public_object_url(bucket, object_name)

    def public_object_url(self, bucket: str, object_name: str) -> str:
        encoded_name = "/".join(quote(segment, safe="") for segment in object_name.split("/"))
        base = self._public_url or f"{self._scheme}://{self._endpoint}"
        return f"{base}/{quote(bucket, safe='')}/{encoded_name}"
