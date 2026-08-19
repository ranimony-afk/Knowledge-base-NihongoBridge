from __future__ import annotations

import random
import re
import unicodedata
from collections.abc import Iterable

from etl.generators.models import QuestionOption

_OPTION_IDS = ("a", "b", "c", "d")


class QuestionGenerationError(RuntimeError):
    """Raised when the knowledge base cannot support the requested question count."""


def normalize(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip()


def unique_texts(values: Iterable[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = normalize(value)
        key = cleaned.casefold()
        if cleaned and key not in seen:
            seen.add(key)
            output.append(cleaned)
    return output


def make_options(
    correct: str,
    distractors: Iterable[str],
    rng: random.Random,
    *,
    english_labels: dict[str, str] | None = None,
) -> tuple[list[QuestionOption], str]:
    candidates = unique_texts([correct, *distractors])
    if len(candidates) < 4:
        raise QuestionGenerationError("Fewer than four unique answer choices are available")
    selected = [candidates[0], *rng.sample(candidates[1:], 3)]
    rng.shuffle(selected)
    options = [
        QuestionOption(
            id=_OPTION_IDS[index],
            text_jp=value,
            text_en=(english_labels or {}).get(value, ""),
        )
        for index, value in enumerate(selected)
    ]
    correct_id = next(option.id for option in options if option.text_jp == normalize(correct))
    return options, correct_id


def provenance(source_ids: Iterable[str], *, method: str) -> dict[str, object]:
    return {
        "kind": "knowledge-base-synthesis",
        "method": method,
        "source_ids": list(dict.fromkeys(str(value) for value in source_ids)),
        "copyrighted_exam_content": False,
    }


def literal_grammar_pattern(pattern: str) -> str:
    value = normalize(pattern).translate(str.maketrans("", "", "\u301c\uff5e~\uff0a*"))
    value = re.sub(r"^[A-Za-z]+(?:-[A-Za-z]+)?", "", value)
    value = re.sub(r"[\uff08(\[].*?[\uff09)\]]", "", value)
    return value.strip()


def shared_character_score(left: str, right: str) -> int:
    return len(set(left) & set(right))


def reading_similarity(left: str, right: str) -> int:
    prefix = 0
    for first, second in zip(left, right, strict=False):
        if first != second:
            break
        prefix += 1
    suffix = 0
    for first, second in zip(reversed(left), reversed(right), strict=False):
        if first != second:
            break
        suffix += 1
    return prefix + suffix - abs(len(left) - len(right))
