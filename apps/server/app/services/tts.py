from __future__ import annotations

import io
import wave
from functools import lru_cache
from typing import Protocol


class TTSBackend(Protocol):
    name: str

    def synthesize(self, text: str, voice: str, speed: float) -> bytes: ...


class StubTTS:
    """Dependency-free placeholder that returns a short silent WAV.

    It exists so the extension, tests and demo plumbing can run before the
    speech extra and the fine-tuned model are installed.
    """

    name = "stub"

    def synthesize(self, text: str, voice: str, speed: float) -> bytes:
        sample_rate = 16_000
        duration = 0.2
        frames = int(sample_rate * duration)
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(b"\x00\x00" * frames)
        return buffer.getvalue()


class MMSTTS:
    """MMS/VITS backend. Loaded lazily only when ZTEAM_TTS_BACKEND=mms."""

    name = "mms"

    def __init__(self, model_name: str) -> None:
        import torch
        from transformers import AutoTokenizer, VitsModel

        self._torch = torch
        self._tokenizer = AutoTokenizer.from_pretrained(model_name)
        self._model = VitsModel.from_pretrained(model_name)
        self._model.eval()

    def synthesize(self, text: str, voice: str, speed: float) -> bytes:
        import numpy as np

        normalized = (
            text.replace("ɲ", "ny").replace("ꞌ", "'").replace("\u00a0", " ").replace("\u202f", " ")
        )
        inputs = self._tokenizer(normalized, return_tensors="pt")
        with self._torch.no_grad():
            waveform = self._model(**inputs).waveform.squeeze().numpy()
        pcm = np.clip(waveform, -1.0, 1.0)
        pcm = (pcm * 32767).astype(np.int16)
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(self._model.config.sampling_rate)
            wav.writeframes(pcm.tobytes())
        return buffer.getvalue()


@lru_cache(maxsize=1)
def get_tts(backend: str, model_name: str) -> TTSBackend:
    if backend == "mms":
        return MMSTTS(model_name)
    return StubTTS()
