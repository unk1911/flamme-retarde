// stand next to individual crowd figures and photograph them
import { spawn } from 'node:child_process';
import { gpuLaunch } from '/home/unk1911/flamme-retarde/tools/gpu.mjs';
import fs from 'node:fs';
const TAG = process.argv[2] || 'bef';
const OUT = '/tmp/claude-1000/-home-unk1911-flamme-retarde/3ab28b14-2416-4c8f-af0a-7abc5478a347/scratchpad/promx/';
fs.mkdirSync(OUT, {recursive:true});
const PORT = 9442, HTTP = process.env.HTTP || '8841', GL = gpuLaunch(null);
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
// Instanced-tier figures: all() is skin.figures then m then f. Skinned ones are
// meshes in the scene, so anybody whose position is NOT one of those meshes is
// an instance.
const list = await js(`(()=>{const j=__fr.jad.raw();
  const all=j.crowd.all();
  return all.map((f,i)=>({i, mode:f.mode, t:+(f.t||0).toFixed(1), s:+(f.lane||0).toFixed(1), chair:f.seat!==undefined}));})()`);
fs.writeFileSync(OUT+TAG+'-figs.json', JSON.stringify(list,null,0));
const prom = list.filter((f)=>f.s>9.5 && f.t>200 && f.t<420);
console.log('promenade figures', prom.length, JSON.stringify(prom.slice(0,40)));
// stand 4 m seaward of a handful of them, looking inland at them
for (const f of prom.slice(0,6)) {
  await js(`__fr.jad.stand(${f.t}, ${f.s - 4.5}, ${Math.PI})`); await sleep(2200);
  await shot(`${TAG}-n${f.i}`);
  console.log('shot', f.i, f.mode, f.t, f.s);
}
console.log('errors ', errs.length ? errs.slice(0,8).join('\n         ') : 'none');
chrome.kill(); process.exit(0);
