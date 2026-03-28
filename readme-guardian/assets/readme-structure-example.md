# Project Name

v1.0.0 | Last updated: YYYY-MM-DD

Brief project description (1-3 lines).

---

## Features

### Public
- Feature A
- Feature B

### Admin
- Feature C
- Feature D

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js x.y.z |
| Language | TypeScript ^5 |
| Styles | Tailwind CSS ^4 |
| State | Zustand ^5 |
| Validation | Zod ^4 + React Hook Form ^7 |
| ORM | Prisma ^5 |
| Database | PostgreSQL 18 |
| Auth | Better Auth ^2 |
| Testing | Playwright ^1.58 |

---

## Installation

```bash
# Clone
git clone <repo>
cd <project>

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Seed data
npm run db:seed

# Start dev server
npm run dev
```

---

## Configuration

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"

# Auth
BETTER_AUTH_SECRET="your-32-char-secret"
BETTER_AUTH_URL="http://localhost:3000"
```

---

## Scripts

```bash
npm run dev        # Dev server
npm run build      # Production build
npm run start      # Start production
npm run lint       # ESLint
npm run test       # Playwright tests
npm run db:seed    # Seed database
npm run db:generate # Generate Prisma client
npm run db:push    # Push schema
npm run db:studio  # Open Prisma Studio
```

---

## Project Structure

```
src/
├── app/           # Next.js App Router
├── components/    # React components
├── lib/           # Utilities and schemas
├── store/         # Zustand stores
└── types/         # Shared types
```

---

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/resource | GET | List resources |
| /api/resource | POST | Create resource |

---

## Roadmap

- [ ] TODO item
- [x] Done item

---

## Changelog

See CHANGELOG.md for full history.
