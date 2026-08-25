#!/usr/bin/env python3
"""Validate GPT_DUDAS Plan Viewer JSON without external dependencies."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


CANONICAL_SCHEMA_URL = "https://ddadda69.github.io/GPT_DUDAS/data/schema.json"
PLAN_KEYS = {"$schema", "id", "version", "title", "description", "sections"}
SECTION_KEYS = {
    "id", "title", "description", "options", "defaultOption",
    "allowOther", "allowNote", "noteLabel", "notePlaceholder",
}
OPTION_KEYS = {"id", "text", "recommended"}
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class ValidationError(ValueError):
    pass


def fail(path: str, message: str) -> None:
    raise ValidationError(f"{path}: {message}")


def is_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def require_string(
    obj: dict[str, Any], key: str, path: str, *, nonempty: bool = False
) -> str:
    value = obj.get(key)
    if not isinstance(value, str):
        fail(f"{path}.{key}", "debe ser texto")
    if nonempty and not value.strip():
        fail(f"{path}.{key}", "no puede estar vacío")
    return value


def optional_string(obj: dict[str, Any], key: str, path: str) -> None:
    if key in obj and not isinstance(obj[key], str):
        fail(f"{path}.{key}", "debe ser texto")


def optional_bool(obj: dict[str, Any], key: str, path: str) -> None:
    if key in obj and not isinstance(obj[key], bool):
        fail(f"{path}.{key}", "debe ser booleano")


def require_safe_id(value: Any, path: str) -> str:
    if not isinstance(value, str) or not SAFE_ID_RE.fullmatch(value):
        fail(
            path,
            "debe empezar por letra o número, usar solo letras, números, punto, guion o guion bajo y tener como máximo 128 caracteres",
        )
    return value


def validate_option(option: Any, path: str, expected_id: int) -> bool:
    if not isinstance(option, dict):
        fail(path, "debe ser un objeto")
    extra = set(option) - OPTION_KEYS
    if extra:
        fail(path, f"campos no permitidos: {sorted(extra)}")

    option_id = option.get("id")
    if not is_integer(option_id) or option_id != expected_id:
        fail(f"{path}.id", f"debe ser exactamente {expected_id}")
    require_string(option, "text", path, nonempty=True)
    optional_bool(option, "recommended", path)
    return option.get("recommended") is True


def validate_section(section: Any, index: int) -> str:
    path = f"$.sections[{index}]"
    if not isinstance(section, dict):
        fail(path, "debe ser un objeto")
    extra = set(section) - SECTION_KEYS
    if extra:
        fail(path, f"campos no permitidos: {sorted(extra)}")

    section_id = require_safe_id(section.get("id"), f"{path}.id")
    require_string(section, "title", path, nonempty=True)
    optional_string(section, "description", path)
    optional_string(section, "noteLabel", path)
    optional_string(section, "notePlaceholder", path)
    optional_bool(section, "allowOther", path)
    optional_bool(section, "allowNote", path)

    options = section.get("options")
    if not isinstance(options, list) or not 1 <= len(options) <= 2:
        fail(f"{path}.options", "debe contener una o dos opciones")

    recommended_ids = []
    for option_index, option in enumerate(options, start=1):
        if validate_option(option, f"{path}.options[{option_index - 1}]", option_index):
            recommended_ids.append(option_index)

    default_option = section.get("defaultOption")
    if not is_integer(default_option) or default_option not in range(1, len(options) + 1):
        fail(f"{path}.defaultOption", "debe coincidir con una opción existente")

    if recommended_ids != [default_option]:
        fail(
            f"{path}.options",
            "debe existir exactamente una opción recommended=true y debe coincidir con defaultOption",
        )

    return section_id


def validate_plan(plan: Any) -> None:
    if not isinstance(plan, dict):
        fail("$", "debe ser un objeto")
    extra = set(plan) - PLAN_KEYS
    if extra:
        fail("$", f"campos no permitidos: {sorted(extra)}")

    for required in ("$schema", "id", "version", "title", "sections"):
        if required not in plan:
            fail("$", f"falta el campo obligatorio {required}")

    if plan["$schema"] != CANONICAL_SCHEMA_URL:
        fail("$.$schema", f"debe ser exactamente {CANONICAL_SCHEMA_URL!r}")
    require_safe_id(plan.get("id"), "$.id")
    require_string(plan, "title", "$", nonempty=True)
    optional_string(plan, "description", "$")

    if not is_integer(plan["version"]) or plan["version"] < 1:
        fail("$.version", "debe ser un entero mayor o igual que 1")

    sections = plan["sections"]
    if not isinstance(sections, list) or not sections:
        fail("$.sections", "debe ser una lista no vacía")

    section_ids = [validate_section(section, index) for index, section in enumerate(sections)]
    if len(section_ids) != len(set(section_ids)):
        fail("$.sections", "los id de sección deben ser únicos")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path, help="Archivo JSON que se validará")
    parser.add_argument(
        "--expected-id",
        help="Si se indica, exige que el id del JSON coincida exactamente con este valor",
    )
    args = parser.parse_args()

    try:
        with args.plan.open("r", encoding="utf-8-sig") as handle:
            plan = json.load(handle)
        validate_plan(plan)
        if args.expected_id is not None and plan["id"] != args.expected_id:
            fail("$.id", f"debe coincidir con el id esperado {args.expected_id!r}")
    except (OSError, json.JSONDecodeError, ValidationError) as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print(f"[OK] Plan válido: {args.plan}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
