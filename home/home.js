/* ============================================================
   شريك — الملف الموحد (All-in-One Bundle) - الإصدار النهائي المُصلح
   يتضمن: Firebase Setup + Utils + Constants + Store + UI Logic
           + Direct Contact Logic + Admin Panel Logic
   
   ★ الإصلاحات الأخيرة ★
   1. dailySentCount: استبدال .count() بـ .get().size لدعم نسخة Compat.
   2. initDashboard: استخدام onAuthStateChanged لحل مشكلة فقدان الجلسة المؤقتة.
   ============================================================ */

(function() {
  'use strict';

  // ==========================================
  // 1. التحقق من تحميل المكتبات الخارجية أولاً
  // ==========================================
  if (typeof firebase === 'undefined') {
    console.error("❌ خطأ فادح: مكتبة Firebase لم تُحمّل.");
    return; 
  }
  if (typeof lucide === 'undefined') {
    console.warn("⚠️ تحذير: مكتبة Lucide لم تُحمّل بعد.");
  }

  // ==========================================
  // 2. إعدادات Firebase (مشروع shriki-813a9)
  // ==========================================
  const firebaseConfig = {
    apiKey: "AIzaSyCJC93gVdQgYjLUBOOW9JA0m_44xBximIs",
    authDomain: "shriki-813a9.firebaseapp.com",
    projectId: "shriki-813a9",
    storageBucket: "shriki-813a9.firebasestorage.app",
    messagingSenderId: "177417794605",
    appId: "1:177417794605:web:c2a332887cb53787cfb4a4"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const db = firebase.firestore();
  const auth = firebase.auth();
  const FV = firebase.firestore.FieldValue;

  const COL_P = "shrik_profiles";
  const COL_C = "shrik_contacts";
  const COL_R = "shrik_requests";
  const COL_S = "shrik_suggestions"; // نفس المجموعة للاقتراحات والرسائل المباشرة

  // ==========================================
  // 3. أدوات مساعدة (Utilities)
  // ==========================================
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  
  const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const initial = t => (String(t || "").trim().charAt(0) || "؟");
  const parseList = s => String(s || "").split(/[،,؛;]/).map(x => x.trim()).filter(Boolean);
  
  const icons = () => {
    if (window.lucide) {
      try { window.lucide.createIcons(); } 
      catch(e) { console.warn("Icon render error:", e); }
    } else {
      setTimeout(() => { if(window.lucide) window.lucide.createIcons(); }, 500);
    }
  };

  const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  function randInt(n) {
    const buf = new Uint32Array(1); let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= Math.floor(4294967296 / n) * n);
    return x % n;
  }
  function makeCode(prefix = "SHRK") {
    let s = ""; for (let i = 0; i < 8; i++) s += ALPHA[randInt(ALPHA.length)];
    return `${prefix}-${s}`;
  }

  const cleanStr = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max ?? 100);
  const cleanArr = (v, n, m) => Array.isArray(v) ? v.slice(0, n).map(s => cleanStr(s, m)).filter(Boolean) : [];

  // ==========================================
  // 4. الثوابت (Constants) — مع إضافة المبادرة الخيرية
  // ==========================================
  const FACULTIES = [
    "كلية العلوم", "كلية التكنولوجيا", "كلية العلوم الإنسانية والاجتماعية",
    "كلية الآداب واللغات", "كلية الحقوق والعلوم السياسية",
    "كلية العلوم الاقتصادية، العلوم التجارية وعلوم التسيير",
    "ملحقة الطب (جامعة الجزائر 1)", "ملحقة المدرسة العليا للأساتذة (القبة)"
  ];
  const CAMPUSES = ["القطب المركزي", "قطب سيدي نعمان", "قطب آخر"];
  const YEARS = ["سنة أولى", "سنة ثانية", "سنة ثالثة", "سنة رابعة", "ماستر 1", "ماستر 2", "دكتوراه"];
  
  // ★ أضفنا "مبادرة خيرية" هنا ★
  const PROJECT_TYPES = ["مذكرة تخرج", "شركة ناشئة", "مشروع خارج الجامعة", "مسابقة / بحث علمي", "مبادرة خيرية"];
  const WM_ICON = { 
    "مذكرة تخرج": "graduation-cap", 
    "شركة ناشئة": "rocket", 
    "مشروع خارج الجامعة": "lightbulb", 
    "مسابقة / بحث علمي": "trophy",
    "مبادرة خيرية": "heart-handshake" // ★ أيقونة جديدة ★
  };
  
  const PROFILE_FIELDS = ["kind","name","faculty","campus","year","title","description","projectType","neededSpecialties","roleDescription","specialty","skills","bio"];
  const MAX_LEN = { name:60, faculty:80, campus:40, year:20, title:120, description:500, specialty:80, bio:300, projectType:40, roleDescription:200 };

  // ==========================================
  // 5. طبقة البيانات (Store)
  // ==========================================
  async function ensureUser() {
    if (auth.currentUser) return auth.currentUser;
    try {
      const cred = await auth.signInAnonymously();
      return cred.user;
    } catch(e) { throw e; }
  }
  
  function getSession() { return auth.currentUser ? auth.currentUser.uid : null; }
  async function clearSession() { await auth.signOut(); }

  async function fetchAllProfiles(limitN = 500) {
    try {
      const snap = await db.collection(COL_P).limit(limitN).get();
      return snap.docs.map(d => ({ 
        id: d.id, ...d.data(), 
        createdAt: d.data().createdAt ? d.data().createdAt.toDate().toISOString() : "" 
      }));
    } catch(err) { 
      console.error("Fetch Error:", err); 
      return []; 
    }
  }
  
  const teams = async () => (await fetchAllProfiles()).filter(a => a.kind === "team");
  const partners = async () => (await fetchAllProfiles()).filter(a => a.kind === "student");
  
  async function profileByCode(code) {
    const all = await fetchAllProfiles();
    return all.find(a => a.code === String(code||"").trim().toUpperCase()) || null;
  }
  
  async function myProfile(uid) {
    const snap = await db.collection(COL_P).doc(uid).get();
    return snap.exists ? { id: snap.id, ...snap.data(), createdAt: snap.data().createdAt ? snap.data().createdAt.toDate().toISOString() : "" } : null;
  }

  async function createAccount(profileData, contactData) {
    const user = await ensureUser();
    let code; let attempts = 0;
    do { 
      code = makeCode(); 
      const exists = await db.collection(COL_P).where("code","==",code).limit(1).get(); 
      if(exists.empty) break; 
      attempts++; 
    } while(attempts<5);
    
    const safeProfile = {};
    for (const k of PROFILE_FIELDS) {
      if (!(k in profileData)) continue;
      if (k === "neededSpecialties" || k === "skills") safeProfile[k] = cleanArr(profileData[k], 10, 40);
      else if (typeof profileData[k] === "string") safeProfile[k] = cleanStr(profileData[k], MAX_LEN[k]);
    }
    safeProfile.code = code;
    
    const safeContact = {
      email: cleanStr(contactData.email, 120).toLowerCase(),
      phone: cleanStr(contactData.phone, 20),
      linkedin: cleanStr(contactData.linkedin, 200) // ← الاسم بقي linkedin للتوافق مع DB، لكن الواجهة تقبل أي رابط
    };
    
    await db.runTransaction(async(tx)=>{
      tx.set(db.collection(COL_P).doc(user.uid), {...safeProfile, createdAt:FV.serverTimestamp()});
      tx.set(db.collection(COL_C).doc(user.uid), {...safeContact, createdAt:FV.serverTimestamp()});
    });
    return { id:user.uid, code, ...safeProfile };
  }

  const DAILY_LIMIT = 5;
  
  // ★ الإصلاح: حساب العدد يدوياً لتجنب خطأ .count() في نسخة Compat ★
  async function dailySentCount(uid) {
    const since = new Date(Date.now() - 86400000); // منذ 24 ساعة
    
    try {
      // نجلب الوثائق الفعلية بدلاً من العد فقط
      const snap = await db.collection(COL_R)
        .where("fromUid", "==", uid)
        .where("createdAt", ">=", firebase.firestore.Timestamp.fromDate(since)) // تحويل التاريخ لـ Timestamp
        .get();
      
      return snap.size; // نعيد عدد الوثائق الموجودة
    } catch(err) {
      console.error("Daily Count Error:", err);
      return 0; // في حال الخطأ، نعتبر أن العدد صفر للسماح بالإرسال (أو يمكنك إرجاع رقم عالٍ لمنع الإرسال)
    }
  }

  async function createRequest({ toCode, type, message }) {
    const user = await ensureUser();
    const mine = await myProfile(user.uid);
    if(!mine) return {error:"no_profile"};
    const to = await profileByCode(toCode);
    if(!to) return {error:"bad_code"};
    if(to.id===user.uid) return {error:"self"};
    if((await dailySentCount(user.uid))>=DAILY_LIMIT) return {error:"rate_limited"};
    
    const msg = String(message||"").trim().slice(0,500);
    if(!msg) return {error:"empty_message"};
    
    const dupSnap = await db.collection(COL_R).where("fromUid","==",user.uid).where("toUid","==",to.id).where("status","==","pending").limit(1).get();
    if(!dupSnap.empty) return {error:"duplicate"};

    await db.collection(COL_R).add({
      fromUid:user.uid, toUid:to.id, fromCode:mine.code, toCode:to.code,
      fromName:mine.name, fromFaculty:mine.faculty, toName:to.title||to.name, toFaculty:to.faculty,
      type, message:msg, status:"pending", createdAt:FV.serverTimestamp()
    });
    return {ok:true};
  }

  async function listRequests(uid, dir) {
    const field = dir==="incoming"?"toUid":"fromUid";
    const snap = await db.collection(COL_R).where(field,"==",uid).orderBy("createdAt","desc").limit(100).get();
    return snap.docs.map(d=>({id:d.id,...d.data(),createdAt:d.data().createdAt?d.data().createdAt.toDate().toISOString():""}));
  }

  async function setStatus(id, st) { await db.collection(COL_R).doc(id).update({status:st}); }
  
  async function getContactForAccepted(otherUid) {
    try { const snap = await db.collection(COL_C).doc(otherUid).get(); return snap.exists?snap.data():null; } catch{return null;}
  }

  async function addSuggestion(raw) {
    const s = {
      name: cleanStr(raw.name, 60),
      email: cleanStr(raw.email, 120).toLowerCase(),
      type: ["idea","improvement","bug","other"].includes(raw.type)?raw.type:"idea",
      content: cleanStr(raw.content, 1000)
    };
    await db.collection(COL_S).add({...s,status:"new",source:"homepage_suggest",createdAt:FV.serverTimestamp()});
  }

  // ★ دالة جديدة: حفظ رسالة التواصل المباشر ★
  async function saveDirectMessage(data) {
    const s = {
      senderName: cleanStr(data.senderName, 60),
      senderEmail: cleanStr(data.senderEmail, 120).toLowerCase(),
      messageBody: cleanStr(data.messageBody, 1000),
      type: "contact_message", // تمييزها عن الاقتراحات العادية
      status: "new",
      source: "homepage_contact_modal",
      createdAt: FV.serverTimestamp()
    };
    await db.collection(COL_S).add(s);
  }

  async function stats() {
    const all = await fetchAllProfiles();
    return {
      teams: all.filter(a=>a.kind==="team").length,
      partners: all.filter(a=>a.kind==="student").length,
      faculties: new Set(all.map(a=>a.faculty).filter(Boolean)).size
    };
  }

  // ★ دالة جديدة: جلب جميع الرسائل والاقتراحات لصفحة الإدارة ★
  async function fetchAllMessages() {
    try {
      const snap = await db.collection(COL_S).orderBy("createdAt", "desc").limit(200).get();
      return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt ? d.data().createdAt.toDate().toLocaleDateString('ar-DZ', { day:'numeric', month:'long', year:'numeric' }) : ""
      }));
    } catch(err) {
      console.error("Admin Fetch Error:", err);
      return [];
    }
  }

  // ==========================================
  // 6. منطق الواجهة (UI Logic)
  // ==========================================

  function fillFaculty(el, all) {
    if(!el)return;
    el.innerHTML=(all?`<option value="all">كل الكليات</option>`:`<option value="" disabled selected>اختر كليّتك…</option>`)+FACULTIES.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("");
  }
  function fillCampuses(el){if(el)el.innerHTML=`<option value="">غير محدد</option>`+CAMPUSES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}
  function fillYears(el){if(el)el.innerHTML=`<option value="" disabled selected>سنتك…</option>`+YEARS.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join("")}
  function fillTypes(el){if(el)el.innerHTML=PROJECT_TYPES.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}

  // ★ الروابط في البطاقات أصبحت نسبية (بدون / الأولى) ★
  function posterCardHome(a) {
    const needs=(a.neededSpecialties||[]);
    const needTxt=needs.length?("يبحث عن: "+needs.slice(0,2).join("، ")):"فريق مفتوح للانضمام";
    const cnt=needs.length?`<span class="p-count"><i data-lucide="users"></i> ${needs.length}</span>`:"";
    const wm=WM_ICON[a.projectType]||"users";
    return `<div class="poster-cell">
      <a class="poster" href="search/search.html?tab=teams" aria-label="${esc(a.title||a.name)}">
        <span class="p-wm"><i data-lucide="${wm}"></i></span>
        <span class="p-badge"><i data-lucide="tag"></i> ${esc(a.projectType||"فريق")}</span>
        ${cnt}
        <span class="p-body"><span class="p-title">${esc(a.title||a.name)}</span><span class="p-arrow"><i data-lucide="arrow-left"></i></span></span>
      </a>
      <div class="p-meta"><span class="pm-faculty"><i data-lucide="building-2"></i> ${esc(a.faculty||"—")}</span><span class="pm-needs">${esc(needTxt)}</span></div>
    </div>`;
  }
  
  function teamCardSearch(a) {
    const chips=(a.neededSpecialties||[]).slice(0,3).map(f=>`<span class="chip">${esc(f)}</span>`).join("");
    return `<article class="card team-card"><div class="tc-head"><div class="tc-avatar">${esc(initial(a.title||a.name))}</div><div style="min-width:0"><h3 class="tc-title">${esc(a.title||a.name)}</h3><div class="tc-meta">${esc(a.faculty||"")} · ${esc(a.projectType||"فريق")}</div></div></div><p class="tc-desc">${esc(a.description||"")}</p><div class="tc-chips">${chips||'<span class="chip neutral">—</span>'}</div><div class="tc-foot"><button type="button" class="btn btn-primary btn-sm btn-block" data-req="${esc(a.code)}" data-name="${esc(a.title||a.name)}"><i data-lucide="send"></i> اطلب الانضمام</button></div></article>`;
  }
  
  function partnerCardSearch(a) {
    const chips=(a.skills||[]).slice(0,3).map(f=>`<span class="chip">${esc(f)}</span>`).join("");
    return `<article class="card team-card"><div class="tc-head"><div class="tc-avatar round">${esc(initial(a.name))}</div><div style="min-width:0"><h3 class="tc-title">${esc(a.name)}</h3><div class="tc-meta">${esc(a.specialty||"")} · ${esc(a.faculty||"")}</div></div></div>${a.bio?`<p class="tc-desc">${esc(a.bio)}</p>`:""}<div class="tc-chips">${chips}</div><div class="tc-foot"><button type="button" class="btn btn-primary btn-sm btn-block" data-req="${esc(a.code)}" data-name="${esc(a.name)}"><i data-lucide="send"></i> تواصل معه</button></div></article>`;
  }

  function toast(type,title,message,duration=3800) {
    let c=$("#toastContainer");
    if(!c){c=document.createElement("div");c.id="toastContainer";c.className="toast-container";document.body.appendChild(c)}
    const ic={success:"check-circle-2",error:"x-circle",warning:"alert-triangle",info:"info"};
    const t=document.createElement("div");t.className=`toast toast-${type}`;
    t.innerHTML=`<div class="toast-icon"><i data-lucide="${ic[type]||"info"}"></i></div><div class="toast-content"><div class="toast-title">${esc(title)}</div><div class="toast-message">${esc(message)}</div></div><button class="toast-close"><i data-lucide="x"></i></button>`;
    c.appendChild(t);icons();
    const kill=()=>{t.classList.add("hiding");setTimeout(()=>t.remove(),260)};
    t.querySelector(".toast-close").addEventListener("click",kill);
    setTimeout(kill,duration);
  }

  function openModal(id){const m=$("#"+id);if(!m)return;m.classList.add("open");document.body.style.overflow="hidden";icons()}
  function closeModals(){$$(".modal.open").forEach(m=>m.classList.remove("open"));document.body.style.overflow=""}
  
  function sharePage(title,text){
    const url=location.origin+location.pathname;
    const T=title||"شريك — من الفكرة إلى الفريق";
    const X=text||"منصّة تربط طلبة جامعة يحيى فارس – المدية عبر تخصّصاتاتهم المتكاملة لتكوين فرق المشاريع. انضمّ وانشر مشروعك.";
    if(navigator.share){navigator.share({title:T,text:X,url}).catch(()=>{});}
    else{
      navigator.clipboard?.writeText(`${X}\n${url}`).then(()=>toast("success","تمّ نسخ الرابط","الصقه في أي محادثة لمشاركته.")).catch(()=>{});
      window.open(`https://wa.me/?text=${encodeURIComponent(X+"\n"+url)}`,"_blank","noopener");
    }
  }

  function initGlobal(){
    document.addEventListener("click",e=>{
      const op=e.target.closest("[data-open]");
      if(op){e.preventDefault();openModal(op.dataset.open);return}
      if(e.target.matches(".modal")||e.target.closest("[data-close]")){closeModals();return}
      const cp=e.target.closest("[data-copy]");
      if(cp){navigator.clipboard?.writeText(cp.dataset.copy).then(()=>toast("success","تمّ النسخ",cp.dataset.copy,2000)).catch(()=>{})}
      const sh=e.target.closest("[data-share]");
      if(sh){e.preventDefault();sharePage(sh.dataset.shareTitle,sh.dataset.shareText)}
    });
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModals()});
  }
  initGlobal();

  function ensureOverlay(onClick){
    let ov=$(".menu-overlay");
    if(!ov){ov=document.createElement("div");ov.className="menu-overlay";document.body.appendChild(ov)}
    ov.onclick=onClick;
    return ov;
  }
  function lockScroll(lock){document.body.classList.toggle("locked",lock)}

  function initContactMenu(){
    const wrap=$("#contactWrap"),btn=$("#contactMenuBtn"),menu=$("#contactMenu");
    if(!wrap||!btn||!menu)return;
    const ov=ensureOverlay(close);
    function close(){menu.classList.remove("open");btn.setAttribute("aria-expanded","false");ov.classList.remove("show");lockScroll(false)}
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      const isOpen=menu.classList.toggle("open");
      btn.setAttribute("aria-expanded",isOpen?"true":"false");
      ov.classList.toggle("show",isOpen);lockScroll(isOpen);
    });
    menu.addEventListener("click",e=>{if(e.target.closest("[data-open],[data-share]"))close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
  }
  initContactMenu();

  function initMobileNav(){
    const toggle=$("#menuToggle"),links=$("#navLinks");
    if(!toggle||!links)return;
    const ov=ensureOverlay(close);
    function close(){links.classList.remove("open");toggle.setAttribute("aria-expanded","false");ov.classList.remove("show");lockScroll(false)}
    toggle.addEventListener("click",e=>{
      e.stopPropagation();
      const isOpen=links.classList.toggle("open");
      toggle.setAttribute("aria-expanded",isOpen?"true":"false");
      ov.classList.toggle("show",isOpen);lockScroll(isOpen);
    });
    links.addEventListener("click",e=>{if(e.target.closest("a,button"))close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
  }
  initMobileNav();

  function animateCount(el,target){
    if(!el)return;if(!target){el.textContent="0";return}
    let c=0;const step=Math.max(1,Math.ceil(target/28));
    const t=setInterval(()=>{c+=step;if(c>=target){c=target;clearInterval(t)}el.textContent=c},28);
  }
  function initReveal(){
    const els=$$(".reveal");
    if(!("IntersectionObserver"in window)){els.forEach(e=>e.classList.add("in"));return}
    const io=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){en.target.classList.add("in");io.unobserve(en.target)}}),{threshold:.12,rootMargin:"0px 0px -6% 0px"});
    els.forEach(e=>io.observe(e));
  }
  
  async function initSuggest(){
    const form=$("#sugForm");if(!form)return;
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const email=$("#sugEmail").value.trim(),content=$("#sugText").value.trim();
      if(!email||!email.includes("@"))return toast("error","أدخل بريدًا صحيحًا","نحتاج بريدك للردّ على اقتراحك.");
      if(!content)return toast("error","أدخل اقتراحك","");
      const btn=form.querySelector('button[type="submit"]');const old=btn?btn.innerHTML:"";
      if(btn){btn.disabled=true;btn.innerHTML='<i data-lucide="loader-2" class="spin"></i> جارٍ الإرسال…';icons()}
      try{await addSuggestion({name:$("#sugName").value,email,type:$("#sugType").value,content});form.reset();closeModals();toast("success","شكرًا لاقتراحك","تمّ استلامه وسنراجعه.")}
      catch(err){console.error(err);toast("error","تعذّر الإرسال","تحقّق من الاتصال ثم أعد المحاولة.")}
      finally{if(btn){btn.disabled=false;btn.innerHTML=old;icons()}}
    });
  }

  // ★ منطق التواصل المباشر (Direct Contact Logic) ★
  function initDirectContact(){
    const form = $("#directContactForm");
    if(!form) return;

    form.addEventListener("submit", async(e)=>{
      e.preventDefault();
      
      const btn = form.querySelector('button[type="submit"]');
      const oldHtml = btn.innerHTML;
      
      // حالة التحميل
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> جارٍ الإرسال…';
      icons();

      try {
        const formData = new FormData(form);
        const msgData = {
          senderName: String(formData.get("senderName")||"").trim(),
          senderEmail: String(formData.get("senderEmail")||"").trim().toLowerCase(),
          messageBody: String(formData.get("messageBody")||"").trim()
        };

        // التحقق البسيط
        if(!msgData.senderEmail || !msgData.messageBody){
           throw new Error("Fields missing");
        }

        // الحفظ في Firestore
        await saveDirectMessage(msgData);

        closeModals();
        toast("success","وصلتنا رسالتك!","شكراً لتواصلك، سنرد عليك قريباً.");
        form.reset();

      } catch(err){
        console.error("Contact Send Error:", err);
        toast("error","تعذر الإرسال","تحقق من اتصالك بالإنترنت وحاول مجدداً.");
      } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
        icons();
      }
    });
  }

  // ==========================================
  // 7. Page Initializers (Router)
  // ==========================================
  const page = document.body.dataset.page;

  // --- Home Page ---
  async function initHome(){
    const nb=$("#navbar");
    if(nb){const on=()=>nb.classList.toggle("scrolled",window.scrollY>10);window.addEventListener("scroll",on,{passive:true});on()}
    const yr=$("#year");if(yr)yr.textContent=new Date().getFullYear();

    const row=$("#teamsRow");
    try{
      const st=await stats();
      animateCount($("#cntTeams"),st.teams);
      animateCount($("#cntPartners"),st.partners);
      animateCount($("#cntFaculties"),st.faculties);
      const t=await teams();
      if(row)row.innerHTML=t.length?t.map(posterCardHome).join(""):
        `<div class="empty rail-empty"><div class="empty-ico"><i data-lucide="folder-search"></i></div><h3>لا توجد مشاريع بعد</h3><p>كن أوّل من ينشر فريقه هنا.</p><a href="register/register.html?kind=team" class="btn btn-primary btn-sm"><i data-lucide="plus"></i> أنشئ مشروعًا</a></div>`;
    }catch(err){
      console.error(err);
      if(row)row.innerHTML=`<div class="empty rail-empty"><div class="empty-ico"><i data-lucide="wifi-off"></i></div><h3>تعذّر تحميل المشاريع</h3><p>أعد تحميل الصفحة.</p></div>`;
    }
    icons();initSuggest();initReveal();
    // ★ تفعيل نموذج التواصل المباشر ★
    setTimeout(initDirectContact, 100);
  }

  // --- Register Page ---
  async function initRegister(){
    const form=$("#registerForm");if(!form)return;
    fillFaculty($("#facSelect"),false);fillCampuses($("#campusSelect"));fillYears($("#yearSelect"));fillTypes($("#typeSelect"));
    const urlKind=new URLSearchParams(location.search).get("kind");
    setKind(urlKind==="student"?"student":"team");
    $$("#kindTabs .seg-btn").forEach(b=>b.addEventListener("click",()=>setKind(b.dataset.kind)));
    function setKind(k){
      $$("#kindTabs .seg-btn").forEach(b=>b.classList.toggle("active",b.dataset.kind===k));
      $("#kindField").value=k;$("#paneTeam").hidden=k!=="team";$("#paneStudent").hidden=k!=="student";
    }
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const fd=new FormData(form),kind=fd.get("kind")||"team";
      const name=String(fd.get("name")||"").trim(),faculty=String(fd.get("faculty")||"").trim(),
            campus=String(fd.get("campus")||"").trim(),year=String(fd.get("year")||"").trim(),
            email=String(fd.get("email")||"").trim();
      if(!name)return toast("error","أدخل اسمك","");
      if(!faculty)return toast("error","اختر كليّتك","");
      if(!year)return toast("error","اختر سنتك","");
      if(!email)return toast("error","أدخل بريدك","");
      const profile={kind,name,faculty,campus,year};
      const contact={email,phone:String(fd.get("phone")||"").trim(),linkedin:String(fd.get("linkedin")||"").trim()};
      if(kind==="team"){
        const title=String(fd.get("title")||"").trim(),description=String(fd.get("description")||"").trim(),needed=String(fd.get("neededSpecialties")||"").trim();
        if(!title||!description)return toast("error","أدخل عنوان مشروعك ووصفه","");
        if(!needed)return toast("error","حدّد التخصّصات التي تنقصك","");
        Object.assign(profile,{title,description,projectType:fd.get("projectType"),neededSpecialties:parseList(needed),roleDescription:String(fd.get("roleDescription")||"").trim()});
      }else{
        const specialty=String(fd.get("specialty")||"").trim();
        if(!specialty)return toast("error","أدخل تخصّصك","");
        Object.assign(profile,{specialty,skills:parseList(fd.get("skills")),bio:String(fd.get("bio")||"").trim()});
      }
      const btn=form.querySelector('button[type="submit"]');const old=btn?btn.innerHTML:"";
      if(btn){btn.disabled=true;btn.innerHTML='<i data-lucide="loader-2" class="spin"></i> جارٍ النشر…';icons()}
      try{
        const acc=await createAccount(profile,contact);
        $("#resultCode").textContent=acc.code;
        $("#copyCode").setAttribute("data-copy",acc.code);
        // ★ رابط نسبي من register/ إلى dashboard/ ★
        $("#goDash").href="../dashboard/dashboard.html";
        const sp=$("#shareProj");
        if(sp)sp.onclick=()=>sharePage(acc.title||acc.name,(acc.description||"").slice(0,120)+" — ابحث عن فريقك على «شريك».");
        form.hidden=true;$("#successState").hidden=false;icons();
        toast("success","تمّ النشر!","رمزك العامّ للبحث والتواصل هو "+acc.code);
      }catch(err){
        console.error(err);
        toast("error","تعذّر النشر",err&&err.message?String(err.message).slice(0,80):"أعد المحاولة.");
      }finally{if(btn){btn.disabled=false;btn.innerHTML=old;icons()}}
    });
    icons();
  }

  // --- Search Page ---
  async function initSearch(){
    fillFaculty($("#fFaculty"),true);
    const urlTab=new URLSearchParams(location.search).get("tab");
    setTab(urlTab==="partners"?"partners":"teams");
    $$("#searchTabs .seg-btn").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
    
    // ★ أضفنا #fType إلى مصفوفة الحقول المستمعة للتغيير ★
    ["#q","#fFaculty","#fSort","#fType"].forEach(s=>{
      const el=$(s);
      if(el) el.addEventListener(el.tagName==="INPUT"?"input":"change",render)
    });
    
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
  let tab="teams",specFilter="all",pendingTo=null,cache=[];
  async function load(){
    const g=$("#results");
    g.innerHTML=`<div class="empty"><div class="empty-ico"><i data-lucide="loader-2" class="spin"></i></div><h3>جارٍ التحميل…</h3></div>`;icons();
    try{cache=await(tab==="teams"?teams():partners())}
    catch(err){console.error(err);g.innerHTML=`<div class="empty"><div class="empty-ico"><i data-lucide="wifi-off"></i></div><h3>تعذّر التحميل</h3><p>أعد المحاولة.</p></div>`;icons();return}
    buildSpecChips();render();
  }
  function setTab(t){
    tab=t;specFilter="all";
    $("#q").value="";$("#fFaculty").value="all";$("#fSort").value="newest";
    // ★ تصفير فلتر النوع عند تبديل التبويب ★
    if($("#fType")) $("#fType").value="all"; 
    
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
  
  // ★ دالة الفلترة المحدثة لتشمل فلتر النوع ★
  function getList(){
    const q=$("#q").value.trim().toLowerCase();
    const fac=$("#fFaculty").value;
    const sort=$("#fSort").value;
    const typeFilter = $("#fType") ? $("#fType").value : "all"; // ★ قراءة الفلتر الجديد ★

    let list=cache.filter(a=>{
      // فلترة الكلية
      const okF=fac==="all"||a.faculty===fac;
      
      // ★ فلترة النوع (الجديدة) ★
      const okT=typeFilter==="all" || a.projectType === typeFilter;

      // فلترة التخصصات الفرعية (chips)
      const okS=specFilter==="all"||(tab==="teams"?(a.neededSpecialties||[]).includes(specFilter):a.specialty===specFilter);
      
      // البحث النصي
      const hay=[a.name,a.title,a.description,a.specialty,(a.skills||[]).join(" "),(a.neededSpecialties||[]).join(" "),a.faculty].join(" ").toLowerCase();
      
      // الشرط المجمّع: يجب تحقيق كل الشروط
      return okF && okT && okS && (!q||hay.includes(q)); 
    });
    
    if(sort==="oldest")list=[...list].reverse();
    if(sort==="needed"&&tab==="teams")list=[...list].sort((a,b)=>(b.neededSpecialties||[]).length-(a.neededSpecialties||[]).length);
    return list;
  }
  
  function render(){
    const list=getList(),g=$("#results");
    // ★ رابط نسبي من search/ إلى register/ ★
    g.innerHTML=list.length?list.map(a=>tab==="teams"?teamCardSearch(a):partnerCardSearch(a)).join(""):
      `<div class="empty"><div class="empty-ico"><i data-lucide="folder-search"></i></div><h3>لم نعثر على نتائج</h3><p>غيّر عوامل التصفية، أو سجّل لتنشر بياناتك هنا.</p><a href="../register/register.html?kind=${tab==="teams"?"team":"student"}" class="btn btn-primary btn-sm"><i data-lucide="plus"></i> سجّل</a></div>`;
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

  // --- Dashboard Page ---
  // ★ الإصلاح: استخدام onAuthStateChanged لضمان استقرار الجلسة ★
  async function initDashboard(){
    const gateEl = $("#gate");
    const panelEl = $("#panel");
    
    // 1. أظهر حالة التحميل أولاً
    if(gateEl) {
        gateEl.hidden = false;
        $("#gateTitle").textContent = "جارٍ التحقق من جلستك...";
        $("#gateText").textContent = "لحظات قليلة.";
    }
    if(panelEl) panelEl.hidden = true;

    // 2. انتظر حتى يستقر وضع المصادقة (Authentication State)
    auth.onAuthStateChanged(async(user) => {
        if (!user) {
            // لا يوجد مستخدم -> اطلب تسجيل الدخول
            showNoSession();
            bindSwitch();
            return;
        }

        // يوجد مستخدم -> جرب جلب ملفه الشخصي
        try {
            const doc = await myProfile(user.uid);
            
            if(!doc) {
                // المستخدم موجود لكن ليس لديه ملف تعريف (ربما حذفه أو فشل الإنشاء)
                showNoProfile();
                bindSwitch();
            } else {
                // كل شيء سليم -> اعرض اللوحة
                me = doc;
                uid = user.uid;
                
                if(gateEl) gateEl.hidden = true;
                if(panelEl) panelEl.hidden = false;
                
                renderHead();
                bindTabs();
                bindSwitch();
                await refresh();
            }
        } catch(err) {
            console.error("Dashboard Load Error:", err);
            showNoSession(); // في حال الخطأ التقني، نعود لشاشة البداية بأمان
            bindSwitch();
        }
    });
  }
  let me=null,uid=null,dashTab="incoming";
  function showNoSession(){
    $("#gate").hidden=false;$("#panel").hidden=true;
    $("#gateTitle").textContent="لا توجد جلسة على هذا الجهاز";
    $("#gateText").textContent="حساب «شريك» مرتبطٌ بمتصفّحك بلا كلمة مرور. أنشئ ملفّك لتبدأ نشر مشروعك أو استقبال الطلبات.";
    $("#gateBtn").innerHTML='<i data-lucide="user-plus"></i> أنشئ ملفّي';
    // ★ رابط نسبي من dashboard/ إلى register/ ★
    $("#gateBtn").onclick=()=>location.href="../register/register.html";
    $("#gateHint").innerHTML='انتقلت لجهازٍ آخر؟ <a href="../register/register.html">أنشئ حسابًا جديدًا</a>.';
    icons();
  }
  function showNoProfile(){
    $("#gate").hidden=false;$("#panel").hidden=true;
    $("#gateTitle").textContent="أكمل تسجيل ملفّك";
    $("#gateText").textContent="وُجدت جلسة لكن لا ملفّ تعريفي بعد. أنشئه لتنشر مشروعك أو تظهر كشريك متاح.";
    $("#gateBtn").innerHTML='<i data-lucide="square-pen"></i> أنشئ ملفّي';
    // ★ رابط نسبي من dashboard/ إلى register/ ★
    $("#gateBtn").onclick=()=>location.href="../register/register.html";
    $("#gateHint").textContent="";
    icons();
  }
  function bindSwitch(){
    const b=$("#switchAcc");if(!b)return;
    b.onclick=async()=>{await clearSession();me=null;uid=null;$("#panel").hidden=true;showNoSession()};
  }
  function bindTabs(){
    $$("#dashTabs .seg-btn").forEach(b=>b.onclick=()=>{dashTab=b.dataset.d;$$("#dashTabs .seg-btn").forEach(x=>x.classList.toggle("active",x===b));refresh()});
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
    renderList(dashTab==="incoming"?inc:out);
  }
  function renderHead(){
    const kind=me.kind==="team"?"صاحب مشروع":"شريك";
    const sub=me.kind==="team"?(me.title||me.name):(me.specialty||"");
    $("#dashHead").innerHTML=`<div class="avatar">${esc(initial(me.name))}</div><div><div class="dash-name">${esc(me.name)}</div><div class="dash-meta">${esc(kind)} · ${esc(me.faculty||"")}${sub?" · "+esc(sub):""}</div></div><button type="button" class="dash-code" data-copy="${esc(me.code)}"><i data-lucide="hash"></i> ${esc(me.code)}</button>`;
    icons();
  }
  function renderList(list){
    const el=$("#reqList");
    if(!list.length){el.innerHTML=`<div class="empty"><div class="empty-ico"><i data-lucide="${dashTab==="incoming"?"inbox":"send"}"></i></div><h3>${dashTab==="incoming"?"لم يصلك طلب بعد":"لم ترسل طلبًا بعد"}</h3><p>${dashTab==="incoming"?"عندما يطلب أحدهم الانضمام إلى مشروعك، يظهر هنا.":"اذهب إلى صفحة البحث وأرسل طلبك الأول."}</p></div>`;icons();return}
    el.innerHTML=list.map(reqCard).join("");icons();
    list.filter(r=>r.status==="accepted").forEach(async r=>{
      const otherUid=dashTab==="incoming"?r.fromUid:r.toUid;
      const slot=document.querySelector(`[data-load-contact="${CSS.escape(otherUid)}"]`);
      if(!slot)return;
      const c=await getContactForAccepted(otherUid);
      if(!c){slot.innerHTML=`<div class="ok-note"><i data-lucide="alert-circle"></i> تعذّر تحميل بيانات التواصل.</div>`;return}
      slot.innerHTML=`<div class="ok-note"><i data-lucide="shield-check"></i> قُبل الطلب — التواصل الآن ظاهر.</div>
        ${c.email?`<div class="contact-row"><i data-lucide="mail"></i><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>`:""}
        ${c.phone?`<div class="contact-row"><i data-lucide="phone"></i><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></div>`:""}
        ${c.linkedin?`<div class="contact-row"><i data-lucide="link"></i><a href="${esc(c.linkedin)}" target="_blank" rel="noopener">${esc(c.linkedin)}</a></div>`:""}`;
      icons();
    });
  }
  function reqCard(r){
    const otherUid=dashTab==="incoming"?r.fromUid:r.toUid;
    const otherName=dashTab==="incoming"?(r.fromName||"مستخدم"):(r.toName||"مستخدم");
    const st=r.status==="pending"?"معلّق":r.status==="accepted"?"مقبول":"مرفوض";
    const actions=(dashTab==="incoming"&&r.status==="pending")?`<div class="req-actions"><button type="button" class="btn btn-primary btn-sm" data-accept="${esc(r.id)}"><i data-lucide="check"></i> قبل</button><button type="button" class="btn btn-glass btn-sm" data-reject="${esc(r.id)}"><i data-lucide="x"></i> ارفض</button></div>`:"";
    const contactSlot=r.status==="accepted"?`<div class="req-contact" data-load-contact="${esc(otherUid)}"><div class="ok-note"><i data-lucide="loader-2" class="spin"></i> جارٍ تحميل بيانات التواصل…</div></div>`:"";
    return `<article class="req ${r.status}"><div class="req-top"><div class="avatar">${esc(initial(otherName))}</div><div class="req-who"><b>${esc(otherName)}</b><span>${esc(r.otherFaculty||r.fromFaculty||r.toFaculty||"")}</span></div><span class="status ${r.status}">${st}</span></div><div class="req-msg">${esc(r.message||"(بدون رسالة)")}</div>${actions}${contactSlot}</article>`;
  }

  // ★ NEW: Admin Page Logic ★
  async function initAdmin(){
    const container = $("#messagesList");
    if(!container) return;
    
    container.innerHTML = `<div class="empty"><div class="empty-ico"><i data-lucide="loader-2" class="spin"></i></div><h3>جارٍ تحميل الرسائل...</h3></div>`;
    icons();

    try {
      // نتأكد من وجود جلسة (حتى لو مجهولة) لقراءة البيانات
      await ensureUser();
      const messages = await fetchAllMessages();
      
      if(messages.length === 0) {
        container.innerHTML = `<div class="empty"><div class="empty-ico"><i data-lucide="inbox"></i></div><h3>لا توجد رسائل بعد</h3><p>ستظهر هنا جميع الاقتراحات ورسائل التواصل فور وصولها.</p></div>`;
        icons();
        return;
      }

      container.innerHTML = messages.map(msg => {
        const isContact = msg.type === "contact_message";
        const typeName = isContact ? "رسالة تواصل" : "اقتراح";
        const icon = isContact ? "message-square" : "lightbulb";
        const nameDisplay = msg.senderName || msg.name || "زائر مجهول";
        const emailDisplay = msg.senderEmail || msg.email || "";
        const bodyDisplay = msg.messageBody || msg.content || "(بدون نص)";
        const dateDisplay = msg.createdAt || "";

        return `
          <div class="msg-card">
            <div class="msg-head">
              <div class="msg-from">
                <span class="msg-name">${esc(nameDisplay)}</span>
                <span class="msg-email">${esc(emailDisplay)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="msg-type"><i data-lucide="${icon}"></i> ${typeName}</span>
                <span class="msg-date">${dateDisplay}</span>
              </div>
            </div>
            <div class="msg-body">${esc(bodyDisplay)}</div>
            <div class="msg-actions">
              <button type="button" class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${esc(emailDisplay)}');this.innerText='تم النسخ ✓';setTimeout(()=>this.innerText='نسخ البريد',2000)">
                <i data-lucide="copy"></i> نسخ البريد
              </button>
              <a href="mailto:${esc(emailDisplay)}?subject=رد%20على%20رسالتك%20في%20شريك&body=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D9%81%D9%8A%20%D8%B4%D8%B1%D9%8A%D9%83!" class="btn btn-primary btn-sm">
                <i data-lucide="reply"></i> رد بالإيميل
              </a>
            </div>
          </div>
        `;
      }).join("");
      
      icons();
    } catch(err) {
      console.error("Admin Load Error:", err);
      container.innerHTML = `<div class="empty"><div class="empty-ico"><i data-lucide="wifi-off"></i></div><h3>تعذّر تحميل الرسائل</h3><p>تحقق من اتصالك أو صلاحيات القراءة في Firestore.</p></div>`;
      icons();
    }
  }

  // ==========================================
  // 8. Execution Router
  // ==========================================
  if(page==="home") initHome();
  else if(page==="register") initRegister();
  else if(page==="search") initSearch();
  else if(page==="dashboard") initDashboard(); // ★ استدعاء المنطق المُصلح ★
  else if(page==="admin") initAdmin(); 

})();
