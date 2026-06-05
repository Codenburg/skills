# TanStack Table API Patterns

## Column Definitions with createColumnHelper

```typescript
import { createColumnHelper } from '@tanstack/react-table'

type Person = { firstName: string; lastName: string; age: number; status: 'active' | 'inactive' }
const columnHelper = createColumnHelper<Person>()

const columns = [
  // Accessor column
  columnHelper.accessor('firstName', {
    header: 'First Name',
    cell: info => info.getValue(),
    footer: info => info.column.id,
  }),

  // Accessor with function (requires id)
  columnHelper.accessor(row => row.lastName, {
    id: 'lastName',
    header: () => <span>Last Name</span>,
    cell: info => <i>{info.getValue()}</i>,
  }),

  // Display column (custom rendering, no data access)
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <button onClick={() => deleteRow(row.original)}>Delete</button>,
  }),

  // Group column (nested headers)
  columnHelper.group({
    id: 'info',
    header: 'Info',
    columns: [
      columnHelper.accessor('age', { header: 'Age' }),
      columnHelper.accessor('status', { header: 'Status' }),
    ],
  }),
]
```

### Column Options

| Option | Type | Description |
|--------|------|-------------|
| `id` | `string` | Unique identifier (auto-derived from accessorKey) |
| `accessorKey` | `string` | Dot-notation path to row data |
| `accessorFn` | `(row) => any` | Custom accessor function |
| `header` | `string \| (context) => ReactNode` | Header renderer |
| `cell` | `(context) => ReactNode` | Cell renderer |
| `footer` | `(context) => ReactNode` | Footer renderer |
| `size` | `number` | Default width (default: 150) |
| `enableSorting` | `boolean` | Enable sorting |
| `enableFiltering` | `boolean` | Enable filtering |
| `enableGrouping` | `boolean` | Enable grouping |
| `enableHiding` | `boolean` | Enable visibility toggle |
| `enableResizing` | `boolean` | Enable resizing |
| `enablePinning` | `boolean` | Enable pinning |

## Complete Table with Features

```typescript
import {
  useReactTable, flexRender,
  getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, getFacetedRowModel,
  getFacetedUniqueValues, getFacetedMinMaxValues,
} from '@tanstack/react-table'

function MyTable() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const table = useReactTable({
    data, columns,
    state: { sorting, columnFilters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

## Core Features

### Sorting

```typescript
const table = useReactTable({
  state: { sorting },
  onSortingChange: setSorting,
  getSortedRowModel: getSortedRowModel(),
  enableSorting: true,
  enableMultiSort: true,
})
```

### Column Filtering

```typescript
const table = useReactTable({
  state: { columnFilters },
  onColumnFiltersChange: setColumnFilters,
  getFilteredRowModel: getFilteredRowModel(),
})

// Filter UI
function Filter({ column }) {
  return <input value={(column.getFilterValue() ?? '') as string}
    onChange={e => column.setFilterValue(e.target.value)}
    placeholder={`Filter... (${column.getFacetedUniqueValues()?.size})`} />
}
```

### Global / Fuzzy Filtering

```typescript
import { rankItem } from '@tanstack/match-sorter-utils'

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const table = useReactTable({ filterFns: { fuzzy: fuzzyFilter }, globalFilterFn: 'fuzzy' })
```

### Pagination

```typescript
table.nextPage()
table.previousPage()
table.firstPage()
table.lastPage()
table.setPageSize(20)
table.getCanNextPage()
table.getCanPreviousPage()
```

### Row Selection

```typescript
const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

const table = useReactTable({
  state: { rowSelection },
  onRowSelectionChange: setRowSelection,
  enableRowSelection: true,
})

// Checkbox column
columnHelper.display({
  id: 'select',
  header: ({ table }) => (
    <input type="checkbox" checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} />
  ),
  cell: ({ row }) => (
    <input type="checkbox" checked={row.getIsSelected()} disabled={!row.getCanSelect()} onChange={row.getToggleSelectedHandler()} />
  ),
})
```

### Column Visibility, Pinning, Resizing

```typescript
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: ['select'], right: ['actions'] })

const table = useReactTable({
  state: { columnVisibility, columnPinning },
  onColumnVisibilityChange: setColumnVisibility,
  onColumnPinningChange: setColumnPinning,
  enableColumnPinning: true,
  enableColumnResizing: true,
  columnResizeMode: 'onChange',
})
```

### Grouping & Expanding

```typescript
const [grouping, setGrouping] = useState<GroupingState>([])
const [expanded, setExpanded] = useState<ExpandedState>({})

const table = useReactTable({
  state: { grouping, expanded },
  onGroupingChange: setGrouping,
  onExpandedChange: setExpanded,
  getGroupedRowModel: getGroupedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getSubRows: (row) => row.subRows,
})
```

## Server-Side Operations

```typescript
const table = useReactTable({
  data: serverData, columns,
  manualSorting: true,
  manualFiltering: true,
  manualPagination: true,
  pageCount: serverPageCount,
  state: { sorting, columnFilters, pagination },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onPaginationChange: setPagination,
  getCoreRowModel: getCoreRowModel(),
  // Do NOT include getSortedRowModel, getFilteredRowModel, getPaginationRowModel
})

useEffect(() => {
  fetchData({ sorting, filters: columnFilters, pagination })
}, [sorting, columnFilters, pagination])
```

## TypeScript Patterns

### Extending Column Meta

```typescript
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: 'text' | 'range' | 'select'
    align?: 'left' | 'center' | 'right'
  }
}
```

### Custom Filter/Sort Function Registration

```typescript
declare module '@tanstack/react-table' {
  interface FilterFns { fuzzy: FilterFn<unknown> }
  interface SortingFns { myCustomSort: SortingFn<unknown> }
}
```

### Editable Cells via Table Meta

```typescript
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void
  }
}

const table = useReactTable({
  meta: {
    updateData: (rowIndex, columnId, value) => {
      setData(old => old.map((row, i) =>
        i === rowIndex ? { ...row, [columnId]: value } : row
      ))
    },
  },
})
```

## Key Imports

```typescript
import {
  createColumnHelper, flexRender, useReactTable,
  getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, getGroupedRowModel, getExpandedRowModel,
  getFacetedRowModel, getFacetedUniqueValues, getFacetedMinMaxValues,
} from '@tanstack/react-table'

import type {
  ColumnDef, SortingState, ColumnFiltersState, VisibilityState,
  PaginationState, ExpandedState, RowSelectionState, GroupingState,
  ColumnOrderState, ColumnPinningState, FilterFn, SortingFn,
} from '@tanstack/react-table'
```

## Virtualization Integration

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedTable() {
  const table = useReactTable({ /* ... */ })
  const { rows } = table.getRowModel()
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 10,
  })

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <table>
        <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index]
            return (
              <tr key={row.id} style={{ position: 'absolute', transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

## Common Pitfalls

- Defining columns inline (creates new ref each render → infinite loops)
- Forgetting `getCoreRowModel()` (required for all tables)
- Using row models without importing them
- Not providing `id` when using `accessorFn`
- Mixing `manualPagination` with client-side `getPaginationRowModel`
- Not handling `header.isPlaceholder` for group column spacers
