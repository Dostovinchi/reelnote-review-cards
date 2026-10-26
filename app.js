(() => {
"use strict";
const $=s=>document.querySelector(s), canvas=$("#cardCanvas"),ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height;
const themes={noir:{bg:"#171715",ink:"#f4f0e7",muted:"#c6c0b4",accent:"#c4a36a",overlay:"rgba(10,10,9,.56)"},wine:{bg:"#351f28",ink:"#f7e9e5",muted:"#d4b9bb",accent:"#e9a28e",overlay:"rgba(30,10,18,.58)"},paper:{bg:"#e8e0d2",ink:"#25231f",muted:"#656056",accent:"#9c563f",overlay:"rgba(40,35,29,.23)"},olive:{bg:"#272c21",ink:"#f0eedf",muted:"#c3c5b3",accent:"#b7b88b",overlay:"rgba(15,19,12,.55)"}};
let poster=null,client=null,authMode="signin",letterboxdReviews=[];
const value=s=>$(s).value.trim(),themeName=()=>document.querySelector('input[name="theme"]:checked')?.value||"noir";
function cover(img){const scale=Math.max(W/img.width,H/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h)}
function lines(text,maxWidth,maxLines){const words=text.split(/\s+/).filter(Boolean),out=[];let line="";for(const word of words){const next=line?line+" "+word:word;if(line&&ctx.measureText(next).width>maxWidth){out.push(line);line=word}else line=next}if(line)out.push(line);if(out.length>maxLines){out.length=maxLines;out[maxLines-1]=out[maxLines-1].replace(/[.,;:\s]+$/,"")+"…"}return out}
function block(text,x,y,width,lineHeight,maxLines){const ls=[];text.split(/\n+/).filter(Boolean).forEach(p=>ls.push(...lines(p,width,maxLines)));const show=ls.slice(0,maxLines);if(ls.length>maxLines)show[maxLines-1]=show[maxLines-1].replace(/[.,;:\s]+$/,"")+"…";show.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));return y+show.length*lineHeight}
function render(){const t=themes[themeName()],title=value("#filmTitle")||"Untitled",meta=value("#filmYear"),review=$("#showReview").checked?value("#reviewText"):"",showRating=$("#showRating").checked,rating=Number($("#rating").value);ctx.clearRect(0,0,W,H);ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);
if(poster){cover(poster);ctx.fillStyle=t.overlay;ctx.fillRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"rgba(0,0,0,.04)");g.addColorStop(.42,t.overlay);g.addColorStop(1,t.bg);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}else{const g=ctx.createRadialGradient(W*.72,H*.24,10,W*.72,H*.24,W*.8);g.addColorStop(0,t.accent+"66");g.addColorStop(1,t.bg);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle=t.accent+"44";ctx.lineWidth=2;[300,350].forEach(r=>{ctx.beginPath();ctx.arc(W*.72,H*.24,r,0,Math.PI*2);ctx.stroke()})}
const m=76;ctx.textAlign="left";ctx.textBaseline="top";ctx.fillStyle=t.ink;ctx.font="500 22px 'DM Mono',monospace";ctx.fillText("FRAMIX / PERSONAL FILM JOURNAL",m,68);ctx.textAlign="right";ctx.fillStyle=t.accent;ctx.fillText("NO. 001",W-m,68);
const bottom=poster?H*.47:H*.39;ctx.strokeStyle=t.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(m,bottom);ctx.lineTo(W-m,bottom);ctx.stroke();let y=bottom+38;ctx.textAlign="left";ctx.fillStyle=t.accent;ctx.font="500 21px 'DM Mono',monospace";ctx.fillText("RECENTLY WATCHED",m,y);y+=48;ctx.fillStyle=t.ink;ctx.font="800 70px Manrope,sans-serif";y=block(title,m,y,W-m*2,80,2)+8;if(meta){ctx.fillStyle=t.muted;ctx.font="500 25px 'DM Sans',sans-serif";y=block(meta,m,y,W-m*2,34,1)+32}else y+=18;
if(showRating){ctx.fillStyle=t.accent;ctx.font="500 42px 'DM Sans',sans-serif";ctx.fillText("★".repeat(Math.floor(rating))+(rating%1?"½":""),m,y);ctx.fillStyle=t.muted;ctx.font="500 21px 'DM Mono',monospace";ctx.fillText(rating.toFixed(1)+" / 5",m,y+56);y+=94}if(review){ctx.fillStyle=t.ink;ctx.font="500 31px 'DM Sans',sans-serif";block("“"+review+"”",m,y,W-m*2,43,4)}
ctx.strokeStyle=t.accent+"88";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(m,H-108);ctx.lineTo(W-m,H-108);ctx.stroke();ctx.fillStyle=t.muted;ctx.font="500 17px 'DM Mono',monospace";ctx.textAlign="left";ctx.fillText("EVERY STORY LEAVES A FRAME.",m,H-76);ctx.textAlign="right";ctx.fillStyle=t.accent;ctx.fillText("FRAMIX © 2026",W-m,H-76);$("#previewStatus").textContent=poster?"ARTWORK LOADED ↗":"READY TO FRAME ↗"}
function setMessage(msg,error=false){const e=$("#authMessage");e.textContent=msg;e.classList.toggle("error",error)}
function setMode(mode){authMode=mode;document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));$("#authHeading").innerHTML=mode==="signup"?"Make it <em>personal.</em>":"Welcome <em>back.</em>";$("#authDescription").textContent=mode==="signup"?"Create an account with your email and a strong password. You may need to verify your email.":"Sign in to your Framix account. Card creation works without an account.";$("#authSubmit").textContent=mode==="signup"?"Create account →":"Sign in →";$("#authPassword").autocomplete=mode==="signup"?"new-password":"current-password";$("#forgotPassword").hidden=mode!=="signin";setMessage("")}
function updateAuth(session){const email=session?.user?.email;$("#accountLabel").textContent=email?"Signed in · "+email:"Your film journal, reframed." ;$("#authOpen").hidden=!!email;$("#signOut").hidden=!email}
function configureAuth(){const c=window.FRAMIX_CONFIG||{};if(!c.supabaseUrl||!c.supabaseAnonKey||!window.supabase?.createClient)return;try{client=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey)}catch(e){console.error(e)}if(client){client.auth.getSession().then(({data})=>updateAuth(data?.session||null));client.auth.onAuthStateChange((_event,session)=>updateAuth(session));if(new URLSearchParams(location.hash.slice(1)).get("type")==="recovery")$("#resetDialog").showModal()}}

// Import only public Letterboxd RSS entries. This stays on the free static host;
// the no-key CORS relay is only used for anonymous public GET requests.
function normalizeLetterboxdUsername(input){
 let raw=String(input||"").trim().replace(/^@/,"");
 raw=raw.replace(/^https?:\/\/(?:www\.)?letterboxd\.com\//i,"");
 raw=raw.replace(/\/(?:rss\/?)?$/i,"");
 raw=raw.split(/[?#/]/)[0].replace(/^@/,"");
 return /^[A-Za-z0-9_]{2,30}$/.test(raw)?raw:"";
}
function rssTag(root,name){
 const all=[...root.getElementsByTagName("*")];
 const found=all.find(el=>el.localName===name);
 return found?.textContent?.trim()||"";
}
function plainReviewText(raw){
 const doc=new DOMParser().parseFromString("<!doctype html><html><body>"+String(raw||"")+"</body></html>","text/html");
 doc.querySelectorAll("script,style").forEach(n=>n.remove());
 doc.querySelectorAll("img").forEach(n=>{const p=n.closest("p");if(p)p.remove();else n.remove()});
 doc.querySelectorAll("br").forEach(n=>n.replaceWith(document.createTextNode("\n")));
 doc.querySelectorAll("p,div").forEach(n=>{if(n.textContent.trim())n.append(document.createTextNode("\n"))});
 return (doc.body.textContent||"").replace(/\u00a0/g," ").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function parseLetterboxdRSS(xmlText,username){
 const xml=new DOMParser().parseFromString(xmlText,"application/xml");
 if(xml.querySelector("parsererror"))throw new Error("Letterboxd returned an unreadable RSS feed.");
 return [...xml.getElementsByTagName("item")].map(item=>{
   const guid=rssTag(item,"guid"),title=rssTag(item,"filmTitle"),year=rssTag(item,"filmYear");
   const rawRating=rssTag(item,"memberRating"),rating=rawRating!==""&&Number.isFinite(Number(rawRating))?Number(rawRating):null;
   const rawDate=rssTag(item,"watchedDate")||rssTag(item,"pubDate").slice(0,10);
   const rawUrl=rssTag(item,"link");
   let reviewUrl="https://letterboxd.com/"+encodeURIComponent(username)+"/";
   try{const parsed=new URL(rawUrl);if(parsed.protocol==="https:"&&parsed.hostname==="letterboxd.com")reviewUrl=parsed.href}catch{}
   return {guid,title,year,date:rawDate,rating,text:plainReviewText(rssTag(item,"description")),url:reviewUrl};
 }).filter(review=>/letterboxd-review-/i.test(review.guid)&&review.title).slice(0,12);
}
function renderLetterboxdReviews(reviews,username){
 const grid=$("#lbReviews");grid.replaceChildren();
 if(!reviews.length){const empty=document.createElement("p");empty.className="lb-empty";empty.textContent="No recent written reviews were found in this public feed. Check the username or open your public Letterboxd diary.";grid.append(empty);return}
 reviews.forEach((review,index)=>{
   const card=document.createElement("article");card.className="lb-review-card";
   const meta=document.createElement("div");meta.className="lb-review-meta";
   const date=document.createElement("span");date.textContent=review.date?("WATCHED · "+review.date):"PUBLIC REVIEW";
   const stars=document.createElement("span");stars.className="lb-stars";stars.textContent=review.rating===null?"UNRATED":("★".repeat(Math.floor(review.rating))+(review.rating%1?"½":"")+" "+review.rating.toFixed(1)+"/5");
   meta.append(date,stars);
   const title=document.createElement("h3");title.textContent=review.title;
   const year=document.createElement("p");year.className="lb-year";year.textContent=review.year?"FILM YEAR · "+review.year:"FROM YOUR LETTERBOXD DIARY";
   const excerpt=document.createElement("p");excerpt.className="lb-excerpt";excerpt.textContent=review.text||"This review has no written note. You can still import its film details.";
   const actions=document.createElement("div");actions.className="lb-review-actions";
   const link=document.createElement("a");link.href=review.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open on Letterboxd ↗";
   const use=document.createElement("button");use.type="button";use.dataset.reviewIndex=String(index);use.textContent="Use this review ↓";
   actions.append(link,use);card.append(meta,title,year,excerpt,actions);grid.append(card);
 });
}
async function loadLetterboxdReviews(event){
 event.preventDefault();
 const username=normalizeLetterboxdUsername($("#lbUsername").value);
 const status=$("#lbStatus"),button=$("#lbLoad");
 status.classList.remove("error");
 if(!username){status.textContent="Enter a valid public Letterboxd username or profile URL.";status.classList.add("error");return}
 button.disabled=true;status.textContent="Looking for public written reviews…";$("#lbReviews").replaceChildren();
 const feedUrl="https://letterboxd.com/"+encodeURIComponent(username)+"/rss/";
 const attempts=[
   async()=>fetch("https://proxy.cors.dev/"+feedUrl,{credentials:"omit",headers:{Accept:"application/rss+xml, application/xml, text/xml, */*"}}),
   async()=>fetch("https://api.allorigins.win/raw?url="+encodeURIComponent(feedUrl),{credentials:"omit"})
 ];
 let lastError=null;
 try{
   let xmlText="";
   for(const attempt of attempts){
     try{const response=await attempt();if(!response.ok)throw new Error("Free RSS relay returned HTTP "+response.status);xmlText=await response.text();if(!xmlText.includes("<rss")&&!xmlText.includes("<feed"))throw new Error("The returned content was not an RSS feed.");break}
     catch(err){lastError=err;xmlText=""}
   }
   if(!xmlText)throw lastError||new Error("The RSS feed could not be loaded.");
   letterboxdReviews=parseLetterboxdRSS(xmlText,username);
   renderLetterboxdReviews(letterboxdReviews,username);
   status.textContent=letterboxdReviews.length?"Found "+letterboxdReviews.length+" recent public written reviews for @"+username+". Choose one to fill the card editor.":"No recent written reviews were found for @"+username+".";
   if(!letterboxdReviews.length)status.classList.add("error");
 }catch(err){
   status.textContent="Could not load this public feed right now. Double-check the username or try again later; the free public relay can occasionally be busy.";
   status.classList.add("error");console.warn("Letterboxd RSS load failed",lastError||err);
 }finally{button.disabled=false}
}
$("#letterboxdForm").addEventListener("submit",loadLetterboxdReviews);
$("#lbReviews").addEventListener("click",event=>{
 const button=event.target.closest("button[data-review-index]");if(!button)return;
 const review=letterboxdReviews[Number(button.dataset.reviewIndex)];if(!review)return;
 $("#filmTitle").value=review.title.slice(0,100);
 $("#filmYear").value=[review.year,review.date?"Watched "+review.date:""].filter(Boolean).join(" · ").slice(0,60);
 if(review.rating!==null&&[...$("#rating").options].some(option=>Number(option.value)===review.rating)){
   $("#rating").value=String(review.rating);$("#showRating").checked=true;
 }else{$("#showRating").checked=false}
 $("#reviewText").value=(review.text||"").slice(0,360);$("#showReview").checked=Boolean(review.text);
 $("#charCount").textContent=$("#reviewText").value.length+" / 360";
 $("#cardForm").dispatchEvent(new Event("input",{bubbles:true}));
 $("#studio").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 $("#previewStatus").textContent="LETTERBOXD REVIEW IMPORTED ✓";
});

$("#cardForm").addEventListener("input",()=>{$("#charCount").textContent=$("#reviewText").value.length+" / 360";render()});$("#cardForm").addEventListener("change",render);
$("#posterUpload").addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;if(!["image/jpeg","image/png","image/webp"].includes(f.type)){ $("#uploadTitle").textContent="Unsupported file type";return}if(f.size>12*1024*1024){$("#uploadTitle").textContent="Image too large (max 12 MB)";return}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{poster=img;$("#uploadTitle").textContent=f.name.length>26?f.name.slice(0,23)+"…":f.name;render()};img.src=reader.result};reader.readAsDataURL(f)});
$("#downloadCard").addEventListener("click",()=>{render();canvas.toBlob(blob=>{if(!blob){$("#previewStatus").textContent="EXPORT FAILED — TRY AGAIN";return}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="framix-"+(value("#filmTitle")||"review").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$("#previewStatus").textContent="YOUR FRAME IS READY ✓"},"image/png")});
$("#authOpen").addEventListener("click",()=>{setMode("signin");$("#authDialog").showModal()});$("#authClose").addEventListener("click",()=>$("#authDialog").close());$("#resetClose").addEventListener("click",()=>$("#resetDialog").close());document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();if(!client){setMessage("Sign-in isn't configured yet. Add your Supabase project URL and publishable key in config.js, then enable email auth in Supabase.",true);return}const email=value("#authEmail"),password=$("#authPassword").value,button=$("#authSubmit");button.disabled=true;setMessage(authMode==="signup"?"Creating your account…":"Signing in…");try{const r=authMode==="signup"?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;if(authMode==="signup"&&!r.data.session)setMessage("Account created. Check your email to verify your address before signing in.");else{setMessage("You're signed in.");setTimeout(()=>$("#authDialog").close(),700)}}catch(err){setMessage(err.message||"Could not complete sign-in. Check your details and try again.",true)}finally{button.disabled=false}});
$("#forgotPassword").addEventListener("click",async()=>{if(!client){setMessage("Password recovery becomes available after Supabase is configured.",true);return}const email=value("#authEmail");if(!email){setMessage("Enter your email address first.",true);$("#authEmail").focus();return}try{const{error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;setMessage("If an account exists for that email, a recovery link has been sent.")}catch(err){setMessage(err.message||"Could not request password recovery.",true)}});
$("#resetForm").addEventListener("submit",async e=>{e.preventDefault();const el=$("#resetMessage");if(!client){el.textContent="Supabase is not configured.";return}try{const{error}=await client.auth.updateUser({password:$("#newPassword").value});if(error)throw error;el.textContent="Password updated. You can close this dialog and continue."}catch(err){el.textContent=err.message||"Could not update the password.";el.classList.add("error")}});
$("#signOut").addEventListener("click",async()=>{if(!client)return;const{error}=await client.auth.signOut();if(error){$("#accountLabel").textContent="Could not sign out. Try again.";return}updateAuth(null)});
$("#charCount").textContent=$("#reviewText").value.length+" / 360";render();configureAuth();
})();