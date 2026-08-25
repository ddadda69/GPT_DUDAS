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
- Cada plan normal se publica de forma canónica en `data/plans/<id>.json`.
- URL estable: `https://ddadda69.github.io/GPT_DUDAS/?plan=<id>`.
- `data/current.json` es un espejo de conveniencia: sin `?plan=` el Viewer carga ese archivo y normalmente muestra el último plan publicado correctamente.
- La habilidad captura el SHA de `current.json` al empezar a preparar el plan y solo actualiza el espejo si ese SHA sigue vigente; un cambio concurrente nunca se sobrescribe a la fuerza.
- Una actualización de un plan existente exige leer primero el SHA de su archivo concreto y escribir usando ese SHA.

## Dependencias y permisos

- Requiere una conexión de GitHub autenticada exactamente como `ddadda69` con permiso de escritura en el repositorio.
- `scripts/validate_plan.py` funciona con Python 3 y no necesita paquetes externos.
- Si Python no está disponible, `SKILL.md` define una validación manual obligatoria antes de publicar.
- No se incluyen tokens, claves, contraseñas ni credenciales.

## Prueba rápida tras restaurar

1. Pide un plan sencillo usando `$plan-viewer`.
2. Comprueba que se cree un archivo nuevo bajo `data/plans/`.
3. Comprueba que `data/current.json` contenga exactamente el mismo plan si no hubo concurrencia.
4. Abre la URL raíz y verifica que muestra ese plan; abre también la URL estable con `?plan=<id>`.
5. Actualiza el mismo plan y verifica que mantiene `id`, incrementa `version` y actualiza tanto el archivo aislado como `current.json` en el caso normal.
6. Para probar concurrencia, inicia dos publicaciones desde el mismo estado de `current.json`: ambas deben conservar sus archivos aislados y como máximo una debe poder actualizar el espejo con el SHA inicial.

Documentación oficial: https://learn.chatgpt.com/docs/build-skills
