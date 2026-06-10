/**
 * Data transformation utilities for HSQLDB -> PostgreSQL migration.
 *
 * Handles parsing INSERT statements, filtering Mendix system columns,
 * type conversion, and building parameterized PostgreSQL inserts.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Columns to strip from every INSERT (Mendix audit/metadata columns). */
export const SYSTEM_COLUMNS = [
  'system$owner',
  'system$changedby',
  'submetaobjectname',
] as const;

/** Table-name prefixes / exact names to skip entirely. */
export const SKIP_TABLES = [
  'system$',
  'mendixsystem$',
  'mxmodelreflection$',
  'blocks',
  'script',
  'cachedrows',
  'text',
] as const;

type PostgresValue = string | number | boolean | Date | Buffer | null;

// ── INSERT Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a single HSQLDB INSERT line into table name and raw value strings.
 *
 * Handles:
 *   INSERT INTO "table" VALUES(v1,v2,...)
 *   INSERT INTO table VALUES(v1,v2,...)
 *
 * Returns null for non-INSERT lines.
 */
export function parseInsert(line: string): {
  tableName: string;
  values: string[];
} | null {
  const trimmed = line.trim();
  if (!trimmed.toUpperCase().startsWith('INSERT INTO ')) return null;

  // Match table name (quoted or unquoted)
  const tableMatch = trimmed.match(
    /^INSERT\s+INTO\s+(?:"([^"]+)"|(\S+))\s+VALUES\s*\((.*)\)\s*;?\s*$/i,
  );
  if (!tableMatch) return null;

  const tableName = tableMatch[1] ?? tableMatch[2];
  const valuesStr = tableMatch[3];

  return {
    tableName,
    values: splitValues(valuesStr),
  };
}

/**
 * Split a VALUES clause into individual value strings, respecting:
 * - Single-quoted strings (with escaped '' inside)
 * - Parenthesized expressions
 * - X'...' hex literals
 */
function splitValues(raw: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inQuote) {
      current += ch;
      if (ch === "'") {
        // Check for escaped quote ''
        if (i + 1 < raw.length && raw[i + 1] === "'") {
          current += raw[i + 1];
          i++;
        } else {
          inQuote = false;
        }
      }
    } else {
      if (ch === "'") {
        inQuote = true;
        current += ch;
      } else if (ch === '(') {
        parenDepth++;
        current += ch;
      } else if (ch === ')') {
        parenDepth--;
        current += ch;
      } else if (ch === ',' && parenDepth === 0) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  if (current.trim()) {
    values.push(current.trim());
  }

  return values;
}

// ── Value Transformation ─────────────────────────────────────────────────────

/**
 * Convert a raw HSQLDB value string to a JavaScript value suitable for
 * parameterized PostgreSQL queries.
 */
export function transformValue(value: string, columnType: string): PostgresValue {
  const trimmed = value.trim();

  // NULL
  if (trimmed.toUpperCase() === 'NULL') return null;

  // Boolean
  if (trimmed.toUpperCase() === 'TRUE') return true;
  if (trimmed.toUpperCase() === 'FALSE') return false;

  // Hex binary: X'...'
  if (/^X'/i.test(trimmed)) {
    return Buffer.from(trimmed.slice(2, -1), 'hex');
  }

  // Quoted string
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const inner = trimmed.slice(1, -1).replace(/''/g, "'");

    // Timestamp / date
    if (columnType.toLowerCase().includes('timestamp') || columnType.toLowerCase().includes('date')) {
      const d = new Date(inner.replace(' ', 'T'));
      return isNaN(d.getTime()) ? inner : d;
    }

    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inner)) {
      return inner;
    }

    return inner;
  }

  // Numeric
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num)) return num;
  }

  // Fallback: return as string
  return trimmed;
}

// ── Column Filtering ─────────────────────────────────────────────────────────

/**
 * Check if a table should be skipped.
 */
export function shouldSkipTable(tableName: string): boolean {
  const lower = tableName.toLowerCase();
  return SKIP_TABLES.some((prefix) => lower.startsWith(prefix.toLowerCase()));
}

/**
 * Check if a column is a Mendix system column.
 */
export function isSystemColumn(columnName: string): boolean {
  const lower = columnName.toLowerCase();
  return SYSTEM_COLUMNS.some((c) => c.toLowerCase() === lower);
}

/**
 * Given raw column names and raw values, filter out system columns and return
 * aligned arrays of clean column names and transformed values.
 */
export function filterSystemColumns(
  columns: string[],
  values: string[],
  columnTypes: string[],
): { columns: string[]; values: PostgresValue[] } {
  const cleanColumns: string[] = [];
  const cleanValues: PostgresValue[] = [];

  for (let i = 0; i < columns.length; i++) {
    if (!isSystemColumn(columns[i])) {
      cleanColumns.push(columns[i]);
      cleanValues.push(transformValue(values[i], columnTypes[i] ?? 'varchar'));
    }
  }

  return { columns: cleanColumns, values: cleanValues };
}

// ── PostgreSQL Insert Builder ────────────────────────────────────────────────

/**
 * Build a parameterized PostgreSQL INSERT statement.
 *
 * Returns { sql, params } where sql uses $1, $2, ... placeholders.
 */
export function buildPostgresInsert(
  tableName: string,
  columns: string[],
  values: PostgresValue[],
): { sql: string; params: PostgresValue[] } {
  if (columns.length === 0 || values.length === 0) {
    return { sql: '', params: [] };
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const colList = columns.map((c) => `"${c}"`).join(', ');

  // Escape table name (may contain $ from Mendix naming)
  const safeTable = `"${tableName}"`;

  return {
    sql: `INSERT INTO ${safeTable} (${colList}) VALUES (${placeholders})`,
    params: values,
  };
}

// ── Schema Extraction ────────────────────────────────────────────────────────

/**
 * Parse a CREATE TABLE line to extract column names and types.
 *
 * Returns { tableName, columns: [{name, type}] } or null.
 */
export function parseCreateTable(line: string): {
  tableName: string;
  columns: { name: string; type: string }[];
} | null {
  const trimmed = line.trim();
  if (!trimmed.toUpperCase().startsWith('CREATE MEMORY TABLE ') &&
      !trimmed.toUpperCase().startsWith('CREATE CACHED TABLE ') &&
      !trimmed.toUpperCase().startsWith('CREATE TABLE ')) {
    return null;
  }

  // Extract table name
  const nameMatch = trimmed.match(
    /CREATE\s+(?:MEMORY|CACHED)?\s*TABLE\s+(?:PUBLIC\.)?"?([^"(]+)"?\s*\(([\s\S]*)\)\s*$/i,
  );
  if (!nameMatch) return null;

  const tableName = nameMatch[1];
  const body = nameMatch[2];

  // Parse column definitions (simplified - handles basic types)
  const columns: { name: string; type: string }[] = [];
  const parts = splitColumnDefs(body);

  for (const part of parts) {
    const colMatch = part.trim().match(/^"([^"]+)"\s+(\w+)/);
    if (colMatch) {
      columns.push({ name: colMatch[1], type: colMatch[2] });
    }
  }

  return { tableName, columns };
}

/**
 * Split CREATE TABLE body into column/constraint definitions, respecting
 * nested parentheses.
 */
function splitColumnDefs(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) parts.push(current);
  return parts;
}
