# Restaurar la habilidad Plan Viewer

Esta carpeta contiene una copia completa y restaurable de la habilidad personal `plan-viewer`, realizada el **25 de agosto de 2026**.

La copia no se activa dentro de este repositorio: está deliberadamente guardada en `skill-backups/` y no en `.agents/skills/`. Tampoco modifica el Viewer ni los archivos de `data/`.

## Contenido

```text
skill/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   └── validate_plan.py
└── references/
    ├── schema.json
    └── example.json
```

## Restauración

### Opción 1: Skill Installer

Desde Codex, solicita:

```text
$skill-installer instala la habilidad desde ddadda69/GPT_DUDAS,
ruta skill-backups/plan-viewer/skill
```

Si la copia todavía está únicamente en la rama de respaldo, indica también la rama `backup-plan-viewer-skill`.

### Opción 2: copia manual

1. Descarga la carpeta `skill` de este respaldo.
2. Crea la carpeta personal de habilidades si no existe.
3. Copia el contenido de `skill` en:

```text
Windows: %USERPROFILE%\.agents\skills\plan-viewer
macOS/Linux: $HOME/.agents/skills/plan-viewer
```

4. Reinicia Codex o la aplicación de escritorio si la habilidad no aparece inmediatamente.

## Uso después de restaurarla

- En Codex: `$plan-viewer`.
- En ChatGPT de escritorio: `@Plan Viewer`.
- También puede activarse automáticamente cuando se pide un plan complejo, una propuesta de implementación o un refactor importante.

## Dependencias y permisos

- La publicación usa el repositorio `ddadda69/GPT_DUDAS`, rama `main`.
- Requiere una conexión de GitHub autenticada como `ddadda69` con permiso para actualizar `data/current.json`.
- `scripts/validate_plan.py` funciona con Python 3 y no necesita paquetes externos.
- No se incluyen tokens, claves, contraseñas ni credenciales.

Documentación oficial: https://learn.chatgpt.com/docs/build-skills