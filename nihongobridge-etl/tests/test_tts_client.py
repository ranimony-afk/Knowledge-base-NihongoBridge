from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest

from etl.utils import tts_client
from etl.utils.tts_client import EdgeTTSClient


@pytest.mark.asyncio
async def test_tts_client_writes_atomically_with_mocked_edge(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, str]] = []

    class FakeCommunicate:
        def __init__(self, text: str, voice: str, **_: Any) -> None:
            calls.append((text, voice))

        async def save(self, path: str) -> None:
            await asyncio.to_thread(Path(path).write_bytes, b"fake-mp3")

    monkeypatch.setattr(tts_client.edge_tts, "Communicate", FakeCommunicate)
    client = EdgeTTSClient(requests_per_second=1000, retries=1)
    destination = tmp_path / "audio.mp3"

    result = await client.synthesize("水です。", destination)

    assert result == destination
    assert destination.read_bytes() == b"fake-mp3"
    assert calls == [("水です。", "ja-JP-NanamiNeural")]
    assert not destination.with_suffix(".part.mp3").exists()


@pytest.mark.asyncio
async def test_dialogue_alternates_female_and_male_voices(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from etl.utils.tts_client import DialogueLine

    client = EdgeTTSClient(requests_per_second=1000, retries=1)
    calls: list[str] = []

    async def fake_synthesize(
        text: str,
        output_path: Path,
        *,
        voice: str | None = None,
    ) -> Path:
        calls.append(str(voice))
        await asyncio.to_thread(output_path.write_bytes, text.encode())
        return output_path

    def fake_combine(_: list[Path], output_path: Path, __: int) -> None:
        output_path.write_bytes(b"dialogue")

    monkeypatch.setattr(client, "synthesize", fake_synthesize)
    monkeypatch.setattr(client, "_combine_audio", fake_combine)

    output = await client.synthesize_dialogue(
        [DialogueLine("一"), DialogueLine("二"), DialogueLine("三")],
        tmp_path / "dialogue.mp3",
    )

    assert output.read_bytes() == b"dialogue"
    assert calls == [
        "ja-JP-NanamiNeural",
        "ja-JP-KeitaNeural",
        "ja-JP-NanamiNeural",
    ]
