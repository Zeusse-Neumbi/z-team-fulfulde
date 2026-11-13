"""Speech normalizer and MMS wiring tests.

`MMSTTS` needs torch and a 145 MB checkpoint, so the class is built with the
loader bypassed: the tokenizer records exactly what would have been synthesized.
"""

from __future__ import annotations

import pytest

from app.services.speech_norm import normalize_for_speech
from app.services.tts import MMSTTS


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("nɛɛsa", "neesa"),
        ("ɲaamdu", "nyaamdu"),
        # ŋ, ƴ, ɓ and ɗ are in the MMS vocab: they must survive.
        ("ƴeewndo", "ƴeewndo"),
        ("jaŋngu ɓe", "jaŋngu ɓe"),
        ("ko ɔɗum", "ko oɗum"),
        ("nángu yāa", "nangu yaa"),
        ("nɛ́ɛsa", "neesa"),
        ("jaŋngu ʼe", "jaŋngu 'e"),
        ("jaŋngu ꞌe", "jaŋngu 'e"),
    ],
)
def test_fub_substitutions(source, expected):
    assert normalize_for_speech("fub", source) == expected


def test_nbsp_and_narrow_nbsp_collapse():
    assert normalize_for_speech("fub", "250\u00a0000\u202fFCFA") == "250 000 FCFA"


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("ɲaamdu", "nyaamdu"),
        ("Ɲaamdu", "Nyaamdu"),
        ("jaŋngu ꞌe", "jaŋngu ʼe"),
        # ʼ, ɛ, ɔ and ŋ are in the Yemba vocab: keep them.
        ("ʼe ɛ́jɛ́ɛ ŋgɔ́", "ʼe ɛ́jɛ́ɛ ŋgɔ́"),
    ],
)
def test_ybb_substitutions(source, expected):
    assert normalize_for_speech("ybb", source) == expected


def test_ybb_keeps_its_tone_marks():
    # The Yemba tokenizer has high and mid tone, unlike fub.
    assert normalize_for_speech("ybb", "ŋgɔ́ áā") == "ŋgɔ́ áā"


def test_unknown_language_is_unchanged():
    text = "nɛɛsa ɲaamdu ɔ"
    assert normalize_for_speech("deu", text) == text


class _Batch(dict):
    def to(self, device):  # noqa: ARG002
        return self


class _Waveform:
    def squeeze(self):
        return self

    def cpu(self):
        return self

    def numpy(self):
        return self

    def clip(self, low, high):  # noqa: ARG002
        return self

    def __mul__(self, other):  # noqa: ARG002
        return self

    def astype(self, dtype):  # noqa: ARG002
        return self

    def tobytes(self):
        return b"\x00\x00" * 16


class _Output:
    waveform = _Waveform()


class _Model:
    def __call__(self, **inputs):  # noqa: ARG002
        return _Output()


class _Torch:
    @staticmethod
    def no_grad():
        import contextlib

        return contextlib.nullcontext()


class _RecordingTokenizer:
    def __init__(self):
        self.seen: str | None = None

    def __call__(self, text, return_tensors=None):  # noqa: ARG002
        self.seen = text
        return _Batch()


def _mms(lang: str) -> tuple[MMSTTS, _RecordingTokenizer]:
    tokenizer = _RecordingTokenizer()
    tts = MMSTTS.__new__(MMSTTS)
    tts._torch = _Torch()
    tts._device = "cpu"
    tts._tokenizer = tokenizer
    tts._model = _Model()
    tts._sample_rate = 16_000
    tts._lang = lang
    tts.model = "fake-mms"
    return tts, tokenizer


def test_mms_synthesizes_the_normalized_text():
    tts, tokenizer = _mms("fub")

    result = tts.synthesize("Nɛɛsa ɲaamdu", "demo", 1.0)

    assert tokenizer.seen == "Neesa nyaamdu"
    assert not ({"ɛ", "ɔ", "ɲ"} & set(tokenizer.seen or ""))
    assert result.audio[:4] == b"RIFF"
    assert result.sample_rate == 16_000


def test_mms_normalizes_ybb():
    tts, tokenizer = _mms("ybb")

    tts.synthesize("Ɲaamdu ꞌe ŋgɔ́", "demo", 1.0)

    assert tokenizer.seen == "Nyaamdu ʼe ŋgɔ́"


def test_mms_leaves_an_unmeasured_language_alone():
    tts, tokenizer = _mms("deu")

    tts.synthesize("nɛɛsa", "demo", 1.0)

    assert tokenizer.seen == "nɛɛsa"
