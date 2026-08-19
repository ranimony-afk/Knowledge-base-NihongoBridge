from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Self

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_SHA256_FIELDS = (
    "jmdict_sha256",
    "tatoeba_sentences_sha256",
    "tatoeba_links_sha256",
    "tatoeba_tags_sha256",
)


class Settings(BaseSettings):
    """Environment-backed configuration shared by NihongoBridge ETL pipelines."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nihongobridge_dev"
    db_pool_size: int = Field(default=5, ge=1, le=50)
    db_max_overflow: int = Field(default=10, ge=0, le=100)
    db_pool_timeout_seconds: float = Field(default=30.0, gt=0)
    db_statement_timeout_ms: int = Field(default=120_000, ge=1_000)

    data_dir: Path = Path("data")
    report_dir: Path = Path("reports")
    checkpoint_dir: Path = Path(".checkpoints")

    http_timeout_seconds: float = Field(default=120.0, gt=0)
    http_connect_timeout_seconds: float = Field(default=20.0, gt=0)
    download_retries: int = Field(default=4, ge=1, le=10)
    download_backoff_seconds: float = Field(default=1.0, ge=0.1, le=60)
    http_user_agent: str = "NihongoBridge-ETL/1.0"
    validation_error_sample_limit: int = Field(default=100, ge=1, le=1_000)

    # JMdict
    jmdict_url: str = "https://www.edrdg.org/pub/Nihongo/JMdict_e.gz"
    jmdict_filename: str = "JMdict_e.xml.gz"
    jmdict_sha256: str | None = None
    jmdict_checksum_url: str | None = None
    require_source_checksum: bool = False
    validate_gzip: bool = True
    batch_size: int = Field(default=750, ge=1, le=3_000)
    jmdict_estimated_entries: int = Field(default=210_000, ge=1)
    checkpoint_every_batches: int = Field(default=1, ge=1, le=100)
    jmdict_source_attribution: str = "jmdict: JMdict/EDRDG (CC BY-SA 3.0)"

    # Shared enrichment
    jlpt_vocab_dir: Path = Path("data/enrichment/openjlpt")
    innocent_frequency_path: Path = Path("data/enrichment/innocent_corpus.zip")
    frequency_value_mode: str = "auto"
    require_jlpt_data: bool = True
    require_frequency_data: bool = True

    # Tatoeba
    tatoeba_base_url: str = "https://downloads.tatoeba.org/exports"
    tatoeba_sentences_archive: str = "sentences.tar.bz2"
    tatoeba_links_archive: str = "links.tar.bz2"
    tatoeba_tags_archive: str = "tags.tar.bz2"
    tatoeba_sentences_sha256: str | None = None
    tatoeba_links_sha256: str | None = None
    tatoeba_tags_sha256: str | None = None
    tatoeba_require_checksums: bool = False
    tatoeba_source_attribution: str = "tatoeba: Tatoeba (CC BY 2.0 FR)"
    tatoeba_stage_filename: str = "tatoeba-stage.sqlite3"
    tatoeba_batch_size: int = Field(default=250, ge=1, le=500)
    tatoeba_estimated_japanese_sentences: int = Field(default=250_000, ge=1)
    tatoeba_seed_limit_per_level: int = Field(default=1_000, ge=1, le=1_000)
    sentence_seed_dir: Path = Path("data/seeds/sentences")

    # Edge TTS and object storage
    edge_tts_female_voice: str = "ja-JP-NanamiNeural"
    edge_tts_male_voice: str = "ja-JP-KeitaNeural"
    edge_tts_rate: str = "+0%"
    edge_tts_volume: str = "+0%"
    tts_requests_per_second: float = Field(default=10.0, gt=0, le=10)
    tts_concurrency: int = Field(default=4, ge=1, le=10)
    tts_retries: int = Field(default=3, ge=1, le=10)
    tts_temp_dir: Path = Path("data/tts-temp")

    minio_endpoint: str = "http://localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_audio_bucket: str = "audio"
    minio_public_url: str | None = None
    minio_public_read: bool = True

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        value = value.strip()
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use PostgreSQL")
        return value

    @field_validator(*_SHA256_FIELDS)
    @classmethod
    def validate_sha256(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = value.strip().lower()
        if len(normalized) != 64 or any(char not in "0123456789abcdef" for char in normalized):
            raise ValueError("SHA-256 values must be 64-character hexadecimal digests")
        return normalized

    @field_validator("frequency_value_mode")
    @classmethod
    def validate_frequency_mode(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"auto", "rank", "count"}:
            raise ValueError("FREQUENCY_VALUE_MODE must be auto, rank, or count")
        return normalized

    @field_validator("edge_tts_rate", "edge_tts_volume")
    @classmethod
    def validate_tts_percentage(cls, value: str) -> str:
        normalized = value.strip()
        if not re.fullmatch(r"[+-]\d+%", normalized):
            raise ValueError("Edge TTS rate and volume must look like +0% or -10%")
        return normalized

    @model_validator(mode="after")
    def create_runtime_directories(self) -> Self:
        for directory in (
            self.raw_data_dir,
            self.report_dir,
            self.checkpoint_dir,
            self.tatoeba_data_dir,
            self.sentence_seed_dir,
            self.tts_temp_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)
        return self

    @property
    def raw_data_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def jmdict_path(self) -> Path:
        return self.raw_data_dir / self.jmdict_filename

    @property
    def jmdict_checkpoint_path(self) -> Path:
        return self.checkpoint_dir / "jmdict.json"

    @property
    def tatoeba_data_dir(self) -> Path:
        return self.data_dir / "tatoeba"

    @property
    def tatoeba_stage_path(self) -> Path:
        return self.tatoeba_data_dir / self.tatoeba_stage_filename

    @property
    def tatoeba_checkpoint_path(self) -> Path:
        return self.checkpoint_dir / "tatoeba.json"

    @property
    def tts_checkpoint_path(self) -> Path:
        return self.checkpoint_dir / "tts.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
