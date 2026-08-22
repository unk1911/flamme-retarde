// promenade bathers probe
import { spawn } from 'node:child_process';
import { gpuLaunch } from '/home/unk1911/flamme-retarde/tools/gpu.mjs';
import fs from 'node:fs';
const TAG = process.argv[2] || 'bef';
const OUT = '/tmp/claude-1000/-home-unk1911-flamme-retarde/3ab28b14-2416-4c8f-af0a-7abc5478a347/scratchpad/promx/';
fs.mkdirSync(OUT, {recursive:true});
const PORT = 9441, HTTP = process.env.HTTP || '8841', GL = gpuLaunch(null);
const chrome = spawn('google-chrome', ['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  ...GL.args,'--hide-scrollbars','--mute-audio','--autoplay-policy=no-user-gesture-required',
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
const shot = async (name) => { const r = await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(OUT+name+'.png', Buffer.from(r.result.data,'base64')); };
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate',{url:`http://127.0.0.1:${HTTP}/flamme-retarde.html?q=low&cb=`+process.pid});
const t0 = Date.now(); let ready = false;
while (Date.now()-t0 < 600000) { await sleep(1000);
  const s = await js(`({r: !document.getElementById('enter').hidden})`);
  if (s && s.r) { ready = true; break; } }
console.log('build', ready ? ((Date.now()-t0)/1000).toFixed(0)+'s' : 'TIMED OUT');
if (!ready) { chrome.kill(); process.exit(2); }
await js(`document.getElementById('enter').click()`); await sleep(1500);
await js(`__fr.skipIntro()`); await sleep(2000);
await key('Digit9','9',57); await sleep(3000);
const S = await js(`(()=>{const s=__fr.stats();return {census:s.jadrija.census, people:s.jadrija.people,
  walkers:s.jadrija.walkers, rigs:s.jadrija.rigs, posed:s.jadrija.posed, tris:s.jadrija.tris,
  camTS:s.camTS};})()`);
console.log('stats  ', JSON.stringify(S));
const T = await js(`(()=>{const j=__fr.jad.raw(); const c=j.crowd; const modes={};
  for(const f of c.all()) modes[f.mode]=(modes[f.mode]||0)+1;
  return {modes, drawn:c.drawn, people:c.people};})()`);
console.log('tiers  ', JSON.stringify(T));
const CAMS = [
  ['w', 214, 13.0, -Math.PI/2],
  ['m', 268, 13.0, -Math.PI/2],
  ['e', 330, 13.0, -Math.PI/2],
  ['q', 250, 3.0, -Math.PI/2],
];
for (const [nm,t,s,yaw] of CAMS) {
  await js(`__fr.jad.stand(${t}, ${s}, ${yaw})`); await sleep(2500);
  await shot(`${TAG}-${nm}`);
  const c = await js(`JSON.stringify(__fr.stats().camTS)`);
  console.log('cam', nm, c);
}
await js(`__fr.jad.stand(268, 13.0, ${-Math.PI/2})`); await sleep(2000);
const F = await js(`new Promise((res)=>{const d=[];let last=performance.now();let n=0;
  const f=()=>{const now=performance.now();d.push(now-last);last=now;n++;
    if(n<180) requestAnimationFrame(f); else {d.sort((a,b)=>a-b);
      res({mean:+(d.reduce((a,b)=>a+b,0)/d.length).toFixed(2), p50:+d[90].toFixed(2), p95:+d[170].toFixed(2), fps:__fr.stats().fps, posed:__fr.stats().jadrija.posed});}};
  requestAnimationFrame(f);})`);
console.log('frame  ', JSON.stringify(F));
console.log('errors ', errs.length ? errs.slice(0,8).join('\n         ') : 'none');
chrome.kill(); process.exit(0);
