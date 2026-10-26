/* Set these two values after creating a Supabase project. Never put Letterboxd secrets here. */
const AUTH={supabaseUrl:'',supabaseAnonKey:''};
const $=s=>document.querySelector(s),dialog=$('#authDialog'),profileDialog=$('#profileDialog');
let source='letterboxd';
const storage={get:k=>{try{return localStorage.getItem(k)||''}catch{return''}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};

function openProfile(which){
  source=which;const letterboxd=which==='letterboxd';
  $('#profileEyebrow').textContent=letterboxd?'LETTERBOXD / PUBLIC PROFILE':'SERIALIZD / PUBLIC PROFILE';
  $('#profileTitle').textContent=letterboxd?'Choose your latest thought.':'Add your TV profile.';
  $('#profileCopy').textContent=letterboxd?'Enter a public username. Your latest written reviews stay on Letterboxd; Reelnote only reads what is already public.':'Serializd has no official account-linking flow. Save a public profile URL or username here; private data is never requested.';
  $('#profileLabel').firstChild.textContent=letterboxd?'Letterboxd username':'Serializd profile URL or username';
  $('#profileHandle').value=storage.get(which+'Handle');$('#profileHandle').placeholder=letterboxd?'your-letterboxd-name':'your-serializd-name';
  $('#profileNote').textContent=letterboxd?'Latest reviews are loaded through this site’s server route, not directly in your browser.':'Public-profile support is saved for your workspace; an official Serializd OAuth connection is not currently available.';
  profileDialog.showModal();$('#profileHandle').focus();
}
function showReviews(reviews){
  const grid=$('#reviewGrid');grid.innerHTML='';
  reviews.forEach(r=>{const a=document.createElement('article');a.className='review';a.innerHTML=`<div class="review-meta"><span>${escapeHtml(r.date||'RECENT')}</span><span>${'★'.repeat(Math.round(r.rating||0))}</span></div><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.text)}</p><a class="outline" href="card-maker.html?review=${encodeURIComponent(r.url)}">Make a card <span>→</span></a>`;grid.appendChild(a)});
  $('#emptyState').hidden=true;grid.hidden=false;$('#refresh').hidden=false;
}
function escapeHtml(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}
async function loadLetterboxd(username){
  $('#emptyState').innerHTML='<span class="empty-glyph">◌</span><h3>Finding your latest reviews…</h3><p>This can take a moment.</p>';
  $('#emptyState').hidden=false;$('#reviewGrid').hidden=true;
  try{let res=await fetch('/api/reviews?username='+encodeURIComponent(username));if(!res.ok)throw new Error();let data=await res.json();if(!data.reviews?.length)throw new Error('empty');showReviews(data.reviews)}catch(e){try{const feed='https://letterboxd.com/'+encodeURIComponent(username)+'/rss/';const res=await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent(feed));if(!res.ok)throw new Error();const xml=await res.text(),doc=new DOMParser().parseFromString(xml,'text/xml');const reviews=[...doc.querySelectorAll('item')].map(i=>{const v=t=>i.querySelector(t)?.textContent.trim()||'';const html=v('description').replace(/<p>\s*<img[^>]*>\s*<\/p>/gi,'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').trim();return {guid:v('guid'),url:v('link'),title:v('letterboxd\\:filmTitle'),date:v('letterboxd\\:watchedDate'),rating:Number(v('letterboxd\\:memberRating')),text:html}}).filter(r=>/letterboxd-review-/i.test(r.guid)&&r.text&&r.title).slice(0,12);if(!reviews.length)throw new Error();showReviews(reviews)}catch(err){$('#emptyState').innerHTML='<span class="empty-glyph">!</span><h3>Couldn’t load public reviews.</h3><p>Check the username, then try again. The public RSS service may also be temporarily unavailable.</p><button class="primary small" id="retry">Try again <span>→</span></button>';$('#retry').onclick=()=>loadLetterboxd(username)}}}

$('#openAuth').onclick=()=>dialog.showModal();$('#start').onclick=()=>openProfile('letterboxd');$('#emptyConnect').onclick=()=>openProfile('letterboxd');
document.querySelectorAll('.connect').forEach(b=>b.onclick=()=>openProfile(b.dataset.source));
$('#refresh').onclick=()=>loadLetterboxd(storage.get('letterboxdHandle'));
$('#saveProfile').onclick=e=>{e.preventDefault();const value=$('#profileHandle').value.trim().replace(/^https?:\/\/(www\.)?letterboxd\.com\//,'').replace(/^@/,'').replace(/\/$/,'');if(!value)return;storage.set(source+'Handle',value);profileDialog.close();if(source==='letterboxd'){ $('#lbState').textContent='Connected: @'+value;loadLetterboxd(value)}else $('#szState').textContent='Saved profile'};
$('#emailSignIn').onclick=async e=>{e.preventDefault();const email=$('#email').value.trim();if(!email)return;if(!AUTH.supabaseUrl||!AUTH.supabaseAnonKey){$('#authNote').textContent='Add your Supabase URL and publishable key in app.js, then email sign-in will be live.';return}try{const r=await fetch(AUTH.supabaseUrl+'/auth/v1/otp',{method:'POST',headers:{'apikey':AUTH.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true,email_redirect_to:location.href})});if(!r.ok)throw new Error();$('#authNote').textContent='Check your inbox for your secure sign-in link.'}catch{$('#authNote').textContent='Could not send the sign-in link. Check the Supabase settings.'}};
const existing=storage.get('letterboxdHandle');if(existing){$('#lbState').textContent='Connected: @'+existing;loadLetterboxd(existing)}
