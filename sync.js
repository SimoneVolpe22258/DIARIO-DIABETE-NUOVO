'use strict';
// Supabase publishable key: public by design. NEVER include a secret/service_role key.
(()=>{
const URL_BASE='https://gyaashpxfeknlkhfyzxe.supabase.co';
const API_KEY='sb_publishable_l5DpS5HR_4aMs38YZnRMeA_K8G97eOm';
let api=null,session=null,busy=false,timer=null,last='Non collegato',lastError='';
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const escapeHTML=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function raw(path,opts={},bearer=null){
 const headers={'apikey':API_KEY,'Content-Type':'application/json',...opts.headers};
 if(bearer)headers.Authorization='Bearer '+bearer;
 let r=await fetch(URL_BASE+path,{...opts,headers,cache:'no-store'});
 let txt=await r.text(),data;try{data=txt?JSON.parse(txt):null}catch{data=txt}
 if(!r.ok)throw new Error((data?.msg||data?.message||data?.error_description||data?.error||r.statusText)+' ('+r.status+')');
 return data;
}
async function saveSession(){await api.transact('settings','readwrite',s=>s.put({id:'sync:session',value:session}));}
async function token(){if(!session)return null;if(Date.now()>session.expires_at*1000-90000){const data=await raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});session={...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in};await saveSession()}return session.access_token;}
async function req(path,opts={}){return raw('/rest/v1/'+path,opts,await token())}
const getAll=store=>api.transact(store,'readonly',s=>s.getAll());
const getOne=(store,id)=>api.transact(store,'readonly',s=>s.get(id));
const write=(store,obj)=>api.transact(store,'readwrite',s=>s.put(obj));
function panel(){return `<section class="card"><h2>☁ Sincronizzazione Supabase</h2><p class="muted">${escapeHTML(last)}${lastError?' · '+escapeHTML(lastError):''}</p>${session?'<div class="buttons"><button data-action="syncNow">↻ Sincronizza ora</button><button class="secondary" data-action="syncLogout">Disconnetti</button></div>':'<p>Accedi con l’utente creato in Supabase. I dati restano sul dispositivo anche senza accesso.</p><label for="syncEmail">Email</label><input id="syncEmail" type="email" autocomplete="username"><label for="syncPassword">Password</label><input id="syncPassword" type="password" autocomplete="current-password"><div class="buttons"><button data-action="syncLogin">Accedi a Supabase</button></div>'}<p class="small">La sincronizzazione avviene all’apertura, dopo le modifiche e quando torna Internet. Se due dispositivi modificano lo stesso elemento offline, una copia viene conservata come conflitto da verificare. Effettua regolarmente backup JSON.</p></section>`}
async function refresh(){if(api){await api.loadMeds();await api.render()}}
async function login(){let email=document.getElementById('syncEmail')?.value;let password=document.getElementById('syncPassword')?.value;if(!email||!password){alert('Inserisci email e password.');return;}try{const data=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:email.trim(),password})});if(session?.user?.id&&session.user.id!==data.user.id)throw new Error('Questo dispositivo contiene una sessione di un altro utente. Esporta prima un backup.');session={...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in};await saveSession();last='Accesso effettuato';lastError='';await refresh();await sync()}catch(e){lastError=e.message;alert('Accesso non riuscito: '+e.message);await refresh()}}
async function logout(){if(!confirm('Disconnettere Supabase? I dati locali rimarranno su questo dispositivo.'))return;session=null;await saveSession();last='Non collegato';lastError='';await refresh()}
async function list(table){let result=[];for(let offset=0;offset<100000;offset+=500){let page=await req(`${table}?select=*&order=creato_il.asc&limit=500&offset=${offset}`);result.push(...page);if(page.length<500)break;}return result}
function tableId(store,item){return store==='settings'?item.id.slice('medication:'.length):item.id}
function localId(store,id){return store==='settings'?'medication:'+id:id}
function rowFrom(store,item){let clean={...item};delete clean._dirty;delete clean._remoteVersion;delete clean._deleted;delete clean._conflict;return {id:tableId(store,item),user_id:session.user.id,...(store==='entries'?{tipo:item.type}:{}),dati:clean,modificato_il:item.updatedAt||item.createdAt||new Date().toISOString(),eliminato:!!item._deleted}}
async function pullTable(store,table){
 const remote=await list(table);let remoteById=new Map(remote.map(r=>[r.id,r]));
 const locals=(await getAll(store)).filter(x=>store==='entries'||x.id.startsWith('medication:'));
 for(const item of locals){if(!item._conflict&&!uuid(tableId(store,item))){throw Error('ID locale non UUID: '+tableId(store,item)+'. Backup necessario prima della migrazione.')} }
 // Upload local changes before pulling server state; remote edits use optimistic version checks.
 for(const item of locals){
  const id=tableId(store,item),server=remoteById.get(id);
  if(item._conflict||(!item._dirty&&item._remoteVersion))continue;
  const payload=rowFrom(store,item);
  if(!server){
   try{const inserted=await req(table,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});const current=await getOne(store,item.id);if(current?.updatedAt===item.updatedAt&&current?._deleted===item._deleted)await write(store,{...item,_dirty:false,_remoteVersion:inserted[0].modificato_il})}
   catch(e){if(e.message.includes('409'))throw Error('Conflitto durante la creazione di '+id+'; riprova.');throw e}
  }else if(!item._remoteVersion){
   // Legacy local data and remote record with same id: do not overwrite remote blindly.
   if(JSON.stringify(server.dati)===JSON.stringify(payload.dati)&&server.eliminato===payload.eliminato){await write(store,{...item,_dirty:false,_remoteVersion:server.modificato_il})}
   else{await preserveConflict(store,item);await write(store,{...server.dati,id:localId(store,id),_deleted:server.eliminato,_dirty:false,_remoteVersion:server.modificato_il})}
  }else if(server.modificato_il!==item._remoteVersion){
   await preserveConflict(store,item);await write(store,{...server.dati,id:localId(store,id),_deleted:server.eliminato,_dirty:false,_remoteVersion:server.modificato_il});
  }else if(item._dirty){
   const version=new Date().toISOString();payload.modificato_il=version;
   let result=await req(`${table}?id=eq.${encodeURIComponent(id)}&modificato_il=eq.${encodeURIComponent(item._remoteVersion)}&select=modificato_il`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
   if(result.length===0){await preserveConflict(store,item);throw Error('Modifica contemporanea rilevata: conservata copia locale. Ripeti la sincronizzazione.');}
   const current=await getOne(store,item.id);if(current?.updatedAt===item.updatedAt&&current?._deleted===item._deleted)await write(store,{...item,_dirty:false,_remoteVersion:result[0].modificato_il});
  }
 }
 // Pull missing/updated records. Do not overwrite unpushed local modifications.
 const latestRemote=await list(table);
 const after=(await getAll(store)).filter(x=>store==='entries'||x.id.startsWith('medication:'));
 const localById=new Map(after.map(x=>[tableId(store,x),x]));
 for(const r of latestRemote){const x=localById.get(r.id);if(x?._dirty||x?._conflict)continue;if(!x||x._remoteVersion!==r.modificato_il){await write(store,{...r.dati,id:localId(store,r.id),_deleted:r.eliminato,_dirty:false,_remoteVersion:r.modificato_il})}}
}
async function preserveConflict(store,item){
 // Never discard a locally edited record. Duplicate it with a new UUID and mark dirty.
 const newId=crypto.randomUUID();const copy={...item,id:localId(store,newId),_remoteVersion:null,_dirty:false,_conflict:true,updatedAt:new Date().toISOString()};
 if(store==='settings')copy.name=(copy.name||'Farmaco')+' (conflitto da verificare)';
 else copy.notes=(copy.notes||'')+' [CONFLITTO: copia locale da verificare; non sincronizzata]';
 await write(store,copy);
}
async function sync(){if(!api||!session||busy||!navigator.onLine)return;busy=true;last='Sincronizzazione in corso…';lastError='';try{await token();await pullTable('settings','diario_farmaci');await pullTable('entries','diario_records');last='Sincronizzato: '+new Date().toLocaleString('it-IT');}catch(e){last='Sincronizzazione incompleta';lastError=e.message;console.error('Diario sync',e)}finally{busy=false;await refresh()}}
function schedule(){if(!session)return;clearTimeout(timer);timer=setTimeout(sync,1200)}
async function init(adapter){api=adapter;let saved=await getOne('settings','sync:session');session=saved?.value||null;if(session){last='Archivio locale pronto · sincronizzazione in attesa';schedule()}window.addEventListener('online',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});setInterval(()=>{if(!document.hidden)schedule()},60000);await refresh()}
window.diarioSync={init,panel,login,logout,sync,schedule};
})();
