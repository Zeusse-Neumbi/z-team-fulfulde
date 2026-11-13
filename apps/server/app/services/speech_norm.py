from __future__ import annotations

import unicodedata

# Grapheme substitutions applied ONLY to speech input, never to displayed
# text. A voice whose tokenizer lacks a letter drops it entirely, which
# destroys the word; substituting the nearest available grapheme keeps the
# word shape at the cost of pronunciation accuracy.
#
# Measured on `models/mms-tts-ful` (41-entry vocab): `ɛ`, `ɔ`, `ɲ`, `ʼ` and
# every tone mark are absent, so `nɛɛsa` became `|n|s|a|` and `ɲaamdu`
# `|a|a|m|d|u|`. In contrast `ŋ`, `ƴ`, `ɓ` and `ɗ` ARE in the vocab, so they
# are preserved: mapping `ƴ` to `y` would throw away a sound the voice can
# say. Reproduce with scripts/check-tokenizer-coverage.py.
#
# Measured on `models/mms-tts-ybb` (46 pieces, 27/28 letters, missing `r`):
# `ɲ`, `Ɲ` and `ꞌ` are absent, while `ʼ`, `ɛ`, `ɔ`, `ŋ` and the high/mid tone
# marks are present. Map the missing `ɲ`/`Ɲ` to `ny`/`Ny`, map `ꞌ` to the
# modifier apostrophe the voice has, and keep the tones.
SPEECH_SUBSTITUTIONS: dict[str, dict[str, str]] = {
    "fub": {"ɛ": "e", "ɔ": "o", "ɲ": "ny", "ʼ": "'", "ꞌ": "'"},
    "ybb": {"ɲ": "ny", "Ɲ": "Ny", "ꞌ": "ʼ"},
}

# Voices with no tone inventory. Yemba's tokenizer has high and mid tone marks,
# so folding them would throw away a distinction the voice can say.
TONE_FOLD = {"fub"}


def _fold_tones(text: str) -> str:
    """Drop combining diacritics: the voice has no tone, and an unmarked vowel
    is audible where a marked one was silently discarded."""
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(char for char in decomposed if not unicodedata.combining(char))
    return unicodedata.normalize("NFC", stripped)


def normalize_for_speech(lang: str, text: str) -> str:
    """Map a language's graphemes onto the ones the configured voice can say.

    Unknown languages are returned unchanged apart from NBSP collapsing: never
    guess a substitution for a language we have not measured.
    """
    if lang in TONE_FOLD:
        text = _fold_tones(text)
    table = SPEECH_SUBSTITUTIONS.get(lang)
    if table is not None:
        for source, target in table.items():
            text = text.replace(source, target)
    return text.replace("\u00a0", " ").replace("\u202f", " ")
