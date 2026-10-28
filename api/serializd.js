// Vercel serverless function: server-side public Serializd diary importer.
// No login credentials or tokens are collected, logged, or stored.
const API_BASE = "https://serializd.onrender.com/api/user/";

function reply(res,status,body,cache="no-store"){
  res.setHeader("Cache-Control",cache);
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options","nosniff");
  return res.status(status).json(body);
}
function requestHeaders(url){
  return {
    "Accept":"application/json, text/plain, */*",
    "Accept-Language":"en-US,en;q=0.9",
    "DNT":"1",
    "Referer":url,
    "User-Agent":"Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
    "X-Requested-With":"serializd_vercel"
  };
}
function extractRows(data,depth=0){
  if(Array.isArray(data))return data;
  if(!data||typeof data!=="object"||depth>3)return null;
  for(const key of ["items","reviews","entries","logs","diary","results"]){
    if(Array.isArray(data[key]))return data[key];
  }
  if(data.data!==undefined)return extractRows(data.data,depth+1);
  return null;
}
async function fetchEndpoint(url){
  const response=await fetch(url,{
    method:"GET",
    headers:requestHeaders(url),
    signal:AbortSignal.timeout(7000),
    redirect:"follow"
  });
  const raw=await response.text();
  let data;
  try{data=JSON.parse(raw)}catch{
    throw Object.assign(new Error("Serializd returned a non-JSON response."),{status:response.status});
  }
  if(!response.ok){
    throw Object.assign(new Error("Serializd returned HTTP "+response.status+"."),{status:response.status});
  }
  const rows=extractRows(data);
  if(!Array.isArray(rows))throw new Error("Serializd returned an unsupported diary format.");
  return rows;
}
export default async function handler(req,res){
  res.setHeader("Vary","Origin");
  if(req.method!=="GET")return reply(res,405,{error:"Use GET for public diary imports."});
  // Keep this public-data endpoint same-origin when called from a browser.
  const origin=req.headers.origin;
  const host=req.headers["x-forwarded-host"]||req.headers.host;
  if(origin){
    const originHost=String(origin).replace(/^https?:\\/\\//i,"").split(/[/?#]/)[0].toLowerCase();
    if(!/^https?:\\/\\//i.test(String(origin))||!originHost||originHost!==String(host||"").toLowerCase())
      return reply(res,403,{error:"Cross-origin requests are not allowed."});
  }
  const raw=String(req.query?.username||"").trim().replace(/^@/,"");
  if(!/^[A-Za-z0-9_-]{2,40}$/.test(raw))
    return reply(res,400,{error:"Enter a valid public Serializd username."});
  const user=encodeURIComponent(raw);
  const base=API_BASE+user+"/";
  const endpoints=[
    base+"reviewspage_v3?sort_by=backdate_desc&include_ratings=true",
    base+"reviewspage_v3",
    base+"reviews?sort_by=backdate_desc&include_ratings=true",
    base+"reviews",
    base+"diary?page=1"
  ];
  let lastError=null,authRejected=false;
  for(const endpoint of endpoints){
    try{
      const rows=await fetchEndpoint(endpoint);
      return reply(res,200,{username:raw,source:"Serializd",reviews:rows.slice(0,12)}, "public, s-maxage=120, stale-while-revalidate=300");
    }catch(error){
      lastError=error;
      if(error?.status===401||error?.status===403)authRejected=true;
      // Do not log profile contents or request headers; only try the next known endpoint.
    }
  }
  if(authRejected)return reply(res,502,{error:"Serializd refused anonymous API access. The public API may now require authentication."});
  return reply(res,502,{error:lastError?.message||"Unable to load the public Serializd diary. Try again later."});
}
