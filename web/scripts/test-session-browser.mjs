#!/usr/bin/env node
// Real Cyber wizard, API client and renewal UI against disposable transport fixtures.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:https';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
const require=createRequire(import.meta.resolve('vitest/package.json'));
const {build}=await import(pathToFileURL(require.resolve('vite')).href);
const root=resolve(import.meta.dirname,'..'),work=await mkdtemp(join(tmpdir(),'cyber-session-browser-'));
let browser,server;
try {
 const aliases=Object.fromEntries(['link','image','navigation'].map(name=>['next/'+name,resolve(root,'tests/browser-fixture/'+name+(name==='navigation'?'.ts':'.tsx'))]));
 await build({configFile:false,root,logLevel:'error',define:{'process.env.NODE_ENV':'"production"'},resolve:{alias:{...aliases,'@':resolve(root,'src')}},
  build:{outDir:join(work,'bundle'),lib:{entry:resolve(root,'tests/browser-fixture/entry.tsx'),formats:['es'],fileName:()=> 'fixture.js'},minify:false}});
 const cert=join(work,'cert.pem'),key=join(work,'key.pem');
 assert.equal(spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-subj','/CN=127.0.0.1','-days','1'],{stdio:'ignore'}).status,0);
 const state={expired:false,deny:false,hold:false,csrf:'initial',renewals:0,deniedRequests:0,writes:[],held:[],staleScanReply:false,scanPolls:0,omitSignal:false,meUnavailable:false,scanPending:false};
 const complete=(res,interactive)=>{
  if(state.deny){res.writeHead(302,{Location:'/auth/renew/complete?error=1'});res.end();return;}
  state.expired=false;state.csrf='renewed-'+state.renewals;
  res.setHeader('Set-Cookie','__Host-frida-domain-check-csrf='+state.csrf+'; Path=/; Secure; SameSite=Strict');
  res.writeHead(302,{Location:'/auth/renew/complete'+(interactive?'?popup=1':'')});res.end();
 };
 server=createServer({key:await readFile(key),cert:await readFile(cert)},async(req,res)=>{
  const url=new URL(req.url,'https://fixture.invalid');
  if(url.pathname==='/fixture.js') {res.setHeader('content-type','text/javascript');res.end(await readFile(join(work,'bundle','fixture.js')));return;}
  if(url.pathname==='/api/auth/login') {
   state.renewals++;if(state.hold){state.held.push(res);return;}
   complete(res,url.searchParams.get('renew')==='interactive');return;
  }
  if(url.pathname.startsWith('/api/')) {
   res.setHeader('content-type','application/json');
   if(url.pathname==='/api/auth/me'){
    if(state.meUnavailable){res.writeHead(503);res.end('{}');return;}
    res.setHeader('X-Frida-Session-TTL',String(7*86400000));
   }
   if(state.expired){state.deniedRequests++;res.writeHead(401);res.end('{"code":"UNAUTHORIZED"}');return;}
   if(url.pathname==='/api/domain-check/options') {
    res.end(JSON.stringify({providers:[{id:'cysmo-id',key:'cysmo',name:'Cysmo',inputType:'domain',isActive:true,isConfigured:true},
     {id:'panta-id',key:'panta',name:'PANTA',inputType:'contact',isActive:true,isConfigured:true}],categories:[],remainingChecks:10,maxChecks:10,disclaimerVersion:'1.0'}));return;
   }
   if(url.pathname==='/api/domain-check'&&req.method==='POST') {
    let raw='';for await(const chunk of req)raw+=chunk;
    if(req.headers['x-frida-csrf']!==state.csrf){res.writeHead(403);res.end('{}');return;}
    state.writes.push(JSON.parse(raw));res.end('{"check":{"id":"11111111-1111-4111-8111-111111111111"}}');return;
   }
   if(url.pathname.startsWith('/api/domain-check/')&&url.pathname!=='/api/domain-check/options') {
    state.scanPolls++;
    if(state.staleScanReply){state.staleScanReply=false;res.writeHead(401);res.end('{"code":"UNAUTHORIZED"}');return;}
    res.end(JSON.stringify({check:{id:url.pathname.split('/').at(-1),url:'synthetic@example.test',status:state.scanPending?'running':'completed',
      provider:{id:'panta-id',key:'panta',name:'PANTA'},category:null,createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),remainingChecks:9,maxChecks:10,attemptCount:1,
      externalJobId:'fixture-job',rawResult:null,structuredResult:{},startedAt:null,completedAt:new Date().toISOString()}}));return;
   }
   res.end('{"email":"synthetic@example.test"}');return;
  }
  if(url.pathname.startsWith('/dashboard/domain-check')||url.pathname==='/auth/renew/complete') {
   if(url.pathname==='/auth/renew/complete'&&state.omitSignal){res.setHeader('content-type','text/html');res.end('<p>Renewed without a browser notification</p>');return;}
   if(url.pathname==='/dashboard/domain-check')res.setHeader('Set-Cookie','__Host-frida-domain-check-csrf='+state.csrf+'; Path=/; Secure; SameSite=Strict');
   res.setHeader('content-type','text/html');res.end('<html><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');return;
  }
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='https://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
 const context=await browser.newContext({ignoreHTTPSErrors:true});
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage();page.setDefaultTimeout(12000);await page.clock.install();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/dashboard/domain-check');
 await page.getByRole('radio',{name:/PANTA/}).click();await page.locator('#domain-url').fill('synthetic@example.test');
 await page.getByRole('checkbox').check();
 state.expired=true;state.deny=true;state.hold=true;
 await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('iframe'));
 await page.evaluate(()=>window.postMessage({type:'frida-domain-check-renewed',ready:true},window.location.origin));
 await page.waitForTimeout(100);assert.equal(state.writes.length,0);
 state.hold=false;for(const response of state.held.splice(0))complete(response,false);
 await page.getByRole('button',{name:'Renew session',exact:true}).waitFor();
 assert.equal(page.url(),origin+'/dashboard/domain-check');
 assert.equal(await page.locator('#domain-url').inputValue(),'synthetic@example.test');
 assert.equal(await page.getByRole('checkbox').isChecked(),true);
 assert.equal(await page.getByRole('radio',{name:/PANTA/}).getAttribute('aria-checked'),'true');
 assert.equal(state.writes.length,0);
 console.log('Denied renewal and a forged callback preserve the real Cyber wizard and its selections.');
 state.deny=false;
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Renew session',exact:true}).click();
 const popup=await popupPromise;await popup.waitForEvent('close').catch(()=>{});
 await page.getByRole('button',{name:'Renew session',exact:true}).waitFor({state:'hidden'});
 state.expired=true;const before=state.renewals;
 await page.locator('button[type=submit]').click();await page.waitForFunction(()=>window.fixtureNavigation);
 assert.equal(state.renewals,before+1);assert.equal(state.writes.length,1);
 assert.equal(state.writes[0].providerId,'panta-id');assert.equal(state.writes[0].url,'synthetic@example.test');
 assert.equal(state.writes[0].hasAcceptedDisclaimer,true);
 console.log('Expired submission silently renews and retries once with new CSRF; exactly one fixture check is created.');
 const timed=state.renewals;await page.clock.fastForward(61_000);
 assert.equal(state.renewals,timed);assert.equal(state.expired,false);assert.equal(state.writes.length,1);
 assert.equal(page.url(),origin+'/dashboard/domain-check');
 assert.deepEqual(errors,[]);
 console.log('Crossing the old 60-second limit keeps the session with no SSO round-trip or new submission.');
 state.meUnavailable=true;await page.clock.fastForward(5*60_000);
 await page.evaluate(async()=>window.fixtureFetch('/api/auth/me'));
 assert.equal(state.renewals,timed);
 assert.equal(await page.getByRole('button',{name:'Renew session',exact:true}).count(),0);
 state.meUnavailable=false;
 console.log('A temporary session-service failure does not open SSO or display a false sign-in banner.');
 const peer=await context.newPage();await peer.goto(origin+'/dashboard/domain-check');
 await peer.getByRole('radio',{name:/PANTA/}).waitFor();
 state.expired=true;state.hold=true;const concurrent=state.renewals,denied=state.deniedRequests;
 const requests=[page.evaluate(async()=> (await window.fixtureFetch('/api/auth/me')).status),
                 peer.evaluate(async()=> (await window.fixtureFetch('/api/auth/me')).status)];
 for(let attempt=0;attempt<200&&(state.deniedRequests<denied+2||!state.held.length);attempt++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.ok(state.deniedRequests>=denied+2);assert.equal(state.held.length,1);
 state.hold=false;for(const response of state.held.splice(0))complete(response,false);
 assert.deepEqual(await Promise.all(requests),[200,200]);assert.equal(state.renewals,concurrent+1);
 assert.equal(state.writes.length,1);
 console.log('Two tabs share one renewal and both retry successfully without replacing each other’s login transaction.');
 await peer.close();
 const results=origin+'/dashboard/domain-check/results/11111111-1111-4111-8111-111111111111';
 state.staleScanReply=true;const renewals=state.renewals;
 await page.goto(results);await page.getByRole('heading',{name:/synthetic@example.test/}).waitFor();
 assert.ok(state.scanPolls>=2);assert.equal(state.renewals,renewals);assert.equal(state.writes.length,1);
 assert.equal(await page.getByRole('button',{name:'Renew session',exact:true}).count(),0);
 console.log('A stale scan response uses the still-valid session and displays the report without a login round-trip or a second scan.');
 state.scanPending=true;await page.reload();
 await page.getByRole('heading',{name:/synthetic@example.test/}).waitFor();
 const duringScan=state.renewals;await page.clock.fastForward(61_000);
 state.scanPending=false;await page.clock.fastForward(3000);
 await page.getByText('Completed',{exact:true}).waitFor();
 assert.equal(state.renewals,duringScan);assert.equal(state.writes.length,1);
 assert.equal(await page.getByRole('button',{name:'Renew session',exact:true}).count(),0);
 console.log('A scan stays running past a minute and completes without any SSO renewal or duplicate submission.');
 state.expired=true;state.omitSignal=true;
 const notificationLost=page.evaluate(async()=> (await window.fixtureFetch('/api/auth/me')).status);
 void notificationLost.catch(()=>{});
 await page.frameLocator('iframe').getByText('Renewed without a browser notification').waitFor({state:'attached'});
 await page.clock.fastForward(40_100);
 assert.equal(await notificationLost,200);
 assert.equal(await page.getByRole('button',{name:'Renew session',exact:true}).count(),0);
 state.omitSignal=false;
 console.log('A lost browser renewal notification is recovered from the live session without showing a false sign-in message.');
 state.expired=true;state.deny=true;await page.reload();
 await page.getByRole('button',{name:'Renew session',exact:true}).waitFor();
 state.deny=false;const recovery=page.waitForEvent('popup');
 await page.getByRole('button',{name:'Renew session',exact:true}).click();
 const recoveryWindow=await recovery;await recoveryWindow.waitForEvent('close').catch(()=>{});
 await page.getByRole('heading',{name:/synthetic@example.test/}).waitFor();
 assert.equal(page.url(),results);assert.equal(state.writes.length,1);
 console.log('When authorization really is lost, restoring it resumes the same saved scan without creating a replacement.');
 assert.deepEqual(errors,[]);
 await context.close();
} finally {
 await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(work,{recursive:true,force:true});
}
