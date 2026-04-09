# Changelog

All notable changes to this project will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [x.y.z] - YYYY-MM-DD

### Added
- Nueva funcionalidad X en módulo Y
- Endpoint `POST /resource` para crear recursos
- Variable de entorno `FEATURE_FLAG` para habilitar modo Z

### Changed
- `functionName()` ahora acepta parámetro opcional `options`
- Comportamiento de validación en módulo Auth — ahora retorna 422 en vez de 400

### Fixed
- Error en cálculo de totales cuando el carrito estaba vacío
- Race condition en worker de sincronización bajo carga alta

### Removed
- Endpoint deprecado `GET /legacy/items` (reemplazado por `GET /items`)
- Dependencia `old-package` — funcionalidad migrada a `new-package`

---

<!-- INSTRUCCIONES DE USO (eliminar en producción)

1. Copiar el bloque [x.y.z] al inicio del archivo (después del header)
2. Reemplazar x.y.z con la nueva versión semver
3. Reemplazar YYYY-MM-DD con la fecha actual en ISO 8601
4. Completar solo las secciones que apliquen — omitir las vacías
5. Una línea por cambio, lenguaje técnico, verbo en pasado implícito

REGLAS:
- NO incluir este archivo dentro del README
- NO acumular múltiples versiones sin fecha
- Cada entrada debe tener al menos una sección con contenido

TIPOS DE BUMP:
  MAJOR → Breaking changes (API incompatible, contrato roto)
  MINOR → Features nuevas compatibles (backward compatible)
  PATCH → Fixes, refactors internos, docs, dependencias patch
-->
