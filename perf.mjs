// Frame time on the promenade, with the frame-rate cap off so the number means
// something. Also dumps the crowd tiers and the census.
import { spawn } from 'node:child_process';
import { gpuLaunch } from '/home/unk1911/flamme-retarde/tools/gpu.mjs';
import fs from 'node:fs';
const TAG = process.argv[2] || 'bef';
const OUT = '/tmp/claude-1000/-home-unk1911-flamme-retarde/3ab28b14-2416-4c8f-af0a-7abc5478a347/scratchpad/promx/';
fs.mkdirSync(OUT, {recursive:true});
const PORT = 9443, HTTP = process.env.HTTP || '8841', GL = gpuLaunch(null);
const chrome = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  ...GL.args,'--hide-scrollbars','--mute-audio','--autoplay-policy=no-user-gesture-required',
  '--disable-gpu-vsync','--disable-frame-rate-limit',
  '--window-size=1280,720',`--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/claude-chrome-profile-'+PORT,'about:blank'],{stdio:['ignore','ignore','pipe'],env:GL.env});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const waits = new Map(); const errs = [];
for (let i = 0; i < 60 && !ws; i++) { await sleep(500);
  try { const l = await fetch(`http://127.0.0.1:${PORT}/json`).then((x)=>x.json());
    const p = l.find((t)=>t.type==='page'); if(!p) continue;
    ws = new globalThis.WebSocket(p.webSocketDebuggerUrl);
    await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;}); } catch(e){ ws=null; } }
if (!ws) { console.log('no chrome'); process.exit(2); }
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && waits.has(d.id)) { waits.get(d.id)(d); waits.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errs.push('THROW ' + (d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text).split('\n')[0]);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('ERR ' + d.params.args.map((a)=>a.value||a.description).join(' ').split('\n')[0]); };
const send = (m,p={}) => new Promise((res)=>{const i=++id;waits.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});
const js = async (e) => { const r = await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
  if (r.result?.exceptionDetails) return {__err: r.result.exceptionDetails.exception?.description?.split('\n')[0]};
  return r.result?.result?.value; };
const key = async (code,k,vk) => { for (const type of ['keyDown','keyUp'])
  await send('Input.dispatchKeyEvent',{type,code,key:k,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk}); };
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate',{url:`http://127.0.0.1:${HTTP}/flamme-retarde.html?cb=`+process.pid});
const t0 = Date.now(); let ready = false;
while (Date.now()-t0 < 600000) { await sleep(1000);
  const s = await js(`({r: !document.getElementById('enter').hidden})`);
  if (s && s.r) { ready = true; break; } }
if (!ready) { console.log('TIMED OUT'); chrome.kill(); process.exit(2); }
await js(`document.getElementById('enter').click()`); await sleep(1500);
await js(`__fr.skipIntro()`); await sleep(2000);
await key('Digit9','9',57); await sleep(3000);
const S = await js(`(()=>{const s=__fr.stats();return {census:s.jadrija.census, people:s.jadrija.people,
  walkers:s.jadrija.walkers, posed:s.jadrija.posed, tris:s.jadrija.tris};})()`);
console.log('stats  ', JSON.stringify(S));
const bench = async (t,s,yaw) => {
  await js(`__fr.jad.stand(${t}, ${s}, ${yaw})`); await sleep(2500);
  return js(`new Promise((res)=>{const d=[];let last=performance.now();let n=0;
    const f=()=>{const now=performance.now();d.push(now-last);last=now;n++;
      if(n<400) requestAnimationFrame(f); else {const w=d.slice(40).sort((a,b)=>a-b);
        res({mean:+(w.reduce((a,b)=>a+b,0)/w.length).toFixed(2), p50:+w[(w.length*0.5)|0].toFixed(2),
          p95:+w[(w.length*0.95)|0].toFixed(2), posed:__fr.stats().jadrija.posed});}};
    requestAnimationFrame(f);})`);
};
for (const [nm,t,s,yaw] of [['w',214,13,-Math.PI/2],['m',268,13,-Math.PI/2],['e',330,13,-Math.PI/2],['far',60,13,-Math.PI/2]]) {
  console.log('bench', nm, JSON.stringify(await bench(t,s,yaw)));
}
console.log('errors ', errs.length ? errs.slice(0,8).join('\n         ') : 'none');
chrome.kill(); process.exit(0);
