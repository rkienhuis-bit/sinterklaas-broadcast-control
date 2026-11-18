(() => {
 const cfg=window.APP_CONFIG;
 const $=id=>document.getElementById(id);
 const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 let connected=false, current='fireplace';
 const pin=$('pin'), start=$('start'), back=$('return');
 function render(){
   $('current-title').textContent=current==='special'?'Sinterklaasvideo':'Openhaard (YouTube)';
   start.disabled=!connected || current==='special';
   back.disabled=!connected || current==='fireplace';
 }
 function connection(ok,label){connected=ok;$('connection').innerHTML='<span class="dot '+(ok?'online':'')+'"></span> '+label;render();}
 async function load(){const {data,error}=await db.from('broadcast_state').select('mode').eq('id',1).single();if(error){connection(false,'Geen verbinding');$('message').textContent='Controleer config.js en de Supabase-tabel.';return;}current=data.mode;connection(true,'Verbonden');}
 db.channel('controller-status').on('postgres_changes',{event:'UPDATE',schema:'public',table:'broadcast_state',filter:'id=eq.1'},p=>{current=p.new.mode;render();$('message').textContent=current==='special'?'Sinterklaasvideo gestart.':'Terug naar openhaard.';}).subscribe(s=>{if(s==='SUBSCRIBED') load();});
 async function command(mode){
   $('message').textContent='';
   if(!pin.value.trim()){$('message').textContent='Vul eerst de regiecode in.';return;}
   start.disabled=true;back.disabled=true;
   try{
     const r=await fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin.value,mode})});
     const data=await r.json();
     if(!r.ok) throw new Error(data.error||'Opdracht mislukt');
     $('message').textContent=mode==='special'?'Startopdracht verstuurd.':'Terugschakelopdracht verstuurd.';
   }catch(e){$('message').textContent=e.message;}
   render();
 }
 start.addEventListener('click',()=>command('special'));
 back.addEventListener('click',()=>command('fireplace'));
 load();
})();