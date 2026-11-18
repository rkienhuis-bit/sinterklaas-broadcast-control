module.exports = async (req,res) => {
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 const {pin,mode}=req.body||{};
 if(!process.env.CONTROLLER_PIN || pin!==process.env.CONTROLLER_PIN) return res.status(401).json({error:'Onjuiste regiecode'});
 if(!['special','fireplace'].includes(mode)) return res.status(400).json({error:'Ongeldige opdracht'});
 const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key) return res.status(500).json({error:'Serverconfiguratie ontbreekt'});
 const response=await fetch(`${base}/rest/v1/broadcast_state?id=eq.1`,{
  method:'PATCH',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},
  body:JSON.stringify({mode,command_id:mode==='special'?`${Date.now()}-${Math.random().toString(36).slice(2,8)}`:null,updated_at:new Date().toISOString()})
 });
 if(!response.ok){const detail=await response.text();console.error(detail);return res.status(502).json({error:'Supabase kon de opdracht niet opslaan'});}
 return res.status(200).json({ok:true});
};