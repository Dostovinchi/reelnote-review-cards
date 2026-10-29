(() => {
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const canvas=$("#cardCanvas"),ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height;
const safeStore={get(k){try{return localStorage.getItem(k)||""}catch{return""}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const proxyBase=()=>String((window.FRAMIX_CONFIG&&window.FRAMIX_CONFIG.proxyBase)||safeStore.get("framix.proxy")||"").trim().replace(/\/+$/,"");
const proxied=url=>proxyBase()?proxyBase()+"/?url="+encodeURIComponent(url):"";
const val=s=>$(s).value.trim();
function status(sel,msg,type=""){const e=$(sel);e.textContent=msg;e.classList.remove("error","success");if(type)e.classList.add(type)}

/* ---------- Card engine state (ReelNote review-card maker) ---------- */
const CARD_STYLES=[["medium","بوستر في الوسط"],["big","بوستر كبير"],["small","بوستر صغير"],["blur","خلفية ضبابية"],["starsfirst","النجوم أولًا"],["text","نص فقط"],["tilt","بوستر مائل"],["polaroid","بولارويد"],["banner","شريط علوي"],["cinema","شريط سينمائي"],["glass","لوح زجاجي"],["color","غسيل لوني"],["fullposter","بوستر كامل"],["lbclassic","ليتربوكسد الكلاسيكي"],["ticket","تذكرة سينما"],["split","إطار منقسم"],["stacked","بطاقات متراكبة"]];

const makePalette=(label,canvas,accent,ink,muted,darkText=false)=>({label,swatch:canvas,canvas,accent,ink,muted,darkText});
const THEME_PALETTES={
  general:{
    noir:makePalette("نوار","#090e16","#d2ae70","#f3f0e8","#b3bdca"),
    midnight:makePalette("منتصف الليل","#0b1a2c","#64b2c5","#eef4f7","#a8c2d2"),
    ember:makePalette("جمر","#21141b","#d2ae70","#f4e8e2","#cbb4b2"),
    archive:makePalette("أرشيف","#e4d9c8","#8c423f","#252932","#5d626a",true),
    ocean:makePalette("محيط","#071c26","#36c9d4","#e8fcff","#9bc2cb"),
    rosewood:makePalette("خشب الورد","#26131c","#ee8f9c","#fff0f3","#d7b7c0"),
    forest:makePalette("غابة","#122218","#b7cc77","#f2f7e8","#b5c5a0"),
    mono:makePalette("أحادي اللون","#151515","#f4f0e7","#ffffff","#b6b6b6")
  },
  letterboxd:{
    lb_green:makePalette("أخضر","#071c11","#00e054","#f3f5ed","#b5c5b8"),
    lb_red:makePalette("أحمر","#2b1018","#ff667a","#fff0ed","#d5b4b7"),
    lb_blue:makePalette("أزرق","#0d1d33","#70a9ff","#f0f5ff","#b5c7e1"),
    lb_gold:makePalette("ذهبي","#231c10","#f1c75b","#fff7df","#d3c7a5"),
    lb_violet:makePalette("بنفسجي","#1b102b","#bc8cff","#f5efff","#c6b5dc"),
    lb_sunset:makePalette("غروب","#2b160d","#ff985c","#fff2e6","#e0bda5"),
    lb_cream:makePalette("كريمي","#eee6d8","#42614d","#232925","#62685f",true),
    lb_mint:makePalette("نعناعي","#08251f","#71e0bf","#e9fff7","#a8d8cb")
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

let cardStyle="medium",poster=null,back=null,posterObjectUrl=null,backObjectUrl=null,activeBackdropPath="";

/* ---------- TMDB ---------- */
let tmdbResults=[],selectedTMDB=null,tmdbPosterVariants=[],tmdbBackdropVariants=[],tmdbLoadSequence=0,backdropLoadSequence=0,activePosterPath="",lbMatches=[],lbLinkSearched="";
function setTMDBStatus(msg,type=""){status("#tmdbStatus",msg,type)}
function tmdbKey(){return safeStore.get("framix.tmdbKey")||""}
async function tmdb(path,params={}){
  const key=tmdbKey(),base=proxyBase();
  if(!key&&!base)throw Error("احفظ مفتاح TMDB v3 أولًا (الخطوة ب).");
  const u=new URL("https://api.themoviedb.org/3"+path);
  if(key)u.searchParams.set("api_key",key);
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,v)});
  const requestUrl=base?base+"/?url="+encodeURIComponent(u.href):u.href;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(requestUrl,{signal:controller.signal,credentials:"omit"});
    if(!response.ok){
      if(response.status===401)throw Error("رفض TMDB هذا المفتاح. تأكد أنك نسخت مفتاح v3 (لا كلمة مرور حسابك) واحفظه مجددًا.");
      if(response.status===403)throw Error("رفض TMDB هذا المفتاح. تحقق من حالة تطبيق API والمفتاح.");
      if(response.status===429)throw Error("بلغت حدّ معدل TMDB. انتظر قليلًا ثم أعد المحاولة.");
      throw Error("فشل طلب TMDB ("+response.status+").");
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
  if(!query){setTMDBStatus("أدخل عنوان فيلم أو مسلسل للبحث.");return}
  const button=$("#tmdbSearch");button.disabled=true;$("#tmdbResults").replaceChildren();
  setTMDBStatus("جارٍ البحث في TMDB…");
  try{
    const [movies,tv]=await Promise.all([
      tmdb("/search/movie",{query,include_adult:"false"}),
      tmdb("/search/tv",{query})
    ]);
    tmdbResults=[...(movies.results||[]).map(item=>tmdbResult(item,"movie")),...(tv.results||[]).map(item=>tmdbResult(item,"tv"))]
      .sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,20);
    renderTMDBResults();
    setTMDBStatus(tmdbResults.length?"عُثر على "+tmdbResults.length+" عنوان. اختر واحدًا ثم اسحب بوسترات TMDB.":"لا نتائج. جرّب العنوان الأصلي أو تهجئة أخرى.",tmdbResults.length?"success":"");
  }catch(error){setTMDBStatus(error.message||"تعذّر الوصول إلى TMDB. حاول لاحقًا.","error")}
  finally{button.disabled=false}
}
function renderTMDBResults(){
  const grid=$("#tmdbResults");grid.replaceChildren();
  tmdbResults.forEach(item=>{
    const card=document.createElement("article");card.className="tmdb-result";
    const img=document.createElement("img");img.alt="";img.loading="lazy";
    const direct=item.poster_path?"https://image.tmdb.org/t/p/w342"+item.poster_path:"";
    img.src=direct;
    img.onerror=()=>{const relayed=direct&&proxyBase()?proxied(direct):"";if(relayed&&img.src!==relayed)img.src=relayed;else img.hidden=true};
    const info=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small"),button=document.createElement("button");
    title.textContent=item.display_title||"بدون عنوان";
    meta.textContent=(item.media_type==="tv"?"مسلسل":"فيلم")+" · "+(item.display_date||"تاريخ غير معروف").slice(0,4);
    button.type="button";button.textContent="اختر العنوان";button.addEventListener("click",()=>loadTMDBTitle(item));
    info.append(title,meta,button);card.append(img,info);grid.append(card);
  });
}

/* ---------- Swipeable TMDB poster options ---------- */
let carouselIndex=0,backdropIndex=0,dragMoved=false;
function posterVariantLabel(v){return ((v.iso_639_1||"بدون نص").toUpperCase())+" · "+(v.vote_average?Number(v.vote_average).toFixed(1)+"★":"TMDB")}
function backdropVariantLabel(v){const size=v.width&&v.height?v.width+"×"+v.height:"";return ((v.iso_639_1||"بدون نص").toUpperCase())+(size?" · "+size:" · TMDB")}
function carouselConfig(kind){
  if(kind==="backdrop")return{
    root:"#tmdbBackdrops",wrap:"#tmdbBackdropOptionsWrap",count:"#tmdbBackdropCount",
    variants:tmdbBackdropVariants,active:activeBackdropPath,label:backdropVariantLabel,prefix:"خلفية",prevAria:"الخلفية السابقة",nextAria:"الخلفية التالية",
    aria:"خيارات خلفية TMDB. اسحب يسارًا للخلفية التالية ويمينًا للسابقة.",
    apply:path=>chooseTMDBBackdrop(path),getIndex:()=>backdropIndex,setIndex:v=>{backdropIndex=v},frameClass:"is-backdrop"
  };
  return{
    root:"#tmdbPosters",wrap:"#tmdbPosterOptionsWrap",count:"#tmdbPosterCount",
    variants:tmdbPosterVariants,active:activePosterPath,label:posterVariantLabel,prefix:"بوستر",prevAria:"البوستر السابق",nextAria:"البوستر التالي",
    aria:"خيارات بوستر TMDB. اسحب يسارًا للبوستر التالي ويمينًا للسابق.",
    apply:path=>chooseTMDBPoster(path),getIndex:()=>carouselIndex,setIndex:v=>{carouselIndex=v},frameClass:""
  };
}
function slideIsCurrent(kind,variant,index,config){
  return kind==="backdrop"?variant.file_path===activeBackdropPath:index===config.getIndex();
}
function renderCarousel(kind){
  const c=carouselConfig(kind),wrap=$(c.wrap),root=$(c.root);
  root.classList.add("poster-carousel");
  root.classList.toggle("backdrop-carousel",kind==="backdrop");
  root.replaceChildren();
  if(!selectedTMDB||!c.variants.length){wrap.hidden=true;$(c.count).textContent="";return}
  wrap.hidden=false;
  c.setIndex(Math.max(0,c.variants.findIndex(v=>v.file_path===c.active)));
  root.classList.toggle("is-single",c.variants.length<2);
  const viewport=document.createElement("div");viewport.className="poster-carousel-viewport";viewport.tabIndex=0;
  viewport.setAttribute("role","group");viewport.setAttribute("aria-label",c.aria);
  const track=document.createElement("div");track.className="poster-carousel-track";
  c.variants.forEach((v,i)=>{
    const slide=document.createElement("figure");slide.className="poster-slide"+(slideIsCurrent(kind,v,i,c)?" is-current":"");slide.dataset.index=String(i);
    const frame=document.createElement("div");frame.className="slide-frame"+(c.frameClass?" "+c.frameClass:"");
    const img=document.createElement("img");img.alt="";img.loading="lazy";img.draggable=false;
    const direct="https://image.tmdb.org/t/p/w"+(kind==="backdrop"?"300":"342")+v.file_path;img.src=direct;
    img.onerror=()=>{const relayed=proxyBase()?proxied(direct):"";if(relayed&&img.src!==relayed)img.src=relayed;else img.alt="Preview unavailable"};
    frame.append(img);
    const cap=document.createElement("figcaption");const c1=document.createElement("span");c1.textContent=c.label(v);const c2=document.createElement("span");c2.textContent=c.prefix+" "+(i+1);cap.append(c1,c2);
    slide.append(frame,cap);
    slide.addEventListener("click",()=>{if(dragMoved)return;goToSlide(kind,Number(slide.dataset.index),true)});
    track.append(slide);
  });
  viewport.append(track);
  const prev=document.createElement("button");prev.type="button";prev.className="poster-carousel-nav prev";prev.textContent="‹";prev.setAttribute("aria-label",c.prevAria);
  const next=document.createElement("button");next.type="button";next.className="poster-carousel-nav next";next.textContent="›";next.setAttribute("aria-label",c.nextAria);
  prev.addEventListener("click",()=>goToSlide(kind,c.getIndex()-1,true));
  next.addEventListener("click",()=>goToSlide(kind,c.getIndex()+1,true));
  root.append(viewport,prev,next);
  viewport.addEventListener("keydown",e=>{
    if(e.key==="ArrowRight"){e.preventDefault();goToSlide(kind,c.getIndex()+1,true)}
    else if(e.key==="ArrowLeft"){e.preventDefault();goToSlide(kind,c.getIndex()-1,true)}
  });
  attachCarouselDrag(kind,viewport,track);
  updateCarouselUI(false,kind);
}
function renderTMDBPosterOptions(){renderCarousel("poster")}
function renderTMDBBackdropOptions(){renderCarousel("backdrop")}
function updateCarouselUI(animate=true,kind="poster"){
  const c=carouselConfig(kind),viewport=$(c.root+" .poster-carousel-viewport");if(!viewport)return;
  const track=viewport.firstElementChild;if(!track)return;
  if(animate===false)track.style.transition="none";
  track.style.transform="translateX("+(-c.getIndex()*viewport.clientWidth)+"px)";
  if(animate===false)requestAnimationFrame(()=>{track.style.transition=""});
  $(c.count).textContent=(c.getIndex()+1)+" / "+c.variants.length;
  [...viewport.querySelectorAll(".poster-slide")].forEach((s,i)=>s.classList.toggle("is-current",slideIsCurrent(kind,c.variants[i],i,c)));
}
function goToSlide(kind,index,apply){
  const c=carouselConfig(kind);
  if(!c.variants.length)return;
  c.setIndex(Math.max(0,Math.min(c.variants.length-1,index)));
  updateCarouselUI(true,kind);
  const viewport=$(c.root+" .poster-carousel-viewport");if(viewport)viewport.focus({preventScroll:true});
  if(apply)c.apply(c.variants[c.getIndex()].file_path);
}
function attachCarouselDrag(kind,viewport,track){
  const c=carouselConfig(kind);
  let startX=0,baseOffset=0,dragging=false;
  viewport.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse"&&e.button!==0)return;
    dragging=true;dragMoved=false;startX=e.clientX;baseOffset=-c.getIndex()*viewport.clientWidth;
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
    if(dx<=-threshold)goToSlide(kind,c.getIndex()+1,true);        /* swipe left → next */
    else if(dx>=threshold)goToSlide(kind,c.getIndex()-1,true);  /* swipe right → previous */
    else updateCarouselUI(true,kind);
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
    if(loaded)setTMDBStatus("تم تطبيق البوستر "+(carouselIndex+1)+" من "+tmdbPosterVariants.length+" · اسحب للمزيد.","success");
  }catch(error){setTMDBStatus("تعذّر تحميل هذا البوستر. جرّب غيره.","error");console.warn("TMDB poster variant failed",error)}
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
  const seq=++backdropLoadSequence;
  try{
    const blob=await fetchImage("https://image.tmdb.org/t/p/w1280"+filePath);
    if(requestId!==tmdbLoadSequence||seq!==backdropLoadSequence)return false;
    const objectUrl=URL.createObjectURL(blob),img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Backdrop could not be decoded"));img.src=objectUrl});
    if(requestId!==tmdbLoadSequence||seq!==backdropLoadSequence){URL.revokeObjectURL(objectUrl);return false}
    if(backObjectUrl)URL.revokeObjectURL(backObjectUrl);
    backObjectUrl=objectUrl;back=img;activeBackdropPath=filePath;refreshBackdropSelection();paint();
    return true;
  }catch(error){console.warn("TMDB backdrop failed",error);return false}
}
function refreshBackdropSelection(){
  const idx=tmdbBackdropVariants.findIndex(v=>v.file_path===activeBackdropPath);
  if(idx>=0)backdropIndex=idx;
  updateCarouselUI(false,"backdrop");
}
async function chooseTMDBBackdrop(filePath){
  if(!filePath||!selectedTMDB)return;
  const applied=await applyTMDBBackdrop(filePath,tmdbLoadSequence);
  if(applied)setTMDBStatus("تم تطبيق خلفية العمل الفني.","success");
  else setTMDBStatus("تعذّر تحميل هذه الخلفية. جرّب غيرها.","error");
}
async function loadTMDBTitle(item,options={}){
  const requestId=options.requestId??(++tmdbLoadSequence);
  const buttons=$("#tmdbResults").querySelectorAll("button");buttons.forEach(button=>button.disabled=true);
  setTMDBStatus(options.automatic?"تم العثور على الفيلم. جارٍ تحميل البوسترات…":"جارٍ تحميل الفيلم وخيارات البوستر…");
  try{
    const detailPath="/"+item.media_type+"/"+item.id;
    const detailParams=item.media_type==="movie"?{append_to_response:"credits"}:{};
    const [detail,imageData]=await Promise.all([
      tmdb(detailPath,detailParams),
      tmdb(detailPath+"/images").catch(error=>{console.warn("TMDB image variants unavailable",error);return {posters:[]}})
    ]);
    if(requestId!==tmdbLoadSequence)return;
    const mediaTitle=detail.title||detail.name||item.display_title||"عنوان TMDB";
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
    if(!tmdbPosterVariants.length)throw Error("وجد TMDB الفيلم لكن لا توجد صور بوستر.");
    const backdropPaths=new Map(),preferredBackdrop=detail.backdrop_path||item.backdrop_path||"";
    (imageData.backdrops||[]).forEach(backdrop=>{if(backdrop.file_path)backdropPaths.set(backdrop.file_path,backdrop)});
    if(preferredBackdrop&&!backdropPaths.has(preferredBackdrop))backdropPaths.set(preferredBackdrop,{file_path:preferredBackdrop});
    tmdbBackdropVariants=[...backdropPaths.values()];
    if(preferredBackdrop)tmdbBackdropVariants.sort((a,b)=>Number(b.file_path===preferredBackdrop)-Number(a.file_path===preferredBackdrop));
    if(!tmdbBackdropVariants.length&&backObjectUrl){URL.revokeObjectURL(backObjectUrl);backObjectUrl=null;back=null}
    $("#filmTitle").value=mediaTitle.slice(0,100);
    $("#filmYear").value=[creator,mediaYear].filter(Boolean).join(", ").slice(0,60);
    const primaryPath=preferredPath||tmdbPosterVariants[0].file_path;
    const loaded=await applyTMDBPoster(primaryPath,requestId);
    if(!loaded)return;
    renderTMDBPosterOptions();
    activeBackdropPath="";
    renderTMDBBackdropOptions();
    void applyTMDBBackdrop(detail.backdrop_path||item.backdrop_path||"",requestId);
    setTMDBStatus((options.automatic?"تم استيراد المراجعة · حُمّل البوستر تلقائيًا. ":"تم تحميل البوستر. ")+tmdbPosterVariants.length+" خيار بوستر من TMDB — اسحب العمل الفني للتبديل.","success");
  }catch(error){
    if(requestId===tmdbLoadSequence)setTMDBStatus(error.message||"تعذّر تحميل عمل TMDB الفني.","error");
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
  const backdropWrap=$("#tmdbBackdropOptionsWrap");if(backdropWrap)backdropWrap.hidden=true;
  const backdropRoot=$("#tmdbBackdrops");if(backdropRoot)backdropRoot.replaceChildren();
  if(!tmdbKey()){
    setTMDBStatus("تم استيراد المراجعة. احفظ مفتاح TMDB v3 في الخطوة ب لتحميل العمل الفني تلقائيًا.","error");
    return;
  }
  if(!query){setTMDBStatus("تم استيراد المراجعة. لا عنوان متاح للبحث في TMDB.","error");return}
  const yearHint=guessYear(year);
  setTMDBStatus("تم استيراد المراجعة · البحث في TMDB عن "+query+(yearHint?" ("+yearHint+")":"")+"…");
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
      setTMDBStatus("تم استيراد المراجعة، لكن TMDB لم يجد تطابقًا واثقًا. اختر العنوان الصحيح في الخطوة ب.","error");
      return;
    }
    await loadTMDBTitle(best,{automatic:true,requestId});
  }catch(error){
    if(requestId===tmdbLoadSequence)setTMDBStatus("تم استيراد المراجعة، لكن فشل بحث البوستر في TMDB: "+(error.message||"خطأ غير معروف"),"error");
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
  if(!m)throw Error("الصق رابط مراجعة ليتربوكسد مثل letterboxd.com/your-name/film/film-title/");
  let slug=m[2],year="";
  const y=slug.match(/-(\d{4})$/);if(y){year=y[1];slug=slug.slice(0,-5)}
  const params={query:slug.replace(/-/g," "),include_adult:"false"};
  if(year)params.year=year;
  const d=await tmdb("/search/movie",params);
  const want=normalizeTitle(slug);
  const matches=(d.results||[]).slice()
    .sort((a,b)=>((normalizeTitle(b.title)===want)-(normalizeTitle(a.title)===want))||((b.vote_count||0)-(a.vote_count||0)))
    .slice(0,10).map(r=>tmdbResult(r,"movie"));
  if(!matches.length)throw Error("لم يجد TMDB هذا الفيلم. تحقق من الرابط أو ابحث عن العنوان يدويًا في الخطوة ب.");
  lbLinkSearched=link;
  populateFilmSelect(matches);
  return matches;
}

/* ---------- Letterboxd review fetching (RSS + review page) ---------- */
async function viaProxy(url,ok){
  return relay(url,ok);
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
  if(!m)throw Error("الصق رابط مراجعة ليتربوكسد أولًا (letterboxd.com/your-name/film/film-title/).");
  const user=m[1],slug=m[2],n=m[3]||"";
  let data=null,src="";
  try{data=await fromRss(user,slug,n);if(data)src="RSS"}catch(e){console.warn("RSS fetch failed",e)}
  if(!data||!data.text||!data.rating){
    try{const p=await fromPage(user,slug,n);
      if(p){data={text:(data&&data.text)||p.text,rating:(data&&data.rating)||p.rating};src="review page"}
    }catch(e){console.warn("Page fetch failed",e)}
  }
  if(!data)throw Error("تعذّر جلب المراجعة من ليتربوكسد. الصق النص يدويًا أو أعد المحاولة لاحقًا. ["+(window.relayLog||[]).join(" · ")+"]");
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
    c.font=size+"px 'Tajawal',system-ui,sans-serif";lh=size*1.42;lines=[];
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
  const title=()=>{c.font="bold "+ts+"px 'Reem Kufi',system-ui,sans-serif";c.fillStyle=tc;
    wrap($("#filmTitle").value||"فيلم بلا عنوان",900).forEach(l=>{c.fillText(l,W/2,y);y+=ts*1.22});y+=6;
    c.font=(hasRev?32:38)+"px 'Tajawal',system-ui,sans-serif";c.globalAlpha=.9;c.fillText($("#filmYear").value,W/2,y);c.globalAlpha=1;y+=hasRev?56:70};
  const who=yy=>{const show=$("#showReviewer"),name=$("#reviewerName");if(!show?.checked||!name?.value?.trim())return;
    const a="راجعه ",b=name.value.trim();c.font="28px 'Tajawal',system-ui,sans-serif";
    c.textAlign="center";c.direction="rtl";c.fillStyle=tc;c.globalAlpha=.85;c.fillText(a+b,W/2,yy);c.direction="ltr";c.globalAlpha=1};
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
  $("#previewStatus").textContent=poster?"العمل الفني محمّل ✓":"جاهز للتأطير ↗";
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
let client=null,authMode="signin",letterboxdReviews=[],lastReviewMediaHint="movie";
const LB_PAGE_SIZE=3;
let lbVisible=[],lbPage=0,lbQuery="";
function normalizeLB(input){let s=String(input||"").trim().replace(/^@/,"").replace(/^https?:\/\/(?:www\.)?letterboxd\.com\//i,"").replace(/\/(?:rss\/?)?$/i,"").split(/[?#/]/)[0].replace(/^@/,"");return /^[A-Za-z0-9_]{2,30}$/.test(s)?s:""}
function rssTag(root,name){return [...root.getElementsByTagName("*")].find(e=>e.localName===name)?.textContent?.trim()||""}
function plain(raw){const d=new DOMParser().parseFromString("<!doctype html><html><body>"+String(raw||"")+"</body></html>","text/html");d.querySelectorAll("script,style,img").forEach(n=>n.remove());d.querySelectorAll("br").forEach(n=>n.replaceWith(document.createTextNode("\n")));return(d.body.textContent||"").replace(/\u00a0/g," ").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim()}
function parseRSS(text,username){
  const xml=new DOMParser().parseFromString(text,"application/xml");
  if(xml.querySelector("parsererror"))throw Error("تعذّرت قراءة خلاصة RSS العامة.");
  return [...xml.getElementsByTagName("item")].map(item=>{
    const guid=rssTag(item,"guid"),isReview=/letterboxd-review-/i.test(guid),isDiaryEntry=/letterboxd-(?:review|watch)-/i.test(guid);
    const title=rssTag(item,"filmTitle"),raw=rssTag(item,"memberRating");
    const rating=raw!==""&&Number.isFinite(+raw)?+raw:null,link=rssTag(item,"link");
    let url="https://letterboxd.com/"+encodeURIComponent(username)+"/";
    try{const u=new URL(link);if(u.protocol==="https:"&&u.hostname==="letterboxd.com")url=u.href}catch{}
    const description=isReview?plain(rssTag(item,"description")).replace(/^Watched on\s+[^\n]+$/i,"").trim():"";
    return{guid,slug:filmSlugFromUrl(link),title,year:rssTag(item,"filmYear"),date:rssTag(item,"watchedDate")||rssTag(item,"pubDate").slice(0,10),rating,text:description,url,isReview,isDiaryEntry};
  }).filter(x=>x.title&&x.isDiaryEntry&&(x.isReview||x.rating!==null));
}
async function relay(url,valid){
  let lastError=null;
  const enc=encodeURIComponent,base=proxyBase();
  const looksBlocked=text=>/just a moment|cf-browser-verification|attention required|enable javascript and cookies/i.test(text);
  const targets=[];
  if(base)targets.push(base+"/?url="+enc(url));
  targets.push(
    "https://proxy.cors.dev/"+url,
    "https://api.allorigins.win/raw?url="+enc(url)
  );
  window.relayLog=[];
  for(const target of targets){
    let host="?";try{host=new URL(target).hostname.replace(/^(api|www)\./,"")}catch{}
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
      try{
        const response=await fetch(target,{credentials:"omit",signal:controller.signal,cache:"no-store"});
        const body=await response.text();
        if(!response.ok||(valid&&!valid(body))){
          if(looksBlocked(body)){
            lastError=Error("blocked");
            window.relayLog.push(host+":challenge");
            break;
          }
          if(!response.ok)throw Error("HTTP "+response.status);
          throw Error("unexpected content");
        }
        window.relayLog.push(host+":ok");
        return body;
      }finally{clearTimeout(timer)}
    }catch(error){
      lastError=error;
      window.relayLog.push(host+":"+(error.name==="AbortError"?"timeout":String(error.message||"blocked").slice(0,32)));
    }
  }
  throw lastError||Error("فشلت جميع الخوادم العامة");
}
async function fetchPublicText(url,valid,label){
  let directError=null;
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"no-store",headers:{Accept:"application/json, application/rss+xml, application/xml, text/xml, */*"},signal:controller.signal});
      if(!response.ok)throw Error(label+" HTTP "+response.status);
      const body=await response.text();
      if(valid&&!valid(body))throw Error(label+" returned unexpected data");
      return body;
    }finally{clearTimeout(timer)}
  }catch(error){directError=error}
  try{return await relay(url,valid)}catch(relayError){
    const reasons=[directError?.message,relayError?.message].filter(Boolean).join("; ");
    if(/HTTP 401|HTTP 403/i.test(reasons)){
      throw Error(label+" access was rejected (HTTP 401/403). The public endpoint or relay is refusing the request.");
    }
    throw Error(label+" unavailable from the browser and public relays. "+(relayError?.message||directError?.message||"حاول لاحقًا."));
  }
}
function lbFiltered(){
  const query=normalizeTitle(lbQuery);
  if(!query)return letterboxdReviews;
  const tokens=query.split(" ").filter(Boolean);
  return letterboxdReviews.filter(review=>{
    const hay=normalizeTitle(review.title+" "+String(review.year||""));
    return tokens.every(token=>hay.includes(token));
  });
}
function lbCard(review,index){
  const card=document.createElement("article");card.className="lb-review-card";
  const content=document.createElement("div");content.className="lb-review-content";
  const meta=document.createElement("div");meta.className="lb-review-meta";
  const date=document.createElement("span");date.textContent=review.date||(review.text?"مراجعة":"تقييم");
  const stars=document.createElement("span");stars.className="lb-stars";
  stars.textContent=review.rating===null?"—":("★".repeat(Math.floor(review.rating))+(review.rating%1?"½":"")+" "+review.rating.toFixed(1));
  meta.append(date,stars);
  const title=document.createElement("h4");title.textContent=review.title;
  content.append(meta,title);
  if(review.year){const year=document.createElement("p");year.className="lb-year";year.textContent=review.year;content.append(year)}
  if(review.text){const excerpt=document.createElement("p");excerpt.className="lb-excerpt";excerpt.textContent=review.text;content.append(excerpt)}
  const actions=document.createElement("div");actions.className="lb-review-actions";
  const link=document.createElement("a");link.href=review.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="ليتربوكسد ↗";
  const use=document.createElement("button");use.type="button";use.dataset.reviewIndex=index;use.textContent="استخدم المراجعة";
  actions.append(link,use);card.append(content,actions);
  return card;
}
function renderLBPage(){
  const grid=$("#lbReviews"),toolbar=$("#lbToolbar");
  const list=lbFiltered();
  const pageCount=Math.max(1,Math.ceil(list.length/LB_PAGE_SIZE));
  lbPage=Math.max(0,Math.min(pageCount-1,lbPage));
  lbVisible=list.slice(lbPage*LB_PAGE_SIZE,(lbPage+1)*LB_PAGE_SIZE);
  if(toolbar)toolbar.hidden=!letterboxdReviews.length;
  const count=$("#lbCount"),info=$("#lbPageInfo"),prev=$("#lbPrev"),next=$("#lbNext");
  if(count)count.textContent=list.length===letterboxdReviews.length?letterboxdReviews.length+" فيلم":list.length+" من "+letterboxdReviews.length+" فيلم";
  if(info)info.textContent=(lbPage+1)+" / "+pageCount;
  if(prev)prev.disabled=lbPage<=0;
  if(next)next.disabled=lbPage>=pageCount-1;
  grid.replaceChildren();
  if(!lbVisible.length){
    const p=document.createElement("p");p.className="lb-empty";
    p.textContent=letterboxdReviews.length?"لا يوجد فيلم يطابق «"+lbQuery.trim()+"».":"لا توجد أفلام مقيّمة لهذا الملف.";
    grid.append(p);return;
  }
  const fragment=document.createDocumentFragment();
  lbVisible.forEach((review,index)=>fragment.append(lbCard(review,index)));
  grid.append(fragment);
}
function renderLB(rows){
  letterboxdReviews=rows;
  lbPage=0;
  renderLBPage();
}
function ratingValue(raw){
  if(raw===null||raw===undefined||raw==="")return null;
  const value=Number(raw);
  return Number.isFinite(value)&&value>=0.5&&value<=5?value:null;
}
function normalizeFilmKey(value){
  return String(value||"").normalize("NFKD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
}
function filmSlugFromUrl(value){
  try{
    const u=new URL(value);
    if(u.hostname!=="letterboxd.com"&&!u.hostname.endsWith(".letterboxd.com"))return "";
    const match=u.pathname.match(/\/film\/([^/]+)/i);
    return match?match[1].toLowerCase():"";
  }catch{return ""}
}
function normalizeRatingApiFilm(item){
  const title=String(item.name||item.title||item.film_title||"").trim();
  const rating=ratingValue(item.member_rating??item.memberRating??item.user_rating??item.rating);
  const slug=String(item.slug||item.film_slug||filmSlugFromUrl(item.link||item.url)||"").trim();
  const rawUrl=String(item.link||item.url||"");
  let url=slug?"https://letterboxd.com/film/"+encodeURIComponent(slug)+"/":"https://letterboxd.com/";
  try{const u=new URL(rawUrl);if(u.protocol==="https:"&&u.hostname==="letterboxd.com")url=u.href}catch{}
  return{
    guid:"letterboxd-rating-"+(slug||normalizeFilmKey(title)),
    slug,title,year:String(item.year||item.release_year||""),
    date:String(item.rated_date||item.date_rated||item.date||"").slice(0,10),
    rating,text:"",url,isReview:false,isDiaryEntry:true
  };
}
function parseMemberFilmsPage(markup,username,pageNumber){
  const doc=new DOMParser().parseFromString(markup,"text/html");
  let containers=[...doc.querySelectorAll("li.griditem")];
  if(!containers.length)containers=[...doc.querySelectorAll(".film-poster")].map(node=>node.closest("li,article")||node.parentElement||node);
  if(!containers.length){
    const title=doc.title||"";
    throw Error(/cloudflare|just a moment|access denied|attention required/i.test(title)
      ?"حجبت ليتربوكسد صفحة الأفلام العامة."
      :"لم يُعثر على بوسترات في صفحة ليتربوكسد "+pageNumber+".");
  }
  const films=containers.map(container=>{
    const meta=container.querySelector("[data-item-slug]")||container;
    const link=container.querySelector('a[href*="/film/"]');
    const img=container.querySelector("img[alt]");
    const rawHref=link?.getAttribute("href")||container.getAttribute("data-target-link")||meta.getAttribute("data-item-link")||"";
    const slugAttr=meta.getAttribute("data-item-slug")||container.getAttribute("data-film-slug")||"";
    const slug=(slugAttr||((rawHref.match(/\/film\/([^/?#]+)/i)||[])[1]||"")).toLowerCase();
    const nameAttr=meta.getAttribute("data-item-name")||container.getAttribute("data-film-name")||"";
    const title=String(img?.getAttribute("alt")||nameAttr||"").replace(/\s*\(\d{4}\)\s*$/,"").trim();
    const ratingNode=container.querySelector(".poster-viewingdata .rating")
      ||container.querySelector(".rating");
    const ratingClass=[
      ratingNode?.getAttribute("class")||"",
      container.querySelector('[class*="rated-"]')?.getAttribute("class")||""
    ].join(" ");
    const classMatch=ratingClass.match(/\brated-(\d{1,2})\b/i);
    let rating=null;
    if(classMatch){
      const halfStars=Number(classMatch[1]);
      if(halfStars>=1&&halfStars<=10)rating=halfStars/2;
    }
    if(rating===null&&ratingNode){
      const explicit=ratingNode.getAttribute("data-rating")||ratingNode.getAttribute("data-member-rating")||"";
      const parsed=Number(explicit);
      if(explicit!==""&&Number.isFinite(parsed)&&parsed>=0.5&&parsed<=5)rating=parsed;
    }
    const yearAttr=meta.getAttribute("data-item-full-display-name")
      ||container.getAttribute("data-film-release-year")
      ||container.getAttribute("data-film-year")
      ||"";
    const yearFromName=(String(yearAttr).match(/\((\d{4})\)/)||[])[1]||(nameAttr.match(/\((\d{4})\)/)||[])[1]||"";
    const yearFromSlug=(slug.match(/-(\d{4})$/)||[])[1]||"";
    let url=slug?"https://letterboxd.com/film/"+slug+"/":"https://letterboxd.com/"+encodeURIComponent(username)+"/films/";
    try{
      if(rawHref){
        const candidate=new URL(rawHref,"https://letterboxd.com");
        if(candidate.protocol==="https:"&&candidate.hostname==="letterboxd.com"&&/\/film\/[^/]+/.test(candidate.pathname))url=candidate.href;
      }
    }catch{}
    return{guid:"letterboxd-rating-"+slug,slug,title,year:String(yearFromName||yearFromSlug),date:"",rating,text:"",url,isReview:false,isDiaryEntry:true};
  }).filter(item=>item.title&&item.rating!==null);
  const pageNumbers=[];
  for(const node of doc.querySelectorAll(".paginate-page, a[href*='/films/'][href*='/page/']")){
    const textValue=String(node.textContent||"").trim();
    const number=Number(textValue);
    if(Number.isInteger(number)&&number>0)pageNumbers.push(number);
    const href=node.getAttribute?.("href")||"";
    const match=href.match(/\/films\/(?:by\/rated-date\/)?page\/(\d+)/);
    if(match)pageNumbers.push(Number(match[1]));
  }
  const lastPageLink=doc.querySelector("a[rel='last'][href*='/page/'], a.paginate-last[href*='/page/']");
  const lastMatch=(lastPageLink?.getAttribute("href")||"").match(/\/films\/(?:by\/rated-date\/)?page\/(\d+)/);
  if(lastMatch)pageNumbers.push(Number(lastMatch[1]));
  const totalPages=Math.max(1,...pageNumbers);
  return{films,totalPages,page:pageNumber};
}
function filmsPath(username,pageNumber,mode){
  const base="/"+encodeURIComponent(username)+"/films/"+(mode==="rated"?"by/rated-date/":"");
  return pageNumber===1?base:base+"page/"+pageNumber+"/";
}
async function fetchMemberFilmsPage(username,pageNumber,attempt=0,mode="rated"){
  const target="https://letterboxd.com"+filmsPath(username,pageNumber,mode);
  try{
    const body=await relay(target,markup=>/<html/i.test(markup)&&/film-poster|poster-container|griditem/i.test(markup));
    return parseMemberFilmsPage(body,username,pageNumber);
  }catch(error){
    const detail=String(error?.message||"Public page unavailable");
    if(attempt<1&&/403|429|blocking|blocked|timeout|failed/i.test(detail)){
      await new Promise(resolve=>setTimeout(resolve,900));
      return fetchMemberFilmsPage(username,pageNumber,attempt+1,mode);
    }
    if(/403|401|cloudflare|access denied|attention required|just a moment/i.test(detail)){
      throw Error("ليتربوكسد تحجب الوصول العام من هذه الشبكة الآن.");
    }
    if(/No film posters|لم يُعثر على بوسترات/i.test(detail))throw Error("أعادت ليتربوكسد صفحة بلا شبكة أفلام. أعد المحاولة بعد لحظة.");
    throw Error("تعذّرت قراءة صفحة أفلام ليتربوكسد "+pageNumber+"."+(window.relayLog?" Relays: "+window.relayLog.join(", "):""));
  }
}
async function fetchRatedLetterboxdFilms(username,onProgress=()=>{}){
  onProgress("جارٍ تحميل تقييماتك…");
  let mode="rated",first;
  try{first=await fetchMemberFilmsPage(username,1,1,mode)}
  catch(error){mode="default";first=await fetchMemberFilmsPage(username,1,0,mode)}
  const totalPages=Math.max(1,Number(first.totalPages)||1);
  const pages=[first];
  let failed=0;
  for(let page=2;page<=totalPages;page+=2){
    const batch=[];
    for(let n=page;n<Math.min(page+2,totalPages+1);n++)batch.push(n);
    onProgress("تحميل التقييمات · صفحة "+batch[0]+(batch.length>1?"–"+batch[batch.length-1]:"")+" من "+totalPages);
    const settled=await Promise.allSettled(batch.map(n=>fetchMemberFilmsPage(username,n,0,mode)));
    settled.forEach(result=>result.status==="fulfilled"?pages.push(result.value):failed++);
    if(page+2<=totalPages)await new Promise(resolve=>setTimeout(resolve,120));
  }
  const byKey=new Map();
  for(const page of pages){
    for(const film of page.films){
      const key=film.slug||normalizeFilmKey(film.title+"-"+film.year);
      if(!byKey.has(key))byKey.set(key,film);
    }
  }
  return{films:[...byKey.values()],totalPages,failed,mode};
}
function mergeRSSReviewText(ratedFilms,rssEntries){
  const bySlug=new Map(),byTitleYear=new Map();
  for(const entry of rssEntries||[]){
    const slug=entry.slug||filmSlugFromUrl(entry.url);
    if(slug)bySlug.set(slug,entry);
    byTitleYear.set(normalizeFilmKey(entry.title)+"-"+String(entry.year||""),entry);
  }
  return ratedFilms.map(film=>{
    const fromRSS=(film.slug&&bySlug.get(film.slug))||byTitleYear.get(normalizeFilmKey(film.title)+"-"+String(film.year||""));
    return fromRSS?{...film,text:fromRSS.text||"",date:fromRSS.date||film.date||"",guid:film.guid||fromRSS.guid}:film;
  });
}
async function loadLB(e){
  e.preventDefault();
  const username=normalizeLB($("#lbUsername").value),button=$("#lbLoad");
  if(!username){status("#lbStatus","أدخل اسم مستخدم ليتربوكسد.","error");return}
  lbQuery="";lbPage=0;
  const searchField=$("#lbSearch");if(searchField)searchField.value="";
  button.disabled=true;button.textContent="جارٍ التحميل…";
  status("#lbStatus","جارٍ البحث عن تقييماتك الحديثة…");
  safeStore.set("framix.lb",username);
  const feedUrl="https://letterboxd.com/"+encodeURIComponent(username)+"/rss/";
  const rssPromise=fetchPublicText(feedUrl,text=>/<rss[\s>]/i.test(text)&&/<channel[\s>]/i.test(text),"خلاصة ليتربوكسد")
    .then(xml=>parseRSS(xml,username));
  const ratingsPromise=fetchRatedLetterboxdFilms(username,message=>status("#lbStatus",message));
  let rssEntries=[];
  try{
    rssEntries=await rssPromise;
    if(rssEntries.length){
      letterboxdReviews=rssEntries;renderLB(letterboxdReviews);
      status("#lbStatus","حُمّلت التقييمات الحديثة. جارٍ تحميل البقية…","success");
    }
  }catch(error){console.info("Recent feed was unavailable",error)}
  try{
    const result=await ratingsPromise;
    letterboxdReviews=mergeRSSReviewText(result.films,rssEntries);
    if(result.mode!=="rated"){
      const dated=letterboxdReviews.filter(review=>review.date).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      const undated=letterboxdReviews.filter(review=>!review.date);
      letterboxdReviews=[...dated,...undated];
    }
    renderLB(letterboxdReviews);
    const partial=result.failed?" (تم تخطي "+result.failed+" صفحة)":"";
    const order=result.mode!=="rated"&&rssEntries.length?" · الأحدث أولًا":"";
    status("#lbStatus",letterboxdReviews.length
      ?"تم تحميل "+letterboxdReviews.length+" فيلمًا مقيّمًا"+partial+order+"."
      :"لا توجد أفلام مقيّمة. تأكد أن الملف عام.",
      letterboxdReviews.length?"success":"error");
  }catch(error){
    if(!rssEntries.length){
      try{rssEntries=await rssPromise}catch(feedError){console.info("Letterboxd feed unavailable",feedError)}
    }
    letterboxdReviews=rssEntries;
    if(letterboxdReviews.length){
      renderLB(letterboxdReviews);
      status("#lbStatus","عرض "+letterboxdReviews.length+" تقييمًا حديثًا. عُد لاحقًا للرف الكامل.","success");
    }else{
      letterboxdReviews=[];renderLB([]);
      const errorText=String(error?.message||"خدمة التقييمات غير متاحة");
      if(/blocking|refusing|401|403/i.test(errorText))
        status("#lbStatus","ليتربوكسد تحجب الوصول الآلي من هذه الشبكة الآن. صناعة البطاقة تعمل — أعد الاستيراد بعد دقائق.","error");
      else if(/without a film grid|unexpected|read Letterboxd/i.test(errorText))
        status("#lbStatus","أعادت ليتربوكسد صفحة تعذّرت قراءتها. أعد المحاولة بعد لحظة.","error");
      else
        status("#lbStatus","تعذّر تحميل التقييمات. تحقق من الاسم وأعد المحاولة بعد لحظة.","error");
    }
    console.warn("Letterboxd import failed",error);
  }finally{button.disabled=false;button.textContent="حمّل التقييمات ↗"}
}
async function fetchImage(url){
  let lastError=null;
  const targets=[...(proxyBase()?[proxyBase()+"/?url="+encodeURIComponent(url)]:[]),url,"https://proxy.cors.dev/"+url,"https://api.allorigins.win/raw?url="+encodeURIComponent(url)];
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
function setMode(mode){authMode=mode;$$("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));$("#authHeading").innerHTML=mode==="signup"?"اجعله <em>شخصيًا.</em>":"أهلًا <em>بعودتك.</em>";$("#authDescription").textContent=mode==="signup"?"أنشئ حسابًا ببريدك وكلمة مرور قوية.":"سجّل الدخول إلى حساب فراميكس.";$("#authSubmit").innerHTML=mode==="signup"?"إنشاء حساب →":"تسجيل الدخول →";$("#authPassword").autocomplete=mode==="signup"?"new-password":"current-password";$("#forgotPassword").hidden=mode!=="signin";setMsg("")}
function updateAuth(session){const email=session?.user?.email;$("#accountLabel").textContent=email?"مسجّل الدخول · "+email:"مفكرة أفلامك، بإطار جديد." ;$("#authOpen").hidden=!!email;$("#signOut").hidden=!email}
function configureAuth(){const c=window.FRAMIX_CONFIG||{};if(!c.supabaseUrl||!c.supabaseAnonKey||!window.supabase?.createClient){$("#authFields").hidden=true;$("#authSetupNote").hidden=false;return}try{client=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey)}catch(e){console.warn(e)}if(!client){$("#authFields").hidden=true;$("#authSetupNote").hidden=false;return}$("#authFields").hidden=false;$("#authSetupNote").hidden=true;client.auth.getSession().then(({data})=>updateAuth(data?.session||null)).catch(()=>updateAuth(null));client.auth.onAuthStateChange((_e,session)=>updateAuth(session));if(new URLSearchParams(location.hash.slice(1)).get("type")==="recovery")$("#resetDialog").showModal()}

/* ---------- Wiring ---------- */
$("#backdropReset")?.addEventListener("click",()=>{
  if(backObjectUrl)URL.revokeObjectURL(backObjectUrl);
  backdropLoadSequence++;
  backObjectUrl=null;back=null;activeBackdropPath="";
  refreshBackdropSelection();paint();
  setTMDBStatus("الخلفية تستخدم البوستر الآن.","success");
});
$("#tmdbSaveKey").addEventListener("click",()=>{
 const key=val("#tmdbKey");
 if(!key){safeStore.set("framix.tmdbKey","");setTMDBStatus("تم مسح مفتاح TMDB من هذا المتصفح.");return}
 safeStore.set("framix.tmdbKey",key);$("#tmdbKey").value=key;
 setTMDBStatus("حُفظ مفتاح TMDB محليًا. جارٍ البحث عن الفيلم الحالي…","success");
 void autoFindTMDBForReview({title:val("#filmTitle"),year:val("#filmYear"),mediaHint:lastReviewMediaHint});
});
$("#tmdbSearch").addEventListener("click",searchTMDB);
$$(".arrow-field").forEach(field=>{
  const select=field.querySelector("select");if(!select)return;
  field.querySelectorAll(".arrow-nav").forEach(button=>{
    button.addEventListener("click",()=>{
      const total=select.options.length;if(!total)return;
      const step=Number(button.dataset.step)||1;
      select.selectedIndex=(select.selectedIndex+step+total)%total;
      select.dispatchEvent(new Event("change",{bubbles:true}));
    });
  });
});
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
    if(!blob){$("#previewStatus").textContent="فشل التصدير — حاول مجددًا";return}
    const url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;const slug=val("#filmTitle").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50);anchor.download="framix-story-"+(slug||"card")+".png";
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1200);$("#previewStatus").textContent="تم تنزيل الستوري ✓";
  },"image/png");
});
$("#letterboxdForm").addEventListener("submit",loadLB);
$("#lbLoad").addEventListener("click",e=>{e.preventDefault();void loadLB({preventDefault(){}})});
$("#lbSearch").addEventListener("input",event=>{lbQuery=event.target.value;lbPage=0;renderLBPage()});
$("#lbPrev").addEventListener("click",()=>{if(lbPage>0){lbPage--;renderLBPage()}});
$("#lbNext").addEventListener("click",()=>{lbPage++;renderLBPage()});
$("#lbToolbar").addEventListener("keydown",event=>{
  if(event.target.id==="lbSearch")return;
  if(event.key==="ArrowLeft"){event.preventDefault();if(lbPage>0){lbPage--;renderLBPage()}}
  else if(event.key==="ArrowRight"){event.preventDefault();lbPage++;renderLBPage()}
});
$("#lbReviews").addEventListener("click",event=>{
 const button=event.target.closest("button[data-review-index]");if(!button)return;
 const review=lbVisible[Number(button.dataset.reviewIndex)];if(!review)return;
 $("#filmTitle").value=review.title.slice(0,100);
 $("#filmYear").value=[review.year,review.date?"شوهد "+review.date:""].filter(Boolean).join(" · ").slice(0,60);
 if(review.rating!==null){
   $("#rating").value=String([...$("#rating").options].map(option=>+option.value).sort((a,b)=>Math.abs(a-review.rating)-Math.abs(b-review.rating))[0]);
 }
 $("#reviewText").value=review.text||"";$("#showReview").checked=!!review.text;
 const who=normalizeLB($("#lbUsername").value),nameField=$("#reviewerName");if(who&&nameField)nameField.value=who;
 render();
 $("#studio").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 lastReviewMediaHint="movie";void autoFindTMDBForReview({title:review.title,year:review.year,mediaHint:lastReviewMediaHint});
});
$("#authOpen").addEventListener("click",()=>{setMode("signin");$("#authDialog").showModal()});$("#authClose").addEventListener("click",()=>$("#authDialog").close());$("#resetClose").addEventListener("click",()=>$("#resetDialog").close());$$("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();if(!client){$("#authSetupNote").hidden=false;$("#authFields").hidden=true;return}const email=val("#authEmail"),password=$("#authPassword").value,button=$("#authSubmit");button.disabled=true;setMsg(authMode==="signup"?"جارٍ إنشاء الحساب…":"جارٍ تسجيل الدخول…");try{const r=authMode==="signup"?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;if(authMode==="signup"&&!r.data.session)setMsg("تم إنشاء الحساب. تحقق من بريدك لتأكيد العنوان.");else{setMsg("تم تسجيل الدخول.");setTimeout(()=>$("#authDialog").close(),650)}}catch(e){setMsg(e.message||"فشل تسجيل الدخول. تحقق من بياناتك.",true)}finally{button.disabled=false}});
$("#forgotPassword").addEventListener("click",async()=>{if(!client){setMsg("أعدّ Supabase أولًا.",true);return}const email=val("#authEmail");if(!email){setMsg("أدخل بريدك أولًا.",true);$("#authEmail").focus();return}try{const{error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;setMsg("إذا كان الحساب موجودًا فقد أُرسل بريد الاستعادة.")}catch(e){setMsg(e.message||"تعذّر طلب الاستعادة.",true)}});
$("#resetForm").addEventListener("submit",async e=>{e.preventDefault();const el=$("#resetMessage");if(!client){el.textContent="أعدّ Supabase أولًا.";return}try{const{error}=await client.auth.updateUser({password:$("#newPassword").value});if(error)throw error;el.textContent="تم تحديث كلمة المرور."}catch(e){el.textContent=e.message||"تعذّر تحديث كلمة المرور.";el.classList.add("error")}});
$("#signOut").addEventListener("click",async()=>{if(!client)return;const{error}=await client.auth.signOut();if(error){$("#accountLabel").textContent="تعذّر تسجيل الخروج.";return}updateAuth(null)});
window.addEventListener("resize",()=>{
  if(!$("#tmdbPosterOptionsWrap").hidden)updateCarouselUI(false,"poster");
  if(!$("#tmdbBackdropOptionsWrap").hidden)updateCarouselUI(false,"backdrop");
});

/* Small debug/verification hook (no UI) */
window.FramixStudio={
  paint,
  parseMemberFilmsPage,
  fetchMemberFilmsPage,
  proxyBase,
  setArtwork(posterSrc,backdropSrc){
    const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>resolve(i);i.onerror=()=>reject(Error("load failed"));i.src=src});
    return Promise.all([posterSrc?load(posterSrc):Promise.resolve(null),backdropSrc?load(backdropSrc):Promise.resolve(null)])
      .then(([p,b])=>{if(p)poster=p;if(b)back=b;paint()}).catch(e=>console.warn("setArtwork failed",e));
  }
};

/* ---------- Init ---------- */
const savedTMDBKey=tmdbKey();if(savedTMDBKey)$("#tmdbKey").value=savedTMDBKey;
$$(".hero-frame img").forEach(img=>{
  const hide=()=>{img.hidden=true};
  img.addEventListener("error",hide);
  if(img.complete&&img.naturalWidth===0)hide();
});
buildStyleChips();
syncThemeOptions(false);
const lb=safeStore.get("framix.lb");if(lb)$("#lbUsername").value=lb;
paint();configureAuth();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>paint());
})();

