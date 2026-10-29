"use client";

let pending: Promise<boolean> | undefined;
export const SESSION_EVENT = 'frida-domain-check-session-status';
export function isSessionPage(path: string) {
  return ['/dashboard','/admin','/profile'].some(prefix => path === prefix || path.startsWith(prefix+'/'));
}
export function reportSession(ready: boolean) {
  window.dispatchEvent(new CustomEvent(SESSION_EVENT,{ detail:{ ready } }));
}
function csrfCookie() {
  return document.cookie.split('; ').find(value=>value.startsWith('__Host-frida-domain-check-csrf='));
}
type SessionStatus = 'ready' | 'expired' | 'unavailable';
async function currentSession(): Promise<SessionStatus> {
  try {
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(response.status===401)return 'expired';
    return response.ok?'ready':'unavailable';
  }catch{return 'unavailable';}
}
function transport(interactive: boolean): Promise<boolean> {
  return new Promise(resolve=>{
    const previousCsrf = csrfCookie();
    const frame = interactive ? undefined : document.createElement('iframe');
    const url = '/api/auth/login?renew='+(interactive?'interactive':'silent');
    const popup = interactive ? window.open(url,'frida-domain-check-signin','popup,width=520,height=720') : null;
    if (interactive && !popup) { resolve(false); return; }
    if (frame) { frame.hidden=true; frame.title='Session renewal'; frame.setAttribute('aria-hidden','true'); frame.src=url; }
    let settled=false;
    const done=(ready:boolean)=>{
      if(settled)return;settled=true;clearTimeout(timeout);clearInterval(poll);
      window.removeEventListener('message',message);frame?.remove();
      if(popup&&!popup.closed)popup.close();resolve(ready);
    };
    const message=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin || event.source!==(popup??frame?.contentWindow) ||
         event.data?.type!=='frida-domain-check-renewed')return;
      done(event.data.ready===true);
    };
    const timeout=setTimeout(()=>done(false),interactive?120_000:40_000);
    // Some identity providers sever window.opener. Rotation still proves a callback completed.
    const poll=setInterval(()=>{
      if(interactive&&csrfCookie()&&csrfCookie()!==previousCsrf)done(true);
      else if(interactive&&popup?.closed)done(false);
    },500);
    window.addEventListener('message',message);
    if(frame)document.body.append(frame);
  });
}
export function renewSession(interactive=false): Promise<boolean> {
  if(pending)return pending;
  const before=csrfCookie();
  const operation=()=>interactive?transport(true).then(ready=>ready?'ready' as const:'expired' as const):(async()=>{
    // Another tab may have completed renewal while this tab waited for the lock.
    const status=await currentSession();
    if(status!=='expired')return status;
    // Only expired legacy sessions need a browser SSO round-trip. Healthy
    // persistent sessions and temporary network/server failures never open one.
    if(csrfCookie()&&csrfCookie()!==before)return currentSession();
    const ready=await transport(false);
    // A failed background round-trip does not invalidate an otherwise live app session.
    return ready?'ready' as const:await currentSession();
  })();
  // A popup must open synchronously in the click handler to avoid popup blockers.
  const result=!interactive&&navigator.locks
    ? Promise.resolve(navigator.locks.request('frida-domain-check-renewal',operation)) : operation();
  pending=result.then(status=>{
    if(status!=='unavailable')reportSession(status==='ready');
    return status==='ready';
  }).finally(()=>{pending=undefined;});
  return pending;
}
