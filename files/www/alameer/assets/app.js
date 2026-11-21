'use strict';
const API='/ubus';
let session=null, board=null, info=null, ifaces=[], radioData=[], wirelessConfig=null, currentPage='dashboard';
const $=id=>document.getElementById(id);
async function rpc(object,method,args={},sid=session){
  const payload={jsonrpc:'2.0',id:Math.floor(Math.random()*1e9),method:'call',params:[sid||'00000000000000000000000000000000',object,method,args]};
  const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data=await res.json(); const result=Array.isArray(data)?data[0]:data;
  if(result?.error) throw new Error(result.error.message||'RPC error');
  if(result?.result && result.result[0]!==0) throw new Error('Router rejected '+object+'.'+method);
  return result?.result?.[1] ?? result?.result ?? {};
}
async function login(user,pass){
  const r=await rpc('session','login',{username:user,password:pass},'00000000000000000000000000000000');
  if(!r.ubus_rpc_session) throw new Error('Login failed. Check username and password.');
  session=r.ubus_rpc_session; localStorage.setItem('alameer_user',user);
  $('login').classList.add('hidden');$('app').classList.remove('hidden');
  await refreshAll();
}
function logout(){session=null;$('app').classList.add('hidden');$('login').classList.remove('hidden');$('password').value='';}
function toast(msg,bad=false){const t=$('toast');t.textContent=msg;t.className='toast show'+(bad?' bad':'');setTimeout(()=>t.className='toast',3500);}
function fmtTime(sec){sec=Number(sec||0);const d=Math.floor(sec/86400);sec%=86400;const h=Math.floor(sec/3600);sec%=3600;const m=Math.floor(sec/60);return `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;}
function setText(id,v){if($(id))$(id).textContent=v??'—';}
async function refreshAll(){
  try{
    [board,info]=await Promise.all([rpc('system','board'),rpc('system','info')]);
    setText('hostname',board.hostname||'Al-Makhadhi-K2');setText('hostInfo',board.hostname);
    setText('model',board.model||'Phicomm K2');setText('sysBoard',board.board_name||board.model);
    setText('sysModel',board.model);setText('sysKernel',board.kernel||'');setText('sysHostname',board.hostname);
    const mem=info.memory||{}, total=Number(mem.total||1), free=Number(mem.free||0), available=Number(mem.available??free);
    const used=Math.max(0,Math.min(100,Math.round((total-available)*100/total)));
    const cpu=info.load?(Number(info.load[0])/65536).toFixed(2):'—';
    setText('cpu',cpu);setText('cpuTop',cpu);setText('cpuRing','LOAD');
    setText('ram',used+'%');setText('ramTop',used+'%');setText('ramRing',used+'%');
    setText('ramDetail',`${Math.round(available/1024)} MB available`);
    setText('uptime',fmtTime(info.uptime));setText('uptimeTop',fmtTime(info.uptime));
    setText('sysUptime',fmtTime(info.uptime));
    const dump=await rpc('network.interface','dump');
    ifaces=dump.interface||[];
    const lan=ifaces.find(x=>x.interface==='lan'||x.device==='br-lan'||x.l3_device==='br-lan');
    const addr=lan?.ipv4_address?.[0];const ip=addr?`${addr.address}/${addr.mask}`:'192.168.1.20/24';
    setText('ipInfo',ip.split('/')[0]);setText('sysIp',ip);setText('lanAddress',ip);setText('lanDetailIp',ip);
    setText('lanState',lan?.up?'ONLINE':'CHECK');$('lanState').className='tag '+(lan?.up?'online':'warning');
    await loadWireless();
  }catch(e){toast('Dashboard refresh: '+e.message,true);}
}
async function getUci(config){
  const r=await rpc('uci','get',{config});
  return r.values||r;
}
async function setUci(config,section,values){
  return rpc('uci','set',{config,section,values});
}
async function commit(config){await rpc('uci','commit',{config});}
async function applyNetwork(){await rpc('network','reload',{});}
async function loadWireless(){
  try{
    wirelessConfig=await getUci('wireless');
    const devices=await rpc('iwinfo','devices',{});
    const names=devices.devices||[];
    radioData=[];
    for(const dev of names){
      try{const d=await rpc('iwinfo','info',{device:dev});radioData.push({device:dev,...d});}catch(_){}
    }
    renderRadios();
    populateWirelessForm();
    await loadClients();
  }catch(e){console.warn(e);}
}
function sectionsByType(type){
  const out=[];for(const [name,s] of Object.entries(wirelessConfig||{})){if(s&&s['.type']===type)out.push([name,s]);}return out;
}
function populateWirelessForm(){
  const radios=sectionsByType('wifi-device'), aps=sectionsByType('wifi-iface');
  const r24=radios.find(([n,s])=>s.band==='2g'||s.hwmode==='11g'||n==='radio0')||radios[0];
  const r5=radios.find(([n,s])=>s.band==='5g'||s.hwmode==='11a'||n==='radio1')||radios[1];
  const fill=(id,v)=>{if($(id)&&v!==undefined)$(id).value=v;};
  const ap24=aps.find(([n,s])=>s.device===r24?.[0])||aps[0];
  const ap5=aps.find(([n,s])=>s.device===r5?.[0])||aps[1];
  window.alameerSections={r24:r24?.[0],r5:r5?.[0],ap24:ap24?.[0],ap5:ap5?.[0]};
  if(ap24){const s=ap24[1];fill('ssid24',s.ssid);fill('sec24',s.encryption||'none');fill('ch24',r24?.[1].channel||'auto');fill('width24',r24?.[1].htmode||'HT20');fill('pass24','');$('hide24').checked=s.hidden==='1';$('isolate24').checked=s.isolate==='1';}
  if(ap5){const s=ap5[1];fill('ssid5',s.ssid);fill('sec5',s.encryption||'none');fill('ch5',r5?.[1].channel||'auto');fill('width5',r5?.[1].htmode||'VHT40');fill('pass5','');$('hide5').checked=s.hidden==='1';$('isolate5').checked=s.isolate==='1';}
}
function renderRadios(){
  const cards=radioData.map(d=>`<div class="radio-card"><div class="radio-top"><b>${d.device}</b><span class="tag online">READY</span></div><strong>${d.ssid||'Wireless radio'}</strong><div class="radio-meta"><span>${d.channel?'Channel '+d.channel:'Channel —'}</span><span>${d.frequency||''} MHz</span></div><small>${d.mode||'Access Point'} · ${d.txpower??'—'} dBm</small></div>`).join('');
  $('radioCards').innerHTML=cards||'<div class="empty">No active radio information returned by iwinfo.</div>';
  $('wirelessDetails').innerHTML=cards||'<div class="empty">No radio data.</div>';
}
async function loadClients(){
  const rows=[];
  for(const d of radioData){
    try{
      const a=await rpc('iwinfo','assoclist',{device:d.device});
      for(const c of (a.results||[])) rows.push({radio:d.device,...c});
    }catch(_){}
  }
  $('clientRows').innerHTML=rows.length?rows.map(c=>`<tr><td>${esc(c.radio)}</td><td>${esc(c.mac||'—')}</td><td>${c.signal??'—'} dBm</td><td>${c.rx_rate?.rate||'—'} / ${c.tx_rate?.rate||'—'} kbps</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No associated stations found.</td></tr>';
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showPage(name){
  currentPage=name;document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  $('page-'+name)?.classList.remove('hidden');
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===name));
  $('sidebar').classList.remove('open');
}
async function applyWireless(){
  const s=window.alameerSections||{};if(!s.ap24||!s.ap5||!s.r24||!s.r5)throw new Error('Could not map the two board radios to their AP sections; no changes were made.');
  const configs=[
    {radio:s.r24,ap:s.ap24,band:'24',ssid:$('ssid24').value,sec:$('sec24').value,key:$('pass24').value,ch:$('ch24').value,width:$('width24').value,power:$('power24').value,hidden:$('hide24').checked,isolate:$('isolate24').checked},
    {radio:s.r5,ap:s.ap5,band:'5',ssid:$('ssid5').value,sec:$('sec5').value,key:$('pass5').value,ch:$('ch5').value,width:$('width5').value,power:$('power5').value,hidden:$('hide5').checked,isolate:$('isolate5').checked}
  ];
  for(const c of configs){
    if(!c.ssid.trim())throw new Error('SSID cannot be empty.');
    if(c.sec==='psk2'&&c.key.length<8)throw new Error('WPA2 password must contain at least 8 characters.');
    await setUci('wireless',c.radio,{channel:c.ch==='auto'?'auto':c.ch,htmode:c.width,txpower:String(c.power),country:'YE',disabled:'0'});
    const ap={mode:'ap',ssid:c.ssid,encryption:c.sec,isolate:c.isolate?'1':'0',hidden:c.hidden?'1':'0'};
    if(c.sec==='psk2')ap.key=c.key;
    else { try { await rpc('uci','delete',{config:'wireless',section:c.ap,option:'key'}); } catch(_) {} }
    await setUci('wireless',c.ap,ap);
  }
  await commit('wireless');await rpc('file','exec',{command:'/sbin/wifi',params:['reload']});await applyNetwork();
  $('wirelessMsg').textContent='Settings saved. Radios are reloading…';toast('Wireless settings applied.');
  setTimeout(refreshAll,5000);
}
async function applyLan(){
  const ip=$('lanIp').value.trim(),mask=$('lanMask').value,gw=$('gateway').value.trim();
  if(!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip))throw new Error('Enter a valid IPv4 address.');
  const values={proto:'static',ipaddr:ip,netmask:mask};if(gw)values.gateway=gw;else values.gateway=null;
  await setUci('network','lan',values);await commit('network');await applyNetwork();
  $('lanMsg').textContent='LAN settings saved. Reconnect at http://'+ip+'/alameer/';
  toast('LAN settings saved. Your browser may disconnect.');
}
document.addEventListener('DOMContentLoaded',()=>{
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';try{await login($('username').value,$('password').value);}catch(err){$('loginError').textContent=err.message;}});
  $('logout').onclick=logout;
  document.querySelectorAll('.nav[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
  document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{showPage(b.dataset.goto);if(b.dataset.openTab)selectTab(b.dataset.openTab);});
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
  function selectTab(tab){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));$('tab-basic').classList.toggle('hidden',tab!=='basic');$('tab-more').classList.toggle('hidden',tab!=='more');}
  $('applyWireless').onclick=async()=>{try{await applyWireless();}catch(e){$('wirelessMsg').textContent=e.message;toast(e.message,true);}};
  $('applyLan').onclick=async()=>{try{await applyLan();}catch(e){$('lanMsg').textContent=e.message;toast(e.message,true);}};
  $('refreshWireless').onclick=loadWireless;$('refreshClients').onclick=loadClients;
  $('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open');
  $('themeToggle').onclick=()=>{document.body.classList.toggle('light');localStorage.setItem('alameer_theme',document.body.classList.contains('light')?'light':'dark');$('themeToggle').innerHTML=document.body.classList.contains('light')?'☀ <span>Light</span>':'☾ <span>Dark</span>';};
  if(localStorage.getItem('alameer_theme')==='light'){$('themeToggle').click();}
  $('reboot').onclick=async()=>{if(confirm('Reboot the router now?')){try{await rpc('rpc-sys','reboot',{});toast('Reboot requested.');logout();}catch(e){toast(e.message,true);}}};
  $('changePassword').onclick=async()=>{
    const p=$('newPassword').value, q=$('confirmPassword').value;
    if(p.length<8){$('passwordMsg').textContent='Use at least 8 characters.';return;}
    if(p!==q){$('passwordMsg').textContent='Passwords do not match.';return;}
    try{await rpc('rpc-sys','password_set',{user:'root',password:p});$('passwordMsg').textContent='Password updated. Please sign in again.';setTimeout(logout,1800);}
    catch(e){$('passwordMsg').textContent=e.message;toast(e.message,true);}
  };
  const saved=localStorage.getItem('alameer_user');if(saved)$('username').value=saved;
  setInterval(()=>{if(session&&currentPage==='dashboard')refreshAll();},15000);
});
