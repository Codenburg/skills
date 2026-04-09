---
name: readme-guardian
description: >
  Mantiene README, CHANGELOG y package.json como única fuente de verdad con versionado semver automático.
  Activar: después de commits que afecten features, config, estructura, dependencias, o cuando se invoque
  /readme-guardian sync. Usar siempre que el usuario pida actualizar documentación del proyecto, sincronizar
  el README, bumpar versión, o registrar cambios en el changelog.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "2.0"
---

## Flujo de Ejecución (Seguir en Orden)

### Paso 1 — Recolectar contexto actual

Leer estos archivos ANTES de escribir cualquier cosa:

```bash
# Versión actual
cat package.json | grep '"version"'

# Últimas entradas del changelog
head -40 openspec/CHANGELOG.md 2>/dev/null || echo "CHANGELOG no existe aún"

# README actual (secciones a detectar)
cat README.md

# Diff de los cambios (si es post-commit)
git diff HEAD~1 HEAD --stat
git log -1 --pretty="%s%n%b"
```

### Paso 2 — Clasificar el cambio (Semver Estricto)

| Tipo de cambio | Bump |
|---|---|
| Breaking change en API/contrato público | MAJOR |
| Feature nueva compatible, endpoint nuevo, módulo nuevo | MINOR |
| Fix, refactor interno, docs, tests, deps patch | PATCH |

**Reglas de desempate:**
- Si hay duda entre MINOR y PATCH → usar MINOR
- Si el commit message tiene `BREAKING CHANGE:` → siempre MAJOR
- Cambios solo en README/docs sin tocar código → PATCH

### Paso 3 — Calcular nueva versión

```bash
# Leer versión actual
CURRENT=$(node -p "require('./package.json').version")
# Ejemplo: 1.4.2

# Calcular nueva según clasificación:
# MAJOR: 2.0.0
# MINOR: 1.5.0
# PATCH: 1.4.3
```

### Paso 4 — Actualizar package.json

```bash
# Con git tag automático:
npm version patch   # o minor / major

# Sin git tag:
npm version minor --no-git-tag-version
```

O editar manualmente solo el campo `"version"` sin tocar el resto del archivo.

### Paso 5 — Actualizar CHANGELOG

Archivo: `openspec/CHANGELOG.md`

**Si no existe**, crear con este header:

```markdown
# Changelog

All notable changes to this project will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---
```

**Prepend** (agregar al principio, después del header) la nueva entrada:

```markdown
## [x.y.z] - YYYY-MM-DD

### Added
- Descripción concreta de lo agregado (qué hace, dónde impacta)

### Changed
- Qué cambió y por qué

### Fixed
- Qué bug se resolvió y en qué contexto

### Removed
- Qué se eliminó

---
```

**Reglas del changelog:**
- Solo incluir secciones que apliquen (omitir `### Fixed` si no hay fixes)
- Usar verbos en pasado: "Added", "Fixed", "Removed"
- Una línea por cambio, concisa y técnica
- NO incluir el changelog dentro del README

### Paso 6 — Actualizar README (solo secciones afectadas)

**Mapa de cambios → secciones:**

| Cambio detectado | Sección del README |
|---|---|
| Nuevo archivo en `/features` o módulo | Features |
| Cambio en scripts de `package.json` | Available Scripts |
| Variable de entorno nueva/modificada | Configuration |
| Ruta o endpoint nuevo/modificado | Usage / API Endpoints |
| Refactor estructural de carpetas | Project Structure |
| Dependencia agregada/removida | Tech Stack |
| Nueva feature visible al usuario | Features + descripción breve |

**Estructura del README (mantener este orden):**

1. Nombre del proyecto + badge de versión
2. Descripción (1-3 líneas, técnica)
3. Features principales
4. Tech Stack
5. Instalación
6. Configuración (variables de entorno con tabla: `VARIABLE | default | descripción`)
7. Uso
8. Scripts disponibles
9. Estructura del proyecto
10. API / Endpoints (si aplica)
11. Roadmap (si existe)

**Políticas de edición:**
- NUNCA reescribir el README completo si solo cambiaron 1-2 secciones
- NO inventar features — solo documentar lo que existe en el código
- NO agregar marketing fluff ("powerful", "robust", "seamless")
- SÍ eliminar secciones obsoletas si ya no corresponden

### Paso 7 — Actualizar Roadmap

Archivo de referencia: `assets/roadmap-template.md`

El roadmap vive en dos lugares que deben mantenerse sincronizados:
- **`openspec/ROADMAP.md`** — fuente de verdad completa
- **`README.md` sección Roadmap** — versión resumida (máximo 5-7 ítems)

**Triggers para actualizar el roadmap:**

| Evento | Acción |
|---|---|
| Feature implementada que estaba en roadmap | Mover de `[ ]` a `[x]` + mover a sección Completed |
| Nueva feature planificada mencionada en commit/PR | Agregar como `[ ]` en la categoría correspondiente |
| Ítem cancelado o descartado | Remover sin dejar rastro (ya queda en CHANGELOG) |
| Release MINOR o MAJOR | Revisar si algún ítem pendiente debe promoverse |

**Estructura de `openspec/ROADMAP.md`:**

```markdown
## In Progress
- [ ] Descripción del ítem — contexto breve

## Planned
- [ ] Ítem planificado con prioridad alta
- [ ] Ítem planificado con prioridad media

## Completed
- [x] Feature implementada — versión en que se completó (v1.5.0)
- [x] Fix importante completado (v1.4.3)
```

**Reglas del roadmap:**
- Solo incluir ítems concretos y accionables — nada vago como "mejorar performance"
- Completados: mantener los últimos 10, archivar el resto
- README solo muestra ítems de `In Progress` y los primeros 3-4 de `Planned`
- NO duplicar ítems ya registrados en CHANGELOG

### Paso 8 — Verificación final

Antes de terminar, confirmar:

```
✓ package.json version actualizado a x.y.z
✓ openspec/CHANGELOG.md tiene entrada [x.y.z] al inicio
✓ README.md secciones afectadas actualizadas
✓ No hay referencias a versión vieja en README
✓ Changelog NO está duplicado en README
✓ openspec/ROADMAP.md sincronizado (ítems completados marcados, nuevos agregados)
✓ README sección Roadmap refleja openspec/ROADMAP.md (resumida)
```

Reportar al usuario:

```
README Guardian — sync completado
Versión: 1.4.2 → 1.5.0 (MINOR)
Archivos modificados:
  - package.json (version bump)
  - openspec/CHANGELOG.md (nueva entrada prepended)
  - openspec/ROADMAP.md (1 ítem completado, 1 ítem agregado)
  - README.md (secciones: Features, API Endpoints, Roadmap)
```

---

## Comandos

```bash
# Sync manual
/readme-guardian sync

# Sync con tipo de bump explícito
/readme-guardian sync --bump minor
/readme-guardian sync --bump major
```

---

## Políticas Globales

- El changelog vive en `openspec/CHANGELOG.md`, NUNCA en README
- Un solo bump por invocación (no acumular varios sin sync)
- Si hay ambigüedad en el tipo de bump, preguntar antes de escribir
- En modo CI/CD, asumir PATCH si no hay indicación explícita