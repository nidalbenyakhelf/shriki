import { App } from "../home/home.js";
const {$,$$,esc,initial,myAccount,listRequests,setStatus,getContactForAccepted,clearSession,toast,icons}=App;
let me=null,uid=null,tab="incoming";

async function initDashboard(){
  uid=App.getSession();               // الجلسة المؤقتة (تُستبدل بـ Anonymous Auth)
  if(!uid){showNoSession();bindSwitch();return}
  const doc=await myAccount(uid);
  if(!doc){showNoProfile();bindSwitch();return}
  me=doc;
  $("#gate").hidden=true;$("#panel").hidden=false;
  renderHead();bindTabs();bindSwitch();await refresh();
}
function showNoSession(){
  $("#gate").hidden=false;$("#panel").hidden=true;
  $("#gateTitle").textContent="لا توجد جلسة على هذا الجهاز";
  $("#gateText").textContent="حساب «شريك» مرتبطٌ بمتصفّحك بلا كلمة مرور. أنشئ ملفّك لتبدأ نشر مشروعك أو استقبال الطلبات.";
  $("#gateBtn").innerHTML='<i data-lucide="user-plus"></i> أنشئ ملفّي';
  $("#gateBtn").onclick=()=>location.href="../register/register.html";
  $("#gateHint").innerHTML='انتقلت لجهازٍ آخر؟ <a href="../register/register.html">أنشئ حسابًا جديدًا</a>.';
  icons();
}
function showNoProfile(){
  $("#gate").hidden=false;$("#panel").hidden=true;
  $("#gateTitle").textContent="أكمل تسجيل ملفّك";
  $("#gateText").textContent="وُجدت جلسة لكن لا ملفّ تعريفي بعد. أنشئه لتنشر مشروعك أو تظهر كشريك متاح.";
  $("#gateBtn").innerHTML='<i data-lucide="square-pen"></i> أنشئ ملفّي';
  $("#gateBtn").onclick=()=>location.href="../register/register.html";
  $("#gateHint").textContent="";
  icons();
}
function bindSwitch(){
  const b=$("#switchAcc");if(!b)return;
  b.onclick=()=>{clearSession();me=null;uid=null;$("#panel").hidden=true;showNoSession()};
}
function bindTabs(){
  $$("#dashTabs .seg-btn").forEach(b=>b.onclick=()=>{tab=b.dataset.d;$$("#dashTabs .seg-btn").forEach(x=>x.classList.toggle("active",x===b));refresh()});
  document.addEventListener("click",async e=>{
    const a=e.target.closest("[data-accept]"),rj=e.target.closest("[data-reject]");
    if(!a&&!rj)return;
    const id=a?a.dataset.accept:rj.dataset.reject,st=a?"accepted":"rejected";
    try{await setStatus(id,st);await refresh();toast(a?"success":"info",a?"قبلت الطلب":"رفضت الطلب",a?"التواصل الآن ظاهر للطرفين.":"")}
    catch(err){console.error(err);toast("error","تعذّر التحديث","")}
  });
}
async function refresh(){
  const[inc,out]=await Promise.all([listRequests(uid,"incoming"),listRequests(uid,"outgoing")]);
  $("#bIn").textContent=inc.filter(r=>r.status==="pending").length||"";
  $("#bOut").textContent=out.length||"";
  renderList(tab==="incoming"?inc:out);
}
function renderHead(){
  const kind=me.kind==="team"?"صاحب مشروع":"شريك";
  const sub=me.kind==="team"?(me.title||me.name):(me.specialty||"");
  $("#dashHead").innerHTML=`<div class="avatar">${esc(initial(me.name))}</div><div><div class="dash-name">${esc(me.name)}</div><div class="dash-meta">${esc(kind)} · ${esc(me.faculty||"")}${sub?" · "+esc(sub):""}</div></div><button type="button" class="dash-code" data-copy="${esc(me.code)}"><i data-lucide="hash"></i> ${esc(me.code)}</button>`;
  icons();
}
function renderList(list){
  const el=$("#reqList");
  if(!list.length){el.innerHTML=`<div class="empty"><div class="empty-ico"><i data-lucide="${tab==="incoming"?"inbox":"send"}"></i></div><h3>${tab==="incoming"?"لم يصلك طلب بعد":"لم تُرسل طلبًا بعد"}</h3><p>${tab==="incoming"?"عندما يطلب أحدهم الانضمام إلى مشروعك، يظهر هنا.":"اذهب إلى صفحة البحث وأرسل طلبك الأول."}</p></div>`;icons();return}
  el.innerHTML=list.map(reqCard).join("");icons();
  list.filter(r=>r.status==="accepted").forEach(async r=>{
    const otherUid=tab==="incoming"?r.fromUid:r.toUid;
    const slot=document.querySelector(`[data-load-contact="${CSS.escape(otherUid)}"]`);
    if(!slot)return;
    const c=await getContactForAccepted(otherUid);
    if(!c){slot.innerHTML=`<div class="ok-note"><i data-lucide="alert-circle"></i> تعذّر تحميل بيانات التواصل.</div>`;return}
    slot.innerHTML=`<div class="ok-note"><i data-lucide="shield-check"></i> قُبل الطلب — التواصل الآن ظاهر.</div>
      ${c.email?`<div class="contact-row"><i data-lucide="mail"></i><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>`:""}
      ${c.phone?`<div class="contact-row"><i data-lucide="phone"></i><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></div>`:""}
      ${c.linkedin?`<div class="contact-row"><i data-lucide="linkedin"></i><a href="${esc(c.linkedin)}" target="_blank" rel="noopener">${esc(c.linkedin)}</a></div>`:""}`;
    icons();
  });
}
function reqCard(r){
  const otherUid=tab==="incoming"?r.fromUid:r.toUid;
  const otherName=tab==="incoming"?(r.fromName||"مستخدم"):(r.toName||"مستخدم");
  const st=r.status==="pending"?"معلّق":r.status==="accepted"?"مقبول":"مرفوض";
  const actions=(tab==="incoming"&&r.status==="pending")?`<div class="req-actions"><button type="button" class="btn btn-primary btn-sm" data-accept="${esc(r.id)}"><i data-lucide="check"></i> قبل</button><button type="button" class="btn btn-glass btn-sm" data-reject="${esc(r.id)}"><i data-lucide="x"></i> ارفض</button></div>`:"";
  const contactSlot=r.status==="accepted"?`<div class="req-contact" data-load-contact="${esc(otherUid)}"><div class="ok-note"><i data-lucide="loader-2" class="spin"></i> جارٍ تحميل بيانات التواصل…</div></div>`:"";
  return `<article class="req ${r.status}"><div class="req-top"><div class="avatar">${esc(initial(otherName))}</div><div class="req-who"><b>${esc(otherName)}</b><span>${esc(r.otherFaculty||r.fromFaculty||r.toFaculty||"")}</span></div><span class="status ${r.status}">${st}</span></div><div class="req-msg">${esc(r.message||"(بدون رسالة)")}</div>${actions}${contactSlot}</article>`;
}
initDashboard();