# PLUGIN

Área independiente para el desarrollo de Plan Viewer Plugin. Nada de esta carpeta forma parte de la habilidad clásica `plan-viewer` ni de `skill-backups/plan-viewer/`.

## Estructura

- `plan-viewer-plugin/`: raíz instalable del plugin. El nombre coincide con `.codex-plugin/plugin.json`.
- `plans/`: planes de diseño y decisiones aprobadas del plugin.
- `backups/`: snapshots restaurables del plugin y sus planes.

La habilidad clásica y el Viewer web actual continúan fuera de esta carpeta y no deben ser modificados por el plugin.
