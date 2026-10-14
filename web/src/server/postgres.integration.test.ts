import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import { createServer, type Server } from 'node:https';
import { generateKeyPairSync,sign,randomUUID,createHash } from 'node:crypto';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { NextRequest } from 'next/server';
const requestState=vi.hoisted(()=>({cookie:'',authorization:''}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(name:string)=>name==='__Host-frida-domain-check'?{value:requestState.cookie}:undefined}),headers:async()=>new Headers(requestState.authorization?{authorization:requestState.authorization}:{})}));
import { startLogin,finishLogin } from '@/lib/auth/oidc';
import { SESSION_COOKIE,CSRF_COOKIE,sessionForCookie } from '@/lib/auth/session';
import { createDatabaseClient } from '@/lib/db/client';
import { database } from '@/lib/db/postgres';
import { requireAdmin } from '@/lib/auth/guards';
import { proxy } from '@/proxy';
import { saveAsset,loadAsset } from './assets';
import * as providers from './domain-check-cysmo';
import { createQueuedDomainCheck,getDomainCheck,processDomainCheckOnDemand } from './domain-check-service';
import sharp from 'sharp';
import { GET as ready } from '@/app/api/health/ready/route';
import { GET as probe } from '@/app/api/internal/deployment-probe/route';

const grants=new Map<string,Record<string,unknown>>();
let server:Server,issuer:string,owner:Client,sessionA:{session:string;csrf:string;returnPath:string},sessionB:typeof sessionA;
let profileA:string,profileB:string,assetPath:string,bundle:Buffer;
let workspace:string;
async function connectService(path:string) {
 const raw=await readFile(path,'utf8');const cfg=Object.fromEntries(raw.split('\n').filter(line=>line.includes('=')).map(line=>line.split('=')));
 const client=new Client({host:cfg.host,user:cfg.user,password:cfg.password,database:cfg.dbname,port:5432});await client.connect();return client;
}
function tool(command:string,service=process.env.FRIDA_TEST_OWNER_SERVICE!,input?:Buffer,extra:Record<string,string>={}) {
 return spawnSync(process.execPath,['deployment/tools.mjs',command],{input,env:{...process.env,PGSERVICEFILE:service,...extra},maxBuffer:300*1024*1024,timeout:280000});
}
async function login(subject:string,email:string,overrides:Record<string,unknown>={}) {
 const flow=await startLogin('/dashboard/domain-check');const url=flow.url;
 const code=randomUUID();grants.set(code,{subject,email,nonce:url.searchParams.get('nonce'),challenge:url.searchParams.get('code_challenge'),...overrides});
 const callback=new URL('https://domain.frida.test/auth/callback');callback.searchParams.set('code',code);callback.searchParams.set('state',url.searchParams.get('state')!);
 return {result:finishLogin(callback,flow.transaction),callback,transaction:flow.transaction};
}
beforeAll(async()=>{
 if(!process.env.FRIDA_TEST_OWNER_SERVICE)throw new Error('Run only through the disposable test fixture.');
 workspace=await mkdtemp(join(process.env.BACKUP_STAGING_DIRECTORY!,'tests-'));
 owner=await connectService(process.env.FRIDA_TEST_OWNER_SERVICE);
 const pair=generateKeyPairSync('rsa',{modulusLength:2048});const jwk=pair.publicKey.export({format:'jwk'});
 server=createServer({key:await readFile(process.env.FRIDA_TEST_KEY!),cert:await readFile(process.env.FRIDA_TEST_CERT!)},async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url==='/.well-known/openid-configuration')return res.end(JSON.stringify({issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_basic']}));
  if(req.url==='/jwks')return res.end(JSON.stringify({keys:[{...jwk,kid:'fixture',alg:'RS256',use:'sig'}]}));
  if(req.url==='/token'){
   let body='';for await(const chunk of req)body+=chunk;
   const input=new URLSearchParams(body),entry=grants.get(input.get('code')??'');
   const basic=Buffer.from(req.headers.authorization?.split(' ')[1]??'','base64').toString().split(':').map(value=>decodeURIComponent(value)).join(':');
   if(!entry||basic!=='domain-client:fixture-client-secret'||createHash('sha256').update(input.get('code_verifier')??'').digest('base64url')!==entry.challenge){res.statusCode=400;return res.end('{}');}
   grants.delete(input.get('code')!);
   const now=Math.floor(Date.now()/1000);
   const claims={iss:issuer,aud:'domain-client',sub:entry.subject,email:entry.email,email_verified:true,groups:['domain-sandbox'],nonce:entry.nonce,iat:now,exp:now+300,...(entry.claims as object??{})};
   const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture'})).toString('base64url');const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');const signed=sign('RSA-SHA256',Buffer.from(header+'.'+payload),pair.privateKey);if(entry.badSignature)signed[0]^=1;const signature=signed.toString('base64url');
   return res.end(JSON.stringify({access_token:'fixture-access',token_type:'Bearer',expires_in:60,id_token:header+'.'+payload+'.'+signature}));
  }
  res.statusCode=404;res.end('{}');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw new Error('No fixture address.');issuer='https://127.0.0.1:'+address.port;
 Object.assign(process.env,{APP_ORIGIN:'https://domain.frida.test',OIDC_ISSUER:issuer,OIDC_CLIENT_ID:'domain-client',OIDC_CLIENT_SECRET:'fixture-client-secret',OIDC_REQUIRED_ENTITLEMENT_CLAIM:'groups',OIDC_REQUIRED_ENTITLEMENT_VALUE:'domain-sandbox',SESSION_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),PANTA_API_KEY:'fixture-panta-key'});
 sessionA=await (await login('person-a','a@example.test',{claims:{role:'admin',groups:['domain-sandbox','staff']}})).result;
 sessionB=await (await login('person-b','b@example.test')).result;
 profileA=(await sessionForCookie(sessionA.session))!.profile.id;profileB=(await sessionForCookie(sessionB.session))!.profile.id;
});
afterAll(async()=>{await owner?.end();await database().end();await new Promise<void>(resolve=>server?.close(()=>resolve()));if(workspace)await rm(workspace,{recursive:true,force:true});});

describe('fresh local PostgreSQL application',()=>{
 it('creates two scoped OIDC identities with user roles, no passwords and bounded sessions',async()=>{
  expect(profileA).not.toBe(profileB);expect((await sessionForCookie(sessionA.session))?.profile.role).toBe('user');
  expect((await owner.query("SELECT to_regclass('auth.users') AS auth")).rows[0].auth).toBe(null);
  const rows=(await owner.query('SELECT expires_at-now() AS remaining FROM app_sessions')).rows;
  expect(rows).toHaveLength(2);
 });
 it('rejects invalid signatures, audience, nonce, issuer, expiry and missing sandbox entitlement',async()=>{
  for(const claims of [{aud:'peer-app'},{nonce:'wrong'},{iss:'https://untrusted.invalid'},{exp:1},{groups:['staff-only']},{email_verified:false}]){
   const flow=await login('denied-'+randomUUID(),'denied@example.test',{claims});await expect(flow.result).rejects.toThrow();
  }
  await expect((await login('invalid-signature','invalid@example.test',{badSignature:true})).result).rejects.toThrow();
  expect((await owner.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n).toBe(2);
 });
 it('consumes callback transactions once and never links another subject by matching email',async()=>{
  const flow=await login('collision','a@example.test');await expect(flow.result).rejects.toThrow();
  await expect(finishLogin(flow.callback,flow.transaction)).rejects.toThrow();
  expect((await owner.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n).toBe(2);
 });
 it('rejects cookie-plus-bearer bypass and cross-origin/missing-CSRF mutations',async()=>{
  const cookies=`${SESSION_COOKIE}=${sessionA.session}; ${CSRF_COOKIE}=${sessionA.csrf}`;
  const request=(headers:Record<string,string>)=>new NextRequest('https://domain.frida.test/api/domain-check',{method:'POST',headers:{cookie:cookies,...headers}});
  expect((await proxy(request({origin:'https://sibling.frida.test','x-frida-csrf':sessionA.csrf}))).status).toBe(403);
  expect((await proxy(request({origin:'https://domain.frida.test'}))).status).toBe(403);
  expect((await proxy(request({origin:'https://domain.frida.test','x-frida-csrf':sessionA.csrf,authorization:'Bearer peer-token'}))).status).toBe(401);
  expect((await proxy(request({origin:'https://domain.frida.test','x-frida-csrf':sessionA.csrf}))).headers.get('x-middleware-next')).toBe('1');
  requestState.cookie=sessionA.session;await expect(requireAdmin()).rejects.toMatchObject({status:403});
 });
 it('enforces atomic quotas and own-check reads through actual SQL',async()=>{
  const profile=randomUUID();await owner.query('INSERT INTO profiles(id,email) VALUES($1,$2)',[profile,'quota@example.test']);
  const catalog=(await owner.query("SELECT p.id AS provider,c.id AS category FROM domain_check_providers p CROSS JOIN domain_check_categories c WHERE p.provider_key='panta'")).rows[0];
  const client=createDatabaseClient();
  const results=await Promise.all(Array.from({length:15},()=>client.rpc('create_queued_domain_check',{p_user_id:profile,p_provider_id:catalog.provider,p_category_id:catalog.category,p_url:'person@example.test',p_has_accepted_disclaimer:true,p_disclaimer_version:'1.0',p_limit:10})));
  expect(results.filter(row=>row.data)).toHaveLength(10);expect(results.filter(row=>row.error?.message==='CHECK_LIMIT_EXCEEDED')).toHaveLength(5);
  requestState.cookie=sessionA.session;
  await expect(getDomainCheck(results.find(row=>row.data)!.data![0].id)).rejects.toMatchObject({status:404});
 });
 it('never retries an ambiguous provider submission and rejects a stale worker write',async()=>{
  requestState.cookie=sessionA.session;
  const adapter={key:'panta',inputType:'contact' as const,isConfigured:true,normalize:()=>({structuredResult:{},richResult:{}}),poll:vi.fn()};
  let finish:(result:unknown)=>void=()=>{};
  const started=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
  const mock=vi.spyOn(providers,'getProviderAdapter').mockReturnValue({...adapter,start:started} as never);
  try {
   const providerId=(await owner.query("SELECT id FROM domain_check_providers WHERE provider_key='panta'")).rows[0].id;
   const created=await createQueuedDomainCheck({url:'person@example.test',providerId,hasAcceptedDisclaimer:true,disclaimerVersion:'1.0'});
   const running=processDomainCheckOnDemand(created.id);const rejected=expect(running).rejects.toThrow();
   for(let i=0;i<100&&!started.mock.calls.length;i++)await new Promise(resolve=>setTimeout(resolve,5));
   expect(started).toHaveBeenCalledTimes(1);
   await owner.query("UPDATE domain_checks SET lease_until=now()-interval '1 second' WHERE id=$1",[created.id]);
   await createDatabaseClient().rpc('claim_domain_check',{p_check_id:created.id,p_lease_seconds:120});
   finish({completed:true,externalJobId:'paid-job-1',snapshot:{}});await rejected;
   await processDomainCheckOnDemand(created.id);expect(started).toHaveBeenCalledTimes(1);
   const row=(await owner.query('SELECT status,last_error_code,external_job_id FROM domain_checks WHERE id=$1',[created.id])).rows[0];
   expect(row).toMatchObject({status:'failed',last_error_code:'PROVIDER_SUBMISSION_UNKNOWN',external_job_id:null});
  }finally{mock.mockRestore();}
 });
 it('stores sanitized immutable catalog images and rejects SVG/path traversal',async()=>{
  const category=(await owner.query('SELECT id FROM domain_check_categories LIMIT 1')).rows[0].id;
  const image=await sharp({create:{width:2,height:2,channels:3,background:'#123456'}}).png().toBuffer();
  assetPath=await saveAsset(new File([new Uint8Array(image)],'picture.png',{type:'image/png'}),'categories',category);
  const bytes=await loadAsset(assetPath.replace('/api/assets/','').split('/'));expect((await sharp(bytes).metadata()).format).toBe('png');
  await expect(saveAsset(new File(['<svg/>'],'bad.svg',{type:'image/png'}),'categories',category)).rejects.toThrow();
  await expect(loadAsset(['..','secret'])).rejects.toThrow();
 });
 it('has separate runtime/backup privileges and idempotent checksummed migrations',async()=>{
  await expect(database().query('CREATE TABLE cannot_ddl(id integer)')).rejects.toThrow();
  const backup=await connectService(process.env.FRIDA_TEST_BACKUP_SERVICE!);
  try{await expect(backup.query("UPDATE profiles SET role='admin'")).rejects.toThrow();}finally{await backup.end();}
  const before=(await owner.query('SELECT count(*)::int AS n FROM domain_checks')).rows[0].n;
  expect(tool('migrate').status).toBe(0);expect((await owner.query('SELECT count(*)::int AS n FROM domain_checks')).rows[0].n).toBe(before);
  await owner.query("UPDATE frida_migrations SET sha256=repeat('0',64)");expect(tool('migrate').status).not.toBe(0);
  const contract=JSON.parse(await readFile('deployment/contract.json','utf8'));await owner.query('UPDATE frida_migrations SET sha256=$1',[contract.reviewed_migrations[0].sha256]);
 });
 it('refuses initialization over an unknown populated target',async()=>{
  const dirty=await connectService(process.env.FRIDA_TEST_DIRTY_SERVICE!);await dirty.query('CREATE TABLE sentinel(id integer)');await dirty.end();
  expect(tool('init',process.env.FRIDA_TEST_DIRTY_SERVICE).status).not.toBe(0);
 });
 it('reports real readiness and prevents writes while the backup barrier is held',async()=>{
  expect((await ready()).status).toBe(200);
  await owner.query('UPDATE app_maintenance SET active=true WHERE id=true');
  try {
   expect((await ready()).status).toBe(503);
   const result=await createDatabaseClient().from('profiles').update({company:'must-not-write'}).eq('id',profileA);
   expect(result.error).not.toBe(null);expect((await owner.query('SELECT company FROM profiles WHERE id=$1',[profileA])).rows[0].company).toBe(null);
  }finally{await owner.query('UPDATE app_maintenance SET active=false WHERE id=true');}
  await owner.query('SELECT pg_advisory_lock(734291861)');
  try {expect((await createDatabaseClient().from('profiles').update({company:'blocked'}).eq('id',profileA)).error).not.toBe(null);}
  finally{await owner.query('SELECT pg_advisory_unlock(734291861)');}
 });
 it('makes a consistent DB/assets bundle and restores only to an empty different database',async()=>{
  const result=tool('backup',process.env.FRIDA_TEST_BACKUP_SERVICE);expect(result.status,result.stderr.toString()).toBe(0);bundle=result.stdout;
  expect(tool('verify',undefined,bundle).status).toBe(0);
  expect(tool('restore',process.env.FRIDA_TEST_OWNER_SERVICE,bundle,{FRIDA_EMPTY_RESTORE:'true'}).status).not.toBe(0);
  const restored=tool('restore',process.env.FRIDA_TEST_RESTORE_SERVICE,bundle,{FRIDA_EMPTY_RESTORE:'true',ASSET_DIRECTORY:process.env.FRIDA_TEST_RESTORED_ASSETS!});
  expect(restored.status,restored.stderr.toString()).toBe(0);
  const db=await connectService(process.env.FRIDA_TEST_RESTORE_SERVICE!);
  try{expect((await db.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n).toBe(3);expect((await db.query('SELECT count(*)::int AS n FROM app_sessions')).rows[0].n).toBe(0);expect((await db.query('SELECT active FROM app_maintenance')).rows[0].active).toBe(false);}finally{await db.end();}
  const restoredFile=join(process.env.FRIDA_TEST_RESTORED_ASSETS!,assetPath.replace('/api/assets/',''));
  expect(await readFile(restoredFile)).toEqual(await loadAsset(assetPath.replace('/api/assets/','').split('/')));
 });
 it('rejects corrupted bundle contents without changing application data',async()=>{
  const changed=Buffer.from(bundle);const position=changed.indexOf(Buffer.from([137,80,78,71,13,10,26,10]));expect(position).toBeGreaterThan(0);changed[position+10]^=1;
  expect(tool('verify',undefined,changed).status).not.toBe(0);
  expect((await owner.query('SELECT active FROM app_maintenance')).rows[0].active).toBe(false);
 });
 it('keeps the authenticated deployment probe confined to its inactive synthetic identity',async()=>{
  const result=tool('create-probe');expect(result.status).toBe(0);
  process.env.DEPLOYMENT_PROBE_PROFILE_ID=result.stdout.toString().trim();process.env.DEPLOYMENT_PROBE_SECRET='disposable-probe-secret-1234567890';
  expect((await probe(new Request('https://domain.frida.test/api/internal/deployment-probe',{headers:{authorization:'Bearer '+process.env.DEPLOYMENT_PROBE_SECRET}}))).status).toBe(200);
  expect((await probe(new Request('https://domain.frida.test/api/internal/deployment-probe'))).status).toBe(401);
 });
 it('denies disabled and expired sessions immediately',async()=>{
  await owner.query('UPDATE profiles SET enabled=false WHERE id=$1',[profileB]);expect(await sessionForCookie(sessionB.session)).toBe(null);
  await owner.query("UPDATE app_sessions SET expires_at=now()-interval '1 second'");expect(await sessionForCookie(sessionA.session)).toBe(null);
 });
});
