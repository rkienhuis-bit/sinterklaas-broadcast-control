(() => {
 const cfg=window.APP_CONFIG, status=document.getElementById('status'), ytId=cfg.YOUTUBE_VIDEO_ID;
 if(!cfg.SUPABASE_URL || cfg.SUPABASE_URL.startsWith('VUL_HIER')) { status.textContent='Vul eerst config.js in.'; return; }
 const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 const video=document.getElementById('special-video');
 let player=null, active=false, lastCommand=null;
 window.onYouTubeIframeAPIReady=()=>{};
 const tag=document.createElement('script'); tag.src='https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
 window.onYouTubeIframeAPIReady=()=>{ player=new YT.Player('youtube-player',{videoId:ytId, playerVars:{autoplay:1,controls:0,disablekb:1,fs:0,iv_load_policy:3,modestbranding:1,playsinline:1,rel:0}, events:{onReady:()=>{status.textContent='Openhaard';},onError:()=>{status.textContent='YouTube kon niet laden';}}}); };
 async function playSpecial(commandId){
   if(active || lastCommand===commandId) return;
   active=true; lastCommand=commandId; video.style.display='block';
   try {
     if(player && player.pauseVideo) player.pauseVideo();
     video.src=cfg.SPECIAL_VIDEO_URL; video.currentTime=0;
     status.textContent='Sinterklaasuitzending';
     await video.play();
   } catch(e) {
     active=false; video.style.display='none'; if(player && player.playVideo) player.playVideo(); status.textContent='Video kon niet starten – controleer autoplay/audio-instellingen';
     console.error('MP4 playback failed',e);
   }
 }
 function returnToFireplace(){
   if(!active) return;
   active=false; video.pause(); video.style.display='none'; video.removeAttribute('src'); video.load();
   status.textContent='Openhaard';
   if(player && player.playVideo) player.playVideo();
 }
 video.addEventListener('ended',returnToFireplace);
 video.addEventListener('error',()=>{if(active){active=false;video.style.display='none';if(player && player.playVideo) player.playVideo();status.textContent='Fout bij laden MP4';}});
 db.from('broadcast_state').select('mode,command_id').eq('id',1).single().then(({data,error})=>{
   if(error){status.textContent='Geen verbinding met regie';console.error(error);return;}
   if(data.mode==='special') playSpecial(data.command_id);
 });
 db.channel('broadcast-control').on('postgres_changes',{event:'UPDATE',schema:'public',table:'broadcast_state',filter:'id=eq.1'},payload=>{
   const s=payload.new;
   if(s.mode==='special') playSpecial(s.command_id);
   else if(s.mode==='fireplace') returnToFireplace();
 }).subscribe(s=>{if(s==='SUBSCRIBED') status.textContent=active?'Sinterklaasuitzending':'Openhaard';});
})();