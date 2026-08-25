#!/usr/bin/env python3
"""Validate GPT_DUDAS Plan Viewer JSON without external dependencies."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT_KEYS = {"$schema", "id", "version", "title", "description", "sections"}
BASE_SECTION_KEYS = {
    "id", "title", "description", "type", "allowNote", "noteLabel",
    "notePlaceholder",
}
TYPE_KEYS = {
    "single": {"options", "defaultOption", "allowOther", "defaultOther"},
    "multiple": {"options", "defaultOptions", "allowOther", "defaultOther"},
    "text": {"rows", "placeholder", "defaultValue"},
    "boolean": {"default", "trueLabel", "falseLabel"},
}
OPTION_KEYS = {"id", "text", "recommended", "selected"}
PLAN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class ValidationError(ValueError):
    pass


def fail(path: str, message: str) -> None:
    raise ValidationError(f"{path}: {message}")


def is_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def is_option_id(value: Any) -> bool:
    return is_integer(value) or (isinstance(value, str) and bool(value))


def require_string(
    obj: dict[str, Any], key: str, path: str, *, nonempty: bool = False
) -> None:
    value = obj.get(key)
    if not isinstance(value, str):
        fail(f"{path}.{key}", "debe ser texto")
    if nonempty and not value:
        fail(f"{path}.{key}", "no puede estar vacío")


def optional_string(obj: dict[str, Any], key: str, path: str) -> None:
    if key in obj and not isinstance(obj[key], str):
        fail(f"{path}.{key}", "debe ser texto")


def optional_bool(obj: dict[str, Any], key: str, path: str) -> None:
    if key in obj and not isinstance(obj[key], bool):
        fail(f"{path}.{key}", "debe ser booleano")


def validate_option(option: Any, path: str) -> Any:
    if not isinstance(option, dict):
        fail(path, "debe ser un objeto")
    extra = set(option) - OPTION_KEYS
    if extra:
        fail(path, f"campos no permitidos: {sorted(extra)}")
    if "id" not in option or not is_option_id(option["id"]):
        fail(f"{path}.id", "debe ser un entero o texto no vacío")
    require_string(option, "text", path)
    optional_bool(option, "recommended", path)
    optional_bool(option, "selected", path)
    return option["id"]


def validate_section(section: Any, index: int) -> None:
    path = f"$.sections[{index}]"
    if not isinstance(section, dict):
        fail(path, "debe ser un objeto")
    section_type = section.get("type")
    if section_type not in TYPE_KEYS:
        fail(f"{path}.type", "debe ser single, multiple, text o boolean")
    allowed = BASE_SECTION_KEYS | TYPE_KEYS[section_type]
    extra = set(section) - allowed
    if extra:
        fail(path, f"campos no permitidos para {section_type}: {sorted(extra)}")

    require_string(section, "id", path, nonempty=True)
    require_string(section, "title", path, nonempty=True)
    optional_string(section, "description", path)
    optional_string(section, "noteLabel", path)
    optional_string(section, "notePlaceholder", path)
    optional_bool(section, "allowNote", path)

    if section_type in {"single", "multiple"}:
        options = section.get("options")
        if not isinstance(options, list) or not options:
            fail(f"{path}.options", "debe ser una lista no vacía")
        option_ids = [
            validate_option(option, f"{path}.options[{option_index}]")
            for option_index, option in enumerate(options)
        ]
        optional_bool(section, "allowOther", path)
        optional_bool(section, "defaultOther", path)

        if section_type == "single" and "defaultOption" in section:
            default_option = section["defaultOption"]
            if not is_option_id(default_option):
                fail(f"{path}.defaultOption", "debe ser un identificador válido")
            if default_option not in option_ids:
                fail(f"{path}.defaultOption", "no coincide con ninguna opción")

        if section_type == "multiple" and "defaultOptions" in section:
            defaults = section["defaultOptions"]
            if not isinstance(defaults, list):
                fail(f"{path}.defaultOptions", "debe ser una lista")
            if any(not is_option_id(value) for value in defaults):
                fail(f"{path}.defaultOptions", "contiene un identificador inválido")
            typed_defaults = {(type(value).__name__, value) for value in defaults}
            if len(typed_defaults) != len(defaults):
                fail(f"{path}.defaultOptions", "no admite duplicados")
            if any(value not in option_ids for value in defaults):
                fail(f"{path}.defaultOptions", "contiene una opción inexistente")

    elif section_type == "text":
        if "rows" in section:
            rows = section["rows"]
            if not is_integer(rows) or rows < 1:
                fail(f"{path}.rows", "debe ser un entero mayor o igual que 1")
        optional_string(section, "placeholder", path)
        optional_string(section, "defaultValue", path)

    elif section_type == "boolean":
        optional_bool(section, "default", path)
        optional_string(section, "trueLabel", path)
        optional_string(section, "falseLabel", path)


def validate_plan(plan: Any) -> None:
    if not isinstance(plan, dict):
        fail("$", "debe ser un objeto")
    extra = set(plan) - ROOT_KEYS
    if extra:
        fail("$", f"campos no permitidos: {sorted(extra)}")
    for required in ("id", "version", "title", "sections"):
        if required not in plan:
            fail("$", f"falta el campo obligatorio {required}")

    optional_string(plan, "$schema", "$")
    require_string(plan, "id", "$", nonempty=True)
    if not PLAN_ID_RE.fullmatch(plan["id"]):
        fail(
            "$.id",
            "solo admite letras, números, punto, guion y guion bajo, debe empezar por letra o número y tener como máximo 128 caracteres",
        )
    require_string(plan, "title", "$", nonempty=True)
    optional_string(plan, "description", "$")
    if not is_integer(plan["version"]) or plan["version"] < 1:
        fail("$.version", "debe ser un entero mayor o igual que 1")
    if not isinstance(plan["sections"], list) or not plan["sections"]:
        fail("$.sections", "debe ser una lista no vacía")
    for index, section in enumerate(plan["sections"]):
        validate_section(section, index)


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
