'use strict';
const {spawn}=require('node:child_process');
const path=require('node:path');
const port=39000+Math.floor(Math.random()*1000);
const child=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,expected){let last;for(let i=0;i<25;i++){try{const r=await fetch(base+url);if(r.status!==expected)throw new Error(`${url}: expected ${expected}, got ${r.status}`);return r;}catch(e){last=e;await sleep(100);}}throw last||new Error('Server did not start');}
(async()=>{try{
 const h=await request('/api/health',200);const health=await h.json();if(!health.ok||health.version!=='5.2')throw new Error('Health payload mismatch');
 const page=await request('/',200);const html=await page.text();for(const term of ['Command center','Security lab','Portfolio','Research journal','Radar academy','Connect wallet','MY WORKSPACE','MARKETS'])if(!html.includes(term))throw new Error(`Missing UI module: ${term}`);
 await request('/app.js',200);await request('/style.css',200);await request('/wallet.js',200);await request('/manifest.webmanifest',200);await request('/sw.js',200);
 await request('/api/security/ethereum/not-an-address',400);
 await request('/api/security/not-supported/0x1234567890123456789012345678901234567890',422);
 await request('/api/does-not-exist',404);
 const method=await fetch(base+'/api/health',{method:'POST'});if(method.status!==405)throw new Error(`POST method guard returned ${method.status}`);
 const traversal=await fetch(base+'/%2e%2e/server.js');if(![403,404].includes(traversal.status))throw new Error(`Path traversal guard returned ${traversal.status}`);
 process.stdout.write('PASS: health, HTML modules, static assets, manifest, service worker, input validation, unsupported security chain, unknown route, method guard, path traversal guard.\n');
 }catch(e){console.error('FAIL:',e.message);process.exitCode=1;}finally{child.kill('SIGTERM');}})();
