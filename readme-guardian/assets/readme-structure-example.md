# readme-structure-example

Ejemplo de referencia para la estructura canónica del README.
readme-guardian debe seguir este orden y estas convenciones al actualizar secciones.

---

# Project Name · ![version](https://img.shields.io/badge/version-1.5.0-blue)

Descripción técnica en 1-3 líneas. Qué hace, para quién, sin adjetivos de marketing.

> Ejemplo: REST API para gestión de inventario de ropa con soporte multi-variante (talle + color), métricas de ventas y exportación PDF/Excel.

---

## Features

- Control de stock con variantes (talle, color)
- Registro de ventas con historial
- Métricas de ventas con filtros por período
- Exportación a PDF y Excel
- Operación offline-first con sincronización diferida

> Regla: solo listar lo que existe en el código. Sin roadmap aquí.

---

## Tech Stack

| Layer | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Estilos | Tailwind CSS |
| Estado | Zustand |
| Local DB | Dexie.js / IndexedDB |
| Backend | NestJS + Prisma |
| Base de datos | PostgreSQL |
| Exportación | jsPDF + SheetJS |

---

## Installation

```bash
# Clonar repositorio
git clone https://github.com/org/project.git
cd project

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
```

---

## Configuration

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | — | Connection string PostgreSQL |
| `PORT` | `3000` | Puerto del servidor |
| `JWT_SECRET` | — | Clave secreta para tokens |
| `STORAGE_PATH` | `./uploads` | Directorio para archivos |

> Regla: documentar TODAS las variables de `.env.example`. Nunca hardcodear valores reales.

---

## Usage

```bash
# Desarrollo
npm run dev

# Build producción
npm run build

# Producción
npm start
```

Descripción breve del flujo principal si aplica:

```
1. Autenticarse en /auth/login
2. Crear productos con variantes en /products
3. Registrar ventas en /sales
4. Consultar métricas en /metrics
```

---

## Available Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | Compilación para producción |
| `npm run test` | Ejecutar suite de tests |
| `npm run lint` | Linter + format check |
| `npm run db:migrate` | Ejecutar migraciones pendientes |
| `npm run db:seed` | Poblar base de datos con datos de prueba |

---

## Project Structure

```
project/
├── src/
│   ├── modules/          # Módulos de dominio (products, sales, auth)
│   │   └── [module]/
│   │       ├── dto/
│   │       ├── entities/
│   │       ├── [module].controller.ts
│   │       ├── [module].service.ts
│   │       └── [module].module.ts
│   ├── common/           # Guards, pipes, interceptors compartidos
│   ├── config/           # Configuración de la app
│   └── main.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── openspec/
│   └── CHANGELOG.md
├── .env.example
└── package.json
```

> Regla: actualizar esta sección solo si cambia la estructura real de carpetas.

---

## API Endpoints

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Autenticación, retorna JWT |
| `POST` | `/auth/refresh` | Refresh de token |

### Products
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/products` | Listar productos con variantes |
| `POST` | `/products` | Crear producto |
| `PATCH` | `/products/:id` | Actualizar producto |
| `DELETE` | `/products/:id` | Eliminar producto |

### Sales
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/sales` | Listar ventas con filtros |
| `POST` | `/sales` | Registrar venta |

> Regla: documentar solo endpoints que existen. Omitir esta sección si el proyecto no tiene API pública.

---

## Roadmap

- [ ] Soporte multi-sucursal
- [ ] Notificaciones de stock bajo
- [ ] Dashboard de métricas en tiempo real

> Regla: mover ítems a Features cuando estén implementados.

---

<!-- NOTAS PARA readme-guardian

SECCIONES OBLIGATORIAS (siempre presentes):
  - Nombre + badge de versión
  - Descripción
  - Installation
  - Configuration
  - Usage

SECCIONES CONDICIONALES (incluir si aplica):
  - Features → solo si el proyecto tiene features documentables
  - API Endpoints → solo si hay API pública
  - Roadmap → solo si hay ítems planificados concretos
  - Tech Stack → siempre recomendado

BADGE DE VERSIÓN:
  Actualizar x.y.z en el badge cada vez que cambie package.json version.
  Formato: https://img.shields.io/badge/version-x.y.z-blue
-->
