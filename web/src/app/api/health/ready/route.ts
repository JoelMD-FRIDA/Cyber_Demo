import { access,constants } from 'node:fs/promises';
import { sql } from '@/lib/db/postgres';
import { appOrigin,encrypt } from '@/lib/auth/session';
import { oidcSettings,oidcConfiguration } from '@/lib/auth/oidc';
import { assetRoot } from '@/server/assets';
import { isProviderConfigured } from '@/server/domain-check-cysmo';
import contract from '../../../../../deployment/contract.json';
export const dynamic = 'force-dynamic';
async function dependencies() {
  appOrigin();oidcSettings();encrypt('readiness');
  const [result] = await Promise.all([
    sql(`SELECT id,sha256,current_user,has_schema_privilege(current_user,'public','CREATE') AS ddl
         FROM frida_migrations ORDER BY id DESC LIMIT 1`),
    oidcConfiguration(),
    assetRoot().then(path=>access(path,constants.R_OK|constants.W_OK)),
  ]);
  const expected=contract.reviewed_migrations.at(-1),row=result.rows[0];
  if (!expected || !row || row.id!==expected.file || row.sha256!==expected.sha256 || row.current_user!=='frida_domain_app' || row.ddl)
    throw new Error('Schema/role mismatch.');
  const state=await sql('SELECT active FROM app_maintenance WHERE id=true');
  if(state.rows[0]?.active!==false)throw new Error('Maintenance active.');
  await sql(`SELECT p.enabled,c.claim_token,c.submission_started,s.csrf_hash,i.subject
    FROM profiles p LEFT JOIN domain_checks c ON c.user_id=p.id
    LEFT JOIN app_sessions s ON s.profile_id=p.id LEFT JOIN oidc_identities i ON i.profile_id=p.id LIMIT 0`);
  const providers=await sql('SELECT provider_key FROM domain_check_providers WHERE is_active');
  if(!providers.rows.some(provider=>isProviderConfigured(provider.provider_key)))throw new Error('No configured provider.');
}
export async function GET() {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    await Promise.race([dependencies(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Readiness deadline.')),4500);})]);
    return Response.json({status:'ready'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  } finally {clearTimeout(timer);}
}
