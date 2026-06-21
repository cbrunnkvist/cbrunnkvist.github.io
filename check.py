# /// script
# dependencies = [
#   "markdown",
#   "Pygments",
#   "PyYAML",
# ]
# ///

from __future__ import annotations

import os
import py_compile
import re
import shutil
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
PYTHON_FILES = [ROOT / "build.py", ROOT / "dev.py", ROOT / "check.py"]
GENERATED_PLACEHOLDER = re.compile(r"\{\{[^}]+\}\}")
CODEHILITE_BLOCK = re.compile(r'<div class="codehilite">.*?</div>|<pre class="codehilite">.*?</pre>', re.DOTALL)
PYGMENTS_TOKEN = re.compile(r'<span class="[a-z][a-z0-9]*">')


def compile_python() -> None:
    for path in PYTHON_FILES:
        py_compile.compile(path, doraise=True)


def assert_exists(path: Path) -> None:
    if not path.exists():
        raise AssertionError(f"missing generated file: {path.relative_to(ROOT)}")


def source_slugs(category: str) -> list[str]:
    slugs = []
    for path in sorted((CONTENT / category).glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        if "\ndraft: true\n" in raw or "\ndraft: True\n" in raw:
            continue
        slugs.append(path.stem)
    return slugs


def assert_no_placeholders(out_dir: Path) -> None:
    for path in sorted(out_dir.rglob("*")):
        if path.suffix not in {".html", ".json"}:
            continue
        content = path.read_text(encoding="utf-8")
        match = GENERATED_PLACEHOLDER.search(content)
        if match:
            relative = path.relative_to(out_dir)
            raise AssertionError(f"unresolved template placeholder in {relative}: {match.group(0)}")


def assert_code_blocks_highlighted(out_dir: Path) -> None:
    for path in sorted(out_dir.rglob("*.html")):
        content = path.read_text(encoding="utf-8")
        for block in CODEHILITE_BLOCK.findall(content):
            if "language-" in block and not PYGMENTS_TOKEN.search(block):
                relative = path.relative_to(out_dir)
                raise AssertionError(f"codehilite block lacks syntax tokens in {relative}")


def build_and_verify() -> None:
    with tempfile.TemporaryDirectory(prefix="frontier-site-check-") as tmp:
        out_dir = Path(tmp)
        os.environ["SITE_OUT_DIR"] = str(out_dir)

        import build

        build.OUT_DIR = out_dir
        build.build()

        assert_exists(out_dir / "index.html")
        assert_exists(out_dir / "tag-index.json")
        assert_exists(out_dir / "log" / "index.html")
        assert_exists(out_dir / "projects" / "index.html")

        for slug in source_slugs("posts"):
            assert_exists(out_dir / "log" / slug / "index.html")

        for slug in source_slugs("projects"):
            assert_exists(out_dir / "projects" / slug / "index.html")

        assert_no_placeholders(out_dir)
        assert_code_blocks_highlighted(out_dir)


def main() -> int:
    compile_python()
    build_and_verify()
    print("[check] python compilation, content build, routes, placeholders, and code highlighting OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
