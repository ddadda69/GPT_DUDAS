# Datos operativos

- `plans/<id>.json`: fuente canónica de cada plan del plugin.
- `current.json`: espejo no canónico del último plan publicado cuando no existe conflicto.
- `decisions/<planId>/<submissionId>.json`: submissions inmutables.

Solo el MCP server debe escribir aquí. La UI nunca accede directamente a GitHub.
