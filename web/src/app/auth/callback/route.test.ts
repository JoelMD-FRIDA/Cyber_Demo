// @vitest-environment node
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth/oidc',()=>({finishLogin:vi.fn()}));
import { finishLogin } from '@/lib/auth/oidc';
import { transactionCookieName,RENEWAL_COOKIE } from '@/lib/auth/session';
import { GET } from './route';

describe('central sign-in callbacks',()=>{
  beforeEach(()=>{vi.stubEnv('APP_ORIGIN','https://domain.frida.test');vi.mocked(finishLogin).mockReset();});
  afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
  it('keeps simultaneous normal sign-in and silent-renewal transactions separate',async()=>{
    const first=transactionCookieName('normal-state'),second=transactionCookieName('renew-state','silent');
    const cookies=first+'=first-transaction; '+second+'=second-transaction';
    vi.mocked(finishLogin).mockImplementation(async(_,transaction)=>({session:'session',csrf:'csrf',
      renewalCookie:'binding',returnPath:transaction==='first-transaction'?'/dashboard/domain-check':'/auth/renew/complete'}));
    for(const [state,expected] of [['normal-state','first-transaction'],['renew-state','second-transaction']]) {
      const response=await GET(new NextRequest('https://domain.frida.test/auth/callback?code=code&state='+state,
        {headers:{host:'domain.frida.test',cookie:cookies}}));
      expect(response.status).toBe(307);
      expect(vi.mocked(finishLogin).mock.lastCall?.[1]).toBe(expected);
      expect(response.cookies.get(RENEWAL_COOKIE)?.value).toBe('binding');
      expect(response.cookies.get(state==='normal-state'?first:second)?.maxAge).toBe(0);
      expect(response.cookies.get(state==='normal-state'?second:first)).toBeUndefined();
    }
  });
  it('offers a fresh normal login after a stale callback and records no secret details',async()=>{
    vi.mocked(finishLogin).mockRejectedValue(new Error('Expired or replayed login transaction.'));
    const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const response=await GET(new NextRequest('https://domain.frida.test/auth/callback?state=old&code=sensitive-code',
      {headers:{host:'domain.frida.test'}}));
    expect(response.headers.get('location')).toBe('https://domain.frida.test/login?error=signin_failed');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(warning.mock.calls).toEqual([['FRIDA_LOGIN_FAILED','TRANSACTION_EXPIRED_OR_REPLACED']]);
  });
  it('reports failed silent renewal to its existing page instead of navigating that page',async()=>{
    vi.mocked(finishLogin).mockRejectedValue(new Error('Private upstream failure'));
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    const response=await GET(new NextRequest('https://domain.frida.test/auth/callback?state=silent-state&error=login_required',
      {headers:{host:'domain.frida.test',cookie:transactionCookieName('silent-state','silent')+'=transaction'}}));
    expect(response.headers.get('location')).toBe('https://domain.frida.test/auth/renew/complete?error=1');
  });
});
