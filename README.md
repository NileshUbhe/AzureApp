# JSON Data Grid (React + Ant Design)

A reusable React component that displays arbitrary JSON data in a table with type-aware column filters and paging, built on Ant Design's Table (v5).

## Features
- Infers column types (string, number, boolean, date, enum, array, object)
- Renders appropriate filters per column
- Client-side filtering and pagination
- Default sorters for primitive types

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run the dev server:

```bash
npm run dev
```

3. Open the URL printed in the terminal.

4. To build for production:

```bash
npm run build
```

## Usage

Import and use `JsonDataGrid` with your JSON array:

```tsx
import JsonDataGrid from './components/JsonDataGrid';

function MyPage() {
  const data = [
    { id: 1, name: 'Alice', age: 30, isAdmin: true, createdAt: new Date() },
    { id: 2, name: 'Bob', age: 24, isAdmin: false, createdAt: new Date() },
  ];

  return <JsonDataGrid data={data} pageSize={20} />;
}
```

### Props
- `data: object[]` – JSON records to display
- `pageSize?: number` – initial page size (default 10)
- `rowKey?: string | (record) => string` – row key (default: `id`/`key`/index)
- `columnsConfig?: Record<string, { title?: string; dataIndex?: string; type?: 'string'|'number'|'boolean'|'date'|'enum'|'array'|'object'; filterable?: boolean }>` – customize per-column behavior
- `columns?: ColumnsType` – optionally provide custom AntD columns (bypass inference)
- `className?: string`, `style?: React.CSSProperties`
- `pagination?: Partial<TablePaginationConfig>` – to override pagination behavior

Notes:
- Enum filters are inferred for string columns with a small set of unique values.
- Date detection supports `Date` objects and date-like strings parsable by dayjs.

## Tech
- React 18 + TypeScript
- Vite 5
- Ant Design 5 (with dayjs)