import React, { useMemo, useState } from 'react';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { Table, Input, InputNumber, Select, DatePicker, Space, Button, Tag, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { FilterFilled, SearchOutlined, CloseCircleFilled } from '@ant-design/icons';
import type { FilterDropdownProps, FilterValue, SorterResult, TableCurrentDataSource } from 'antd/es/table/interface';

const { Text } = Typography;

export type Primitive = string | number | boolean | null | undefined | Date;

export type InferredType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'array'
  | 'object'
  | 'unknown';

export interface ColumnConfig {
  title?: string;
  dataIndex?: string; // if different from key
  type?: InferredType;
  filterable?: boolean;
}

export type ColumnConfigMap = Record<string, ColumnConfig>;

export interface JsonDataGridProps<RecordType extends object = Record<string, any>> {
  data: RecordType[];
  pageSize?: number;
  rowKey?: string | ((record: RecordType) => string);
  columnsConfig?: ColumnConfigMap;
  columns?: ColumnsType<RecordType>;
  className?: string;
  style?: React.CSSProperties;
  pagination?: Partial<TablePaginationConfig>;
}

// ------------------ Helpers ------------------
function isDateLike(value: unknown): boolean {
  if (value instanceof Date && !isNaN(value.getTime())) return true;
  if (typeof value !== 'string') return false;
  // quick heuristic to avoid treating random numbers as dates
  if (!/[-/:]/.test(value)) return false;
  const parsed = dayjs(value);
  return parsed.isValid();
}

function detectType(values: unknown[]): InferredType {
  const sample = values.find((v) => v !== null && v !== undefined);
  if (sample === undefined) return 'unknown';
  if (Array.isArray(sample)) return 'array';
  const t = typeof sample;
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (sample instanceof Date || isDateLike(sample)) return 'date';
  if (t === 'string') {
    // enum heuristic: few unique values
    const stringValues = values
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    const uniqueCount = new Set(stringValues).size;
    if (uniqueCount > 0 && uniqueCount <= Math.max(6, Math.floor(values.length * 0.2))) {
      return 'enum';
    }
    return 'string';
  }
  if (t === 'object') return 'object';
  return 'unknown';
}

// ------------------ Filter State ------------------
type TextFilter = { type: 'text'; value: string };
type NumberFilter = { type: 'number'; min?: number; max?: number };
type BooleanFilter = { type: 'boolean'; value?: boolean };
type DateFilter = { type: 'date'; from?: Dayjs; to?: Dayjs };
type EnumFilter = { type: 'enum'; values: (string | number | boolean)[] };

type FilterState = TextFilter | NumberFilter | BooleanFilter | DateFilter | EnumFilter;

function isFilterActive(filter?: FilterState): boolean {
  if (!filter) return false;
  switch (filter.type) {
    case 'text':
      return !!filter.value?.trim();
    case 'number':
      return filter.min !== undefined || filter.max !== undefined;
    case 'boolean':
      return filter.value !== undefined;
    case 'date':
      return !!filter.from || !!filter.to;
    case 'enum':
      return filter.values.length > 0;
  }
}

// ------------------ Component ------------------
export function JsonDataGrid<RecordType extends Record<string, any>>({
  data,
  pageSize = 10,
  rowKey,
  columnsConfig,
  columns: providedColumns,
  className,
  style,
  pagination: providedPagination
}: JsonDataGridProps<RecordType>) {
  const [filters, setFilters] = useState<Record<string, FilterState | undefined>>({});
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize,
    showSizeChanger: true,
    pageSizeOptions: [5, 10, 20, 50, 100]
  });

  // Reset current page when pageSize changes via prop
  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageSize, current: 1 }));
  }, [pageSize]);

  const inferredColumns = useMemo(() => {
    if (providedColumns) return providedColumns as ColumnsType<RecordType>;

    const keys = new Set<string>();
    data.forEach((row) => Object.keys(row ?? {}).forEach((k) => keys.add(k)));
    const keyList = Array.from(keys);

    return keyList.map((key): any => {
      const config = columnsConfig?.[key] ?? {};
      const values = data.map((r) => (r ? (r as any)[key] : undefined));
      const inferredType = config.type ?? detectType(values);
      const title = config.title ?? key;

      const base: any = {
        title,
        dataIndex: config.dataIndex ?? key,
        key,
        ellipsis: true
      };

      // Renderers for complex types
      if (inferredType === 'array') {
        base.render = (value: unknown[]) => {
          if (!Array.isArray(value)) return '';
          if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
            return (
              <Space wrap>
                {value.map((v, i) => (
                  <Tag key={i}>{String(v)}</Tag>
                ))}
              </Space>
            );
          }
          return <Text code>{JSON.stringify(value)}</Text>;
        };
      } else if (inferredType === 'object') {
        base.render = (value: unknown) => <Text code>{value ? JSON.stringify(value) : ''}</Text>;
      } else if (inferredType === 'boolean') {
        base.render = (value: unknown) =>
          value === true ? <Tag color="green">true</Tag> : value === false ? <Tag color="red">false</Tag> : '';
      } else if (inferredType === 'date') {
        base.render = (value: unknown) => {
          if (!value) return '';
          const d = value instanceof Date ? dayjs(value) : dayjs(String(value));
          return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(value);
        };
      }

      // Filters per type
      const filterable = config.filterable !== false; // default true
      if (filterable) {
        const filterKey = key;
        base.filtered = isFilterActive(filters[filterKey]);
        base.filterIcon = base.filtered ? <FilterFilled style={{ color: '#1677ff' }} /> : <SearchOutlined />;

        if (inferredType === 'string') {
          base.filterDropdown = ({ setSelectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
            const current = (filters[filterKey] as TextFilter) ?? { type: 'text', value: '' };
            return (
              <div style={{ padding: 12 }}>
                <Input
                  placeholder={`Search ${title}`}
                  allowClear
                  value={current.value}
                  onChange={(e) => {
                    const next: TextFilter = { type: 'text', value: e.target.value };
                    setFilters((f) => ({ ...f, [filterKey]: next }));
                    setSelectedKeys(e.target.value ? [e.target.value] : []);
                  }}
                  onPressEnter={() => confirm()}
                />
                <div className="filter-actions">
                  <Button type="primary" size="small" onClick={() => confirm()}>
                    Apply
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setFilters((f) => ({ ...f, [filterKey]: { type: 'text', value: '' } }));
                      clearFilters?.();
                      confirm();
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            );
          };
        } else if (inferredType === 'number') {
          base.filterDropdown = ({ confirm, clearFilters }: FilterDropdownProps) => {
            const current = (filters[filterKey] as NumberFilter) ?? { type: 'number' };
            return (
              <div style={{ padding: 12 }}>
                <Space>
                  <InputNumber
                    placeholder="Min"
                    value={current.min}
                    onChange={(val) => setFilters((f) => ({ ...f, [filterKey]: { ...current, min: val ?? undefined } }))}
                  />
                  <InputNumber
                    placeholder="Max"
                    value={current.max}
                    onChange={(val) => setFilters((f) => ({ ...f, [filterKey]: { ...current, max: val ?? undefined } }))}
                  />
                </Space>
                <div className="filter-actions">
                  <Button type="primary" size="small" onClick={() => confirm()}>
                    Apply
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setFilters((f) => ({ ...f, [filterKey]: { type: 'number' } }));
                      clearFilters?.();
                      confirm();
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            );
          };
        } else if (inferredType === 'boolean') {
          base.filterDropdown = ({ confirm, clearFilters }: FilterDropdownProps) => {
            const current = (filters[filterKey] as BooleanFilter) ?? { type: 'boolean' };
            return (
              <div style={{ padding: 12 }}>
                <Select
                  style={{ width: 200 }}
                  placeholder={`Filter ${title}`}
                  allowClear
                  value={current.value as any}
                  onChange={(val) => setFilters((f) => ({ ...f, [filterKey]: { type: 'boolean', value: val as boolean | undefined } }))}
                  options={[
                    { value: true, label: 'true' },
                    { value: false, label: 'false' }
                  ]}
                />
                <div className="filter-actions">
                  <Button type="primary" size="small" onClick={() => confirm()}>
                    Apply
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setFilters((f) => ({ ...f, [filterKey]: { type: 'boolean' } }));
                      clearFilters?.();
                      confirm();
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            );
          };
        } else if (inferredType === 'date') {
          base.filterDropdown = ({ confirm, clearFilters }: FilterDropdownProps) => {
            const current = (filters[filterKey] as DateFilter) ?? { type: 'date' };
            return (
              <div style={{ padding: 12 }}>
                <DatePicker.RangePicker
                  showTime
                  style={{ width: 260 }}
                  value={[current.from, current.to] as any}
                  onChange={(range) =>
                    setFilters((f) => ({ ...f, [filterKey]: { type: 'date', from: range?.[0] ?? undefined, to: range?.[1] ?? undefined } }))
                  }
                />
                <div className="filter-actions">
                  <Button type="primary" size="small" onClick={() => confirm()}>
                    Apply
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setFilters((f) => ({ ...f, [filterKey]: { type: 'date' } }));
                      clearFilters?.();
                      confirm();
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            );
          };
        } else if (inferredType === 'enum') {
          const uniqueValues = Array.from(
            new Set(
              values
                .filter((v) => v !== null && v !== undefined)
                .map((v) => (typeof v === 'string' ? v : String(v)))
            )
          ).slice(0, 1000);

          base.filterDropdown = ({ confirm, clearFilters }: FilterDropdownProps) => {
            const current = (filters[filterKey] as EnumFilter) ?? { type: 'enum', values: [] };
            return (
              <div style={{ padding: 12 }}>
                <Select
                  mode="multiple"
                  allowClear
                  style={{ width: 260 }}
                  placeholder={`Select ${title}`}
                  value={current.values as any}
                  onChange={(vals) => setFilters((f) => ({ ...f, [filterKey]: { type: 'enum', values: vals } }))}
                  options={uniqueValues.map((v) => ({ value: v, label: v }))}
                />
                <div className="filter-actions">
                  <Button type="primary" size="small" onClick={() => confirm()}>
                    Apply
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setFilters((f) => ({ ...f, [filterKey]: { type: 'enum', values: [] } }));
                      clearFilters?.();
                      confirm();
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            );
          };
        } else {
          // Unknown/object/array – no filter by default
        }
      }

      return base;
    }) as ColumnsType<RecordType>;
  }, [data, columnsConfig, providedColumns, filters]);

  const filteredData = useMemo(() => {
    const applyFilter = (record: Record<string, any>) => {
      for (const [key, filter] of Object.entries(filters)) {
        if (!filter || !isFilterActive(filter)) continue;
        const value = record?.[key];
        switch (filter.type) {
          case 'text': {
            const needle = filter.value.toLowerCase();
            if (needle && String(value ?? '').toLowerCase().indexOf(needle) === -1) return false;
            break;
          }
          case 'number': {
            const num = typeof value === 'number' ? value : Number(value);
            if (filter.min !== undefined && !(num >= filter.min)) return false;
            if (filter.max !== undefined && !(num <= filter.max)) return false;
            break;
          }
          case 'boolean': {
            if (filter.value !== undefined && value !== filter.value) return false;
            break;
          }
          case 'date': {
            if (!value) return false;
            const d = value instanceof Date ? dayjs(value) : dayjs(String(value));
            if (!d.isValid()) return false;
            if (filter.from && d.isBefore(filter.from)) return false;
            if (filter.to && d.isAfter(filter.to)) return false;
            break;
          }
          case 'enum': {
            if (filter.values.length > 0) {
              const v = typeof value === 'string' ? value : String(value);
              if (!filter.values.includes(v)) return false;
            }
            break;
          }
        }
      }
      return true;
    };

    return data.filter((row) => applyFilter(row as any));
  }, [data, filters]);

  const tableColumns = inferredColumns.map((col: any) => ({
    ...col,
    // ensure sorter for primitive types for better UX
    sorter:
      col.sorter !== undefined
        ? col.sorter
        : (a: any, b: any) => {
            const va = a?.[col.dataIndex];
            const vb = b?.[col.dataIndex];
            if (typeof va === 'number' && typeof vb === 'number') return va - vb;
            if (typeof va === 'boolean' && typeof vb === 'boolean') return (va === vb ? 0 : va ? 1 : -1);
            const sa = va === null || va === undefined ? '' : String(va).toLowerCase();
            const sb = vb === null || vb === undefined ? '' : String(vb).toLowerCase();
            return sa.localeCompare(sb);
          }
  }));

  const resolvedRowKey: any =
    rowKey || ((record: any, index?: number) => (record && (record.id ?? record.key)) || String(index));

  const handleTableChange = (
    nextPagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    _sorter: SorterResult<RecordType> | SorterResult<RecordType>[],
    _extra: TableCurrentDataSource<RecordType>
  ) => {
    setPagination(nextPagination);
  };

  const clearAllFilters = () => setFilters({});

  return (
    <div className={className} style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text type="secondary">Rows: {filteredData.length} / {data.length}</Text>
        <Button icon={<CloseCircleFilled />} onClick={clearAllFilters} disabled={Object.values(filters).every((f) => !isFilterActive(f))}>
          Clear all filters
        </Button>
      </div>
      <Table
        rowKey={resolvedRowKey}
        columns={tableColumns as any}
        dataSource={filteredData}
        pagination={{ ...pagination, ...providedPagination }}
        onChange={handleTableChange}
        scroll={{ x: true }}
      />
    </div>
  );
}

export default JsonDataGrid;