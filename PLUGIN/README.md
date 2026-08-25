# PLUGIN

Área independiente para el desarrollo de Plan Viewer Plugin. Nada de esta carpeta forma parte de la habilidad clásica `plan-viewer` ni de `skill-backups/plan-viewer/`.

## Estructura

- `plan-viewer-plugin/`: raíz instalable del plugin.
- `plans/`: planes de diseño y decisiones aprobadas del proyecto; no contiene datos runtime de usuarios.
- `backups/`: snapshots restaurables del plugin y sus planes.

Desde la versión 0.2.0 los planes de usuarios están desacoplados de GitHub: Codex usa SQLite local ignorado por Git y el despliegue de ChatGPT usa PostgreSQL aislado por identidad OAuth.

La habilidad clásica y el Viewer web actual continúan fuera de esta carpeta y no deben ser modificados por el plugin.
