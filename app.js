(() => {
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const canvas=$("#cardCanvas"),ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height;
const themes={
 noir:{bg:"#090e16",ink:"#f3f0e8",muted:"#b3bdca",accent:"#d2ae70",overlay:"rgba(5,9,16,.64)"},
 midnight:{bg:"#0b1a2c",ink:"#eef4f7",muted:"#a8c2d2",accent:"#64b2c5",overlay:"rgba(4,17,31,.58)"},
 ember:{bg:"#21141b",ink:"#f4e8e2",muted:"#cbb4b2",accent:"#d2ae70",overlay:"rgba(23,7,13,.64)"},
 archive:{bg:"#e4d9c8",ink:"#252932",muted:"#5d626a",accent:"#8c423f",overlay:"rgba(20,23,31,.48)"}
};
const themeFamilies={
 general:{label:"Framix · General",themes:{
 noir:{bg:"#090e16",ink:"#f3f0e8",muted:"#b3bdca",accent:"#d2ae70",overlay:"rgba(5,9,16,.64)"},
 midnight:{bg:"#0b1a2c",ink:"#eef4f7",muted:"#a8c2d2",accent:"#64b2c5",overlay:"rgba(4,17,31,.58)"},
 ember:{bg:"#21141b",ink:"#f4e8e2",muted:"#cbb4b2",accent:"#d2ae70",overlay:"rgba(23,7,13,.64)"},
 archive:{bg:"#e4d9c8",ink:"#252932",muted:"#5d626a",accent:"#8c423f",overlay:"rgba(20,23,31,.48)"}
 }},
 letterboxd:{label:"Letterboxd",themes:{
 lb_green:{bg:"#071c11",ink:"#f3f5ed",muted:"#b5c5b8",accent:"#00e054",overlay:"rgba(0,20,10,.68)"},
 lb_red:{bg:"#2b1018",ink:"#fff0ed",muted:"#d5b4b7",accent:"#ff667a",overlay:"rgba(25,3,10,.68)"},
 lb_blue:{bg:"#0d1d33",ink:"#f0f5ff",muted:"#b5c7e1",accent:"#70a9ff",overlay:"rgba(5,12,29,.7)"},
 lb_gold:{bg:"#231c10",ink:"#fff7df",muted:"#d3c7a5",accent:"#f1c75b",overlay:"rgba(23,16,5,.7)"}
 }},
 serializd:{label:"Serializd",themes:{
 sz_violet:{bg:"#151024",ink:"#f6f0ff",muted:"#c0b5d9",accent:"#b59aff",overlay:"rgba(18,8,36,.7)"},
 sz_pink:{bg:"#28111f",ink:"#fff0f6",muted:"#d8b6c9",accent:"#ff8bc3",overlay:"rgba(35,5,25,.7)"},
 sz_cyan:{bg:"#071e27",ink:"#eaffff",muted:"#b0d3d8",accent:"#59dce5",overlay:"rgba(0,18,26,.7)"},
 sz_lime:{bg:"#18200c",ink:"#f5ffe9",muted:"#c6d5ad",accent:"#b4e56e",overlay:"rgba(13,22,5,.7)"}
 }}
};
const samples=[
{name:"In the Mood for Love",url:"https://images.squarespace-cdn.com/content/v1/55e06149e4b0e924d81546a2/1617825549939-LAKNACAXYPYGDT0BHAMV/Movie-still-Maggie-Cheung-Tony-Leung-Fayeung-ninwa-In-the-Mood-For-Love-2000.jpeg?format=1000w"},
{name:"Blade Runner 2049",url:"https://images.everyeye.it/img-screenshot/blade-runner-2049-v1-524761.jpg"},
{name:"Chungking Express",url:"https://m.media-amazon.com/images/M/MV5BOGE2OWU5NzQtNTI2Ni00YmJmLWIzM2QtNzA1MTY3ZTRiNDdkXkEyXkFqcGc%40._V1_.jpg"}
];
let tmdbResults=[], selectedTMDB=null, tmdbPosterVariants=[], tmdbLoadSequence=0, activePosterPath="";
function setTMDBStatus(msg,type=""){status("#tmdbStatus",msg,type)}
function tmdbKey(){return safeStore.get("framix.tmdbKey")||""}
async function tmdb(path,params={}){
  const key=tmdbKey();
  if(!key)throw Error("Save your TMDB v3 API key first. You can still upload a poster manually.");
  const u=new URL("https://api.themoviedb.org/3"+path);
  u.searchParams.set("api_key",key);
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,v)});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(u,{signal:controller.signal,credentials:"omit"});
    if(!response.ok){
      if(response.status===401)throw Error("TMDB rejected this API key. Check that you copied the v3 API key (not your account password) and save it again.");
      if(response.status===403)throw Error("TMDB denied this key. Check your API application status and key.");
      if(response.status===429)throw Error("TMDB rate limit reached. Wait a moment and retry.");
      throw Error("TMDB request failed ("+response.status+").");
    }
    return await response.json();
  }finally{clearTimeout(timer)}
}
function normalizeTitle(text){
  return String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
}
function guessYear(text){
  const match=String(text||"").match(/\b(?:18|19|20)\d{2}\b/);
  return match?match[0]:"";
}
function tmdbResult(item,mediaType){
  return {...item,media_type:mediaType,display_title:mediaType==="tv"?(item.name||item.original_name):(item.title||item.original_title),display_date:mediaType==="tv"?item.first_air_date:item.release_date};
}
function scoreTMDBResult(item,title,year,mediaHint){
  const expected=normalizeTitle(title);
  const names=[item.display_title,item.original_title,item.original_name,item.title,item.name].filter(Boolean).map(normalizeTitle);
  let titleScore=0;
  for(const candidate of names){
    if(candidate===expected)titleScore=Math.max(titleScore,120);
    else if(candidate.startsWith(expected)||expected.startsWith(candidate))titleScore=Math.max(titleScore,75);
    else{
      const a=new Set(expected.split(" ").filter(Boolean)),b=new Set(candidate.split(" ").filter(Boolean));
      const overlap=[...a].filter(token=>b.has(token)).length/Math.max(1,a.size);
      titleScore=Math.max(titleScore,overlap*72);
    }
  }
  const itemYear=String(item.display_date||"").slice(0,4);
  const yearScore=year?(itemYear===year?45:(itemYear?-18:0)):0;
  const typeScore=mediaHint&&item.media_type===mediaHint?16:0;
  const popularityScore=Math.min(8,Math.log2(1+Math.max(0,Number(item.popularity)||0)));
  return titleScore+yearScore+typeScore+popularityScore;
}
async function searchTMDB(){
  const query=val("#tmdbQuery");
  if(!query){setTMDBStatus("Enter a movie or TV title to search.");return}
  const button=$("#tmdbSearch");button.disabled=true;$("#tmdbResults").replaceChildren();
  setTMDBStatus("Searching TMDB…");
  try{
    const [movies,tv]=await Promise.all([
      tmdb("/search/movie",{query,include_adult:"false"}),
      tmdb("/search/tv",{query})
    ]);
    tmdbResults=[...(movies.results||[]).map(item=>tmdbResult(item,"movie")),...(tv.results||[]).map(item=>tmdbResult(item,"tv"))]
      .sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,20);
    renderTMDBResults();
    setTMDBStatus(tmdbResults.length?"Found "+tmdbResults.length+" titles. Choose one, then browse all its TMDB posters.":"No results found. Try the original title or another spelling.",tmdbResults.length?"success":"");
  }catch(error){setTMDBStatus(error.message||"Could not reach TMDB. Try again later.","error")}
  finally{button.disabled=false}
}
function renderTMDBResults(){
  const grid=$("#tmdbResults");grid.replaceChildren();
  tmdbResults.forEach(item=>{
    const card=document.createElement("article");card.className="tmdb-result";
    const img=document.createElement("img");img.alt="";img.loading="lazy";img.src=item.poster_path?"https://image.tmdb.org/t/p/w342"+item.poster_path:"";img.onerror=()=>{img.hidden=true};
    const info=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small"),button=document.createElement("button");
    title.textContent=item.display_title||"Untitled";
    meta.textContent=(item.media_type==="tv"?"TV SERIES":"MOVIE")+" · "+(item.display_date||"Release date unknown").slice(0,4);
    button.type="button";button.textContent="Choose title";button.addEventListener("click",()=>selectTMDB(item));
    info.append(title,meta,button);card.append(img,info);grid.append(card);
  });
}
function renderTMDBPosterOptions(){
  const wrap=$("#tmdbPosterOptionsWrap"),grid=$("#tmdbPosters");
  grid.replaceChildren();
  if(!selectedTMDB||!tmdbPosterVariants.length){wrap.hidden=true;$("#tmdbPosterCount").textContent="";return}
  wrap.hidden=false;
  $("#tmdbPosterCount").textContent=tmdbPosterVariants.length+" option"+(tmdbPosterVariants.length===1?"":"s");
  tmdbPosterVariants.forEach((posterItem,index)=>{
    const button=document.createElement("button");button.type="button";button.className="tmdb-poster-option"+(posterItem.file_path===activePosterPath?" is-selected":"");
    button.dataset.posterPath=posterItem.file_path;
    button.title="Use poster variant "+(index+1)+(posterItem.iso_639_1?" · "+posterItem.iso_639_1:" · no language label");
    button.setAttribute("aria-label",button.title);
    const img=document.createElement("img");img.loading="lazy";img.alt="";img.src="https://image.tmdb.org/t/p/w185"+posterItem.file_path;img.onerror=()=>{img.alt="Poster preview unavailable"};
    const caption=document.createElement("span");caption.textContent=(posterItem.iso_639_1||"no text").toUpperCase()+" · "+(posterItem.vote_average?Number(posterItem.vote_average).toFixed(1)+"★":"TMDB");
    button.append(img,caption);
    button.addEventListener("click",()=>chooseTMDBPoster(posterItem.file_path));
    grid.append(button);
  });
}
async function chooseTMDBPoster(filePath){
  const requestId=++tmdbLoadSequence;
  if(!selectedTMDB||!filePath)return;
  setTMDBStatus("Switching poster artwork…");
  try{
    const loaded=await applyTMDBPoster(filePath,selectedTMDB.display_title,requestId);
    if(loaded){activePosterPath=filePath;renderTMDBPosterOptions();setTMDBStatus("Poster changed. This artwork is from TMDB.","success")}
  }catch(error){if(requestId===tmdbLoadSequence)setTMDBStatus("Could not load that poster variant. Try another one or upload your own.","error");console.warn("TMDB poster variant failed",error)}
}
async function applyTMDBPoster(filePath,title,requestId){
  const blob=await fetchImage("https://image.tmdb.org/t/p/w780"+filePath);
  if(requestId!==tmdbLoadSequence)return false;
  const objectUrl=URL.createObjectURL(blob),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Image could not be decoded"));img.src=objectUrl});
    if(requestId!==tmdbLoadSequence){URL.revokeObjectURL(objectUrl);return false}
    if(posterObjectUrl)URL.revokeObjectURL(posterObjectUrl);
    posterObjectUrl=objectUrl;poster=img;activePosterPath=filePath;
    setPoster(img,(title||"TMDB title")+" · TMDB poster");
    $$(".poster-preset").forEach(button=>button.classList.remove("is-selected"));
    renderTMDBPosterOptions();
    return true;
  }catch(error){URL.revokeObjectURL(objectUrl);throw error}
}
async function selectTMDB(item,options={}){
  const requestId=options.requestId??(++tmdbLoadSequence);
  const buttons=$("#tmdbResults").querySelectorAll("button");buttons.forEach(button=>button.disabled=true);
  setTMDBStatus(options.automatic?"Found the title. Loading its posters…":"Loading title and alternate posters…");
  try{
    const detailPath="/"+item.media_type+"/"+item.id;
    const detailParams=item.media_type==="movie"?{append_to_response:"credits"}:{};
    const [detail,imageData]=await Promise.all([
      tmdb(detailPath,detailParams),
      tmdb(detailPath+"/images").catch(error=>{console.warn("TMDB image variants unavailable",error);return {posters:[]}})
    ]);
    if(requestId!==tmdbLoadSequence)return;
    const mediaTitle=detail.title||detail.name||item.display_title||"TMDB title";
    const mediaYear=String(detail.release_date||detail.first_air_date||item.display_date||"").slice(0,4);
    const creator=item.media_type==="tv"?(detail.created_by||[]).map(person=>person.name).filter(Boolean).slice(0,2).join(", "):(detail.credits?.crew||[]).find(person=>person.job==="Director")?.name||"";
    selectedTMDB={id:item.id,media_type:item.media_type,display_title:mediaTitle,display_date:mediaYear};
    const variants=imageData.posters||[];
    const allPaths=new Map();
    [...variants].sort((a,b)=>(Number(b.vote_average)||0)-(Number(a.vote_average)||0)||(Number(b.vote_count)||0)-(Number(a.vote_count)||0))
      .forEach(variant=>{if(variant.file_path&&!allPaths.has(variant.file_path))allPaths.set(variant.file_path,variant)});
    const preferredPath=detail.poster_path||item.poster_path||"";
    if(preferredPath&&!allPaths.has(preferredPath))allPaths.set(preferredPath,{file_path:preferredPath,iso_639_1:null,vote_average:0,vote_count:0});
    tmdbPosterVariants=[...allPaths.values()];
    if(preferredPath)tmdbPosterVariants.sort((a,b)=>Number(b.file_path===preferredPath)-Number(a.file_path===preferredPath));
    renderTMDBPosterOptions();
    if(!tmdbPosterVariants.length)throw Error("TMDB found the title, but it has no poster images. Upload a poster manually.");
    $("#filmTitle").value=mediaTitle.slice(0,100);
    $("#filmYear").value=[mediaYear,creator].filter(Boolean).join(" · ").slice(0,60);
    const primaryPath=preferredPath||tmdbPosterVariants[0].file_path;
    const loaded=await applyTMDBPoster(primaryPath,mediaTitle,requestId);
    if(!loaded)return;
    setTMDBStatus((options.automatic?"Review imported · poster loaded automatically. ":"Poster loaded. ")+tmdbPosterVariants.length+" TMDB poster option"+(tmdbPosterVariants.length===1?"":"s")+" available below. Choose any thumbnail to switch artwork.","success");
  }catch(error){
    if(requestId===tmdbLoadSequence)setTMDBStatus(error.message||"Could not load TMDB poster artwork.","error");
    console.warn("TMDB title selection failed",error);
  }finally{if(requestId===tmdbLoadSequence)buttons.forEach(button=>button.disabled=false)}
}
async function autoFindTMDBForReview({title,year="",mediaHint="movie"}){
  const requestId=++tmdbLoadSequence;
  const query=String(title||"").trim();
  $("#tmdbQuery").value=query;
  $("#tmdbResults").replaceChildren();
  $("#tmdbPosterOptionsWrap").hidden=true;
  $("#tmdbPosters").replaceChildren();
  if(!tmdbKey()){
    setTMDBStatus("Review imported. Save your TMDB v3 key above to load the poster automatically; you can also upload an image manually.","error");
    return;
  }
  if(!query){setTMDBStatus("Review imported. No title was available for TMDB search.","error");return}
  const yearHint=guessYear(year);
  setTMDBStatus("Review imported · searching TMDB for "+query+(yearHint?" ("+yearHint+")":"")+"…");
  try{
    const movieParams={query,include_adult:"false"};
    const tvParams={query};
    if(yearHint){movieParams.primary_release_year=yearHint;tvParams.first_air_date_year=yearHint}
    let [movies,tv]=await Promise.all([
      tmdb("/search/movie",movieParams).catch(()=>({results:[]})),
      tmdb("/search/tv",tvParams).catch(()=>({results:[]}))
    ]);
    let candidates=[...(movies.results||[]).map(result=>tmdbResult(result,"movie")),...(tv.results||[]).map(result=>tmdbResult(result,"tv"))];
    if(!candidates.length&&yearHint){
      [movies,tv]=await Promise.all([tmdb("/search/movie",{query,include_adult:"false"}).catch(()=>({results:[]})),tmdb("/search/tv",{query}).catch(()=>({results:[]}))]);
      candidates=[...(movies.results||[]).map(result=>tmdbResult(result,"movie")),...(tv.results||[]).map(result=>tmdbResult(result,"tv"))];
    }
    if(requestId!==tmdbLoadSequence)return;
    candidates=candidates.map(candidate=>({...candidate,_framixScore:scoreTMDBResult(candidate,query,yearHint,mediaHint)}))
      .sort((a,b)=>b._framixScore-a._framixScore);
    tmdbResults=candidates.slice(0,10);renderTMDBResults();
    const best=candidates[0];
    if(!best||best._framixScore<55){
      setTMDBStatus("Review imported, but TMDB couldn't find a confident title match. Choose the correct title above or upload a poster.","error");
      return;
    }
    await selectTMDB(best,{automatic:true,requestId});
  }catch(error){
    if(requestId===tmdbLoadSequence)setTMDBStatus("Review imported, but TMDB poster lookup failed: "+(error.message||"unknown error"),"error");
  }
}

let poster=null,client=null,authMode="signin",letterboxdReviews=[],serializdReviews=[],posterObjectUrl=null;
const val=s=>$(s).value.trim(), themeName=()=>$("#themeFamily")?.value==="letterboxd"?"lb_green":$("#themeFamily")?.value==="serializd"?"sz_violet":$('input[name="theme"]:checked')?.value||"noir";
function activeTheme(){const family=themeFamilies[$("#themeFamily")?.value||"general"]||themeFamilies.general;return family.themes[themeName()]||Object.values(family.themes)[0]}
function setThemeOptions(){const family=themeFamilies[$("#themeFamily").value]||themeFamilies.general,grid=$("#themeSwatches");grid.replaceChildren();Object.entries(family.themes).forEach(([key,t],i)=>{const label=document.createElement("label"),radio=document.createElement("input"),sw=document.createElement("span"),name=document.createElement("b");radio.type="radio";radio.name="theme";radio.value=key;radio.checked=i===0;sw.className="swatch";sw.style.background="linear-gradient(135deg,"+t.bg+" 40%,"+t.accent+" 41%, "+t.accent+" 48%,"+t.bg+" 49%)";name.textContent=key.replace(/^lb_|^sz_/,"").replace(/_/g," ").replace(/^./,x=>x.toUpperCase());label.append(radio,sw,name);grid.append(label)});render()}
const safeStore={get(k){try{return localStorage.getItem(k)||""}catch{return""}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
function cover(img,x,y,w,h){const scale=Math.max(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
function wrap(text,width,max){const words=String(text||"").split(/\s+/).filter(Boolean),lines=[];let line="";for(const word of words){const next=line?line+" "+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word}else line=next}if(line)lines.push(line);if(lines.length>max){lines.length=max;lines[max-1]=lines[max-1].replace(/[.,;:\s]+$/,"")+"…"}return lines}
function textBlock(text,x,y,width,lh,max){const lines=[];String(text||"").split(/\n+/).filter(Boolean).forEach(p=>lines.push(...wrap(p,width,max)));const show=lines.slice(0,max);if(lines.length>max&&show.length)show[show.length-1]=show[show.length-1].replace(/[.,;:\s]+$/,"")+"…";show.forEach((line,i)=>ctx.fillText(line,x,y+i*lh));return y+show.length*lh}
function render(){
 const t=activeTheme(),layout=$("#posterLayout").value,title=val("#filmTitle")||"Untitled",meta=val("#filmYear"),review=$("#showReview").checked?val("#reviewText"):"",showRating=$("#showRating").checked,rating=Number($("#rating").value)||0,m=76;
 ctx.clearRect(0,0,W,H);ctx.textBaseline="top";ctx.textAlign="left";ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
 const imageHeight=layout==="poster"?H:layout==="review"?Math.round(H*.47):Math.round(H*.34);
 if(poster){cover(poster,0,0,W,imageHeight);const shade=ctx.createLinearGradient(0,0,0,imageHeight);shade.addColorStop(0,"rgba(3,7,13,.28)");shade.addColorStop(.48,t.overlay);shade.addColorStop(1,t.bg);ctx.fillStyle=shade;ctx.fillRect(0,0,W,imageHeight)}
 else{const g=ctx.createRadialGradient(W*.72,H*.23,10,W*.72,H*.23,W*.8);g.addColorStop(0,t.accent+"66");g.addColorStop(1,t.bg);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle=t.accent+"33";ctx.lineWidth=2;[300,355].forEach(r=>{ctx.beginPath();ctx.arc(W*.72,H*.23,r,0,Math.PI*2);ctx.stroke()})}
 if(layout!=="poster"){ctx.fillStyle=t.bg;ctx.fillRect(0,imageHeight,W,H-imageHeight)}
 const footerY=H-310;
 ctx.fillStyle=t.ink;ctx.font="500 18px 'DM Mono',monospace";ctx.textAlign="left";ctx.fillText("FRAMIX / FILM JOURNAL",m,112);ctx.textAlign="right";ctx.fillStyle=t.accent;ctx.fillText(layout==="poster"?"CINEMATIC POSTER":layout==="review"?"PERSONAL REVIEW":"EDITORIAL FRAME",W-m,112);
 ctx.strokeStyle=t.accent+"66";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(m,151);ctx.lineTo(W-m,151);ctx.stroke();
 let y=layout==="poster"?(poster?H*.45:H*.37):layout==="review"?imageHeight+38:imageHeight+35;
 ctx.textAlign="left";ctx.fillStyle=t.accent;ctx.font="500 18px 'DM Mono',monospace";ctx.fillText(layout==="poster"?"A FILM TO REMEMBER":layout==="review"?"RECENTLY WATCHED":"SELECTED FRAME",m,y);y+=42;
 ctx.fillStyle=t.ink;const titleSize=layout==="review"?62:layout==="editorial"?70:76;ctx.font="600 "+titleSize+"px 'Playfair Display',Georgia,serif";y=textBlock(title,m,y,W-2*m,Math.round(titleSize*1.08),2)+8;
 if(meta){ctx.fillStyle=t.muted;ctx.font="500 20px 'DM Mono',monospace";y=textBlock(meta.toUpperCase(),m,y,W-2*m,29,1)+20}
 if(showRating){ctx.fillStyle=t.accent;ctx.font="500 37px 'DM Sans',sans-serif";ctx.fillText("★".repeat(Math.floor(rating))+(rating%1?"½":""),m,y);ctx.fillStyle=t.muted;ctx.font="500 17px 'DM Mono',monospace";ctx.fillText(rating.toFixed(1)+" / 5",m,y+45);y+=75}
 if(review){ctx.fillStyle=t.ink;ctx.font="italic 27px 'Playfair Display',Georgia,serif";textBlock("“"+review+"”",m,y,W-2*m,37,3)}
 ctx.strokeStyle=t.accent+"88";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(m,footerY);ctx.lineTo(W-m,footerY);ctx.stroke();ctx.fillStyle=t.muted;ctx.font="500 14px 'DM Mono',monospace";ctx.textAlign="left";ctx.fillText("YOUR TASTE, IN A FRAME.",m,footerY+23);ctx.textAlign="right";ctx.fillStyle=t.accent;ctx.fillText("FRAMIX © 2026",W-m,footerY+23);
 $("#previewStatus").textContent=poster?"ARTWORK LOADED ✓":"READY TO FRAME ↗";
}

function status(sel,msg,type=""){const e=$(sel);e.textContent=msg;e.classList.remove("error","success");if(type)e.classList.add(type)}
function normalizeLB(input){let s=String(input||"").trim().replace(/^@/,"").replace(/^https?:\/\/(?:www\.)?letterboxd\.com\//i,"").replace(/\/(?:rss\/?)?$/i,"").split(/[?#/]/)[0].replace(/^@/,"");return /^[A-Za-z0-9_]{2,30}$/.test(s)?s:""}
function normalizeSZ(input){let s=String(input||"").trim();if(/^https?:\/\//i.test(s)){try{const u=new URL(s);if(!/(^|\.)serializd\.com$/i.test(u.hostname))return"";const parts=u.pathname.split("/").filter(Boolean);const i=parts.findIndex(x=>["user","users"].includes(x.toLowerCase()));s=i>=0?parts[i+1]:(parts[parts.length-1]||"")}catch{return""}}s=s.replace(/^@/,"").replace(/\/$/,"");return /^[A-Za-z0-9_-]{2,40}$/.test(s)?s:""}
function rssTag(root,name){return [...root.getElementsByTagName("*")].find(e=>e.localName===name)?.textContent?.trim()||""}
function plain(raw){const d=new DOMParser().parseFromString("<!doctype html><html><body>"+String(raw||"")+"</body></html>","text/html");d.querySelectorAll("script,style,img").forEach(n=>n.remove());d.querySelectorAll("br").forEach(n=>n.replaceWith(document.createTextNode("\n")));return(d.body.textContent||"").replace(/\u00a0/g," ").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim()}
function parseRSS(text,username){const xml=new DOMParser().parseFromString(text,"application/xml");if(xml.querySelector("parsererror"))throw Error("Could not parse the public RSS feed.");return[...xml.getElementsByTagName("item")].map(item=>{const guid=rssTag(item,"guid"),title=rssTag(item,"filmTitle"),raw=rssTag(item,"memberRating"),rating=raw!==""&&Number.isFinite(+raw)?+raw:null,link=rssTag(item,"link");let url="https://letterboxd.com/"+encodeURIComponent(username)+"/";try{const u=new URL(link);if(u.protocol==="https:"&&u.hostname==="letterboxd.com")url=u.href}catch{}return{guid,title,year:rssTag(item,"filmYear"),date:rssTag(item,"watchedDate")||rssTag(item,"pubDate").slice(0,10),rating,text:plain(rssTag(item,"description")),url}}).filter(x=>/letterboxd-review-/i.test(x.guid)&&x.title).slice(0,12)}
async function relay(url){let last;for(const target of ["https://proxy.cors.dev/"+url,"https://api.allorigins.win/raw?url="+encodeURIComponent(url)]){try{const c=new AbortController(),timer=setTimeout(()=>c.abort(),16000);try{const r=await fetch(target,{credentials:"omit",signal:c.signal});if(!r.ok)throw Error("HTTP "+r.status);return await r.text()}finally{clearTimeout(timer)}}catch(e){last=e}}throw last||Error("Free public relay unavailable")}
function renderLB(rows){const grid=$("#lbReviews");grid.replaceChildren();if(!rows.length){const p=document.createElement("p");p.className="lb-empty";p.textContent="No recent written reviews found. Check your public profile or use the poster editor manually.";grid.append(p);return}rows.forEach((r,i)=>{const card=document.createElement("article");card.className="lb-review-card";const meta=document.createElement("div");meta.className="lb-review-meta";const date=document.createElement("span");date.textContent=r.date||"PUBLIC REVIEW";const stars=document.createElement("span");stars.className="lb-stars";stars.textContent=r.rating===null?"UNRATED":("★".repeat(Math.floor(r.rating))+(r.rating%1?"½":"")+" "+r.rating.toFixed(1));meta.append(date,stars);const title=document.createElement("h4");title.textContent=r.title;const year=document.createElement("p");year.className="lb-year";year.textContent=r.year||"LETTERBOXD";const excerpt=document.createElement("p");excerpt.className="lb-excerpt";excerpt.textContent=r.text||"No written note.";const actions=document.createElement("div");actions.className="lb-review-actions";const link=document.createElement("a");link.href=r.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open Letterboxd ↗";const use=document.createElement("button");use.type="button";use.dataset.reviewIndex=i;use.textContent="Use this review";actions.append(link,use);card.append(meta,title,year,excerpt,actions);grid.append(card)})}
async function loadLB(e){e.preventDefault();const username=normalizeLB($("#lbUsername").value),button=$("#lbLoad");if(!username){status("#lbStatus","Enter a valid Letterboxd username or profile URL.","error");return}button.disabled=true;status("#lbStatus","Loading public reviews…");safeStore.set("framix.lb",username);try{const xml=await relay("https://letterboxd.com/"+encodeURIComponent(username)+"/rss/");if(!xml.includes("<rss"))throw Error("Not an RSS feed");letterboxdReviews=parseRSS(xml,username);renderLB(letterboxdReviews);status("#lbStatus",letterboxdReviews.length?"Loaded "+letterboxdReviews.length+" recent reviews for @"+username+".":"No written reviews found for @"+username+".",letterboxdReviews.length?"success":"error")}catch(err){status("#lbStatus","Could not load the feed. Check the username or retry later; free public relays can be unavailable.","error");console.warn(err)}finally{button.disabled=false}}
function serialEntry(x){const show=x.show||x.series||x.tvShow||x.media||{},title=x.showName||x.showTitle||show.name||show.title||x.title||x.name||"",note=x.reviewText||x.review||x.reviewContent||x.text||x.comment||x.content||"",raw=x.rating??x.userRating??x.score??x.stars;let rating=raw==null||raw===""?null:Number(raw);if(rating!==null&&!Number.isFinite(rating))rating=null;if(rating!==null&&rating>5&&rating<=10)rating/=2;let url=x.url||x.diaryUrl||x.reviewUrl||"";try{const u=new URL(url);if(u.protocol!=="https:"||!/(^|\.)serializd\.com$/i.test(u.hostname))url=""}catch{url=""}return{title:String(title),text:String(note),rating,date:String(x.dateAdded||x.createdAt||x.watchedDate||x.date||"").slice(0,10),year:String(x.year||x.releaseYear||show.year||""),url}}
function renderSZ(rows){const grid=$("#serializdReviews");grid.replaceChildren();if(!rows.length){const p=document.createElement("p");p.className="sz-empty";p.textContent="No public diary entries were returned. The profile link is saved; this unofficial endpoint may require a session. You can still create posters manually.";grid.append(p);return}rows.forEach((r,i)=>{const card=document.createElement("article");card.className="sz-review-card";const meta=document.createElement("div");meta.className="sz-review-meta";const date=document.createElement("span");date.textContent=r.date||"SERIALIZD";const rate=document.createElement("span");rate.className="sz-rating";rate.textContent=r.rating===null?"UNRATED":r.rating.toFixed(1)+"/5";meta.append(date,rate);const title=document.createElement("h4");title.textContent=r.title;const year=document.createElement("p");year.className="sz-year";year.textContent=r.year||"TV DIARY";const note=document.createElement("p");note.className="sz-excerpt";note.textContent=r.text||"No written note.";const actions=document.createElement("div");actions.className="sz-review-actions";const link=document.createElement("a");link.href=r.url||$("#serializdProfileLink").href;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open Serializd ↗";const use=document.createElement("button");use.type="button";use.dataset.serializdIndex=i;use.textContent="Use this review";actions.append(link,use);card.append(meta,title,year,note,actions);grid.append(card)})}
async function loadSZ(e){e.preventDefault();const username=normalizeSZ($("#serializdUsername").value),button=$("#serializdLoad");if(!username){status("#serializdStatus","Enter a valid Serializd username or profile URL.","error");return}button.disabled=true;status("#serializdStatus","Checking public diary…");safeStore.set("framix.sz",username);$("#serializdProfileLink").href="https://www.serializd.com/user/"+encodeURIComponent(username);$("#serializdProfileLink").textContent="Open @"+username+" on Serializd ↗";$("#serializdProfileLink").hidden=false;try{const text=await relay("https://serializd.onrender.com/api/user/"+encodeURIComponent(username)+"/diary?page=1"),data=JSON.parse(text),rows=Array.isArray(data)?data:(data.reviews||data.items||data.diary||data.entries||data.results||data.data?.reviews||data.data?.items||data.data?.diary||[]);serializdReviews=rows.map(serialEntry).filter(x=>x.title).slice(0,8);renderSZ(serializdReviews);status("#serializdStatus",serializdReviews.length?"Loaded "+serializdReviews.length+" public diary entries.":"The profile link works, but no public diary entries were returned by the available endpoint. Serializd does not expose a stable supported API for all profiles; posters still work normally.",serializdReviews.length?"success":"error")}catch(err){serializdReviews=[];renderSZ([]);status("#serializdStatus","Profile shortcut saved. Serializd's unofficial public endpoint may be unavailable or require a session; no password was collected.","error");console.warn(err)}finally{button.disabled=false}}
function setPoster(img,name){poster=img;$("#uploadTitle").textContent=name;$$(".poster-preset").forEach(b=>b.classList.toggle("is-selected",b.dataset.posterName===name));render()}
function loadSample(button){const url=button.dataset.posterUrl,name=button.dataset.posterName;button.disabled=true;$("#previewStatus").textContent="LOADING FILM STILL…";(async()=>{try{const blob=await fetchImage(url);if(posterObjectUrl)URL.revokeObjectURL(posterObjectUrl);posterObjectUrl=URL.createObjectURL(blob);const img=new Image();img.onload=()=>{setPoster(img,name);button.disabled=false};img.onerror=()=>{button.disabled=false;$("#previewStatus").textContent="IMAGE FAILED TO LOAD"};img.src=posterObjectUrl}catch(e){button.disabled=false;$("#previewStatus").textContent="SAMPLE UNAVAILABLE";status("#lbStatus","This sample source is unavailable. Upload a still from your device or try another sample.","error");console.warn(e)}})()}
async function fetchImage(url){let last;for(const target of ["https://proxy.cors.dev/"+url,"https://api.allorigins.win/raw?url="+encodeURIComponent(url)]){try{const c=new AbortController(),timer=setTimeout(()=>c.abort(),16000);try{const r=await fetch(target,{credentials:"omit",signal:c.signal});if(!r.ok)throw Error("HTTP "+r.status);const b=await r.blob();if(!b.type.startsWith("image/"))throw Error("Not an image");return b}finally{clearTimeout(timer)}}catch(e){last=e}}throw last||Error("Image unavailable")}
function setMsg(s,error=false){const e=$("#authMessage");e.textContent=s;e.classList.toggle("error",error)}
function setMode(mode){authMode=mode;$$("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));$("#authHeading").innerHTML=mode==="signup"?"Make it <em>personal.</em>":"Welcome <em>back.</em>";$("#authDescription").textContent=mode==="signup"?"Create an account with your email and a strong password.":"Sign in to your Framix account.";$("#authSubmit").innerHTML=mode==="signup"?"Create account →":"Sign in →";$("#authPassword").autocomplete=mode==="signup"?"new-password":"current-password";$("#forgotPassword").hidden=mode!=="signin";setMsg("")}
function updateAuth(session){const email=session?.user?.email;$("#accountLabel").textContent=email?"Signed in · "+email:"Your film journal, reframed." ;$("#authOpen").hidden=!!email;$("#signOut").hidden=!email}
function configureAuth(){const c=window.FRAMIX_CONFIG||{};if(!c.supabaseUrl||!c.supabaseAnonKey||!window.supabase?.createClient){$("#authFields").hidden=true;$("#authSetupNote").hidden=false;return}try{client=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey)}catch(e){console.warn(e)}if(!client){$("#authFields").hidden=true;$("#authSetupNote").hidden=false;return}$("#authFields").hidden=false;$("#authSetupNote").hidden=true;client.auth.getSession().then(({data})=>updateAuth(data?.session||null)).catch(()=>updateAuth(null));client.auth.onAuthStateChange((_e,session)=>updateAuth(session));if(new URLSearchParams(location.hash.slice(1)).get("type")==="recovery")$("#resetDialog").showModal()}

$("#themeFamily").addEventListener("change",()=>{setThemeOptions();const family=$("#themeFamily").value;$("#filmTitleLabel").textContent=family==="serializd"?"TV SERIES TITLE":family==="letterboxd"?"FILM TITLE":"FILM OR SERIES TITLE";$("#filmYearLabel").textContent=family==="serializd"?"YEAR / CREATOR":family==="letterboxd"?"YEAR / DIRECTOR":"YEAR / DIRECTOR";});
$("#themeSwatches").addEventListener("change",render);
$("#tmdbSaveKey").addEventListener("click",()=>{const key=val("#tmdbKey");if(!key){safeStore.set("framix.tmdbKey","");setTMDBStatus("TMDB key cleared from this browser.");return}safeStore.set("framix.tmdbKey",key);$("#tmdbKey").value=key;setTMDBStatus("TMDB key saved in this browser only. Try searching a title.","success")});
$("#tmdbSearch").addEventListener("click",searchTMDB);$("#tmdbQuery").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchTMDB()}});
const savedTMDBKey=tmdbKey();if(savedTMDBKey)$("#tmdbKey").value=savedTMDBKey;setThemeOptions();
$("#cardForm").addEventListener("input",()=>{$("#charCount").textContent=$("#reviewText").value.length+" / 360";render()});$("#cardForm").addEventListener("change",render);
$$(".poster-preset").forEach(b=>b.addEventListener("click",()=>{const sample=samples.find(x=>x.name===b.dataset.posterName);if(sample){$("#filmTitle").value=sample.name;loadSample(b)}}));
$("#posterUpload").addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)){status("#lbStatus","Use JPG, PNG or WebP.","error");return}if(file.size>12*1024*1024){status("#lbStatus","Image exceeds 12 MB. Choose a smaller file.","error");return}const reader=new FileReader();reader.onerror=()=>status("#lbStatus","Could not read that image.","error");reader.onload=()=>{const img=new Image();img.onload=()=>{if(posterObjectUrl){URL.revokeObjectURL(posterObjectUrl);posterObjectUrl=null}poster=img;$("#uploadTitle").textContent=file.name.slice(0,35);$$(".poster-preset").forEach(b=>b.classList.remove("is-selected"));render()};img.onerror=()=>status("#lbStatus","Image could not be opened.","error");img.src=reader.result};reader.readAsDataURL(file)});
$("#downloadCard").addEventListener("click",()=>{render();canvas.toBlob(blob=>{if(!blob){$("#previewStatus").textContent="EXPORT FAILED";return}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="framix-"+(val("#filmTitle")||"review").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$("#previewStatus").textContent="POSTER DOWNLOADED ✓"},"image/png")});
$("#letterboxdForm").addEventListener("submit",loadLB);$("#lbReviews").addEventListener("click",e=>{const b=e.target.closest("button[data-review-index]");if(!b)return;const r=letterboxdReviews[Number(b.dataset.reviewIndex)];if(!r)return;$("#filmTitle").value=r.title.slice(0,100);$("#filmYear").value=[r.year,r.date?"Watched "+r.date:""].filter(Boolean).join(" · ").slice(0,60);if(r.rating!==null){$("#rating").value=String([...$("#rating").options].map(o=>+o.value).sort((a,b)=>Math.abs(a-r.rating)-Math.abs(b-r.rating))[0]);$("#showRating").checked=true}else $("#showRating").checked=false;$("#reviewText").value=(r.text||"").slice(0,360);$("#showReview").checked=!!r.text;$("#charCount").textContent=$("#reviewText").value.length+" / 360";render();$("#studio").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})});
$("#serializdForm").addEventListener("submit",loadSZ);$("#serializdReviews").addEventListener("click",e=>{const b=e.target.closest("button[data-serializd-index]");if(!b)return;const r=serializdReviews[+b.dataset.serializdIndex];if(!r)return;$("#filmTitle").value=r.title.slice(0,100);$("#filmYear").value=[r.year,r.date].filter(Boolean).join(" · ").slice(0,60);if(r.rating!==null){$("#rating").value=String([...$("#rating").options].map(o=>+o.value).sort((a,b)=>Math.abs(a-r.rating)-Math.abs(b-r.rating))[0]);$("#showRating").checked=true}else $("#showRating").checked=false;$("#reviewText").value=r.text.slice(0,360);$("#showReview").checked=!!r.text;$("#charCount").textContent=$("#reviewText").value.length+" / 360";render();$("#studio").scrollIntoView({behavior:"smooth"})});
$("#authOpen").addEventListener("click",()=>{setMode("signin");$("#authDialog").showModal()});$("#authClose").addEventListener("click",()=>$("#authDialog").close());$("#resetClose").addEventListener("click",()=>$("#resetDialog").close());$$("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();if(!client){$("#authSetupNote").hidden=false;$("#authFields").hidden=true;return}const email=val("#authEmail"),password=$("#authPassword").value,button=$("#authSubmit");button.disabled=true;setMsg(authMode==="signup"?"Creating account…":"Signing in…");try{const r=authMode==="signup"?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;if(authMode==="signup"&&!r.data.session)setMsg("Account created. Check your email to verify your address.");else{setMsg("You're signed in.");setTimeout(()=>$("#authDialog").close(),650)}}catch(e){setMsg(e.message||"Sign-in failed. Check your details.",true)}finally{button.disabled=false}});
$("#forgotPassword").addEventListener("click",async()=>{if(!client){setMsg("Configure Supabase first.",true);return}const email=val("#authEmail");if(!email){setMsg("Enter your email first.",true);$("#authEmail").focus();return}try{const{error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;setMsg("If the account exists, a recovery email has been requested.")}catch(e){setMsg(e.message||"Could not request recovery.",true)}});
$("#resetForm").addEventListener("submit",async e=>{e.preventDefault();const el=$("#resetMessage");if(!client){el.textContent="Configure Supabase first.";return}try{const{error}=await client.auth.updateUser({password:$("#newPassword").value});if(error)throw error;el.textContent="Password updated."}catch(e){el.textContent=e.message||"Could not update password.";el.classList.add("error")}});
$("#signOut").addEventListener("click",async()=>{if(!client)return;const{error}=await client.auth.signOut();if(error){$("#accountLabel").textContent="Could not sign out.";return}updateAuth(null)});
const lb=safeStore.get("framix.lb"),sz=safeStore.get("framix.sz");if(lb)$("#lbUsername").value=lb;if(sz){$("#serializdUsername").value=sz;$("#serializdProfileLink").href="https://www.serializd.com/user/"+encodeURIComponent(sz);$("#serializdProfileLink").textContent="Open @"+sz+" on Serializd ↗";$("#serializdProfileLink").hidden=false}
$("#charCount").textContent=$("#reviewText").value.length+" / 360";render();configureAuth();
})();