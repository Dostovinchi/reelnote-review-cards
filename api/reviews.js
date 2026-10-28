// Vercel serverless function. It reads only public Letterboxd RSS data and keeps CORS work off the browser.
export default async function handler(req,res){
  const username=String(req.query.username||'').trim().replace(/^@/,'');
  if(!/^[A-Za-z0-9_]{2,30}$/.test(username))return res.status(400).json({error:'Invalid username'});
  try{
    const response=await fetch(`https://letterboxd.com/${encodeURIComponent(username)}/rss/`,{headers:{'User-Agent':'Reelnote/1.0 (+public review card maker)'}});
    if(!response.ok)throw new Error('Letterboxd unavailable');
    const xml=await response.text(),items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(x=>x[1]);
    const value=(item,tag)=>{const m=item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?m[1].replace(/^<!\[CDATA\[|\]\]>$/g,'').trim():''};
    const clean=html=>html.replace(/<p>\s*<img[^>]*>\s*<\/p>/gi,'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#039;/g,"'").trim();
    const reviews=items.map(item=>{
      const guid=value(item,'guid'),isReview=/letterboxd-review-/i.test(guid),rawRating=value(item,'letterboxd:memberRating');
      const rating=rawRating!==''&&Number.isFinite(Number(rawRating))?Number(rawRating):null;
      const text=isReview?clean(value(item,'description')).replace(/^Watched on\s+.*$/i,'').trim():'';
      return {guid,url:value(item,'link'),title:value(item,'letterboxd:filmTitle'),date:value(item,'letterboxd:watchedDate'),rating,text};
    }).filter(r=>r.title&&(/letterboxd-review-/i.test(r.guid)||( /letterboxd-watch-/i.test(r.guid)&&r.rating!==null))).slice(0,12);
    res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');return res.status(200).json({reviews});
  }catch(e){return res.status(502).json({error:'Could not load public reviews'})}
}
