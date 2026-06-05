---
name: tanstack-table
description: "Trigger: data tables, datagrids, sorting, filtering, pagination, TanStack Table v8. Headless UI for building powerful tables and datagrids for React, Vue, Solid, Svelte, and more."
license: Apache-2.0
metadata:
  author: Codenburg
  version: "1.1"
---

## Activation Contract

Load this skill when building data tables or datagrids with TanStack Table (v8) — needing sorting, filtering, pagination, grouping, column pinning, row selection, or server-side data operations.

## Hard Rules

- **Always memoize** `data` and `columns` — new references every render cause infinite loops. Use `useMemo`.
- Use `createColumnHelper` for type-safe column definitions.
- Use `flexRender` for all header/cell/footer rendering.
- Always pair controlled state with both `state.X` and `onXChange`.
- Use `table.getRowModel().rows` for final rendered rows (not `getCoreRowModel`).
- Import only needed row models — each adds processing overhead.

## Decision Gates

| Feature | Pattern |
|---------|---------|
| Client-side sorting | `getSortedRowModel()` + `state.sorting` |
| Client-side filtering | `getFilteredRowModel()` + `state.columnFilters` |
| Client-side pagination | `getPaginationRowModel()` + `state.pagination` |
| Server-side data | `manualSorting/manualFiltering/manualPagination: true` |
| Fuzzy search | `filterFns: { fuzzy }` with `@tanstack/match-sorter-utils` |
| Row selection | `enableRowSelection: true` + `state.rowSelection` |
| Column pinning | `enableColumnPinning: true` + `state.columnPinning` |
| Column resizing | `enableColumnResizing: true` |
| Grouping | `getGroupedRowModel()` + `state.grouping` |
| Expandable rows | `getExpandedRowModel()` + `getSubRows` |
| Large datasets | Virtualization with `@tanstack/react-virtual` |

## Execution Steps

1. Define stable `columns` with `createColumnHelper` (memoized).
2. Define stable `data` reference (memoized from fetched/sourced data).
3. Configure `useReactTable` with row models for features needed.
4. Render headers via `table.getHeaderGroups()` and rows via `table.getRowModel()`.
5. Wire up interactive features (sorting, filtering, pagination, selection).
6. For server-side: set `manualX: true`, fetch data based on state changes.

## Best Practices

1. Use `getRowId` for stable row keys when data has unique IDs.
2. Use `columnHelper.accessor()` for data columns, `columnHelper.display()` for action columns.
3. Set `autoResetPageIndex: false` when data changes shouldn't reset pagination.
4. Extend types via module augmentation for custom meta and filter/sort fns.

## Output Contract

Return the table configuration: column definitions, row models used, feature states (sorting/filtering/pagination), and server-side setup if applicable.

## References

- [references/api-patterns.md](references/api-patterns.md) — full API reference: column defs, sorting, filtering, pagination, selection, pinning, virtualization, server-side, TypeScript patterns, and common pitfalls
- [TanStack Table Documentation](https://tanstack.com/table/latest)
- Package: `@tanstack/react-table` / Utility: `@tanstack/match-sorter-utils`
