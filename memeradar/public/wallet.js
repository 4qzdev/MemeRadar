(()=>{'use strict';
const $=s=>document.querySelector(s);
const button=$('#walletOpenBtn'),label=$('#walletButtonLabel');
let session=null,announced=[];
const short=a=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'';
function walletName(p){return p?.isTrust?'Trust Wallet':p?.isCoinbaseWallet?'Coinbase Wallet':p?.isMetaMask?'MetaMask':p?.isBraveWallet?'Brave Wallet':p?.isRabby?'Rabby':p?.isPhantom?'Phantom':p?.isSolflare?'Solflare':'Connected wallet';}
function evmProvider(){
 const eth=window.ethereum;
 if(eth?.providers?.length){const preferred=eth.providers.find(p=>p.isMetaMask)||eth.providers[0];return {provider:preferred,name:walletName(preferred)};}
 if(eth&&typeof eth.request==='function')return {provider:eth,name:walletName(eth)};
 const found=announced.find(x=>x.provider&&typeof x.provider.request==='function');
 return found||null;
}
function solProvider(){const candidates=[window.phantom?.solana,window.solflare,window.trustwallet?.solana,window.solana];const p=candidates.find(x=>x&&typeof x.connect==='function');return p?{provider:p,name:walletName(p)}:null;}
function showConnected(){button.classList.add('connected');label.textContent=short(session.address);button.title=`Connected to ${session.name} · Click to disconnect locally`;}
function showDisconnected(){button.classList.remove('connected');label.textContent='Connect wallet';button.title='Connect your actual browser wallet';}
function disconnectLocal(){session=null;showDisconnected();}
function fail(message){if(typeof window.toast==='function')window.toast(message);else alert(message);}
async function connectEvm(item){const p=item?.provider;if(!p){fail('No real browser wallet is available. Install/unlock MetaMask, Trust Wallet, Coinbase Wallet or Rabby, or open MemeRadar in your wallet’s dApp browser.');return;}
 try{const accounts=await p.request({method:'eth_requestAccounts'});if(!Array.isArray(accounts)||!accounts[0])throw new Error('The wallet did not return an account.');let chainId='';try{chainId=await p.request({method:'eth_chainId'});}catch(_){}
 session={kind:'EVM',name:item.name||walletName(p),address:accounts[0],provider:p};showConnected();
 p.on?.('accountsChanged',a=>{if(!a?.length)disconnectLocal();else{session.address=a[0];showConnected();}});
 p.on?.('chainChanged',()=>{});
 }catch(e){if(e?.code===4001)fail('Connection request rejected in your wallet.');else fail(`Wallet connection failed: ${e.message||e}`);}}
async function connectSol(item){const p=item?.provider;if(!p){fail('No real Solana wallet is available. Install/unlock Phantom or Solflare, or open MemeRadar in its dApp browser.');return;}
 try{const result=await p.connect();const address=result?.publicKey?.toString?.()||p.publicKey?.toString?.();if(!address)throw new Error('The wallet did not return a public address.');session={kind:'Solana',name:item.name||walletName(p),address,provider:p};showConnected();p.on?.('accountChanged',key=>{if(!key)disconnectLocal();else{session.address=key.toString();showConnected();}});
 }catch(e){fail(e?.code===4001?'Connection request rejected in your wallet.':`Wallet connection failed: ${e?.message||e}`);}}
async function connect(){if(session){disconnectLocal();return;}const evm=evmProvider();if(evm){await connectEvm(evm);return;}const sol=solProvider();if(sol){await connectSol(sol);return;}fail('No real wallet extension was detected. Install and unlock a wallet, then refresh this page. MemeRadar never creates a demo or virtual wallet.');}
window.addEventListener('eip6963:announceProvider',event=>{const d=event.detail||{},p=d.provider;if(p&&!announced.some(x=>x.provider===p))announced.push({provider:p,name:d.info?.name||walletName(p)});});
window.dispatchEvent(new Event('eip6963:requestProvider'));
button?.addEventListener('click',connect);
showDisconnected();
})();
