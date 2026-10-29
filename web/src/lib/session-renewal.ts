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
function transport(interactive: boolean): Promise<boolean> {
  return new Promise(resolve=>{
    const previousCsrf = csrfCookie();
    const frame = interactive ? undefined : document.createElement('iframe');
    const url = '/api/auth/login?renew='+(interactive?'interactive':'silent');
    const popup = interactive ? window.open(url,'frida-domain-check-signin','popup,width=520,height=720') : null;
    if (interactive && !popup) { reportSession(false); resolve(false); return; }
    if (frame) { frame.hidden=true; frame.title='Session renewal'; frame.setAttribute('aria-hidden','true'); frame.src=url; }
    let settled=false;
    const done=(ready:boolean)=>{
      if(settled)return;settled=true;clearTimeout(timeout);clearInterval(poll);
      window.removeEventListener('message',message);frame?.remove();
      if(popup&&!popup.closed)popup.close();reportSession(ready);resolve(ready);
    };
    const message=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin || event.source!==(popup??frame?.contentWindow) ||
         event.data?.type!=='frida-domain-check-renewed')return;
      done(event.data.ready===true);
    };
    const timeout=setTimeout(()=>done(false),interactive?120_000:12_000);
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
  const operation=()=>{
    // Another tab may have completed renewal while this tab waited for the lock.
    if(!interactive&&csrfCookie()&&csrfCookie()!==before) { reportSession(true); return Promise.resolve(true); }
    return transport(interactive);
  };
  // A popup must open synchronously in the click handler to avoid popup blockers.
  const result=!interactive&&navigator.locks
    ? Promise.resolve(navigator.locks.request('frida-domain-check-renewal',operation)) : operation();
  pending=result.finally(()=>{pending=undefined;});
  return pending;
}
