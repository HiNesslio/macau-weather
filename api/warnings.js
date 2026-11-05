import { loadWarnings } from '../lib/warnings.js';
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');res.setHeader('Cache-Control','no-store');return res.status(405).json({error:'Method not allowed'});}
 const data=await loadWarnings();const available=data.entries.some(e=>e.active!==null);
 // No stale-while-revalidate: never serve a cancelled signal as active from an old warning cache.
 res.setHeader('Cache-Control',!data.unavailable.length?'public, max-age=0, s-maxage=30, must-revalidate':'no-store');
 res.status(available?200:503);return req.method==='HEAD'?res.end():res.json(data);
}
