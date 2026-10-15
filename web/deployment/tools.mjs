import { Client } from 'pg';
import * as tar from 'tar';
import * as fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash,randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.umask(0o077);
const root=dirname(fileURLToPath(import.meta.url));
const WRITE_LOCK=734291861,MIGRATION_LOCK=734291862;
const command=process.argv[2],MAX=256*1024*1024;
const children=new Set();
const abort=new AbortController();
function stop(){abort.abort();for(const child of children)child.kill('SIGKILL');setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',stop);
const deadline=setTimeout(stop,command==='migrate'?90_000:240_000);
deadline.unref();
function need(ok,message='Maintenance validation failed.') {if(!ok)throw new Error(message);}
async function configuration() {
 const path=process.env.PGSERVICEFILE;need(path?.startsWith('/'));
 const st=await fs.lstat(path);need(st.isFile()&&!st.isSymbolicLink()&&(st.mode&0o077)===0);
 const config={};let section=false;
 for(const raw of (await fs.readFile(path,'utf8')).split('\n')) {
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  if(line.startsWith('[')){section=line==='[frida]';continue;}
  if(!section)continue;
  const i=line.indexOf('=');need(i>0);const key=line.slice(0,i).trim(),value=line.slice(i+1).trim();
  need(['host','port','dbname','user','password','sslmode','sslrootcert'].includes(key)&&!Object.hasOwn(config,key));config[key]=value;
 }
 need(config.host&&config.dbname&&config.user&&config.password);
 const options={host:config.host,database:config.dbname,user:config.user,password:config.password,port:Number(config.port||5432),
  connectionTimeoutMillis:5000,statement_timeout:60_000,lock_timeout:60_000};
 if(config.sslmode==='verify-full')options.ssl={rejectUnauthorized:true,ca:await fs.readFile(config.sslrootcert,'utf8')};
 else need(!config.sslmode||config.sslmode==='disable');
 return {config,options};
}
async function connection() {const {config,options}=await configuration();const client=new Client(options);await client.connect();return {client,config};}
async function checksum(path) {const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
function limit(max=MAX) {let size=0;return new Transform({transform(chunk,_encoding,done){size+=chunk.length;done(size>max?new Error('Bundle too large.'):null,chunk);}});}
async function run(name,args,output) {
 const binary=join(process.env.PG_BIN_DIRECTORY||'/usr/lib/postgresql/18/bin',name);
 const child=spawn(binary,args,{stdio:['ignore',output?'pipe':'ignore','ignore'],env:{...process.env,PGSERVICE:'frida'},signal:abort.signal});
 children.add(child);
 const completion=new Promise((yes,no)=>{child.once('error',no);child.once('exit',code=>code===0?yes():no(new Error('Database tool failed.')));});
 try {await Promise.all([completion,output?pipeline(child.stdout,limit(),createWriteStream(output,{flags:'wx',mode:0o600}),{signal:abort.signal}):Promise.resolve()]);}
 catch(error){child.kill('SIGKILL');throw error;}finally{children.delete(child);}
}
async function scratch() {
 const parent=process.env.BACKUP_STAGING_DIRECTORY;need(parent?.startsWith('/'));
 need(await fs.realpath(parent)===resolve(parent));return fs.mkdtemp(join(parent,'frida-'));
}
async function assetDirectory() {const path=process.env.ASSET_DIRECTORY;need(path?.startsWith('/'));need(await fs.realpath(path)===resolve(path));return resolve(path);}
async function inventory(directory,prefix='') {
 let files=[];
 for(const item of await fs.readdir(join(directory,prefix),{withFileTypes:true})) {
  const path=prefix?prefix+'/'+item.name:item.name;need(!abort.signal.aborted&&!item.isSymbolicLink());
  if(item.isDirectory())files.push(...await inventory(directory,path));
  else {need(item.isFile()&&/^(providers|categories)\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/.test(path));files.push(path);}
  need(files.length<=10000);
 }
 return files.sort();
}
async function grants(db) {
 await db.query('GRANT USAGE ON SCHEMA public TO frida_domain_app,frida_domain_backup');
 await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON profiles,registration_keys,domain_check_providers,domain_check_categories,domain_checks,oidc_identities,app_sessions,oidc_transactions TO frida_domain_app');
 await db.query('GRANT SELECT ON app_maintenance,frida_migrations TO frida_domain_app');
 await db.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO frida_domain_backup');
 await db.query('GRANT UPDATE(active) ON app_maintenance TO frida_domain_backup');
 await db.query('GRANT EXECUTE ON FUNCTION create_queued_domain_check(uuid,uuid,uuid,text,boolean,text,integer),claim_domain_check(uuid,integer) TO frida_domain_app');
}
async function tableCount(db) {return (await db.query("SELECT count(*)::int AS total FROM pg_tables WHERE schemaname='public'")).rows[0].total;}
async function owner(db) {need(!['frida_domain_app','frida_domain_backup'].includes((await db.query('SELECT current_user AS name')).rows[0].name));}
async function provision(db) {
 await owner(db);
 const roles=[['frida_domain_app',process.env.FRIDA_APP_DB_PASSWORD],['frida_domain_backup',process.env.FRIDA_BACKUP_DB_PASSWORD]];
 for(const [,secret] of roles)need(secret&&secret.length>=24&&!secret.includes('\n'));
 await db.query('BEGIN');
 try {
  await db.query('SELECT pg_advisory_xact_lock($1)',[MIGRATION_LOCK]);
  need(process.env.FRIDA_EMPTY_INSTALL==='true'&&await tableCount(db)===0);
  for(const [role,secret] of roles) {
   need((await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount===0);
   const statement=(await db.query("SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',$1::text,$2::text)",[role,secret])).rows[0].format;
   await db.query(statement);
  }
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}
}
async function migrate(db) {
 await owner(db);
 await db.query('BEGIN');
 try {
  await db.query('SELECT pg_advisory_xact_lock($1)',[MIGRATION_LOCK]);
  await db.query('SELECT pg_advisory_xact_lock($1)',[WRITE_LOCK]);
  const exists=(await db.query("SELECT to_regclass('public.frida_migrations') AS name")).rows[0].name;
  if(!exists) {
   need(command==='init'&&process.env.FRIDA_EMPTY_INSTALL==='true'&&await tableCount(db)===0,'Refusing to initialize a populated or unapproved target.');
   await db.query('CREATE TABLE frida_migrations(id text primary key,sha256 text not null,applied_at timestamptz not null default now())');
  }
  const manifest=JSON.parse(await fs.readFile(join(root,'contract.json'),'utf8'));
  const applied=(await db.query('SELECT id,sha256 FROM frida_migrations ORDER BY id')).rows;
  need(applied.length<=manifest.reviewed_migrations.length);
  for(let i=0;i<manifest.reviewed_migrations.length;i++) {
   const item=manifest.reviewed_migrations[i];need(/^\d{14}_[a-z0-9_]+\.sql$/.test(item.file));
   const file=join(root,'migrations',item.file);need(await fs.realpath(file)===file&&await checksum(file)===item.sha256);
   if(i<applied.length){need(applied[i].id===item.file&&applied[i].sha256===item.sha256);continue;}
   const sql=await fs.readFile(file,'utf8');need(!/\b(DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i.test(sql));
   await db.query(sql);await db.query('INSERT INTO frida_migrations(id,sha256) VALUES($1,$2)',[item.file,item.sha256]);
  }
  await grants(db);await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}
}
async function backup(db,config) {
 const stage=await scratch();let paused=false,locked=false;
 try {
  await db.query('SELECT pg_advisory_lock($1)',[WRITE_LOCK]);locked=true;
  need((await db.query('SELECT active FROM app_maintenance WHERE id=true')).rows[0]?.active===false);
  await db.query('UPDATE app_maintenance SET active=true WHERE id=true');paused=true;
  await run('pg_dump',['--format=custom','--no-owner','--no-privileges','--dbname=service=frida'],join(stage,'database.dump'));
  await fs.mkdir(join(stage,'assets'),{mode:0o700});
  const assets=await assetDirectory(),files=await inventory(assets);
  let total=(await fs.stat(join(stage,'database.dump'))).size;
  const manifest={schema:1,id:'frida-domain-check',database:config.dbname,files:[]};
  manifest.files.push({path:'database.dump',sha256:await checksum(join(stage,'database.dump'))});
  for(const file of files) {
   need(!abort.signal.aborted);total+=(await fs.stat(join(assets,file))).size;need(total<MAX);
   const target=join(stage,'assets',file);await fs.mkdir(dirname(target),{recursive:true,mode:0o700});
   await fs.copyFile(join(assets,file),target);
   manifest.files.push({path:'assets/'+file,sha256:await checksum(target)});
  }
  need(Buffer.byteLength(JSON.stringify(manifest))<=1024*1024);
  await fs.writeFile(join(stage,'manifest.json'),JSON.stringify(manifest),{mode:0o600});
  await pipeline(tar.c({cwd:stage,portable:true},['manifest.json','database.dump','assets']),limit(),process.stdout,{signal:abort.signal});
 }finally {
  if(paused)await db.query('UPDATE app_maintenance SET active=false WHERE id=true');
  if(locked)await db.query('SELECT pg_advisory_unlock($1)',[WRITE_LOCK]);
  await fs.rm(stage,{recursive:true,force:true});
 }
}
async function unpack(file,stage) {
 const names=new Set();let total=0;
 await tar.t({file,strict:true,onReadEntry:entry=>{
  const name=entry.path.replace(/\/$/,'');
  need(['File','Directory'].includes(entry.type)&&!names.has(name));names.add(name);
  need(name==='manifest.json'||name==='database.dump'||name==='assets'||/^assets\/(providers|categories)(\/[a-f0-9-]{36}(\/[a-f0-9-]{36}\.png)?)?$/.test(name));
  total+=entry.size;need(total<=MAX&&names.size<=30002&&(name!=='manifest.json'||entry.size<=1024*1024));
 }});
 await tar.x({file,cwd:stage,strict:true,preservePaths:false,filter:(_path,entry)=>['File','Directory'].includes(entry.type)});
 const manifest=JSON.parse(await fs.readFile(join(stage,'manifest.json'),'utf8'));
 need(manifest.schema===1&&manifest.id==='frida-domain-check'&&Array.isArray(manifest.files));
 const expected=new Set();
 for(const item of manifest.files) {
  need(typeof item.path==='string'&&!expected.has(item.path)&&names.has(item.path)&&/^[a-f0-9]{64}$/.test(item.sha256));expected.add(item.path);
  need(item.path==='database.dump'||/^assets\/(providers|categories)\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/.test(item.path));
  need(await checksum(join(stage,item.path))===item.sha256);
 }
 need(expected.has('database.dump'));
 for(const name of names){if(name.endsWith('.png')||name==='database.dump')need(expected.has(name));}
 await run('pg_restore',['--list',join(stage,'database.dump')]);return manifest;
}
async function verifyOrRestore(db,config) {
 const stage=await scratch();
 try {
  const file=join(stage,'input.tar');await pipeline(process.stdin,limit(),createWriteStream(file,{flags:'wx',mode:0o600}),{signal:abort.signal});
  const extracted=join(stage,'extracted');await fs.mkdir(extracted,{mode:0o700});
  const manifest=await unpack(file,extracted);
  if(command==='verify')return;
  await owner(db);need(process.env.FRIDA_EMPTY_RESTORE==='true'&&await tableCount(db)===0&&config.dbname!==manifest.database);
  const assets=await assetDirectory();need((await fs.readdir(assets)).length===0);
  await run('pg_restore',['--no-owner','--no-privileges','--exit-on-error','--single-transaction','--dbname=service=frida',join(extracted,'database.dump')]);
  for(const name of await fs.readdir(join(extracted,'assets'))) {
   await fs.cp(join(extracted,'assets',name),join(assets,name),{recursive:true,force:false,errorOnExist:true});
  }
  await db.query('BEGIN');
  try {
   await db.query('DELETE FROM app_sessions');await db.query('DELETE FROM oidc_transactions');
   await db.query('UPDATE app_maintenance SET active=false WHERE id=true');await grants(db);await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}
 }finally{await fs.rm(stage,{recursive:true,force:true});}
}
async function main() {
 if(command==='smoke') {
  need(process.env.SMOKE_BASE_URL==='http://app:3000'&&process.env.SMOKE_TOKEN?.length>=32);
  const response=await fetch('http://app:3000/api/internal/deployment-probe',{headers:{authorization:'Bearer '+process.env.SMOKE_TOKEN},redirect:'error',signal:AbortSignal.timeout(5000)});
  need(response.status===200&&(await response.json()).status==='ok');return;
 }
 if(command==='verify'){await verifyOrRestore(null,null);return;}
 const {client:db,config}=await connection();
 try {
  if(command==='provision')await provision(db);
  else if(command==='init'||command==='migrate')await migrate(db);
  else if(command==='backup')await backup(db,config);
  else if(command==='restore')await verifyOrRestore(db,config);
  else if(command==='grant-admin') {
   await owner(db);need(process.argv.length===5);
   const result=await db.query("UPDATE profiles SET role='admin' WHERE id=(SELECT profile_id FROM oidc_identities WHERE issuer=$1 AND subject=$2)",[process.argv[3],process.argv[4]]);need(result.rowCount===1);
  }else if(command==='create-probe') {
   await owner(db);const id=randomUUID();
   await db.query('INSERT INTO profiles(id,email,enabled) VALUES($1,$2,false)',[id,'probe-'+id+'@invalid.test']);
   console.log(id);
  }else if(command==='resume') {await owner(db);await db.query('UPDATE app_maintenance SET active=false WHERE id=true');}
  else throw new Error('Unknown maintenance command.');
 }finally{await db.end();}
}
try{await main();}catch(error){const code=typeof error?.code==='string'&&/^[A-Z0-9_]{1,32}$/.test(error.code)?error.code:'VALIDATION';console.error('Maintenance command failed ('+code+'); inspect the isolated target and restricted audit evidence.');process.exitCode=1;}
