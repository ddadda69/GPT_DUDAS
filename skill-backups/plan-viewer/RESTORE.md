# Restaurar la habilidad Plan Viewer

Esta carpeta contiene una copia completa y restaurable de la habilidad personal `plan-viewer`, actualizada el **25 de agosto de 2026**.

La copia está deliberadamente fuera de `.agents/skills/`, no se activa por sí sola y no contiene credenciales.

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

### Skill Installer

Desde Codex:

```text
$skill-installer instala la habilidad desde ddadda69/GPT_DUDAS,
ruta skill-backups/plan-viewer/skill, rama main
```

### Copia manual

1. Descarga `skill-backups/plan-viewer/skill` desde `main`.
2. Copia su contenido en:

```text
Windows: %USERPROFILE%\.agents\skills\plan-viewer
macOS/Linux: $HOME/.agents/skills/plan-viewer
```

3. Reinicia Codex o ChatGPT si la habilidad no aparece inmediatamente.

## Uso

- Codex: `$plan-viewer`.
- ChatGPT: `@Plan Viewer` cuando la interfaz permita seleccionar la habilidad.
- Puede activarse automáticamente para planes complejos cuando el entorno admita habilidades personales.

## Publicación actual

- Repositorio: `ddadda69/GPT_DUDAS`.
- Rama: `main`.
- Esquema autoritativo: `data/schema.json`.
- Archivo canónico: `data/plans/<id>.json`.
- URL estable: `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.
- `data/current.json` refleja el último plan en el caso normal y alimenta la URL raíz.
- El archivo canónico y `current.json` se actualizan con control optimista de SHA; nunca se fuerzan conflictos.

## Contrato

La versión actual no mantiene formatos históricos ni usa un campo `type`. Cada sección contiene una o dos opciones, numeradas consecutivamente desde 1, y debe existir exactamente una `recommended: true` que coincida con `defaultOption`.

`$schema` debe ser exactamente `https://ddadda69.github.io/GPT_DUDAS/data/schema.json`.

## Dependencias

- GitHub debe estar autenticado exactamente como `ddadda69` para publicar.
- `scripts/validate_plan.py` usa Python 3 sin paquetes externos.
- Si Python no está disponible, `SKILL.md` obliga a validar manualmente el contrato remoto antes de publicar.

## Prueba rápida

1. Pide un plan usando `$plan-viewer`.
2. Comprueba que crea `data/plans/<id>.json` y que el JSON cumple el esquema remoto.
3. Sin concurrencia, verifica que `data/current.json` contiene exactamente el mismo plan.
4. Abre la URL raíz y la URL estable con `?plan=<id>`.
5. Actualiza el mismo plan: debe conservar `id`, incrementar `version` en uno y usar el SHA remoto del archivo canónico.
6. Publica desde dos chats partiendo del mismo `current.json`: ambos planes canónicos deben sobrevivir y como máximo uno debe poder reemplazar el espejo con el SHA inicial.

Documentación oficial de plugins y skills: https://developers.openai.com/plugins/llms.txt
