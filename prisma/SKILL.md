---
name: prisma
description: "Trigger: Prisma ORM, schema design, type-safe database operations, Prisma Client, migrations. Expert in Prisma ORM with type-safe database operations and schema design."
license: Apache-2.0
metadata:
  author: Codenburg
  version: "1.1"
---

## Activation Contract

Load this skill when designing Prisma schemas, writing Prisma Client queries, setting up migrations, or optimizing database performance with Prisma.

## Hard Rules

- Use `prisma-client` generator (Prisma 7+) with explicit `output` path, not `prisma-client-js`.
- Always use driver adapters (`PrismaPg`, `PrismaMySQL`, etc.) for SQL providers in Prisma 7.
- Prefer type-safe Prisma Client operations over raw queries.
- Separate data access from business logic (repository pattern).
- Use `select` to fetch only needed fields — never `include` everything.

## Decision Gates

| Situation | Pattern |
|-----------|---------|
| New project | Define schema with proper relations, generators, datasource |
| Complex queries | Use transactions for multi-step operations |
| Performance issue | Check N+1, missing indexes, over-fetching |
| Error handling | Catch `PrismaClientKnownRequestError` and `PrismaClientValidationError` |
| Testing | Use in-memory database or mock Prisma Client |

## Execution Steps

1. Define schema in `prisma/schema.prisma` with domain-driven model naming.
2. Configure generator (`prisma-client` with explicit output) and datasource.
3. Generate Prisma Client: `npx prisma generate`.
4. Instantiate with driver adapter for SQL providers.
5. Use `select`/`include` for efficient queries, pagination for large datasets.
6. Handle errors with specific Prisma error types.

## Schema Design Rules

- Employ domain-driven model naming (PascalCase).
- Use `@id`, `@unique`, `@relation`, `@default` decorators.
- Implement soft deletes using `deletedAt` timestamps.
- Maintain normalized, DRY schemas.
- Define proper relationships between models.

## Performance Rules

- Use `select` to fetch only needed fields.
- Implement proper indexing in schema.
- Use batch operations for bulk updates.
- Avoid N+1 queries with proper `include`.
- Use connection pooling in production.

## Security Rules

- Implement input validation at application level.
- Rely on Prisma's built-in SQL injection protection.
- Validate data at both schema and application level.

## Output Contract

Return schema changes, Prisma Client usage patterns, and any migration steps needed.

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma 7 Migration](https://www.prisma.io/docs/orm/prisma-7)
