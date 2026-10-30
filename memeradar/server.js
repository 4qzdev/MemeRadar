'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const DEX = 'https://api.dexscreener.com';
const cache = new Map(), hits = new Map();
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const EVM = {ethereum:'1',bsc:'56',polygon:'137',arbitrum:'42161',optimism:'10',base:'8453',avalanche:'43114',fantom:'250',linea:'59144',zksync:'324',mantle:'5000',blast:'81457',mode:'34443',celo:'42220',gnosis:'100',opbnb:'204',scroll:'534352'};
function send(res,status,data,type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Cross-Origin-Opener-Policy':'same-origin','Cache-Control':type.includes('text/html')?'no-cache':'no-store'});
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function rateLimited(req) {
  const ip = req.socket.remoteAddress || 'unknown', now = Date.now(); let v = hits.get(ip);
  if (!v || now-v.at > 60000) { v={at:now,n:0}; hits.set(ip,v); }
  return ++v.n > 90;
}
async function jsonFetch(url, headers={}) {
  const r = await fetch(url, {headers:{accept:'application/json','user-agent':'MemeRadar/3.0',...headers},signal:AbortSignal.timeout(14000)});
  if (!r.ok) { const e = new Error(`Provider returned HTTP ${r.status}`); e.status=r.status; throw e; }
  return r.json();
}
async function cached(key, ttl, fn) {
  const now=Date.now(), old=cache.get(key); if(old && now-old.at<ttl){if(Array.isArray(old.value)){old.value._cache={hit:true,ageMs:now-old.at};return old.value;}return {...old.value,_cache:{hit:true,ageMs:now-old.at}};}
  try { const value=await fn(); cache.set(key,{at:now,value}); if(Array.isArray(value)){value._cache={hit:false,ageMs:0};return value;} return {...value,_cache:{hit:false,ageMs:0}}; }
  catch(e) { if(old){if(Array.isArray(old.value)){old.value._cache={hit:true,stale:true,ageMs:now-old.at};return old.value;}return {...old.value,_cache:{hit:true,stale:true,ageMs:now-old.at}};} throw e; }
}
async function latestFeed() {
  return cached('latest-feed',25000,async()=>{
    const [profiles,boosts] = await Promise.all([
      jsonFetch(`${DEX}/token-profiles/latest/v1`),
      jsonFetch(`${DEX}/token-boosts/latest/v1`).catch(()=>[])
    ]);
    const list=Array.isArray(profiles)?profiles:[], boostList=Array.isArray(boosts)?boosts:[];
    const boostMap=new Map(boostList.map(x=>[`${x.chainId}:${x.tokenAddress}`.toLowerCase(),x]));
    const groups=new Map();
    for(const p of list){if(!p.chainId||!p.tokenAddress)continue;if(!groups.has(p.chainId))groups.set(p.chainId,[]);groups.get(p.chainId).push(p.tokenAddress);}
    const pairMap=new Map();
    await Promise.all([...groups].flatMap(([chain,addresses])=>{
      const uniq=[...new Set(addresses)], chunks=[]; for(let i=0;i<uniq.length;i+=25)chunks.push(uniq.slice(i,i+25));
      return chunks.map(async chunk=>{try{const pairs=await jsonFetch(`${DEX}/tokens/v1/${encodeURIComponent(chain)}/${chunk.map(encodeURIComponent).join(',')}`);for(const p of Array.isArray(pairs)?pairs:[]){const k=`${chain}:${p.baseToken?.address||''}`.toLowerCase(),old=pairMap.get(k);if(!old||Number(p.liquidity?.usd||0)>Number(old.liquidity?.usd||0))pairMap.set(k,p);}}catch(_){}});
    }));
    return {tokens:list.map(p=>({...p,pair:pairMap.get(`${p.chainId}:${p.tokenAddress}`.toLowerCase())||null,boost:boostMap.get(`${p.chainId}:${p.tokenAddress}`.toLowerCase())||null})),source:'DexScreener',updatedAt:new Date().toISOString(),providerCount:boostList.length};
  });
}
function securityChecks(d) {
  const checks=[]; const add=(name,field,good,bad,critical=false,invert=false)=>{const v=d[field];if(v===undefined||v===null||v==='')return checks.push({name,status:'unknown',detail:'Provider did not return this field',source:'GoPlus'});const flagged=String(v)==='1'||v===true;const risk=invert?!flagged:flagged;checks.push({name,status:risk?'risk':'clear',severity:risk&&critical?'critical':risk?'warning':'info',detail:risk?bad:good,raw:String(v),source:'GoPlus'});};
  add('Honeypot detection','is_honeypot','No honeypot flag returned','Provider flags possible honeypot',true);
  add('Cannot sell all','cannot_sell_all','No cannot-sell-all flag returned','Provider flags a sell restriction',true);
  add('Cannot buy','cannot_buy','No cannot-buy flag returned','Provider flags a buy restriction',true);
  add('Open source','is_open_source','Contract source is reported open source','Contract source is not reported open source',false,true);
  add('Proxy contract','is_proxy','No proxy flag returned','Proxy pattern detected; implementation can change');
  add('Mint capability','is_mintable','No mintable flag returned','Mint capability reported');
  add('Hidden owner','hidden_owner','No hidden-owner flag returned','Hidden owner flag reported',true);
  add('Blacklist capability','is_blacklisted','No blacklist flag returned','Blacklist capability / risk flag reported',true);
  add('Owner balance changes','owner_change_balance','No owner balance-change flag returned','Owner may change balances',true);
  add('Self-destruct capability','selfdestruct','No self-destruct flag returned','Self-destruct capability reported',true);
  add('External calls','external_call','No external-call flag returned','External calls flagged; review contract');
  for(const [field,label] of [['buy_tax','Buy tax'],['sell_tax','Sell tax']]){const v=Number(d[field]);if(d[field]===undefined||d[field]===null||d[field]===''){checks.push({name:label,status:'unknown',detail:'Provider did not return this field',source:'GoPlus'});continue;}checks.push({name:label,status:v>=10?'risk':v>=5?'warning':'clear',severity:v>=10?'critical':v>=5?'warning':'info',detail:`Reported ${Number.isFinite(v)?(v*100).toFixed(2)+'%':'unavailable'}; provider values are fractions`,raw:String(d[field]),source:'GoPlus'});}
  return checks;
}
async function securityReport(chain,address) {
  const chainKey=chain.toLowerCase();
  if(chainKey==='solana'){
    const url=`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${encodeURIComponent(address)}`;
    const headers=process.env.GOPLUS_ACCESS_TOKEN?{Authorization:process.env.GOPLUS_ACCESS_TOKEN}:{};
    const payload=await jsonFetch(url,headers); const item=payload.result?.[address]||Object.values(payload.result||{})[0];
    if(!item)throw new Error(payload.message||'No Solana security result returned');
    const fields=[['Mint authority','mint_authority'],['Freeze authority','freeze_authority'],['Metadata mutable','metadata_mutable'],['Transfer fee','transfer_fee_enable'],['Default account state','default_account_state'],['Non-transferable','non_transferable']];
    const checks=fields.map(([name,k])=>({name,status:item[k]===undefined?'unknown':(item[k]===null||item[k]===''||item[k]==='0'||item[k]===false)?'clear':'risk',detail:item[k]===undefined?'Provider did not return this field':String(item[k]),raw:String(item[k]??''),source:'GoPlus'}));
    return {provider:'GoPlus Security',chain,address,checkedAt:new Date().toISOString(),checks,rawSummary:{holder_count:item.holder_count,lp_holders:item.lp_holders,top_holders:item.holders?.slice?.(0,10)||[]},disclaimer:'Automated third-party screening, not an audit or guarantee. Missing fields are unknown, not safe.'};
  }
  const id=EVM[chainKey]; if(!id)throw Object.assign(new Error(`GoPlus EVM security is not configured for ${chain}.`),{status:422});
  const headers=process.env.GOPLUS_ACCESS_TOKEN?{Authorization:process.env.GOPLUS_ACCESS_TOKEN}:{};
  const payload=await jsonFetch(`https://api.gopluslabs.io/api/v1/token_security/${id}?contract_addresses=${encodeURIComponent(address.toLowerCase())}`,headers);
  const item=payload.result?.[address.toLowerCase()]||Object.values(payload.result||{})[0];
  if(!item)throw new Error(payload.message||'No security result returned. The provider may not support this contract.');
  return {provider:'GoPlus Security',chain,address,checkedAt:new Date().toISOString(),checks:securityChecks(item),rawSummary:{holder_count:item.holder_count,holders:item.holders?.slice?.(0,10)||[],creator_address:item.creator_address,owner_address:item.owner_address,lp_holders:item.lp_holders?.slice?.(0,10)||[]},disclaimer:'Automated third-party screening, not an audit or guarantee. Missing fields are unknown, not safe.'};
}
const server=http.createServer(async(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed'});
  if(rateLimited(req))return send(res,429,{error:'Rate limit reached. Wait a moment and retry.'});
  const u=new URL(req.url,'http://localhost');
  try {
    if(u.pathname==='/api/health')return send(res,200,{ok:true,service:'MemeRadar',version:'5.2',providers:{market:'DexScreener',security:'GoPlus Security (provider availability varies by chain)'},serverTime:new Date().toISOString()});
    if(u.pathname==='/api/latest')return send(res,200,await latestFeed());
    if(u.pathname==='/api/search'){
      const q=(u.searchParams.get('q')||'').trim().slice(0,100);if(!q)return send(res,400,{error:'Enter a token name, ticker, or address.'});
      const data=await cached('search:'+q.toLowerCase(),12000,()=>jsonFetch(`${DEX}/latest/dex/search?q=${encodeURIComponent(q)}`));return send(res,200,{pairs:data.pairs||[],source:'DexScreener',updatedAt:new Date().toISOString(),_cache:data._cache});
    }
    if(u.pathname.startsWith('/api/token/')){
      const bits=u.pathname.split('/').filter(Boolean);if(bits.length!==4)return send(res,400,{error:'Use /api/token/:chain/:address'});
      const chain=decodeURIComponent(bits[2]),address=decodeURIComponent(bits[3]);if(!/^[a-zA-Z0-9]{20,100}$/.test(address))return send(res,400,{error:'Invalid token address format'});
      const data=await cached(`token:${chain}:${address}`.toLowerCase(),15000,()=>jsonFetch(`${DEX}/tokens/v1/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`));return send(res,200,{pairs:Array.isArray(data)?data:[],source:'DexScreener',updatedAt:new Date().toISOString(),_cache:data._cache});
    }
    if(u.pathname.startsWith('/api/security/')){
      const bits=u.pathname.split('/').filter(Boolean);if(bits.length!==4)return send(res,400,{error:'Use /api/security/:chain/:address'});
      const chain=decodeURIComponent(bits[2]),address=decodeURIComponent(bits[3]);if(!/^[a-zA-Z0-9]{20,100}$/.test(address))return send(res,400,{error:'Invalid token address format'});
      const report=await cached(`security:${chain}:${address}`.toLowerCase(),120000,()=>securityReport(chain,address));return send(res,200,report);
    }
    if(u.pathname.startsWith('/api/'))return send(res,404,{error:'API route not found'});
    let pathname;try{pathname=decodeURIComponent(u.pathname)}catch(_){return send(res,400,{error:'Bad path'});}if(pathname==='/')pathname='/index.html';
    const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep))return send(res,403,{error:'Forbidden'});
    fs.readFile(file,(err,body)=>{if(err)return send(res,404,'Not found','text/plain; charset=utf-8');send(res,200,body,MIME[path.extname(file)]||'application/octet-stream');});
  } catch(e) { const status=e.status===422?422:502;send(res,status,{error:e.message||'Upstream provider unavailable',provider:'External provider',updatedAt:new Date().toISOString()}); }
});
server.listen(PORT,()=>console.log(`MemeRadar 3.0 running at http://localhost:${PORT}`));
