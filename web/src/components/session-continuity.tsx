"use client";
import { useEffect,useState } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { isSessionPage,renewSession,SESSION_EVENT } from '@/lib/session-renewal';

export function SessionContinuity() {
  const path=usePathname();const {locale}=useI18n();
  const [expired,setExpired]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!isSessionPage(path))return;
    let lastActivity=Date.now();
    const activity=()=>{lastActivity=Date.now();};
    const status=(event:Event)=>setExpired(!(event as CustomEvent<{ready:boolean}>).detail.ready);
    const renew=()=>{
      if(document.visibilityState==='visible'&&Date.now()-lastActivity<15*60_000)void renewSession();
    };
    window.addEventListener(SESSION_EVENT,status);
    window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);
    window.addEventListener('focus',renew);
    // Recover an expired page after a reload without unmounting forms or selections.
    void fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})
      .then(response=>{if(response.status===401)renew();}).catch(()=>{});
    const timer=setInterval(renew,40_000);
    return ()=>{clearInterval(timer);window.removeEventListener(SESSION_EVENT,status);
      window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);
      window.removeEventListener('focus',renew);};
  },[path]);
  if(!isSessionPage(path)||!expired)return null;
  return <div role="status" className="fixed bottom-4 left-1/2 z-[10000] flex w-[min(44rem,calc(100%-2rem))] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-sm text-slate-900 shadow-lg">
    <span className="flex-1">{locale==='de'?'Ihre Sitzung muss erneuert werden. Ihre Eingaben bleiben erhalten.':'Your session needs renewing. Your entries are preserved.'}</span>
    <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-50" disabled={busy}
      onClick={async()=>{setBusy(true);try{await renewSession(true);}finally{setBusy(false);}}}>
      {locale==='de'?'Sitzung erneuern':'Renew session'}
    </button>
    <a className="underline" href={'/api/auth/login?redirect='+encodeURIComponent(path+window.location.search)}>
      {locale==='de'?'Erneut anmelden':'Sign in again'}
    </a>
  </div>;
}
