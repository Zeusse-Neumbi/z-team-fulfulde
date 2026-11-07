from __future__ import annotations

from functools import lru_cache


class StubMT:
    name = "stub"

    def translate(self, text: str, source: str, target: str) -> tuple[str, bool, str]:
        # The scaffold never invents a translation. Novel text stays untouched
        # until a validated TM entry or the optional local Marian model exists.
        return text, False, "none"


class MarianMT:
    """Local CTranslate2 Marian backend, loaded only when configured."""

    name = "marian"

    def __init__(self, model_path: str) -> None:
        import ctranslate2
        from transformers import AutoTokenizer

        self._translator = ctranslate2.Translator(model_path, device="cpu")
        self._tokenizer = AutoTokenizer.from_pretrained(model_path)

    def translate(self, text: str, source: str, target: str) -> tuple[str, bool, str]:
        tokens = self._tokenizer.convert_ids_to_tokens(self._tokenizer.encode(text))
        results = self._translator.translate_batch([tokens], beam_size=2)
        output = results[0].hypotheses[0]
        translated = self._tokenizer.decode(self._tokenizer.convert_tokens_to_ids(output))
        return translated, True, "marian"


@lru_cache(maxsize=1)
def get_mt(backend: str, model_path: str) -> StubMT | MarianMT:
    if backend == "marian":
        return MarianMT(model_path)
    return StubMT()
