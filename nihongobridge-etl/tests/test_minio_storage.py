from __future__ import annotations

from etl.storage.minio_client import MinioStorage


def test_minio_public_url_encodes_object_segments() -> None:
    storage = MinioStorage(
        "http://minio:9000",
        "access",
        "secret",
        public_url="https://media.example.test",
    )

    assert storage.public_object_url("audio", "sentences/a file.mp3") == (
        "https://media.example.test/audio/sentences/a%20file.mp3"
    )
