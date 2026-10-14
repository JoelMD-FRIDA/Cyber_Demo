/** Small parameterized SQL adapter for the application's existing catalog CRUD. */
import type { PoolClient } from 'pg';
import { sql, withWrites } from './postgres';
import type { Database } from './types';

type Tables = Database['public']['Tables'];
type Table = keyof Tables;
type Row<T extends Table> = Tables[T]['Row'];
type Result<T> = { data: T | null; count: number | null; error: { code: string; message: string } | null };
const columns: Record<Table, string[]> = {
  profiles: ['id','email','username','firstname','lastname','company','role','enabled','performed_domain_checks','created_at','updated_at'],
  registration_keys: ['id','code','company_domain','total_slots','company','used_count','enabled','expires_at','created_at'],
  domain_check_providers: ['id','provider_key','name','is_active','website_url','description','short_description','long_description','asset_path','created_at','updated_at'],
  domain_check_categories: ['id','category_key','name','description','asset_path','created_at','updated_at'],
  domain_checks: ['id','user_id','provider_id','category_id','url','status','raw_result','structured_result','external_job_id','external_report_id','attempt_count','next_poll_at','lease_until','claim_token','submission_started','last_error_code','last_error_message','has_accepted_disclaimer','disclaimer_accepted_at','disclaimer_version','remaining_domain_checks','max_checks','started_at','completed_at','created_at','updated_at'],
};
function failure(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'DATABASE_ERROR';
  return { data: null, count: null, error: { code, message: 'Database request failed.' } };
}

class Query<T extends Table> implements PromiseLike<Result<Row<T>[]>> {
  private filters: { field: string; op: string; value: unknown }[] = [];
  private operation = 'SELECT';
  private values: Record<string, unknown> = {};
  private ordering = '';
  private page: [number,number] | undefined;
  private count = false;
  private selection = '*';
  private head = false;
  constructor(private table: T, private connection?: PoolClient) {
    if (!Object.hasOwn(columns, table)) throw new Error('Unknown application table.');
  }
  private field(name: string) {
    if (!columns[this.table].includes(name)) throw new Error('Unknown application column.');
    return '"'+name+'"';
  }
  select(fields = '*', options?: { count?: string; head?: boolean }) {
    this.selection = fields === '*' ? '*' : fields.split(',').map(field=>this.field(field.trim())).join(',');
    this.count = options?.count === 'exact'; this.head = options?.head === true; return this;
  }
  eq(field: string, value: unknown) { this.field(field); this.filters.push({ field, op: '=', value }); return this; }
  gt(field: string, value: unknown) { this.field(field); this.filters.push({ field, op: '>', value }); return this; }
  ilike(field: string, value: string) { this.field(field); this.filters.push({ field, op: 'ILIKE', value }); return this; }
  order(field: string) { this.ordering = this.field(field); return this; }
  range(from: number, to: number) {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from || to-from > 100)
      throw new Error('Invalid page bounds.');
    this.page = [from,to-from+1]; return this;
  }
  insert(values: Tables[T]['Insert']) { this.operation = 'INSERT'; this.values = values; return this; }
  update(values: Tables[T]['Update']) { this.operation = 'UPDATE'; this.values = values; return this; }
  delete() { this.operation = 'DELETE'; return this; }
  async maybeSingle(): Promise<Result<Row<T>>> {
    const result = await this.execute();
    if ((result.data?.length ?? 0) > 1) return failure(new Error('Ambiguous row.'));
    return { ...result, data: result.data?.[0] ?? null };
  }
  async single(): Promise<Result<Row<T>>> {
    const result = await this.maybeSingle();
    return result.data ? result : failure(new Error('Expected one row.'));
  }
  then<U = Result<Row<T>[]>, V = never>(success?: ((value: Result<Row<T>[]>) => U | PromiseLike<U>) | null,
    fail?: ((reason: unknown) => V | PromiseLike<V>) | null): Promise<U | V> {
    return this.execute().then(success,fail);
  }
  private async execute(): Promise<Result<Row<T>[]>> {
    try {
      const parameters: unknown[] = [];
      const parameter = (value: unknown) => { parameters.push(value); return '$'+parameters.length; };
      const entries = Object.entries(this.values);
      const table = 'public."'+this.table+'"';
      let text = 'SELECT '+this.selection+' FROM '+table;
      if (this.operation === 'INSERT') {
        if (!entries.length) throw new Error('Empty insert.');
        text = `INSERT INTO ${table} (${entries.map(([key])=>this.field(key)).join(',')}) VALUES (${entries.map(([,v])=>parameter(v)).join(',')})`;
      } else if (this.operation === 'UPDATE') {
        if (!entries.length) throw new Error('Empty update.');
        text = `UPDATE ${table} SET ${entries.map(([key,v])=>this.field(key)+'='+parameter(v)).join(',')}`;
        if (columns[this.table].includes('updated_at')) text += ', updated_at=now()';
      } else if (this.operation === 'DELETE') text = 'DELETE FROM '+table;
      if (['UPDATE','DELETE'].includes(this.operation) && !this.filters.length) throw new Error('Unscoped mutation.');
      if (this.filters.length) text += ' WHERE '+this.filters.map(f=>this.field(f.field)+' '+f.op+' '+parameter(f.value)).join(' AND ');
      const run = async (client?: PoolClient): Promise<Result<Row<T>[]>> => {
        const query = client ? client.query.bind(client) : sql;
        let count: number | null = null;
        if (this.count) {
          const counted = await query(text.replace(/^SELECT .*? FROM /,'SELECT count(*)::int AS total FROM '),parameters);
          count = counted.rows[0]?.total ?? 0;
        }
        if (this.head) return { data: [], count, error: null };
        let final = text;
        if (this.operation !== 'SELECT') final += ' RETURNING *';
        else {
          if (this.ordering) final += ' ORDER BY '+this.ordering;
          if (this.page) final += ` LIMIT ${parameter(this.page[1])} OFFSET ${parameter(this.page[0])}`;
        }
        const result = await query(final,parameters);
        return { data: result.rows as Row<T>[], count, error: null };
      };
      return await (this.connection ? run(this.connection) : this.operation === 'SELECT' ? run() : withWrites(run));
    } catch (error) { return failure(error); }
  }
}
export function createDatabaseClient(connection?: PoolClient) {
  return {
    from<T extends Table>(table: T) { return new Query(table, connection); },
    async rpc(name: 'create_queued_domain_check' | 'claim_domain_check' | 'claim_domain_checks', args: Record<string,unknown>): Promise<Result<Row<'domain_checks'>[]>> {
      try {
        const keys = name === 'create_queued_domain_check'
          ? ['p_user_id','p_provider_id','p_category_id','p_url','p_has_accepted_disclaimer','p_disclaimer_version','p_limit']
          : ['p_check_id','p_lease_seconds'];
        const fn = name === 'claim_domain_checks' ? 'claim_domain_check' : name;
        if (!['create_queued_domain_check','claim_domain_check'].includes(fn)) throw new Error('Unknown database operation.');
        const values = keys.map(key=>args[key] ?? (key === 'p_check_id' ? null : 120));
        const text = 'SELECT * FROM public.'+fn+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+')';
        const run = async (client: PoolClient) => {
          const result = await client.query(text,values);
          return { data: result.rows as Row<'domain_checks'>[], count: null, error: null };
        };
        return await (connection ? run(connection) : withWrites(run));
      } catch (error) {
        if (error instanceof Error && ['CHECK_LIMIT_EXCEEDED','PROVIDER_NOT_FOUND','CATEGORY_NOT_FOUND'].includes(error.message))
          return { data:null,count:null,error:{ code:'P0001',message:error.message } };
        return failure(error);
      }
    },
  };
}
export type AppDatabaseClient = ReturnType<typeof createDatabaseClient>;
