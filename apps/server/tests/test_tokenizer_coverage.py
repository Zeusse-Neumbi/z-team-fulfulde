"""Tests for scripts/check-tokenizer-coverage.py.

The guard is the artifact that would have caught the original defect, so it is
tested against both a complete and an incomplete fixture vocab.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "check-tokenizer-coverage.py"
COMPLETE = "abcdefghijklmnoprstuwyɛɔɓɗƴŋɲʼ"


def _load_module():
    spec = importlib.util.spec_from_file_location("check_tokenizer_coverage", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _vocab(path: Path, text: str) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    (path / "vocab.json").write_text(
        json.dumps({char: index for index, char in enumerate(text)}),
        encoding="utf-8",
    )
    return path


def test_complete_vocab_passes(tmp_path, capsys):
    module = _load_module()
    model = _vocab(tmp_path / "complete", COMPLETE)

    code = module.main(["--lang", "fub", "--model", str(model)])

    assert code == 0
    out = capsys.readouterr().out
    assert "status=pass" in out
    assert "missing=none" in out


def test_incomplete_vocab_fails_with_the_dropped_letters(tmp_path, capsys):
    module = _load_module()
    model = _vocab(tmp_path / "incomplete", "abcdefghijklmnoprstuwyŋƴɓɗ")

    code = module.main(["--lang", "fub", "--model", str(model)])

    assert code == 1
    out = capsys.readouterr().out
    assert "missing: ɛ ɔ ɲ ʼ" in out
    assert "tone: none" in out
    assert "status=fail" in out


def test_warn_only_never_blocks(tmp_path, capsys):
    module = _load_module()
    model = _vocab(tmp_path / "incomplete", "abc")

    code = module.main(["--lang", "fub", "--model", str(model), "--warn-only"])

    assert code == 0
    assert "status=warn" in capsys.readouterr().out


def test_missing_vocab_is_skipped_when_warn_only(tmp_path, capsys):
    module = _load_module()

    code = module.main(["--lang", "fub", "--model", str(tmp_path / "absent"), "--warn-only"])

    assert code == 0
    assert "status=skipped" in capsys.readouterr().out


def test_missing_vocab_is_an_error_when_blocking(tmp_path):
    module = _load_module()

    code = module.main(["--lang", "fub", "--model", str(tmp_path / "absent")])

    assert code == 2


def test_cli_exit_code_on_an_incomplete_vocab(tmp_path):
    model = _vocab(tmp_path / "incomplete", "abcdefghijklmnoprstuwyŋƴɓɗ")

    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--lang", "fub", "--model", str(model)],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 1
    assert "missing: ɛ ɔ ɲ ʼ" in result.stdout
