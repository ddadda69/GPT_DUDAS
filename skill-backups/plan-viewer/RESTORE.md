# Restaurar la habilidad Plan Viewer

Esta carpeta contiene una copia completa y restaurable de la habilidad personal `plan-viewer`, actualizada el **25 de agosto de 2026**.

La copia no se activa dentro de este repositorio: está deliberadamente guardada en `skill-backups/` y no en `.agents/skills/`. Tampoco se ejecuta por sí sola ni contiene credenciales.

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
ruta skill-backups/plan-viewer/skill, rama main
```

### Opción 2: copia manual

1. Descarga la carpeta `skill` de este respaldo desde `main`.
2. Crea la carpeta personal de habilidades si no existe.
3. Copia el contenido de `skill` en:

```text
Windows: %USERPROFILE%\.agents\skills\plan-viewer
macOS/Linux: $HOME/.agents/skills/plan-viewer
```

4. Reinicia Codex o la aplicación de escritorio si la habilidad no aparece inmediatamente.

## Uso después de restaurarla

- En Codex: `$plan-viewer`.
- En ChatGPT de escritorio: `@Plan Viewer` cuando la interfaz permita seleccionar la habilidad.
- También puede activarse automáticamente cuando se pide un plan complejo, una propuesta de implementación o un refactor importante y el entorno admite habilidades personales.

## Publicación actual

- Repositorio: `ddadda69/GPT_DUDAS`.
- Rama: `main`.
- Esquema autoritativo: `data/schema.json`.
- Cada plan normal se publica de forma aislada en `data/plans/<id>.json`.
- URL: `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.
- `data/current.json` queda como compatibilidad legacy y no debe reemplazarse durante una publicación normal.
- Una actualización exige leer primero el SHA del archivo concreto y escribir usando ese SHA; un conflicto nunca se sobrescribe a la fuerza.

## Dependencias y permisos

- Requiere una conexión de GitHub autenticada exactamente como `ddadda69` con permiso de escritura en el repositorio.
- `scripts/validate_plan.py` funciona con Python 3 y no necesita paquetes externos.
- Si Python no está disponible, `SKILL.md` define una validación manual obligatoria antes de publicar.
- No se incluyen tokens, claves, contraseñas ni credenciales.

## Prueba rápida tras restaurar

1. Pide un plan sencillo usando `$plan-viewer`.
2. Comprueba que se cree un archivo nuevo bajo `data/plans/` y que no cambie `data/current.json`.
3. Abre manualmente la URL devuelta con `?plan=<id>`.
4. Actualiza el mismo plan y verifica que mantiene `id`, incrementa `version` y modifica únicamente ese archivo.
5. Inicia otro chat y publica otro plan: debe obtener otro `id` y otro archivo, sin afectar al primero.

Documentación oficial: https://learn.chatgpt.com/docs/build-skills
