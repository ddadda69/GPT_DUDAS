# Backup v3 — Plan Viewer Plugin 0.2.0

Snapshot de la arquitectura multiusuario:

- `files/plan-viewer-plugin/` comparte exactamente el mismo tree SHA que el plugin activo 0.2.0.
- `files/plans/` comparte exactamente el mismo tree SHA que `PLUGIN/plans/`.
- Codex usa SQLite local; ChatGPT/HTTP usa PostgreSQL + OAuth/OIDC.
- Los planes y decisiones de usuarios no se almacenan en GitHub.
- No contiene tokens, credenciales, bases SQLite ni datos de producción.
- No contiene ni reemplaza `skill-backups/plan-viewer/`.
