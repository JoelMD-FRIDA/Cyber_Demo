import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

// ── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_COLUMNS = ['system$owner', 'system$changedby', 'submetaobjectname'];
const SKIP_TABLE_PREFIXES = [
  'system$',
  'mendixsystem$',
  'mxmodelreflection$',
  'blocks',
  'script',
  'cachedrows',
  'text',
];

// ── Config ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCRIPT_PATH = resolve(__dirname, '../../deployment/data/database/hsqldb/default/default.script');
const HSQLDB_SCRIPT = process.env.HSQLDB_SCRIPT || DEFAULT_SCRIPT_PATH;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function parseInsert(line) {
  const trimmed = line.trim();
  if (!trimmed.toUpperCase().startsWith('INSERT INTO ')) return null;

  const tableMatch = trimmed.match(
    /^INSERT\s+INTO\s+(?:"([^"]+)"|(\S+))\s+VALUES\s*\((.*)\)\s*;?\s*$/i,
  );
  if (!tableMatch) return null;

  return {
    tableName: tableMatch[1] ?? tableMatch[2],
    values: splitValues(tableMatch[3]),
  };
}

function splitValues(raw) {
  const values = [];
  let current = '';
  let inQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuote) {
      current += ch;
      if (ch === "'") {
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
  if (current.trim()) values.push(current.trim());
  return values;
}

function parseCreateTable(line) {
  const trimmed = line.trim();
  if (!trimmed.toUpperCase().startsWith('CREATE MEMORY TABLE ') &&
      !trimmed.toUpperCase().startsWith('CREATE CACHED TABLE ') &&
      !trimmed.toUpperCase().startsWith('CREATE TABLE ')) {
    return null;
  }

  const nameMatch = trimmed.match(
    /CREATE\s+(?:MEMORY|CACHED)?\s*TABLE\s+(?:PUBLIC\.)?"?([^"(]+)"?\s*\((.*)\)\s*$/is,
  );
  if (!nameMatch) return null;

  const tableName = nameMatch[1];
  const columns = [];
  const parts = splitColumnDefs(nameMatch[2]);

  for (const part of parts) {
    const colMatch = part.trim().match(/^"([^"]+)"\s+(\w+)/);
    if (colMatch) {
      columns.push({ name: colMatch[1], type: colMatch[2] });
    }
  }

  return { tableName, columns };
}

function splitColumnDefs(body) {
  const parts = [];
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

// ── Transformation ───────────────────────────────────────────────────────────

function transformValue(value, columnType) {
  const trimmed = value.trim();
  if (trimmed.toUpperCase() === 'NULL') return null;
  if (trimmed.toUpperCase() === 'TRUE') return true;
  if (trimmed.toUpperCase() === 'FALSE') return false;
  if (/^X'/i.test(trimmed)) return Buffer.from(trimmed.slice(2, -1), 'hex');

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const inner = trimmed.slice(1, -1).replace(/''/g, "'");
    if (columnType?.toLowerCase().includes('timestamp') || columnType?.toLowerCase().includes('date')) {
      const d = new Date(inner.replace(' ', 'T'));
      return isNaN(d.getTime()) ? inner : d;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inner)) {
      return inner;
    }
    return inner;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num)) return num;
  }

  return trimmed;
}

function shouldSkipTable(tableName) {
  const lower = tableName.toLowerCase();
  return SKIP_TABLE_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()));
}

function isSystemColumn(col) {
  const lower = col.toLowerCase();
  return SYSTEM_COLUMNS.some((c) => c.toLowerCase() === lower);
}

// ── Migration Logic ──────────────────────────────────────────────────────────

async function main() {
  console.log('=== HSQLDB -> PostgreSQL Migration ===\n');
  console.log(`Script: ${HSQLDB_SCRIPT}`);
  console.log(`Database: ${DATABASE_URL.split('@')[1] ?? DATABASE_URL}\n`);

  // Read script file
  if (!existsSync(HSQLDB_SCRIPT)) {
    console.error(`ERROR: Script file not found: ${HSQLDB_SCRIPT}`);
    process.exit(1);
  }

  const content = readFileSync(HSQLDB_SCRIPT, 'utf-8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);

  // Phase 1: Parse schema
  console.log('\n--- Phase 1: Parsing schema ---');
  const tableSchemas = new Map(); // tableName -> [{name, type}]

  for (const line of lines) {
    const ct = parseCreateTable(line);
    if (ct && !shouldSkipTable(ct.tableName)) {
      tableSchemas.set(ct.tableName, ct.columns);
    }
  }
  console.log(`Tables to migrate: ${tableSchemas.size}`);

  // Phase 2: Parse and filter INSERTs
  console.log('\n--- Phase 2: Parsing data ---');
  const insertsByTable = new Map(); // tableName -> [{columns, values}]
  let totalInserts = 0;
  let skippedTables = 0;
  let skippedRows = 0;

  for (const line of lines) {
    const parsed = parseInsert(line);
    if (!parsed) continue;
    totalInserts++;

    if (shouldSkipTable(parsed.tableName)) {
      skippedTables++;
      continue;
    }

    const schema = tableSchemas.get(parsed.tableName);
    if (!schema || schema.length === 0) continue;

    // Align values with columns, filter system columns
    const cleanColumns = [];
    const cleanValues = [];

    for (let i = 0; i < schema.length; i++) {
      const col = schema[i];
      if (isSystemColumn(col.name)) continue;

      const rawValue = parsed.values[i] ?? 'NULL';
      cleanColumns.push(col.name);
      cleanValues.push(transformValue(rawValue, col.type));
    }

    if (cleanColumns.length === 0) {
      skippedRows++;
      continue;
    }

    if (!insertsByTable.has(parsed.tableName)) {
      insertsByTable.set(parsed.tableName, []);
    }
    insertsByTable.get(parsed.tableName).push({
      columns: cleanColumns,
      values: cleanValues,
    });
  }

  console.log(`Total INSERT statements: ${totalInserts}`);
  console.log(`Skipped (system tables): ${skippedTables}`);
  console.log(`Skipped (empty rows): ${skippedRows}`);
  console.log(`Tables with data: ${insertsByTable.size}`);

  // Phase 3: Connect and migrate
  console.log('\n--- Phase 3: Migrating data ---');
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    await pool.query('BEGIN');

    const results = [];

    for (const [tableName, rows] of insertsByTable) {
      if (rows.length === 0) continue;

      // Create table if not exists
      const schema = tableSchemas.get(tableName);
      if (schema) {
        const createSql = buildCreateTableIfNotExists(tableName, schema);
        if (createSql) {
          try {
            await pool.query(createSql);
          } catch (e) {
            // Table may already exist with different schema - continue
            console.log(`  [warn] Could not create table ${tableName}: ${e.message}`);
          }
        }
      }

      // Insert rows
      let inserted = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          const { sql, params } = buildInsert(tableName, row.columns, row.values);
          if (sql) {
            await pool.query(sql, params);
            inserted++;
          }
        } catch (e) {
          failed++;
          if (failed <= 3) {
            console.log(`  [error] ${tableName}: ${e.message}`);
          }
        }
      }

      results.push({ table: tableName, inserted, failed, total: rows.length });
      console.log(`  ${tableName}: ${inserted}/${rows.length} rows`);
    }

    await pool.query('COMMIT');

    // Phase 4: Verification
    console.log('\n--- Phase 4: Verification ---');
    for (const r of results) {
      const { rows } = await pool.query(`SELECT COUNT(*) FROM "${r.table}"`);
      const count = parseInt(rows[0].count, 10);
      const status = count === r.inserted ? 'OK' : 'MISMATCH';
      console.log(`  ${r.table}: ${count} rows in DB (${status})`);
    }

    // Summary
    console.log('\n=== Migration Summary ===');
    const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
    const totalFailed = results.reduce((s, r) => s + r.failed, 0);
    console.log(`Tables migrated: ${results.length}`);
    console.log(`Total rows inserted: ${totalInserted}`);
    console.log(`Total rows failed: ${totalFailed}`);
    console.log(`Status: ${totalFailed === 0 ? 'SUCCESS' : 'COMPLETED WITH ERRORS'}`);

  } catch (e) {
    await pool.query('ROLLBACK');
    console.error(`\nERROR: Migration failed - ${e.message}`);
    console.error('Transaction rolled back. No changes committed.');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ── SQL Builders ─────────────────────────────────────────────────────────────

function buildCreateTableIfNotExists(tableName, columns) {
  if (columns.length === 0) return null;

  const colDefs = columns.map((col) => {
    const pgType = mapType(col.type);
    return `"${col.name}" ${pgType}`;
  }).join(',\n  ');

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${colDefs}\n)`;
}

function mapType(hsqlType) {
  const t = hsqlType.toUpperCase();
  if (t === 'BIGINT') return 'BIGINT';
  if (t === 'INTEGER' || t === 'INT') return 'INTEGER';
  if (t === 'SMALLINT') return 'SMALLINT';
  if (t === 'BOOLEAN') return 'BOOLEAN';
  if (t === 'TIMESTAMP') return 'TIMESTAMP';
  if (t === 'VARCHAR') return 'TEXT';
  if (t === 'VARBINARY') return 'BYTEA';
  if (t.startsWith('VARCHAR')) return 'TEXT';
  return 'TEXT';
}

function buildInsert(tableName, columns, values) {
  if (columns.length === 0 || values.length === 0) {
    return { sql: '', params: [] };
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const colList = columns.map((c) => `"${c}"`).join(', ');

  return {
    sql: `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})`,
    params: values,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER DATA IMPORT (--master-data-only)
// ═══════════════════════════════════════════════════════════════════════════════

// Maps Mendix table → Drizzle schema table with column mapping & conflict key
const MASTER_DATA_TABLES = {
  'domaincheck$domaincheckprovider': {
    drizzleTable: 'domain_check_providers',
    columnMap: {
      'uuid': 'uuid',
      'name': 'name',
      'isactive': 'is_active',
      'websiteurl': 'website_url',
      'shortdescription': 'short_description',
      'longdescription': 'long_description',
      'apibaseurl': 'api_base_url',
      'apikeyencrypted': 'api_key_encrypted',
    },
    idColumn: 'uuid',
    idType: 'uuid',
  },
  'domaincheck$domaincheckcategory': {
    drizzleTable: 'domain_check_categories',
    columnMap: {
      'uuid': 'uuid',
      'name': 'name',
      'description': 'description',
    },
    idColumn: 'uuid',
    idType: 'uuid',
  },
  'core$registrationkey': {
    drizzleTable: 'registration_keys',
    columnMap: {
      'code': 'code',
      'companydomain': 'company_domain',
      'totalslots': 'total_slots',
      'company': 'company',
    },
    idColumn: 'code',
    idType: 'varchar',
  },
  'api$apicredentials': {
    drizzleTable: 'api_credentials',
    columnMap: {
      'apiurl': 'api_url',
      'oauthurl': 'oauth_url',
      'username': 'username',
      'passwordencrypted': 'password_encrypted',
    },
    idColumn: null,  // no unique constraint; use pre-check
    idType: null,
  },
  'system$language': {
    drizzleTable: 'system_languages',
    columnMap: {
      'code': 'code',
      'description': 'description',
    },
    idColumn: 'code',
    idType: 'varchar',
  },
  'encryption$pgpcertificate': {
    drizzleTable: 'pgp_certificates',
    columnMap: {
      'certificatetype': 'certificate_type',
      'passphrase_encrypted': 'passphrase_encrypted',
      'reference': 'reference',
      'emailaddress': 'email_address',
    },
    idColumn: null,
    idType: null,
  },
  'email_connector$emailtemplate': {
    drizzleTable: 'email_templates',
    columnMap: {
      'templatename': 'name',
      'subject': 'subject',
      'content': 'body',
      'plainbody': 'plain_body',
      'fromaddress': 'from_address',
      'fromdisplayname': 'from_display_name',
      'replyto': 'reply_to',
      'to': 'to',
      'cc': 'cc',
      'bcc': 'bcc',
      'useonlyplaintext': 'use_only_plain_text',
      'hasattachment': 'has_attachment',
      'signed': 'signed',
      'encrypted': 'encrypted',
      'recipientstoggle': 'recipients_toggle',
      'sentdate': 'sent_date',
    },
    idColumn: 'name',
    idType: 'varchar',
  },
  'email_connector$emailaccount': {
    drizzleTable: 'email_accounts',
    columnMap: {
      'mailaddress': 'mail_address',
      'username': 'username',
      'password': 'password_encrypted',
      'fromdisplayname': 'from_display_name',
      'timeout': 'timeout',
      'issharedmailbox': 'is_shared_mailbox',
      'isp12configured': 'is_p12_configured',
      'isoauthused': 'is_oauth_used',
      'isldapconfigured': 'is_ldap_configured',
      'isoutgoingemailconfigured': 'is_outgoing_email_configured',
      'isincomingemailconfigured': 'is_incoming_email_configured',
      'sanitizeemailbodyforxssscript': 'sanitize_email_body_for_xss',
      'isemailconfigautodetect': 'is_email_config_auto_detect',
      'usesslcheckserveridentity': 'use_ssl_check_server_identity',
    },
    idColumn: 'mail_address',
    idType: 'varchar',
  },
  'email_connector$outgoingemailconfiguration': {
    drizzleTable: 'outgoing_email_configs',
    columnMap: {
      'serverhost': 'server_host',
      'serverport': 'server_port',
      'outgoingprotocol': 'outgoing_protocol',
      'ssl': 'ssl',
      'tls': 'tls',
      'sendmaxattempts': 'send_max_attempts',
    },
    idColumn: null,
    idType: null,
  },
  'email_connector$incomingemailconfiguration': {
    drizzleTable: 'incoming_email_configs',
    columnMap: {
      'serverhost': 'server_host',
      'serverport': 'server_port',
      'incomingprotocol': 'incoming_protocol',
      'folder': 'folder',
      'batchsize': 'batch_size',
      'fetchstrategy': 'fetch_strategy',
      'handling': 'handling',
      'movefolder': 'move_folder',
      'processinlineimage': 'process_inline_image',
      'notifyonnewemails': 'notify_on_new_emails',
      'usebatchimport': 'use_batch_import',
    },
    idColumn: null,
    idType: null,
  },
  'email_connector$ldapconfiguration': {
    drizzleTable: 'ldap_configurations',
    columnMap: {
      'ldaphost': 'ldap_host',
      'ldapport': 'ldap_port',
      'ldapusername': 'ldap_username',
      'ldappassword': 'ldap_password_encrypted',
      'basedn': 'base_dn',
      'authtype': 'auth_type',
      'isssl': 'is_ssl',
    },
    idColumn: null,
    idType: null,
  },
  'email_connector$oauthprovider': {
    drizzleTable: 'oauth_providers',
    columnMap: {
      'name': 'name',
      'oauthtype': 'oauth_type',
      'authorizationendpoint': 'authorization_endpoint',
      'tokenendpoint': 'token_endpoint',
      'clientid': 'client_id',
      'clientsecret': 'client_secret_encrypted',
      'tenantid': 'tenant_id',
      'emaildomain': 'email_domain',
      'callbackurl': 'callback_url',
      'callbackoperationpath': 'callback_operation_path',
      'openidwellknownmetadatauri': 'open_id_well_known_metadata_uri',
    },
    idColumn: null,
    idType: null,
  },
  'email_connector$oauthtoken': {
    drizzleTable: 'email_connector_oauth_tokens',
    columnMap: {
      'access_token': 'access_token',
      'refresh_token': 'refresh_token',
      'id_token': 'id_token',
      'token_type': 'token_type',
      'scope': 'scope',
      'expires_in': 'expires_in',
    },
    idColumn: null,
    idType: null,
  },
  'api$oauthtoken': {
    drizzleTable: 'oauth_tokens',
    columnMap: {
      'access_token': 'access_token',
      'expires_in': 'expires_in',
      'refresh_expires_in': 'refresh_expires_in',
      'token_type': 'token_type',
      'scope': 'scope',
      'expirydate': 'expiry_date',
    },
    idColumn: null,
    idType: null,
  },
  'domaincheck$appsettings': {
    drizzleTable: 'app_settings',
    columnMap: {
      'maximumnumberofchecks': 'maximum_number_of_checks',
    },
    idColumn: 'key',  // We set key='default' for the singleton
    idType: 'fixed',
    fixedKey: 'default',
  },
  'forgotpassword$configuration': {
    drizzleTable: 'forgot_password_configs',
    columnMap: {},
    idColumn: null,
    idType: null,
  },
};

// Entity types that should be explicitly skipped with a reason
const MASTER_DATA_SKIP = {
  'system$user': { reason: 'historical user accounts — excluded per plan scope' },
  'core$user': { reason: 'historical user data — excluded per plan scope' },
  'administration$account': { reason: 'historical account data — excluded per plan scope' },
  'core$activationrequest': { reason: 'historical activation requests — excluded per plan scope' },
  'system$session': { reason: 'historical session data — excluded per plan scope' },
  'system$queuedtask': { reason: 'historical queued task data — excluded per plan scope' },
  'system$processedqueuetask': { reason: 'historical processed task data — excluded per plan scope' },
  'system$userroles': { reason: 'historical user-role associations — excluded per plan scope' },
  'system$grantableroles': { reason: 'historical role grants — excluded per plan scope' },
  'system$user_language': { reason: 'historical user-language associations — excluded per plan scope' },
  'system$session_user': { reason: 'historical session-user associations — excluded per plan scope' },
  'system$timezone': { reason: 'timezone reference data — not in target schema' },
};

// ── Master Data Import ────────────────────────────────────────────────────────

function extractMendixValue(rawValue) {
  const trimmed = (rawValue ?? '').trim();
  if (trimmed.toUpperCase() === 'NULL') return null;
  if (trimmed.toUpperCase() === 'TRUE') return true;
  if (trimmed.toUpperCase() === 'FALSE') return false;

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num)) return num;
  }

  return trimmed;
}

function buildMasterUpsert(drizzleTable, drizzleCols, params, idColumn) {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
  const colList = drizzleCols.map((c) => `"${c}"`).join(', ');

  if (idColumn && drizzleCols.includes(idColumn)) {
    // ON CONFLICT upsert
    const updateParts = drizzleCols
      .filter((c) => c !== idColumn)
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');
    return {
      sql: `INSERT INTO "${drizzleTable}" (${colList}) VALUES (${placeholders}) ON CONFLICT ("${idColumn}") DO UPDATE SET ${updateParts}`,
      params,
    };
  }

  // Simple insert for tables without unique constraint
  return {
    sql: `INSERT INTO "${drizzleTable}" (${colList}) VALUES (${placeholders})`,
    params,
  };
}

async function importMasterData() {
  console.log('=== Master Data Import ===\n');
  console.log(`Script: ${HSQLDB_SCRIPT}`);
  console.log(`Database: ${DATABASE_URL.split('@')[1] ?? DATABASE_URL}\n`);

  if (!existsSync(HSQLDB_SCRIPT)) {
    console.error(`ERROR: Script file not found: ${HSQLDB_SCRIPT}`);
    process.exit(1);
  }

  const content = readFileSync(HSQLDB_SCRIPT, 'utf-8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}\n`);

  // Phase 1: Parse schema of master-data tables
  console.log('--- Phase 1: Parsing schema ---');
  const tableSchemas = new Map();

  for (const line of lines) {
    const ct = parseCreateTable(line);
    if (ct && MASTER_DATA_TABLES[ct.tableName]) {
      tableSchemas.set(ct.tableName, ct.columns);
    }
  }
  console.log(`Master-data tables found in schema: ${tableSchemas.size}\n`);

  // Phase 2: Parse INSERTs grouped by Mendix table
  console.log('--- Phase 2: Parsing data ---');
  const insertsByTable = new Map();

  for (const line of lines) {
    const parsed = parseInsert(line);
    if (!parsed) continue;

    const tableName = parsed.tableName;

    // Track only mapped master data or explicitly skipped tables
    if (MASTER_DATA_TABLES[tableName] || MASTER_DATA_SKIP[tableName]) {
      const schema = tableSchemas.get(tableName);
      if (!schema) {
        // For skipped tables, just count them
        if (!insertsByTable.has(tableName)) {
          insertsByTable.set(tableName, []);
        }
        insertsByTable.get(tableName).push(parsed.values);
        continue;
      }

      // Build row with column names
      const row = {};
      for (let i = 0; i < schema.length; i++) {
        const colName = schema[i].name;
        const rawValue = parsed.values[i] ?? 'NULL';
        row[colName] = extractMendixValue(rawValue);
      }

      if (!insertsByTable.has(tableName)) {
        insertsByTable.set(tableName, []);
      }
      insertsByTable.get(tableName).push(row);
    }
  }

  console.log(`Tables with rows: ${insertsByTable.size}\n`);

  // Phase 3: Import master data
  console.log('--- Phase 3: Importing master data ---\n');
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const stats = {
      imported: {},
      skipped: {},
      failed: {},
    };

    for (const [mendixTable, rows] of insertsByTable) {
      // Handle skipped tables
      if (MASTER_DATA_SKIP[mendixTable]) {
        stats.skipped[mendixTable] = {
          count: Array.isArray(rows) ? rows.length : 0,
          reason: MASTER_DATA_SKIP[mendixTable].reason,
        };
        continue;
      }

      const mapping = MASTER_DATA_TABLES[mendixTable];
      if (!mapping) continue;

      const { drizzleTable, columnMap, idColumn, fixedKey } = mapping;
      let imported = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          const drizzleCols = [];
          const params = [];

          // Map columns from Mendix → Drizzle
          for (const [mendixCol, drizzleCol] of Object.entries(columnMap)) {
            if (row[mendixCol] !== undefined && row[mendixCol] !== null) {
              drizzleCols.push(drizzleCol);
              let val = row[mendixCol];

              // Type conversions
              if (drizzleCol.endsWith('_at') || drizzleCol.endsWith('_date')) {
                // Timestamp columns — handle string→Date conversion
                if (typeof val === 'string' && val.includes('-') && val.includes(':')) {
                  const d = new Date(val.replace(' ', 'T'));
                  if (!isNaN(d.getTime())) val = d;
                }
              }

              params.push(val);
            }
          }

          // Handle fixed-key tables (e.g., app_settings with key='default')
          if (fixedKey && idColumn) {
            drizzleCols.push(idColumn);
            params.push(fixedKey);
          }

          if (drizzleCols.length === 0) {
            // Skip rows with no mapped columns
            failed++;
            continue;
          }

          const { sql, params: sqlParams } = buildMasterUpsert(
            drizzleTable, drizzleCols, params, idColumn,
          );

          try {
            await pool.query(sql, sqlParams);
            imported++;
          } catch (insertErr) {
            // If no unique constraint, try pre-check + insert fallback
            if (!idColumn && insertErr.message?.includes('duplicate key')) {
              // For tables without natural key, try mail_address pre-check
              const mailIdx = drizzleCols.indexOf('mail_address');
              if (mailIdx !== -1) {
                const mailVal = params[mailIdx];
                const { rows: existing } = await pool.query(
                  `SELECT id FROM "${drizzleTable}" WHERE "mail_address" = $1 LIMIT 1`,
                  [mailVal],
                );
                if (existing.length > 0) {
                  // Update by mail_address
                  const setClauses = drizzleCols
                    .map((c, i) => `"${c}" = $${i + 1}`)
                    .join(', ');
                  await pool.query(
                    `UPDATE "${drizzleTable}" SET ${setClauses} WHERE "mail_address" = $${drizzleCols.length + 1}`,
                    [...params, mailVal],
                  );
                  imported++;
                } else {
                  // Genuine error
                  failed++;
                  console.log(`  [error] ${drizzleTable}: ${insertErr.message}`);
                }
              } else {
                failed++;
                console.log(`  [error] ${drizzleTable}: ${insertErr.message}`);
              }
            } else if (!idColumn) {
              // For tables without any natural key: skip duplicate silently
              if (insertErr.message?.includes('duplicate key') || insertErr.message?.includes('unique constraint')) {
                imported++; // Count as successful idempotent skip
              } else {
                failed++;
                console.log(`  [error] ${drizzleTable}: ${insertErr.message}`);
              }
            } else {
              failed++;
              console.log(`  [error] ${drizzleTable}: ${insertErr.message}`);
            }
          }
        } catch (rowErr) {
          failed++;
          console.log(`  [error] ${drizzleTable}: ${rowErr.message}`);
        }
      }

      stats.imported[mendixTable] = {
        drizzleTable,
        total: rows.length,
        imported,
        failed,
      };
    }

    // Phase 4: Report
    console.log('\n=== Import Report ===\n');

    let totalImported = 0;
    let totalFailed = 0;

    // Print imported entities
    const importedTables = Object.keys(stats.imported).sort();
    if (importedTables.length > 0) {
      console.log('--- Imported ---');
      for (const mendixTable of importedTables) {
        const s = stats.imported[mendixTable];
        totalImported += s.imported;
        totalFailed += s.failed;
        const status = s.failed === 0 ? 'OK' : 'ERRORS';
        console.log(`  ${mendixTable} → ${s.drizzleTable}: ${s.imported}/${s.total} rows (${status})`);
      }
      console.log('');
    }

    // Print skipped entities
    const skippedTables = Object.keys(stats.skipped).sort();
    if (skippedTables.length > 0) {
      console.log('--- Skipped (by design) ---');
      for (const mendixTable of skippedTables) {
        const s = stats.skipped[mendixTable];
        console.log(`  ${mendixTable}: ${s.count} rows — ${s.reason}`);
      }
      console.log('');
    }

    // Summary
    console.log('--- Summary ---');
    const totalRows = Object.values(stats.imported).reduce((s, v) => s + v.total, 0);
    const totalSkip = Object.values(stats.skipped).reduce((s, v) => s + v.count, 0);
    console.log(`  Master-data tables: ${importedTables.length}`);
    console.log(`  Rows processed: ${totalRows}`);
    console.log(`  Rows imported: ${totalImported}`);
    console.log(`  Rows skipped (entity-level): ${totalSkip}`);
    console.log(`  Rows failed: ${totalFailed}`);
    console.log(`  Status: ${totalFailed === 0 ? 'SUCCESS' : 'COMPLETED WITH ERRORS'}`);

    // Print entity types with 0 rows for completeness
    const emptyTables = Object.keys(MASTER_DATA_TABLES)
      .filter((t) => !insertsByTable.has(t));
    if (emptyTables.length > 0) {
      console.log(`\n  Tables with 0 rows (no data in HSQLDB): ${emptyTables.join(', ')}`);
    }

  } catch (e) {
    console.error(`\nERROR: Master data import failed - ${e.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ── CLI Dispatch ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--master-data-only')) {
  importMasterData().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
} else {
  main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
}
