(() => {
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const canvas=$("#cardCanvas"),ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height;
const safeStore={get(k){try{return localStorage.getItem(k)||""}catch{return""}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const val=s=>$(s).value.trim();
function status(sel,msg,type=""){const e=$(sel);e.textContent=msg;e.classList.remove("error","success");if(type)e.classList.add(type)}

/* ---------- Card engine state (ReelNote review-card maker) ---------- */
const CARD_STYLES=[["medium","Poster centre"],["big","Large poster"],["small","Small poster"],["blur","Blurred backdrop"],["starsfirst","Stars first"],["text","Text only"],["tilt","Tilted poster"],["polaroid","Polaroid"],["banner","Top banner"],["cinema","Cinema strip"],["glass","Glass panel"],["color","Colour wash"],["fullposter","Full poster"],["lbclassic","Letterboxd classic"],["ticket","Ticket stub"],["split","Split frame"],["stacked","Stacked cards"]];

const makePalette=(label,canvas,accent,ink,muted,darkText=false)=>({label,swatch:canvas,canvas,accent,ink,muted,darkText});
const THEME_PALETTES={
  general:{
    noir:makePalette("Noir","#090e16","#d2ae70","#f3f0e8","#b3bdca"),
    midnight:makePalette("Midnight","#0b1a2c","#64b2c5","#eef4f7","#a8c2d2"),
    ember:makePalette("Ember","#21141b","#d2ae70","#f4e8e2","#cbb4b2"),
    archive:makePalette("Archive","#e4d9c8","#8c423f","#252932","#5d626a",true),
    ocean:makePalette("Ocean","#071c26","#36c9d4","#e8fcff","#9bc2cb"),
    rosewood:makePalette("Rosewood","#26131c","#ee8f9c","#fff0f3","#d7b7c0"),
    forest:makePalette("Forest","#122218","#b7cc77","#f2f7e8","#b5c5a0"),
    mono:makePalette("Monochrome","#151515","#f4f0e7","#ffffff","#b6b6b6")
  },
  letterboxd:{
    lb_green:makePalette("Green","#071c11","#00e054","#f3f5ed","#b5c5b8"),
    lb_red:makePalette("Red","#2b1018","#ff667a","#fff0ed","#d5b4b7"),
    lb_blue:makePalette("Blue","#0d1d33","#70a9ff","#f0f5ff","#b5c7e1"),
    lb_gold:makePalette("Gold","#231c10","#f1c75b","#fff7df","#d3c7a5"),
    lb_violet:makePalette("Violet","#1b102b","#bc8cff","#f5efff","#c6b5dc"),
    lb_sunset:makePalette("Sunset","#2b160d","#ff985c","#fff2e6","#e0bda5"),
    lb_cream:makePalette("Cream","#eee6d8","#42614d","#232925","#62685f",true),
    lb_mint:makePalette("Mint","#08251f","#71e0bf","#e9fff7","#a8d8cb")
  },
  serializd:{
    sz_violet:makePalette("Violet","#151024","#b59aff","#f6f0ff","#c0b5d9"),
    sz_pink:makePalette("Pink","#28111f","#ff8bc3","#fff0f6","#d8b6c9"),
    sz_cyan:makePalette("Cyan","#071e27","#59dce5","#eaffff","#b0d3d8"),
    sz_lime:makePalette("Lime","#18200c","#b4e56e","#f5ffe9","#c6d5ad"),
    sz_orchid:makePalette("Orchid","#27112f","#e69aff","#fff0ff","#d7b9e5"),
    sz_ocean:makePalette("Deep Sea","#091a35","#7aa8ff","#eef4ff","#afc3ed"),
    sz_amber:makePalette("Amber","#2c1a08","#ffc46d","#fff7e7","#dec49d"),
    sz_midnight:makePalette("After Dark","#111522","#aeb8d8","#f0f2ff","#b4b9ca")
  }
};
function activePalette(){
  const family=$("#themeFamily")?.value||"general";
  const choices=THEME_PALETTES[family]||THEME_PALETTES.general;
  const key=$('input[name="theme"]:checked')?.value;
  return choices[key]||choices[Object.keys(choices)[0]];
}
function syncThemeOptions(repaint=true){
  const family=$("#themeFamily")?.value||"general";
  const choices=THEME_PALETTES[family]||THEME_PALETTES.general;
  const grid=$("#themeSwatches");
  if(!grid)return;
  const oldKey=$('input[name="theme"]:checked')?.value;
  const chosenKey=choices[oldKey]?oldKey:Object.keys(choices)[0];
  grid.replaceChildren();
  Object.entries(choices).forEach(([key,palette])=>{
    const label=document.createElement("label");
    const radio=document.createElement("input");radio.type="radio";radio.name="theme";radio.value=key;radio.checked=key===chosenKey;
    const swatch=document.createElement("span");swatch.className="swatch";
    swatch.style.background="linear-gradient(135deg,"+palette.canvas+" 0%, "+palette.canvas+" 44%, "+palette.accent+" 45%, "+palette.accent+" 53%, "+palette.canvas+" 54%)";
    swatch.style.borderColor=palette.accent;
    const name=document.createElement("b");name.textContent=palette.label;
    label.append(radio,swatch,name);grid.append(label);
  });
  const palette=activePalette();
  document.documentElement.style.setProperty("--accent",palette.accent);
  document.documentElement.style.setProperty("--ink",palette.ink);
  document.documentElement.style.setProperty("--muted",palette.muted);
  if(repaint&&typeof paint==="function")paint();
}

let cardStyle="medium",poster=null,back=null,posterObjectUrl=null,backObjectUrl=null;

/* ---------- TMDB ---------- */
let tmdbResults=[],selectedTMDB=null,tmdbPosterVariants=[],tmdbLoadSequence=0,activePosterPath="",lbMatches=[],lbLinkSearched="";
function setTMDBStatus(msg,type=""){status("#tmdbStatus",msg,type)}
function tmdbKey(){return safeStore.get("framix.tmdbKey")||""}
async function tmdb(path,params={}){
  const key=tmdbKey();
  if(!key)throw Error("Save your TMDB v3 API key first (step B below).");
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
    setTMDBStatus(tmdbResults.length?"Found "+tmdbResults.length+" titles. Choose one, then swipe through its TMDB posters.":"No results found. Try the original title or another spelling.",tmdbResults.length?"success":"");
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
    button.type="button";button.textContent="Choose title";button.addEventListener("click",()=>loadTMDBTitle(item));
    info.append(title,meta,button);card.append(img,info);grid.append(card);
  });
}

/* ---------- Swipeable TMDB poster options ---------- */
let carouselIndex=0,dragMoved=false;
function posterVariantLabel(v){return ((v.iso_639_1||"no text").toUpperCase())+" · "+(v.vote_average?Number(v.vote_average).toFixed(1)+"★":"TMDB")}
function renderTMDBPosterOptions(){
  const wrap=$("#tmdbPosterOptionsWrap"),root=$("#tmdbPosters");
  root.classList.add("poster-carousel");
  root.replaceChildren();
  if(!selectedTMDB||!tmdbPosterVariants.length){wrap.hidden=true;$("#tmdbPosterCount").textContent="";return}
  wrap.hidden=false;
  const found=tmdbPosterVariants.findIndex(v=>v.file_path===activePosterPath);
  carouselIndex=Math.max(0,found);
  root.classList.toggle("is-single",tmdbPosterVariants.length<2);
  const viewport=document.createElement("div");viewport.className="poster-carousel-viewport";viewport.tabIndex=0;
  viewport.setAttribute("role","group");viewport.setAttribute("aria-label","TMDB poster options. Swipe right for the next poster, left for the previous one.");
  const track=document.createElement("div");track.className="poster-carousel-track";
  tmdbPosterVariants.forEach((v,i)=>{
    const slide=document.createElement("figure");slide.className="poster-slide"+(i===carouselIndex?" is-current":"");slide.dataset.index=String(i);
    const frame=document.createElement("div");frame.className="slide-frame";
    const img=document.createElement("img");img.alt="";img.loading="lazy";img.draggable=false;img.src="https://image.tmdb.org/t/p/w342"+v.file_path;img.onerror=()=>{img.alt="Preview unavailable"};
    frame.append(img);
    const cap=document.createElement("figcaption");const c1=document.createElement("span");c1.textContent=posterVariantLabel(v);const c2=document.createElement("span");c2.textContent="POSTER "+(i+1);cap.append(c1,c2);
    slide.append(frame,cap);
    slide.addEventListener("click",()=>{if(dragMoved)return;goToPoster(Number(slide.dataset.index),true)});
    track.append(slide);
  });
  viewport.append(track);
  const prev=document.createElement("button");prev.type="button";prev.className="poster-carousel-nav prev";prev.textContent="‹";prev.setAttribute("aria-label","Previous poster");
  const next=document.createElement("button");next.type="button";next.className="poster-carousel-nav next";next.textContent="›";next.setAttribute("aria-label","Next poster");
  prev.addEventListener("click",()=>goToPoster(carouselIndex-1,true));
  next.addEventListener("click",()=>goToPoster(carouselIndex+1,true));
  root.append(viewport,prev,next);
  viewport.addEventListener("keydown",e=>{
    if(e.key==="ArrowRight"){e.preventDefault();goToPoster(carouselIndex+1,true)}
    else if(e.key==="ArrowLeft"){e.preventDefault();goToPoster(carouselIndex-1,true)}
  });
  attachCarouselDrag(viewport,track);
  updateCarouselUI(false);
}
function updateCarouselUI(animate=true){
  const viewport=$("#tmdbPosters .poster-carousel-viewport");if(!viewport)return;
  const track=viewport.firstElementChild;if(!track)return;
  if(animate===false)track.style.transition="none";
  track.style.transform="translateX("+(-carouselIndex*viewport.clientWidth)+"px)";
  if(animate===false)requestAnimationFrame(()=>{track.style.transition=""});
  $("#tmdbPosterCount").textContent=(carouselIndex+1)+" / "+tmdbPosterVariants.length;
  [...viewport.querySelectorAll(".poster-slide")].forEach((s,i)=>s.classList.toggle("is-current",i===carouselIndex));
}
function goToPoster(index,apply){
  if(!tmdbPosterVariants.length)return;
  carouselIndex=Math.max(0,Math.min(tmdbPosterVariants.length-1,index));
  updateCarouselUI(true);
  const viewport=$("#tmdbPosters .poster-carousel-viewport");if(viewport)viewport.focus({preventScroll:true});
  if(apply)chooseTMDBPoster(tmdbPosterVariants[carouselIndex].file_path);
}
function attachCarouselDrag(viewport,track){
  let startX=0,baseOffset=0,dragging=false;
  viewport.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse"&&e.button!==0)return;
    dragging=true;dragMoved=false;startX=e.clientX;baseOffset=-carouselIndex*viewport.clientWidth;
    track.style.transition="none";
    try{viewport.setPointerCapture(e.pointerId)}catch{}
  });
  viewport.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const dx=e.clientX-startX;
    if(Math.abs(dx)>6)dragMoved=true;
    track.style.transform="translateX("+(baseOffset+dx)+"px)";
  });
  const end=e=>{
    if(!dragging)return;dragging=false;track.style.transition="";
    const dx=e.clientX-startX;
    const threshold=Math.max(30,viewport.clientWidth*.12);
    if(dx<=-threshold)goToPoster(carouselIndex+1,true);        /* swipe left → next poster */
    else if(dx>=threshold)goToPoster(carouselIndex-1,true);  /* swipe right → previous poster */
    else updateCarouselUI(true);
    setTimeout(()=>{dragMoved=false},0);
  };
  viewport.addEventListener("pointerup",end);
  viewport.addEventListener("pointercancel",end);
}
async function chooseTMDBPoster(filePath){
  if(!selectedTMDB||!filePath||filePath===activePosterPath)return;
  const requestId=++tmdbLoadSequence;
  try{
    const loaded=await applyTMDBPoster(filePath,requestId);
    if(loaded)setTMDBStatus("Poster "+(carouselIndex+1)+" / "+tmdbPosterVariants.length+" applied · swipe for more artwork.","success");
  }catch(error){setTMDBStatus("Could not load that poster variant. Try another one.","error");console.warn("TMDB poster variant failed",error)}
}
async function applyTMDBPoster(filePath,requestId){
  const blob=await fetchImage("https://image.tmdb.org/t/p/w780"+filePath);
  if(requestId!==tmdbLoadSequence)return false;
  const objectUrl=URL.createObjectURL(blob),img=new Image();
  try{
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Image could not be decoded"));img.src=objectUrl});
    if(requestId!==tmdbLoadSequence){URL.revokeObjectURL(objectUrl);return false}
    if(posterObjectUrl)URL.revokeObjectURL(posterObjectUrl);
    posterObjectUrl=objectUrl;poster=img;activePosterPath=filePath;
    updateCarouselUI(false);paint();
    return true;
  }catch(error){URL.revokeObjectURL(objectUrl);throw error}
}
async function applyTMDBBackdrop(filePath,requestId){
  if(!filePath)return false;
  try{
    const blob=await fetchImage("https://image.tmdb.org/t/p/w1280"+filePath);
    if(requestId!==tmdbLoadSequence)return false;
    const objectUrl=URL.createObjectURL(blob),img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Backdrop could not be decoded"));img.src=objectUrl});
    if(requestId!==tmdbLoadSequence){URL.revokeObjectURL(objectUrl);return false}
    if(backObjectUrl)URL.revokeObjectURL(backObjectUrl);
    backObjectUrl=objectUrl;back=img;paint();
    return true;
  }catch(error){console.warn("TMDB backdrop failed",error);return false}
}
async function loadTMDBTitle(item,options={}){
  const requestId=options.requestId??(++tmdbLoadSequence);
  const buttons=$("#tmdbResults").querySelectorAll("button");buttons.forEach(button=>button.disabled=true);
  setTMDBStatus(options.automatic?"Found the title. Loading its posters…":"Loading title and poster options…");
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
    if(!tmdbPosterVariants.length)throw Error("TMDB found the title, but it has no poster images.");
    $("#filmTitle").value=mediaTitle.slice(0,100);
    $("#filmYear").value=[creator,mediaYear].filter(Boolean).join(", ").slice(0,60);
    const primaryPath=preferredPath||tmdbPosterVariants[0].file_path;
    const loaded=await applyTMDBPoster(primaryPath,requestId);
    if(!loaded)return;
    renderTMDBPosterOptions();
    void applyTMDBBackdrop(detail.backdrop_path||item.backdrop_path||"",requestId);
    setTMDBStatus((options.automatic?"Review imported · poster loaded automatically. ":"Poster loaded. ")+tmdbPosterVariants.length+" TMDB poster option"+(tmdbPosterVariants.length===1?"":"s")+" — swipe the artwork to switch.","success");
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
    setTMDBStatus("Review imported. Save your TMDB v3 key in step B to load the artwork automatically.","error");
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
    populateFilmSelect(candidates.slice(0,10));
    const best=candidates[0];
    if(!best||best._framixScore<55){
      setTMDBStatus("Review imported, but TMDB couldn't find a confident title match. Choose the correct title in step B.","error");
      return;
    }
    await loadTMDBTitle(best,{automatic:true,requestId});
  }catch(error){
    if(requestId===tmdbLoadSequence)setTMDBStatus("Review imported, but TMDB poster lookup failed: "+(error.message||"unknown error"),"error");
  }
}

/* ---------- Letterboxd review link → TMDB search ---------- */
function populateFilmSelect(items){
  lbMatches=items;
  const select=$("#filmSelect"),wrap=$("#filmSelectWrap");
  if(!select||!wrap)return; /* Older link-import UI is not present in the current page. */
  select.replaceChildren();
  items.forEach(r=>{const o=document.createElement("option");o.value=String(r.id);o.textContent=r.title+" ("+String(r.release_date||"").slice(0,4)+")";select.append(o)});
  wrap.hidden=!items.length;
}
async function searchLetterboxdLink(){
  const link=$("#lbReviewLink").value.trim();
  if(link===lbLinkSearched&&lbMatches.length)return lbMatches;
  const m=link.match(/letterboxd\.com\/([^\/]+)\/film\/([^\/?#]+)(?:\/(\d+))?/i);
  if(!m)throw Error("Paste a Letterboxd review link like letterboxd.com/your-name/film/film-title/");
  let slug=m[2],year="";
  const y=slug.match(/-(\d{4})$/);if(y){year=y[1];slug=slug.slice(0,-5)}
  const params={query:slug.replace(/-/g," "),include_adult:"false"};
  if(year)params.year=year;
  const d=await tmdb("/search/movie",params);
  const want=normalizeTitle(slug);
  const matches=(d.results||[]).slice()
    .sort((a,b)=>((normalizeTitle(b.title)===want)-(normalizeTitle(a.title)===want))||((b.vote_count||0)-(a.vote_count||0)))
    .slice(0,10).map(r=>tmdbResult(r,"movie"));
  if(!matches.length)throw Error("TMDB couldn't find that film. Check the link, or search the title manually in step B.");
  lbLinkSearched=link;
  populateFilmSelect(matches);
  return matches;
}

/* ---------- Letterboxd review fetching (RSS + review page) ---------- */
async function viaProxy(url,ok){
  const enc=encodeURIComponent,bust=Date.now();
  const custom=safeStore.get("framix.proxy").replace(/\/+$/,"");
  const list=[];
  if(custom)list.push(u=>custom+"/?url="+enc(u));
  list.push(
    u=>"https://api.allorigins.win/raw?url="+enc(u)+"&_="+bust,
    u=>"https://api.codetabs.com/v1/proxy/?quest="+enc(u),
    u=>"https://corsproxy.io/?url="+enc(u),
    u=>"https://thingproxy.freeboard.io/fetch/"+u
  );
  window.proxyLog=[];
  for(const p of list){
    const u=p(url);let host="?";try{host=new URL(u).hostname.replace(/^(api|www)\./,"")}catch{}
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      const r=await fetch(u,{credentials:"omit",signal:controller.signal});clearTimeout(timer);
      if(!r.ok){window.proxyLog.push(host+":"+r.status);continue}
      const x=await r.text();
      if(ok(x))return x;
      window.proxyLog.push(host+":bad");
    }catch(e){window.proxyLog.push(host+":"+(e.name==="AbortError"?"timeout":"blocked"))}
  }
  throw Error("proxy");
}
const cleanParas=ps=>ps.map(p=>p.textContent.trim())
  .filter(t=>t&&!/^Watched on /i.test(t)&&!/^This review may contain spoilers/i.test(t)).join("\n");
async function fromRss(user,slug,n){
  const txt=await viaProxy("https://letterboxd.com/"+user+"/rss/",x=>/<item[\s>]/.test(x));
  const xml=new DOMParser().parseFromString(txt,"text/xml");
  const target="/"+user+"/film/"+slug+(n?"/"+n:"");
  let items=[...xml.getElementsByTagName("item")].filter(it=>{
    const l=it.getElementsByTagName("link")[0];return l&&l.textContent.includes("/film/"+slug+"/")});
  if(!items.length)return null;
  const path=it=>{try{return new URL(it.getElementsByTagName("link")[0].textContent).pathname.replace(/\/+$/,"")}catch(e){return ""}};
  items.sort((a,b)=>(path(b)===target)-(path(a)===target));
  const getText=it=>{
    const d=it.getElementsByTagName("description")[0];if(!d)return "";
    const h=new DOMParser().parseFromString(d.textContent,"text/html");
    return cleanParas([...h.querySelectorAll("p")].filter(p=>!p.querySelector("img")))};
  const getRate=it=>{
    let e=it.getElementsByTagNameNS("*","memberRating")[0]||it.getElementsByTagName("letterboxd:memberRating")[0];
    let v=e?parseFloat(e.textContent):NaN;
    if(!(v>=0.5&&v<=5)){
      const t=(it.getElementsByTagName("title")[0]||{}).textContent||"";
      const part=t.split(" - ").pop();
      v=(part.match(/★/g)||[]).length+(part.includes("½")?0.5:0)}
    return v>=0.5&&v<=5&&v*2===Math.round(v*2)?v:null};
  const it=items.find(i=>getText(i))||items[0];
  return {text:getText(it),rating:getRate(it)};
}
async function fromPage(user,slug,n){
  const url="https://letterboxd.com/"+user+"/film/"+slug+"/"+(n?n+"/":"");
  const html=await viaProxy(url,x=>x.length>2000&&/letterboxd/i.test(x)&&!/Just a moment|cf-browser-verification/i.test(x));
  const doc=new DOMParser().parseFromString(html,"text/html");
  let rating=null;
  const r=doc.querySelector('.film-detail .rating[class*="rated-"], .review .rating[class*="rated-"], .viewing-poster-container ~ * .rating[class*="rated-"]')||doc.querySelector('.rating[class*="rated-"]');
  if(r){const m=r.className.match(/rated-(\d+)/);if(m)rating=parseInt(m[1])/2}
  if(!(rating>=0.5&&rating<=5))rating=null;
  let body=doc.querySelector(".js-review-body")||doc.querySelector(".review .body-text")||doc.querySelector(".body-text");
  let text=body?cleanParas([...body.querySelectorAll("p")]):"";
  if(!text){const og=doc.querySelector('meta[property="og:description"]');if(og)text=og.content.trim()}
  return {text,rating};
}
async function fetchReview(){
  const link=$("#lbReviewLink").value.trim();
  const m=link.match(/letterboxd\.com\/([^\/]+)\/film\/([^\/?#]+)(?:\/(\d+))?/i);
  if(!m)throw Error("Paste your Letterboxd review link first (letterboxd.com/your-name/film/film-title/).");
  const user=m[1],slug=m[2],n=m[3]||"";
  let data=null,src="";
  try{data=await fromRss(user,slug,n);if(data)src="RSS"}catch(e){console.warn("RSS fetch failed",e)}
  if(!data||!data.text||!data.rating){
    try{const p=await fromPage(user,slug,n);
      if(p){data={text:(data&&data.text)||p.text,rating:(data&&data.rating)||p.rating};src="review page"}
    }catch(e){console.warn("Page fetch failed",e)}
  }
  if(!data)throw Error("Couldn't fetch the review from Letterboxd. Paste the text manually, or set a custom proxy. ["+(window.proxyLog||[]).join(" · ")+"]");
  if(data.rating&&[...$("#rating").options].some(o=>o.value===String(data.rating)))$("#rating").value=String(data.rating);
  if(data.text)$("#reviewText").value=data.text;
  $("#reviewerName").value=user;
  paint();
  if(!data.text)return "rating "+(data.rating||"not found")+" — write the review text manually";
  return src+(data.rating?" · "+data.rating+"★":" · rating not found, pick one manually");
}

/* ---------- Card painting (ReelNote engine) ---------- */
function cover(c,img,x,y,w,h){const s=Math.max(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;
  c.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function blurred(c,img){const k=28,s=document.createElement("canvas");s.width=W/k;s.height=H/k;
  const x=s.getContext("2d");cover(x,img,0,0,s.width,s.height);c.imageSmoothingQuality="high";c.drawImage(s,0,0,W,H)}
function wrap(text,max,n=3){const w=String(text||"").split(/\s+/),L=[];let l="";
  w.forEach(a=>{const x=l?l+" "+a:a;if(ctx.measureText(x).width>max&&l){L.push(l);l=a}else l=x});
  if(l)L.push(l);return L.slice(0,n)}
function avgColor(img){if(!img)return "#2a2a2e";try{const s=document.createElement("canvas");s.width=s.height=16;const x=s.getContext("2d");x.drawImage(img,0,0,16,16);
  const d=x.getImageData(0,0,16,16).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]+d[i+1]+d[i+2];if(l<60||l>700)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++}
  return n?"rgb("+Math.round(r/n)+","+Math.round(g/n)+","+Math.round(b/n)+")":"#2a2a2e"}catch(e){return "#2a2a2e"}}
function drawPoster(c,w,y){if(!poster)return y;const h=w*poster.height/poster.width,x=(W-w)/2;
  c.save();c.shadowColor="rgba(0,0,0,.6)";c.shadowBlur=50;c.shadowOffsetY=20;rr(c,x,y,w,h,18);c.fillStyle="#000";c.fill();c.restore();
  c.save();rr(c,x,y,w,h,18);c.clip();c.drawImage(poster,x,y,w,h);c.restore();
  c.save();rr(c,x,y,w,h,18);c.lineWidth=5;c.strokeStyle="rgba(255,255,255,.9)";c.stroke();c.restore();return y+h}
function drawPosterRot(c,w,y,deg){if(!poster)return y;const h=w*poster.height/poster.width,x=(W-w)/2,a=deg*Math.PI/180;
  c.save();c.translate(W/2,y+h/2);c.rotate(a);c.translate(-W/2,-(y+h/2));
  c.shadowColor="rgba(0,0,0,.6)";c.shadowBlur=50;c.shadowOffsetY=20;rr(c,x,y,w,h,18);c.fillStyle="#000";c.fill();c.shadowColor="transparent";
  c.save();rr(c,x,y,w,h,18);c.clip();c.drawImage(poster,x,y,w,h);c.restore();
  rr(c,x,y,w,h,18);c.lineWidth=5;c.strokeStyle="rgba(255,255,255,.9)";c.stroke();c.restore();
  return y+h+Math.abs(Math.sin(a))*w/2+10}
function drawPolaroid(c,w,y){if(!poster)return y;const p=26,iw=w-p*2,ih=iw*poster.height/poster.width,h=ih+p*2+50,x=(W-w)/2;
  c.save();c.shadowColor="rgba(0,0,0,.6)";c.shadowBlur=50;c.shadowOffsetY=20;rr(c,x,y,w,h,10);c.fillStyle="#f4f1ea";c.fill();c.restore();
  c.drawImage(poster,x+p,y+p,iw,ih);return y+h}
const reviewText=()=>$("#showReview")?.checked?val("#reviewText"):"";
const darkenAmount=()=>{const input=$("#darken"),n=Number(input?.value);return Number.isFinite(n)?n:45};
function drawReview(c,y,maxY,color){
  const text=reviewText();if(!text)return y;
  c.textBaseline="top";c.textAlign="center";c.direction=/[\u0600-\u06FF]/.test(text)?"rtl":"ltr";
  const paras=text.split(/\n+/).filter(Boolean);
  let size=42,lines=[],lh=0;
  for(;size>=24;size-=2){
    c.font=size+"px system-ui,sans-serif";lh=size*1.42;lines=[];
    paras.forEach(p=>lines.push(...wrap(p,880,99)));
    if(y+lines.length*lh<=maxY)break;
  }
  const fit=Math.max(1,Math.floor((maxY-y)/lh));
  if(lines.length>fit){lines=lines.slice(0,fit);lines[fit-1]=lines[fit-1].replace(/[\s.,،]*$/,"")+"…"}
  c.fillStyle=color;c.globalAlpha=.93;
  lines.forEach((l,i)=>c.fillText(l,W/2,y+i*lh));
  c.globalAlpha=1;c.direction="ltr";
  return y+lines.length*lh+30;
}
function drawText(c,y,starsFirst,hasRev){
  const palette=activePalette(),tc=palette.ink,sc=palette.accent,r=parseFloat($("#rating").value)||0;
  const ts=hasRev?64:78,ss=hasRev?84:104;
  c.textAlign="center";c.textBaseline="top";
  const stars=()=>{c.font="bold "+ss+"px system-ui,sans-serif";c.fillStyle=sc;
    c.fillText("★".repeat(Math.floor(r))+(r%1?"½":""),W/2,y);y+=ss*1.35};
  const title=()=>{c.font="bold "+ts+"px system-ui,sans-serif";c.fillStyle=tc;
    wrap($("#filmTitle").value||"Untitled film",900).forEach(l=>{c.fillText(l,W/2,y);y+=ts*1.22});y+=6;
    c.font=(hasRev?32:38)+"px system-ui,sans-serif";c.globalAlpha=.9;c.fillText($("#filmYear").value,W/2,y);c.globalAlpha=1;y+=hasRev?56:70};
  const who=yy=>{const show=$("#showReviewer"),name=$("#reviewerName");if(!show?.checked||!name?.value?.trim())return;
    const a="Reviewed by ",b=name.value.trim();c.font="28px system-ui,sans-serif";const wa=c.measureText(a).width;
    c.font="bold 28px system-ui,sans-serif";const wb=c.measureText(b).width,x=(W-wa-wb)/2;
    c.textAlign="left";c.fillStyle=tc;c.globalAlpha=.85;c.font="28px system-ui,sans-serif";c.fillText(a,x,yy);
    c.font="bold 28px system-ui,sans-serif";c.fillText(b,x+wa,yy);c.globalAlpha=1;c.textAlign="center"};
  if(starsFirst){stars();title()}else{title();stars()}
  if(hasRev){y=drawReview(c,y,H-150,tc);who(H-110)}else who(y);
}
function paint(){
  const palette=activePalette();
  const layout=$("#posterLayout")?.value||"review";
  const style=cardStyle;
  ctx.fillStyle=palette.canvas;ctx.fillRect(0,0,W,H);
  const hr=!!reviewText();
  const bg=back||poster;
  const solid=style==="banner"||style==="cinema";
  if(style==="color"){
    const gg=ctx.createLinearGradient(0,0,0,H);
    gg.addColorStop(0,avgColor(poster||bg));gg.addColorStop(1,palette.canvas);
    ctx.fillStyle=gg;ctx.fillRect(0,0,W,H);
  }else if(bg&&!solid&&style!=="text"&&layout!=="editorial"){
    if(style==="blur"||style==="glass")blurred(ctx,poster||bg);
    else if(style==="fullposter")cover(ctx,poster||bg,0,0,W,H);
    else cover(ctx,bg,0,0,W,H);
  }
  const overlayAlpha=palette.darkText?0:darkenAmount()/100;ctx.fillStyle="rgba(0,0,0,"+overlayAlpha+")";ctx.fillRect(0,0,W,H);
  const g=ctx.createLinearGradient(0,H*.4,0,H);
  g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,palette.darkText?"rgba(255,255,255,.04)":"rgba(0,0,0,.92)");
  ctx.fillStyle=g;ctx.fillRect(0,H*.4,W,H*.6);
  let e;
  if(style==="medium"){e=hr?drawPoster(ctx,330,150):drawPoster(ctx,430,330);drawText(ctx,e+(hr?50:90),false,hr)}
  else if(style==="big"){e=hr?drawPoster(ctx,520,120):drawPoster(ctx,820,150);drawText(ctx,e+(hr?50:70),false,hr)}
  else if(style==="small"){e=hr?drawPoster(ctx,240,140):drawPoster(ctx,300,420);drawText(ctx,e+(hr?50:100),false,hr)}
  else if(style==="blur"){e=hr?drawPoster(ctx,380,150):drawPoster(ctx,560,260);drawText(ctx,e+(hr?50:90),false,hr)}
  else if(style==="starsfirst")drawText(ctx,hr?200:720,true,hr);
  else if(style==="tilt"){e=hr?drawPosterRot(ctx,330,190,-5):drawPosterRot(ctx,470,330,-5);drawText(ctx,e+(hr?50:90),false,hr)}
  else if(style==="polaroid"){e=hr?drawPolaroid(ctx,380,140):drawPolaroid(ctx,560,240);drawText(ctx,e+(hr?50:80),false,hr)}
  else if(style==="lbclassic"){
    const x=82,y=135,w=W-164,h=600;
    if(poster){ctx.save();rr(ctx,x,y,w,h,22);ctx.clip();cover(ctx,poster,x,y,w,h);ctx.restore();ctx.save();rr(ctx,x,y,w,h,22);ctx.lineWidth=3;ctx.strokeStyle=palette.accent;ctx.stroke();ctx.restore()}
    ctx.fillStyle=palette.accent;ctx.fillRect(x,y+h+24,86,5);
    drawText(ctx,y+h+68,false,hr);
  }
  else if(style==="ticket"){
    ctx.save();rr(ctx,70,92,W-140,H-184,34);ctx.setLineDash([13,10]);ctx.lineWidth=3;ctx.strokeStyle=palette.accent+"cc";ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=palette.canvas;[H*.47].forEach(cutY=>{[70,W-70].forEach(cutX=>{ctx.beginPath();ctx.arc(cutX,cutY,18,0,Math.PI*2);ctx.fill()})});ctx.restore();
    e=hr?drawPoster(ctx,310,145):drawPoster(ctx,420,230);drawText(ctx,e+(hr?50:80),false,hr);
  }
  else if(style==="split"){
    const x=70,y=130,w=W-140,h=620;
    if(poster){ctx.save();rr(ctx,x,y,w,h,18);ctx.clip();cover(ctx,poster,x,y,w,h);ctx.restore();ctx.save();rr(ctx,x,y,w,h,18);ctx.lineWidth=2;ctx.strokeStyle=palette.accent+"aa";ctx.stroke();ctx.restore()}
    const fade=ctx.createLinearGradient(0,y+h-120,0,y+h+60);fade.addColorStop(0,palette.darkText?"rgba(255,255,255,0)":"rgba(0,0,0,0)");fade.addColorStop(1,palette.canvas);ctx.fillStyle=fade;ctx.fillRect(x,y+h-120,w,180);
    ctx.fillStyle=palette.accent;ctx.fillRect(x,y+h+26,5,110);
    drawText(ctx,y+h+64,false,hr);
  }
  else if(style==="stacked"){
    const w=hr?310:430,h=w*(poster?poster.height/poster.width:1.5),x=(W-w)/2,y=hr?160:300;
    if(poster){
      [[-22,18,-0.075],[22,7,0.065]].forEach(([dx,dy,angle])=>{ctx.save();ctx.translate(W/2+dx,y+h/2+dy);ctx.rotate(angle);ctx.drawImage(poster,-w/2,-h/2,w,h);ctx.restore()});
      ctx.save();rr(ctx,x,y,w,h,18);ctx.clip();ctx.drawImage(poster,x,y,w,h);ctx.restore();ctx.save();rr(ctx,x,y,w,h,18);ctx.lineWidth=4;ctx.strokeStyle=palette.accent;ctx.stroke();ctx.restore();
    }else{
      ctx.save();rr(ctx,x,y,w,h,18);ctx.strokeStyle=palette.accent;ctx.lineWidth=3;ctx.stroke();ctx.restore();
    }
    drawText(ctx,y+h+(hr?55:85),false,hr);
  }
  else if(style==="banner"){
    const bh=780,bi=back||poster;
    if(bi){ctx.save();ctx.beginPath();ctx.rect(0,0,W,bh);ctx.clip();cover(ctx,bi,0,0,W,bh);ctx.fillStyle="rgba(0,0,0,"+darkenAmount()/100*.6+")";ctx.fillRect(0,0,W,bh);ctx.restore()}
    const fg=ctx.createLinearGradient(0,bh-320,0,bh);fg.addColorStop(0,"rgba(11,11,12,0)");fg.addColorStop(1,palette.canvas);
    ctx.fillStyle=fg;ctx.fillRect(0,bh-320,W,320);
    e=hr?drawPoster(ctx,300,470):drawPoster(ctx,400,500);drawText(ctx,e+(hr?50:80),false,hr);
  }else if(style==="cinema"){
    const by=hr?120:340,bh2=hr?560:607,bi=back||poster;
    if(bi){ctx.save();ctx.beginPath();ctx.rect(0,by,W,bh2);ctx.clip();cover(ctx,bi,0,by,W,bh2);ctx.fillStyle="rgba(0,0,0,"+darkenAmount()/100*.5+")";ctx.fillRect(0,by,W,bh2);ctx.restore()}
    ctx.fillStyle=palette.accent+"d9";ctx.fillRect(0,by-6,W,3);ctx.fillRect(0,by+bh2+3,W,3);
    drawText(ctx,by+bh2+70,false,hr);
  }else if(style==="glass"){
    const py=hr?90:240,ph=hr?H-180:1420;
    ctx.save();rr(ctx,60,py,W-120,ph,40);ctx.fillStyle=palette.accent+"1c";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=palette.accent+"65";ctx.stroke();ctx.restore();
    e=hr?drawPoster(ctx,300,py+60):drawPoster(ctx,440,py+70);drawText(ctx,e+(hr?50:80),false,hr);
  }else if(style==="color"){e=hr?drawPoster(ctx,330,150):drawPoster(ctx,520,260);drawText(ctx,e+(hr?50:90),false,hr)}
  else if(style==="fullposter")drawText(ctx,hr?900:1300,false,hr);
  else drawText(ctx,hr?200:760,false,hr);
  $("#previewStatus").textContent=poster?"ARTWORK LOADED ✓":"READY TO FRAME ↗";
}
function render(){clearTimeout(render.t);render.t=setTimeout(paint,60)}
function buildStyleChips(){
  const select=$("#cardComposition");if(!select)return;
  select.replaceChildren();
  CARD_STYLES.forEach(([key,label])=>{
    const option=document.createElement("option");option.value=key;option.textContent=label;select.append(option);
  });
  select.value=cardStyle;
}

/* ---------- Diary connections (public RSS / diary endpoints) ---------- */
let client=null,authMode="signin",letterboxdReviews=[],serializdReviews=[],lastReviewMediaHint="movie";
function normalizeLB(input){let s=String(input||"").trim().replace(/^@/,"").replace(/^https?:\/\/(?:www\.)?letterboxd\.com\//i,"").replace(/\/(?:rss\/?)?$/i,"").split(/[?#/]/)[0].replace(/^@/,"");return /^[A-Za-z0-9_]{2,30}$/.test(s)?s:""}
function normalizeSZ(input){let s=String(input||"").trim();if(/^https?:\/\//i.test(s)){try{const u=new URL(s);if(!/(^|\.)serializd\.com$/i.test(u.hostname))return"";const parts=u.pathname.split("/").filter(Boolean);const i=parts.findIndex(x=>["user","users"].includes(x.toLowerCase()));s=i>=0?parts[i+1]:(parts[parts.length-1]||"")}catch{return""}}s=s.replace(/^@/,"").replace(/\/$/,"");return /^[A-Za-z0-9_-]{2,40}$/.test(s)?s:""}
function rssTag(root,name){return [...root.getElementsByTagName("*")].find(e=>e.localName===name)?.textContent?.trim()||""}
function plain(raw){const d=new DOMParser().parseFromString("<!doctype html><html><body>"+String(raw||"")+"</body></html>","text/html");d.querySelectorAll("script,style,img").forEach(n=>n.remove());d.querySelectorAll("br").forEach(n=>n.replaceWith(document.createTextNode("\n")));return(d.body.textContent||"").replace(/\u00a0/g," ").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim()}
function parseRSS(text,username){const xml=new DOMParser().parseFromString(text,"application/xml");if(xml.querySelector("parsererror"))throw Error("Could not parse the public RSS feed.");return[...xml.getElementsByTagName("item")].map(item=>{const guid=rssTag(item,"guid"),title=rssTag(item,"filmTitle"),raw=rssTag(item,"memberRating"),rating=raw!==""&&Number.isFinite(+raw)?+raw:null,link=rssTag(item,"link");let url="https://letterboxd.com/"+encodeURIComponent(username)+"/";try{const u=new URL(link);if(u.protocol==="https:"&&u.hostname==="letterboxd.com")url=u.href}catch{}return{guid,title,year:rssTag(item,"filmYear"),date:rssTag(item,"watchedDate")||rssTag(item,"pubDate").slice(0,10),rating,text:plain(rssTag(item,"description")),url}}).filter(x=>/letterboxd-review-/i.test(x.guid)&&x.title).slice(0,12)}
async function relay(url,valid){let last;const enc=encodeURIComponent;const targets=["https://api.allorigins.win/raw?url="+enc(url),"https://api.codetabs.com/v1/proxy/?quest="+enc(url),"https://corsproxy.io/?url="+enc(url),"https://proxy.cors.dev/"+url];for(const target of targets){try{const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);try{const r=await fetch(target,{credentials:"omit",signal:c.signal});if(!r.ok)throw Error("HTTP "+r.status);const body=await r.text();if(valid&&!valid(body))throw Error("Unexpected response from relay");return body}finally{clearTimeout(timer)}}catch(e){last=e}}throw last||Error("All public relays failed")}
function renderLB(rows){const grid=$("#lbReviews");grid.replaceChildren();if(!rows.length){const p=document.createElement("p");p.className="lb-empty";p.textContent="No recent written reviews found. Check your public profile or use the poster editor manually.";grid.append(p);return}rows.forEach((r,i)=>{const card=document.createElement("article");card.className="lb-review-card";const meta=document.createElement("div");meta.className="lb-review-meta";const date=document.createElement("span");date.textContent=r.date||"PUBLIC REVIEW";const stars=document.createElement("span");stars.className="lb-stars";stars.textContent=r.rating===null?"UNRATED":("★".repeat(Math.floor(r.rating))+(r.rating%1?"½":"")+" "+r.rating.toFixed(1));meta.append(date,stars);const title=document.createElement("h4");title.textContent=r.title;const year=document.createElement("p");year.className="lb-year";year.textContent=r.year||"LETTERBOXD";const excerpt=document.createElement("p");excerpt.className="lb-excerpt";excerpt.textContent=r.text||"No written note.";const actions=document.createElement("div");actions.className="lb-review-actions";const link=document.createElement("a");link.href=r.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open Letterboxd ↗";const use=document.createElement("button");use.type="button";use.dataset.reviewIndex=i;use.textContent="Use this review";actions.append(link,use);card.append(meta,title,year,excerpt,actions);grid.append(card)})}
async function loadLB(e){e.preventDefault();const username=normalizeLB($("#lbUsername").value),button=$("#lbLoad");if(!username){status("#lbStatus","Enter a valid Letterboxd username or profile URL.","error");return}button.disabled=true;status("#lbStatus","Loading public reviews…");safeStore.set("framix.lb",username);try{const xml=await relay("https://letterboxd.com/"+encodeURIComponent(username)+"/rss/",x=>/<rss[\s>]/i.test(x)&&/<channel[\s>]/i.test(x));if(!xml.includes("<rss"))throw Error("Not an RSS feed");letterboxdReviews=parseRSS(xml,username);renderLB(letterboxdReviews);status("#lbStatus",letterboxdReviews.length?"Loaded "+letterboxdReviews.length+" recent reviews for @"+username+".":"No written reviews found for @"+username+".",letterboxdReviews.length?"success":"error")}catch(err){status("#lbStatus","Could not load the feed: "+(err?.message||"public relay unavailable")+". Check the username and retry.","error");console.warn("Letterboxd import failed",err)}finally{button.disabled=false}}
function serialEntry(x){const show=x.show||x.series||x.tvShow||x.media||{},title=x.showName||x.showTitle||show.name||show.title||x.title||x.name||"",note=x.reviewText||x.review||x.reviewContent||x.text||x.comment||x.content||"",raw=x.rating??x.userRating??x.score??x.stars;let rating=raw==null||raw===""?null:Number(raw);if(rating!==null&&!Number.isFinite(rating))rating=null;if(rating!==null&&rating>5&&rating<=10)rating/=2;let url=x.url||x.diaryUrl||x.reviewUrl||"";try{const u=new URL(url);if(u.protocol!=="https:"||!/(^|\.)serializd\.com$/i.test(u.hostname))url=""}catch{url=""}return{title:String(title),text:String(note),rating,date:String(x.dateAdded||x.createdAt||x.watchedDate||x.date||"").slice(0,10),year:String(x.year||x.releaseYear||show.year||""),url}}
function renderSZ(rows){const grid=$("#serializdReviews");grid.replaceChildren();if(!rows.length){const p=document.createElement("p");p.className="sz-empty";p.textContent="No public diary entries were returned. The profile link is saved; this unofficial endpoint may require a session. You can still create posters manually.";grid.append(p);return}rows.forEach((r,i)=>{const card=document.createElement("article");card.className="sz-review-card";const meta=document.createElement("div");meta.className="sz-review-meta";const date=document.createElement("span");date.textContent=r.date||"SERIALIZD";const rate=document.createElement("span");rate.className="sz-rating";rate.textContent=r.rating===null?"UNRATED":r.rating.toFixed(1)+"/5";meta.append(date,rate);const title=document.createElement("h4");title.textContent=r.title;const year=document.createElement("p");year.className="sz-year";year.textContent=r.year||"TV DIARY";const note=document.createElement("p");note.className="sz-excerpt";note.textContent=r.text||"No written note.";const actions=document.createElement("div");actions.className="sz-review-actions";const link=document.createElement("a");link.href=r.url||$("#serializdProfileLink").href;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open Serializd ↗";const use=document.createElement("button");use.type="button";use.dataset.serializdIndex=i;use.textContent="Use this review";actions.append(link,use);card.append(meta,title,year,note,actions);grid.append(card)})}
function serializdRows(data){
  if(Array.isArray(data))return data;
  if(!data||typeof data!=="object")return null;
  if(/unauthori[sz]ed|authentication required|token required/i.test(String(data.message||data.error||data.detail||""))||Number(data.status||data.statusCode||data.code)===401)throw Error("HTTP 401");
  const candidates=[
    data.reviews,data.items,data.diary,data.entries,data.results,
    data.data?.reviews,data.data?.items,data.data?.diary,data.data?.entries,data.data?.results
  ];
  return candidates.find(Array.isArray)??null;
}
async function fetchSerializdDiary(username){
  const user=encodeURIComponent(username);
  const endpoints=[
    "https://www.serializd.com/api/user/"+user+"/diary?page=1",
    "https://www.serializd.onrender.com/api/user/"+user+"/diary?page=1",
    "https://serializd.onrender.com/api/user/"+user+"/diary?page=1"
  ];
  let lastError=null,authRejected=false;
  for(const endpoint of endpoints){
    try{
      const body=await relay(endpoint,text=>{
        try{return Array.isArray(serializdRows(JSON.parse(text)))}catch(error){if(/401|unauthori[sz]ed|authentication required|token required/i.test(String(error?.message||error)))authRejected=true;return false}
      });
      const rows=serializdRows(JSON.parse(body));
      if(!Array.isArray(rows))throw Error("Serializd returned an unsupported diary response.");
      return rows;
    }catch(error){
      lastError=error;
      console.warn("Serializd endpoint failed",endpoint,error);
    }
  }
  if(authRejected||(lastError&&/401|unauthori[sz]ed/i.test(String(lastError.message||lastError)))){
    throw Error("Public diary requests were rejected (HTTP 401). Serializd's current API may require a session.");
  }
  throw Error("Could not reach a public Serializd diary endpoint. "+(lastError?.message||"No endpoint returned usable diary data."));
}
async function loadSZ(e){
  e.preventDefault();
  const username=normalizeSZ($("#serializdUsername").value),button=$("#serializdLoad");
  if(!username){status("#serializdStatus","Enter a valid Serializd username or profile URL.","error");return}
  button.disabled=true;status("#serializdStatus","Trying public Serializd diary endpoints…");
  safeStore.set("framix.sz",username);
  $("#serializdProfileLink").href="https://www.serializd.com/user/"+encodeURIComponent(username);
  $("#serializdProfileLink").textContent="Open @"+username+" on Serializd ↗";
  $("#serializdProfileLink").hidden=false;
  try{
    const rows=await fetchSerializdDiary(username);
    serializdReviews=rows.map(serialEntry).filter(x=>x.title).slice(0,8);
    renderSZ(serializdReviews);
    status("#serializdStatus",serializdReviews.length
      ?"Loaded "+serializdReviews.length+" public diary entries."
      :"The public diary endpoint responded, but no diary entries were returned for @"+username+".",
      serializdReviews.length?"success":"error");
  }catch(err){
    serializdReviews=[];renderSZ([]);
    const reason=String(err?.message||"");
    const message=/401|unauthori[sz]ed/i.test(reason)
      ?"Serializd rejected anonymous diary access (HTTP 401). This page will not ask for or send your password to a third-party relay."
      :"Could not load the public diary: "+(reason||"no public endpoint responded")+". The profile link remains available.";
    status("#serializdStatus",message,"error");
    console.warn("Serializd import failed",err);
  }finally{button.disabled=false}
}
async function fetchImage(url){
  let lastError=null;
  const targets=[url,"https://proxy.cors.dev/"+url,"https://api.allorigins.win/raw?url="+encodeURIComponent(url)];
  for(const target of targets){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
    try{
      const response=await fetch(target,{mode:"cors",credentials:"omit",signal:controller.signal});
      if(!response.ok)throw Error("Image request failed ("+response.status+")");
      const blob=await response.blob();
      if(!blob.type.startsWith("image/"))throw Error("The returned file is not an image");
      return blob;
    }catch(error){lastError=error}
    finally{clearTimeout(timer)}
  }
  throw lastError||Error("Image unavailable");
}

/* ---------- Auth (optional Supabase) ---------- */
function setMsg(s,error=false){const e=$("#authMessage");e.textContent=s;e.classList.toggle("error",error)}
function setMode(mode){authMode=mode;$$("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));$("#authHeading").innerHTML=mode==="signup"?"Make it <em>personal.</em>":"Welcome <em>back.</em>";$("#authDescription").textContent=mode==="signup"?"Create an account with your email and a strong password.":"Sign in to your Framix account.";$("#authSubmit").innerHTML=mode==="signup"?"Create account →":"Sign in →";$("#authPassword").autocomplete=mode==="signup"?"new-password":"current-password";$("#forgotPassword").hidden=mode!=="signin";setMsg("")}
function updateAuth(session){const email=session?.user?.email;$("#accountLabel").textContent=email?"Signed in · "+email:"Your film journal, reframed." ;$("#authOpen").hidden=!!email;$("#signOut").hidden=!email}
function configureAuth(){const c=window.FRAMIX_CONFIG||{};if(!c.supabaseUrl||!c.supabaseAnonKey||!window.supabase?.createClient){$("#authFields").hidden=true;$("#authSetupNote").hidden=false;return}try{client=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey)}catch(e){console.warn(e)}if(!client){$("#authFields").hidden=true;$("#authSetupNote").hidden=false;return}$("#authFields").hidden=false;$("#authSetupNote").hidden=true;client.auth.getSession().then(({data})=>updateAuth(data?.session||null)).catch(()=>updateAuth(null));client.auth.onAuthStateChange((_e,session)=>updateAuth(session));if(new URLSearchParams(location.hash.slice(1)).get("type")==="recovery")$("#resetDialog").showModal()}

/* ---------- Wiring ---------- */
$("#tmdbSaveKey").addEventListener("click",()=>{
 const key=val("#tmdbKey");
 if(!key){safeStore.set("framix.tmdbKey","");setTMDBStatus("TMDB key cleared from this browser.");return}
 safeStore.set("framix.tmdbKey",key);$("#tmdbKey").value=key;
 setTMDBStatus("TMDB key saved locally. Looking up the current film/show…","success");
 void autoFindTMDBForReview({title:val("#filmTitle"),year:val("#filmYear"),mediaHint:lastReviewMediaHint});
});
$("#tmdbSearch").addEventListener("click",searchTMDB);
 $("#themeFamily").addEventListener("change",()=>{syncThemeOptions(false);paint();});
 $("#themeSwatches").addEventListener("change",event=>{if(event.target.matches('input[name="theme"]'))syncThemeOptions();});
 $("#cardComposition").addEventListener("change",()=>{cardStyle=$("#cardComposition").value;paint();});
 $("#posterLayout").addEventListener("change",()=>{
   const layout=$("#posterLayout").value;
   if(layout==="poster")cardStyle="fullposter";
   else if(layout==="editorial")cardStyle="text";
   else cardStyle="medium";
   $("#cardComposition").value=cardStyle;paint();
 });
$("#tmdbQuery").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchTMDB()}});
["#filmTitle","#filmYear","#rating","#reviewerName","#reviewText","#showReview","#textColor","#starColor","#darken","#showReviewer"].forEach(sel=>{
  const el=$(sel);if(!el)return;
  el.addEventListener("input",render);el.addEventListener("change",render);
});
$("#downloadCard").addEventListener("click",()=>{
  paint();canvas.toBlob(blob=>{
    if(!blob){$("#previewStatus").textContent="EXPORT FAILED — TRY AGAIN";return}
    const url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download="framix-story-"+(val("#filmTitle")||"review").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)+".png";
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1200);$("#previewStatus").textContent="INSTAGRAM STORY DOWNLOADED ✓";
  },"image/png");
});
$("#letterboxdForm").addEventListener("submit",loadLB);
$("#lbLoad").addEventListener("click",e=>{e.preventDefault();void loadLB({preventDefault(){}})});
$("#lbReviews").addEventListener("click",event=>{
 const button=event.target.closest("button[data-review-index]");if(!button)return;
 const review=letterboxdReviews[Number(button.dataset.reviewIndex)];if(!review)return;
 $("#filmTitle").value=review.title.slice(0,100);
 $("#filmYear").value=[review.year,review.date?"Watched "+review.date:""].filter(Boolean).join(" · ").slice(0,60);
 if(review.rating!==null){
   $("#rating").value=String([...$("#rating").options].map(option=>+option.value).sort((a,b)=>Math.abs(a-review.rating)-Math.abs(b-review.rating))[0]);
 }
 $("#reviewText").value=review.text||"";$("#showReview").checked=!!review.text;
 const who=normalizeLB($("#lbUsername").value),nameField=$("#reviewerName");if(who&&nameField)nameField.value=who;
 render();
 $("#studio").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 lastReviewMediaHint="movie";void autoFindTMDBForReview({title:review.title,year:review.year,mediaHint:lastReviewMediaHint});
});
$("#serializdForm").addEventListener("submit",loadSZ);
$("#serializdLoad").addEventListener("click",e=>{e.preventDefault();void loadSZ({preventDefault(){}})});
$("#serializdReviews").addEventListener("click",event=>{
 const button=event.target.closest("button[data-serializd-index]");if(!button)return;
 const review=serializdReviews[Number(button.dataset.serializdIndex)];if(!review)return;
 $("#filmTitle").value=review.title.slice(0,100);
 $("#filmYear").value=[review.year,review.date].filter(Boolean).join(" · ").slice(0,60);
 if(review.rating!==null){
   $("#rating").value=String([...$("#rating").options].map(option=>+option.value).sort((a,b)=>Math.abs(a-review.rating)-Math.abs(b-review.rating))[0]);
 }
 $("#reviewText").value=review.text||"";$("#showReview").checked=!!review.text;
 const who=normalizeSZ($("#serializdUsername").value),nameField=$("#reviewerName");if(who&&nameField)nameField.value=who;
 render();
 $("#studio").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 lastReviewMediaHint="tv";void autoFindTMDBForReview({title:review.title,year:review.year,mediaHint:lastReviewMediaHint});
});
$("#authOpen").addEventListener("click",()=>{setMode("signin");$("#authDialog").showModal()});$("#authClose").addEventListener("click",()=>$("#authDialog").close());$("#resetClose").addEventListener("click",()=>$("#resetDialog").close());$$("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();if(!client){$("#authSetupNote").hidden=false;$("#authFields").hidden=true;return}const email=val("#authEmail"),password=$("#authPassword").value,button=$("#authSubmit");button.disabled=true;setMsg(authMode==="signup"?"Creating account…":"Signing in…");try{const r=authMode==="signup"?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;if(authMode==="signup"&&!r.data.session)setMsg("Account created. Check your email to verify your address.");else{setMsg("You're signed in.");setTimeout(()=>$("#authDialog").close(),650)}}catch(e){setMsg(e.message||"Sign-in failed. Check your details.",true)}finally{button.disabled=false}});
$("#forgotPassword").addEventListener("click",async()=>{if(!client){setMsg("Configure Supabase first.",true);return}const email=val("#authEmail");if(!email){setMsg("Enter your email first.",true);$("#authEmail").focus();return}try{const{error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;setMsg("If the account exists, a recovery email has been requested.")}catch(e){setMsg(e.message||"Could not request recovery.",true)}});
$("#resetForm").addEventListener("submit",async e=>{e.preventDefault();const el=$("#resetMessage");if(!client){el.textContent="Configure Supabase first.";return}try{const{error}=await client.auth.updateUser({password:$("#newPassword").value});if(error)throw error;el.textContent="Password updated."}catch(e){el.textContent=e.message||"Could not update password.";el.classList.add("error")}});
$("#signOut").addEventListener("click",async()=>{if(!client)return;const{error}=await client.auth.signOut();if(error){$("#accountLabel").textContent="Could not sign out.";return}updateAuth(null)});
window.addEventListener("resize",()=>{if(!$("#tmdbPosterOptionsWrap").hidden)updateCarouselUI(false)});

/* Small debug/verification hook (no UI) */
window.FramixStudio={
  paint,
  setArtwork(posterSrc,backdropSrc){
    const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>resolve(i);i.onerror=()=>reject(Error("load failed"));i.src=src});
    return Promise.all([posterSrc?load(posterSrc):Promise.resolve(null),backdropSrc?load(backdropSrc):Promise.resolve(null)])
      .then(([p,b])=>{if(p)poster=p;if(b)back=b;paint()}).catch(e=>console.warn("setArtwork failed",e));
  }
};

/* ---------- Init ---------- */
const savedTMDBKey=tmdbKey();if(savedTMDBKey)$("#tmdbKey").value=savedTMDBKey;
const savedProxy=safeStore.get("framix.proxy"),proxyField=$("#proxyUrl");if(savedProxy&&proxyField)proxyField.value=savedProxy;
buildStyleChips();
syncThemeOptions(false);
const lb=safeStore.get("framix.lb"),sz=safeStore.get("framix.sz");if(lb)$("#lbUsername").value=lb;if(sz){$("#serializdUsername").value=sz;$("#serializdProfileLink").href="https://www.serializd.com/user/"+encodeURIComponent(sz);$("#serializdProfileLink").textContent="Open @"+sz+" on Serializd ↗";$("#serializdProfileLink").hidden=false}
paint();configureAuth();
})();