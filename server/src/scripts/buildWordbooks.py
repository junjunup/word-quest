#!/usr/bin/env python3
"""Build traceable Word Quest wordbooks from public JSONL zip sources.

The source archives are mirrored by the kajweb-dicts repository. The script keeps
source metadata and SHA-256 checksums so enterprise imports can be audited.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

BASE_URL = "https://raw.githubusercontent.com/jadyyang/kajweb-dicts/master/book"
SCRIPT_DIR = Path(__file__).resolve().parent
SERVER_SRC = SCRIPT_DIR.parent
OUTPUT_DIR = SERVER_SRC / "data" / "wordbooks"
MANIFEST_PATH = OUTPUT_DIR / "source-manifest.json"

@dataclass(frozen=True)
class SourceFile:
    file_name: str
    expected_book_id: str

@dataclass(frozen=True)
class WordbookSpec:
    wordbook_id: str
    wordbook_name: str
    sources: tuple[SourceFile, ...]
    max_words: int | None = None

WORDBOOKS = (
    WordbookSpec(
        wordbook_id="cet4",
        wordbook_name="CET-4 真题核心词库（4500）",
        sources=(
            SourceFile("1521164649209_CET4_1.zip", "CET4_1"),
            SourceFile("1521164635506_CET4_2.zip", "CET4_2"),
            SourceFile("1521164643060_CET4_3.zip", "CET4_3"),
        ),
    ),
    WordbookSpec(
        wordbook_id="cet4_core_2000",
        wordbook_name="CET-4 高频核心词库（2000）",
        sources=(
            SourceFile("1521164649209_CET4_1.zip", "CET4_1"),
            SourceFile("1521164635506_CET4_2.zip", "CET4_2"),
            SourceFile("1521164643060_CET4_3.zip", "CET4_3"),
        ),
        max_words=2000,
    ),
    WordbookSpec(
        wordbook_id="cet6",
        wordbook_name="CET-6 真题核心词库",
        sources=(
            SourceFile("1521164668667_CET6_1.zip", "CET6_1"),
            SourceFile("1524052554766_CET6_2.zip", "CET6_2"),
            SourceFile("1521164633851_CET6_3.zip", "CET6_3"),
        ),
    ),
    WordbookSpec(
        wordbook_id="postgraduate",
        wordbook_name="考研英语真题核心词库",
        sources=(
            SourceFile("1521164669833_KaoYan_1.zip", "KaoYan_1"),
            SourceFile("1521164654696_KaoYan_2.zip", "KaoYan_2"),
            SourceFile("1521164658897_KaoYan_3.zip", "KaoYan_3"),
        ),
    ),
)



def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "WordQuest-WordbookBuilder/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def as_text(value: Any) -> str:
    return str(value or "").replace("<b>", "").replace("</b>", "").strip()


def safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def extract_records(archive_bytes: bytes) -> list[dict[str, Any]]:
    with zipfile.ZipFile(PathLikeBytes(archive_bytes)) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith(".json")]
        if not names:
            raise ValueError("archive does not contain a JSON payload")
        raw = archive.read(names[0]).decode("utf-8")
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(raw.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSONL at line {line_number}: {exc}") from exc
    return records


class PathLikeBytes:
    """Small adapter so zipfile can read immutable bytes without extra deps."""

    def __init__(self, data: bytes):
        from io import BytesIO
        self._buffer = BytesIO(data)

    def read(self, *args: Any) -> bytes:
        return self._buffer.read(*args)

    def seek(self, *args: Any) -> int:
        return self._buffer.seek(*args)

    def tell(self) -> int:
        return self._buffer.tell()

    def seekable(self) -> bool:
        return True


def transform_record(raw: dict[str, Any], spec: WordbookSpec, source_file: str, order_index: int, total_count: int) -> dict[str, Any] | None:
    content = raw.get("content", {}).get("word", {}).get("content", {}) if isinstance(raw.get("content"), dict) else {}
    word = as_text(raw.get("headWord") or content.get("wordHead"))
    if not word:
        return None

    translations = []
    part_of_speech = ""
    for item in safe_list(content.get("trans")):
        pos = as_text(item.get("pos"))
        tran = as_text(item.get("tranCn"))
        if tran:
            translations.append(f"{pos}. {tran}" if pos else tran)
        if pos and not part_of_speech:
            part_of_speech = f"{pos}." if not pos.endswith(".") else pos
    meaning = "；".join(dict.fromkeys(translations)) or "待补充释义"

    sentence = {}
    sentences = content.get("sentence", {}).get("sentences", []) if isinstance(content.get("sentence"), dict) else []
    if sentences:
        sentence = sentences[0]

    synonyms: list[str] = []
    syno = content.get("syno", {}) if isinstance(content.get("syno"), dict) else {}
    for syn in safe_list(syno.get("synos")):
        for hwd in safe_list(syn.get("hwds")):
            value = as_text(hwd.get("w"))
            if value and value.lower() != word.lower():
                synonyms.append(value)

    antonyms: list[str] = []
    anto = content.get("anto", {}) if isinstance(content.get("anto"), dict) else {}
    for ant in safe_list(anto.get("antos")):
        for hwd in safe_list(ant.get("hwds")):
            value = as_text(hwd.get("w"))
            if value:
                antonyms.append(value)

    rel_words = []
    rel = content.get("relWord", {}) if isinstance(content.get("relWord"), dict) else {}
    for rel_group in safe_list(rel.get("rels"))[:3]:
        pos = as_text(rel_group.get("pos"))
        for rel_word in safe_list(rel_group.get("words"))[:3]:
            hwd = as_text(rel_word.get("hwd"))
            tran = as_text(rel_word.get("tran"))
            if hwd:
                rel_words.append(f"{pos} {hwd}: {tran}".strip())

    rank = order_index + 1
    chapter = min(6, max(1, math.ceil(rank / max(1, total_count) * 6)))
    level_within_book = min(180, max(1, math.ceil(rank / max(1, total_count) * 180)))
    level = ((level_within_book - 1) % 30) + 1
    difficulty = min(5, max(1, math.ceil(rank / max(1, total_count) * 5)))

    phone = as_text(content.get("usphone") or content.get("ukphone") or content.get("phone"))
    phonetic = f"/{phone}/" if phone and not phone.startswith("/") else phone

    return {
        "wordbookId": spec.wordbook_id,
        "wordbookName": spec.wordbook_name,
        "word": word,
        "phonetic": phonetic,
        "meaning": meaning,
        "partOfSpeech": part_of_speech or "",
        "example": as_text(sentence.get("sContent")),
        "exampleTranslation": as_text(sentence.get("sCn")),
        "difficulty": difficulty,
        "chapter": chapter,
        "level": level,
        "synonyms": list(dict.fromkeys(synonyms))[:8],
        "antonyms": list(dict.fromkeys(antonyms))[:8],
        "rootAnalysis": "；".join(rel_words)[:500],
        "memoryTip": f"源词书 {raw.get('bookId') or spec.wordbook_id} / rank {raw.get('wordRank') or rank} / file {source_file}",
        "category": spec.wordbook_id,
        "source": {
            "provider": "jadyyang/kajweb-dicts",
            "sourceFile": source_file,
            "sourceBookId": raw.get("bookId") or "",
            "sourceWordId": content.get("wordId") or "",
            "sourceRank": raw.get("wordRank") or rank,
        },
    }


def build_wordbook(spec: WordbookSpec, cache_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    source_meta = []
    unique: dict[str, dict[str, Any]] = {}
    source_order: list[tuple[dict[str, Any], str]] = []

    for source in spec.sources:
        url = f"{BASE_URL}/{source.file_name}"
        cache_path = cache_dir / source.file_name
        if cache_path.exists():
            archive_bytes = cache_path.read_bytes()
        else:
            print(f"Downloading {url}")
            archive_bytes = download(url)
            cache_path.write_bytes(archive_bytes)
        sha256 = hashlib.sha256(archive_bytes).hexdigest()
        records = extract_records(archive_bytes)
        source_meta.append({
            "fileName": source.file_name,
            "url": url,
            "sha256": sha256,
            "rawRecords": len(records),
            "expectedBookId": source.expected_book_id,
        })
        for record in records:
            word_key = as_text(record.get("headWord")).lower()
            if word_key and word_key not in unique:
                unique[word_key] = record
                source_order.append((record, source.file_name))

    if spec.max_words:
        source_order = source_order[:spec.max_words]
    total = len(source_order)
    words = [
        transformed for index, (record, source_file) in enumerate(source_order)
        if (transformed := transform_record(record, spec, source_file, index, total)) is not None
    ]
    return words, source_meta


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    built_at = datetime.now(timezone.utc).isoformat()
    manifest = {
        "generatedAt": built_at,
        "generator": "server/src/scripts/buildWordbooks.py",
        "sourceRepository": "https://github.com/jadyyang/kajweb-dicts",
        "sourceNote": "Public vocabulary JSONL archives transformed into Word Quest schema. Review upstream license/compliance before external redistribution.",
        "wordbooks": [],
    }

    with TemporaryDirectory(prefix="wordquest-wordbooks-") as tmp:
        cache_dir = Path(tmp)
        for spec in WORDBOOKS:
            words, source_meta = build_wordbook(spec, cache_dir)
            output_path = OUTPUT_DIR / f"{spec.wordbook_id}.json"
            output_path.write_text(json.dumps(words, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            digest = hashlib.sha256(output_path.read_bytes()).hexdigest()
            manifest["wordbooks"].append({
                "wordbookId": spec.wordbook_id,
                "wordbookName": spec.wordbook_name,
                "wordCount": len(words),
                "outputFile": str(output_path.relative_to(SERVER_SRC)).replace("\\", "/"),
                "outputSha256": digest,
                "maxWords": spec.max_words,
                "sources": source_meta,
            })
            print(f"Built {spec.wordbook_id}: {len(words)} words -> {output_path}")

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Manifest -> {MANIFEST_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
