"use client";
import { isSessionPage, renewSession, reportSession } from './session-renewal';
export async function apiFetch(input: string, init: RequestInit = {}) {
  if (!input.startsWith('/api/')) throw new Error('Only same-origin application APIs are supported.');
  const send=()=>{
  const headers = new Headers(init.headers);
  if (!['GET','HEAD','OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) {
    const cookie = document.cookie.split('; ').find(value=>value.startsWith('__Host-frida-domain-check-csrf='));
    if (cookie) headers.set('x-frida-csrf',decodeURIComponent(cookie.split('=')[1]));
  }
  return fetch(input,{ ...init,headers,credentials:'same-origin',cache:'no-store' });
  };
  const response=await send();
  if (response.status===401 && isSessionPage(window.location.pathname) && !(init.body instanceof ReadableStream)) {
    const ready=await renewSession();
    if(init.signal?.aborted)throw init.signal.reason??new DOMException('Request aborted','AbortError');
    if(ready) {
      const retry=await send();
      if(retry.status===401)reportSession(false);
      return retry;
    }
  }
  return response;
}
