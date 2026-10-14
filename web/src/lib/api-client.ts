"use client";
export async function apiFetch(input: string, init: RequestInit = {}) {
  if (!input.startsWith('/api/')) throw new Error('Only same-origin application APIs are supported.');
  const headers = new Headers(init.headers);
  if (!['GET','HEAD','OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) {
    const cookie = document.cookie.split('; ').find(value=>value.startsWith('__Host-frida-domain-check-csrf='));
    if (cookie) headers.set('x-frida-csrf',decodeURIComponent(cookie.split('=')[1]));
  }
  const response = await fetch(input,{ ...init,headers,credentials:'same-origin',cache:'no-store' });
  if (response.status===401 && ['/dashboard','/admin','/profile'].some(path=>window.location.pathname.startsWith(path))) {
    const back = window.location.pathname+window.location.search;
    window.location.assign('/api/auth/login?redirect='+encodeURIComponent(back));
  }
  return response;
}
