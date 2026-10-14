// @vitest-environment node
import { describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth/oidc',()=>({ startLogin:vi.fn().mockRejectedValue(new Error('unconfigured')) }));
import { GET,POST } from './route';
describe('central sign-in entry',()=>{
 it('never accepts a password login',async()=>{expect((await POST()).status).toBe(410);});
 it('fails closed without a usable IdP',async()=>{
  vi.stubEnv('APP_ORIGIN','https://domain.frida.test');
  try { expect((await GET(new NextRequest('https://domain.frida.test/api/auth/login',{headers:{host:'domain.frida.test'}}))).status).toBe(503); }
  finally { vi.unstubAllEnvs(); }
 });
});
