import { App } from "../home/home.js";
const {$,$$,esc,fillFaculty,teams,partners,createRequest,toast,openModal,closeModals,icons,teamCardSearch,partnerCardSearch}=App;
let tab="teams",specFilter="all",pendingTo=null,cache=[];

async function initSearch(){
  fillFaculty($("#fFaculty"),true);
  const urlTab=new URLSearchParams(location.search).get("tab");
  setTab(urlTab==="partners"?"partners":"teams");
  $$("#searchTabs .seg-btn").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
  ["#q","#fFaculty","#fSort"].forEach(s=>{const el=$(s);el.addEventListener(el.tagName==="INPUT"?"input":"change",render)});
  $("#sendReq").addEventListener("click",sendRequest);
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-req]");if(!b)return;
    pendingTo={code:b.dataset.req,name:b.dataset.name};
    $("#reqTo").textContent=b.dataset.name;
    $("#reqMsg").value="";
    openModal("reqModal");
  });
  await load();
}
async function load(){
  const g=$("#results");
  g.innerHTML=`<div class="empty"><div class="empty-ico"><i data-lucide="loader-2" class="spin"></i></div><h3>جارٍ التحميل…</h3></div>`;icons();
  try{cache=await(tab==="teams"?teams():partners())}
  catch(err){console.error(err);g.innerHTML=`<div class="empty"><div class="empty-ico"><i data-lucide="wifi-off"></i></div><h3>تعذّر التحميل</h3><p>أعد المحاولة.</p></div>`;icons();return}
  buildSpecChips();render();
}
function setTab(t){
  tab=t;specFilter="all";
  $("#q").value="";$("#fFaculty").value="all";$("#fSort").value="newest"; // يصفّر الفلاتر العالقة
  $$("#searchTabs .seg-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));
  load();
}
function buildSpecChips(){
  const all=tab==="teams"?[...new Set(cache.flatMap(a=>a.neededSpecialties||[]))]:[...new Set(cache.map(a=>a.specialty).filter(Boolean))];
  all.sort((a,b)=>a.localeCompare(b,"ar"));
  const box=$("#specChips");
  box.innerHTML=`<button type="button" class="spec-chip ${specFilter==="all"?"active":""}" data-spec="all">الكل</button>`+all.map(f=>`<button type="button" class="spec-chip ${specFilter===f?"active":""}" data-spec="${esc(f)}">${esc(f)}</button>`).join("");
  box.querySelectorAll(".spec-chip").forEach(c=>c.addEventListener("click",()=>{specFilter=c.dataset.spec;box.querySelectorAll(".spec-chip").forEach(x=>x.classList.toggle("active",x===c));render()}));
}
function getList(){
  const q=$("#q").value.trim().toLowerCase(),fac=$("#fFaculty").value,sort=$("#fSort").value;
  let list=cache.filter(a=>{
    const okF=fac==="all"||a.faculty===fac;
    const okS=specFilter==="all"||(tab==="teams"?(a.neededSpecialties||[]).includes(specFilter):a.specialty===specFilter);
    const hay=[a.name,a.title,a.description,a.specialty,(a.skills||[]).join(" "),(a.neededSpecialties||[]).join(" "),a.faculty].join(" ").toLowerCase();
    return okF&&okS&&(!q||hay.includes(q));
  });
  if(sort==="oldest")list=[...list].reverse();
  if(sort==="needed"&&tab==="teams")list=[...list].sort((a,b)=>(b.neededSpecialties||[]).length-(a.neededSpecialties||[]).length);
  return list;
}
function render(){
  const list=getList(),g=$("#results");
  g.innerHTML=list.length?list.map(a=>tab==="teams"?teamCardSearch(a):partnerCardSearch(a)).join(""):
    `<div class="empty"><div class="empty-ico"><i data-lucide="folder-search"></i></div><h3>لم نعثر على نتائج</h3><p>غيّر عوامل التصفية، أو سجّل لتُنشر بياناتك هنا.</p><a href="../register/register.html?kind=${tab==="teams"?"team":"student"}" class="btn btn-primary btn-sm"><i data-lucide="plus"></i> سجّل</a></div>`;
  $("#count").textContent=list.length?`${list.length} نتيجة`:"";
  icons();
}
async function sendRequest(){
  const msg=$("#reqMsg").value.trim();
  if(!msg)return toast("error","أدخل رسالة","عرّف بتخصّصك وما يمكنك تقديمه.");
  if(!pendingTo)return;
  const btn=$("#sendReq");const old=btn.innerHTML;
  btn.disabled=true;btn.innerHTML='<i data-lucide="loader-2" class="spin"></i> جارٍ الإرسال…';icons();
  try{
    const res=await createRequest({toCode:pendingTo.code,type:tab==="teams"?"join_team":"contact_partner",message:msg});
    if(res.error==="no_profile")return toast("warning","أكمل تسجيلك أولًا","أنشئ ملفّك لتتمكّن من إرسال الطلبات.");
    if(res.error==="bad_code")return toast("error","الرمز غير موجود","تأكّد من الجهة التي تراسلها.");
    if(res.error==="self")return toast("warning","هذا ملفّك","لا يمكنك مراسلة نفسك.");
    if(res.error==="rate_limited")return toast("warning","بلغت الحدّ اليومي","يمكنك إرسال 5 طلبات يوميًا. عُد غدًا.");
    if(res.error==="duplicate")return toast("warning","لديك طلب معلّق","انتظر ردّ الطرف الآخر.");
    if(res.error==="empty_message")return toast("error","أدخل رسالة","");
    if(res.error)return toast("error","تعذّر الإرسال","");
    closeModals();
    toast("success","تمّ إرسال طلبك","يظهر للطرف في لوحته ليقبله أو يرفضه.");
  }catch(err){console.error(err);toast("error","تعذّر الإرسال",err&&err.message?String(err.message).slice(0,80):"أعد المحاولة.")}
  finally{btn.disabled=false;btn.innerHTML=old;icons()}
}
initSearch();