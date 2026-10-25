/* ============================================================
   شريك — الإصدار النهائي المستقر (Stable Release v3 - No External Icons)
   - إزالة الاعتماد على مكتبة Lucide تماماً لمنع أخطاء الحظر.
   - استخدام نظام الأيقونات الاحتياطي (CSS Emojis).
   - إصلاح مشكلة فقدان الجلسة في "لوحتي".
   - إصلاح إرسال الطلبات (Compat mode fix).
   ============================================================ */

(function() {
  'use strict';

  // ==========================================
  // 1. Setup & Config
  // ==========================================
  if (typeof firebase === 'undefined') { console.error("Firebase not loaded"); return; }

  const firebaseConfig = {
    apiKey: "AIzaSyCJC93gVdQgYjLUBOOW9JA0m_44xBximIs",
    authDomain: "shriki-813a9.firebaseapp.com",
    projectId: "shriki-813a9",
    storageBucket: "shriki-813a9.firebasestorage.app",
    messagingSenderId: "177417794605",
    appId: "1:177417794605:web:c2a332887cb53787cfb4a4"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  
  const db = firebase.firestore();
  const auth = firebase.auth();
  const FV = firebase.firestore.FieldValue;

  const COL_P = "shrik_profiles";
  const COL_C = "shrik_contacts";
  const COL_R = "shrik_requests";
  const COL_S = "shrik_suggestions";

  // Utilities
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const initial = t => (String(t || "").trim().charAt(0) || "؟");
  
  // ★ الإصلاح الحاسم: دالة icons أصبحت فارغة أو مجرد تأكيد بسيط ★
  // لأن الأيقونات الآن تُرسم عبر CSS (::before)، لا نحتاج لمكتبة JS.
  // هذه الدالة موجودة فقط للتوافق مع الكود القديم، لكنها لن تفعل شيئاً ضاراً.
  const icons = () => {
    // لا نفعل شيئاً هنا، لأن CSS يتولى الأمر.
    // إذا أردت إضافة تأثيرات حركية بسيطة لاحقاً، يمكنك وضعها هنا.
  };
  
  const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  function makeCode(prefix="SHRK") {
    let s=""; for(let i=0;i<8;i++) s+=ALPHA[Math.floor(Math.random()*ALPHA.length)];
    return `${prefix}-${s}`;
  }

  // Constants
  const FACULTIES = ["كلية العلوم","كلية التكنولوجيا","كلية العلوم الإنسانية والاجتماعية","كلية الآداب واللغات","كلية الحقوق والعلوم السياسية","كلية العلوم الاقتصادية","ملحقة الطب","ملحقة الأساتذة"];
  const PROJECT_TYPES = ["مذكرة تخرج","شركة ناشئة","مشروع خارج الجامعة","مسابقة / بحث علمي","مبادرة خيرية"];
  const WM_ICON = {"مذكرة تخرج":"graduation-cap","شركة ناشئة":"rocket","مشروع خارج الجامعة":"lightbulb","مسابقة / بحث علمي":"trophy","مبادرة خيرية":"heart-handshake"};

  // ==========================================
  // 2. Store Layer (Data Operations)
  // ==========================================
  
  // Wait for Auth to be ready before doing anything critical
  function waitForAuth() {
    return new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(user => {
        unsub(); // Unsubscribe immediately after first check
        resolve(user);
      });
      // Timeout safety
      setTimeout(() => resolve(auth.currentUser), 5000);
    });
  }

  async function ensureUser() {
    if (auth.currentUser) return auth.currentUser;
    try {
      const cred = await auth.signInAnonymously();
      return cred.user;
    } catch(e) { throw e; }
  }

  async function getUserProfile(uid) {
    if(!uid) return null;
    const snap = await db.collection(COL_P).doc(uid).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async function getAllProfiles() {
    try {
      const snap = await db.collection(COL_P).limit(500).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate().toISOString() || "" }));
    } catch(e) { console.error(e); return []; }
  }

  async function createOrUpdateProfile(profileData, contactData) {
    const user = await ensureUser();
    const existing = await getUserProfile(user.uid);
    
    let code = existing?.code || makeCode();
    
    const safeProfile = { ...profileData, code, updatedAt: FV.serverTimestamp() };
    if(!existing) safeProfile.createdAt = FV.serverTimestamp();

    const safeContact = { email: contactData.email.toLowerCase(), phone: contactData.phone||"", linkedin: contactData.linkedin||"" };

    await db.runTransaction(async(tx) => {
      tx.set(db.collection(COL_P).doc(user.uid), safeProfile, { merge: true });
      tx.set(db.collection(COL_C).doc(user.uid), safeContact, { merge: true });
    });
    return { uid: user.uid, code };
  }

  async function deleteMyAccount() {
    const user = await ensureUser();
    if(!user) return;
    
    // Delete Profile
    await db.collection(COL_P).doc(user.uid).delete();
    // Delete Contact
    await db.collection(COL_C).doc(user.uid).delete();
    
    await auth.signOut(); // Force logout
  }

  async function sendRequest(toCode, message) {
    const user = await ensureUser();
    const mine = await getUserProfile(user.uid);
    if(!mine) return { error: "no_profile" };

    const all = await getAllProfiles();
    const to = all.find(a => a.code === toCode.toUpperCase());
    if(!to) return { error: "bad_code" };
    if(to.id === user.uid) return { error: "self" };

    // Check duplicate pending
    const dup = await db.collection(COL_R).where("fromUid","==",user.uid).where("toUid","==",to.id).where("status","==","pending").limit(1).get();
    if(!dup.empty) return { error: "duplicate" };

    // Rate limit simple check
    const since = new Date(Date.now() - 86400000);
    const recentSnap = await db.collection(COL_R).where("fromUid","==",user.uid).where("createdAt",">=",firebase.firestore.Timestamp.fromDate(since)).get();
    if(recentSnap.size >= 5) return { error: "rate_limited" };

    await db.collection(COL_R).add({
      fromUid: user.uid, toUid: to.id,
      fromName: mine.name, fromFaculty: mine.faculty,
      toName: to.title || to.name, toFaculty: to.faculty,
      message: message.trim().slice(0,500),
      status: "pending",
      createdAt: FV.serverTimestamp()
    });
    return { ok: true };
  }

  async function getMyRequests(dir) {
    const user = await ensureUser();
    if(!user) return [];
    const field = dir === "incoming" ? "toUid" : "fromUid";
    const snap = await db.collection(COL_R).where(field, "==", user.uid).orderBy("createdAt","desc").limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate().toISOString() || "" }));
  }

  async function updateRequestStatus(id, status) {
    await db.collection(COL_R).doc(id).update({ status });
  }

  async function saveSuggestion(data) {
    await db.collection(COL_S).add({ ...data, type: data.type || "contact_message", status: "new", createdAt: FV.serverTimestamp() });
  }

  // ==========================================
  // 3. UI Logic
  // ==========================================
  
  function toast(type, title, msg) {
    let c = $("#toastContainer");
    if(!c) { c=document.createElement("div"); c.id="toastContainer"; c.className="toast-container"; document.body.appendChild(c); }
    const ic={success:"check-circle-2",error:"x-circle",warning:"alert-triangle",info:"info"};
    const t=document.createElement("div"); t.className=`toast toast-${type}`;
    // نستخدم نفس أسماء data-lucide لأن CSS سيتعامل معها كـ Emojis
    t.innerHTML=`<div class="toast-icon"><i data-lucide="${ic[type]}"></i></div><div class="toast-content"><div class="toast-title">${esc(title)}</div><div class="toast-message">${esc(msg)}</div></div>`;
    c.appendChild(t); 
    icons(); // استدعاء آمن (فارغ حالياً)
    setTimeout(()=>t.remove(), 4000);
  }

  function openModal(id){ $(`#${id}`).classList.add("open"); document.body.style.overflow="hidden"; icons(); }
  function closeModals(){ $$(".modal.open").forEach(m=>m.classList.remove("open")); document.body.style.overflow=""; }

  // Global Listeners
  document.addEventListener("click", e => {
    if(e.target.closest("[data-open]")) { e.preventDefault(); openModal(e.target.dataset.open); }
    if(e.target.matches(".modal") || e.target.closest("[data-close]")) closeModals();
    if(e.key === "Escape") closeModals();
  });

  const page = document.body.dataset.page;

  // --- HOME PAGE ---
  async function initHome() {
    const row = $("#teamsRow");
    if(row) {
      try {
        const profiles = await getAllProfiles();
        const teams = profiles.filter(p => p.kind === "team");
        row.innerHTML = teams.length ? teams.map(p => `
          <div class="poster-cell">
            <a class="poster" href="search/search.html?tab=teams">
              <span class="p-badge"><i data-lucide="tag"></i> ${esc(p.projectType||"فريق")}</span>
              <span class="p-body"><span class="p-title">${esc(p.title||p.name)}</span></span>
            </a>
            <div class="p-meta"><span class="pm-faculty">${esc(p.faculty)}</span></div>
          </div>
        `).join("") : `<div class="empty rail-empty"><h3>لا مشاريع بعد</h3></div>`;
      } catch(e) { console.error(e); }
      icons(); 
    }
    
    // Suggest Form
    const sugForm = $("#sugForm");
    if(sugForm) sugForm.addEventListener("submit", async e => {
      e.preventDefault();
      await saveSuggestion({ name: $("#sugName").value, email: $("#sugEmail").value, content: $("#sugText").value, type: $("#sugType").value });
      closeModals(); toast("success","شكرًا","تم استلام اقتراحك.");
    });

    // Direct Contact Form
    const contForm = $("#directContactForm");
    if(contForm) contForm.addEventListener("submit", async e => {
      e.preventDefault();
      await saveSuggestion({ senderName: e.target.senderName.value, senderEmail: e.target.senderEmail.value, messageBody: e.target.messageBody.value, type: "contact_message" });
      closeModals(); toast("success","وصلتنا رسالتك","سنرد قريبًا.");
    });
  }

  // --- REGISTER PAGE ---
  async function initRegister() {
    const form = $("#registerForm");
    if(!form) return;
    
    // Fill Selects
    const facSel = $("#facSelect"); if(facSel) facSel.innerHTML = FACULTIES.map(f=>`<option value="${f}">${f}</option>`).join("");
    const typeSel = $("#typeSelect"); if(typeSel) typeSel.innerHTML = PROJECT_TYPES.map(t=>`<option value="${t}">${t}</option>`).join("");

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const kind = fd.get("kind");
      const profile = { kind, name: fd.get("name"), faculty: fd.get("faculty"), year: fd.get("year") };
      const contact = { email: fd.get("email"), phone: fd.get("phone"), linkedin: fd.get("linkedin") };
      
      if(kind === "team") {
        Object.assign(profile, { title: fd.get("title"), description: fd.get("description"), projectType: fd.get("projectType"), neededSpecialties: String(fd.get("neededSpecialties")).split(",").map(s=>s.trim()).filter(Boolean) });
      } else {
        Object.assign(profile, { specialty: fd.get("specialty"), skills: String(fd.get("skills")).split(",").map(s=>s.trim()).filter(Boolean), bio: fd.get("bio") });
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.innerHTML = "جارٍ النشر...";
      
      try {
        const res = await createOrUpdateProfile(profile, contact);
        $("#resultCode").textContent = res.code;
        $("#copyCode").setAttribute("data-copy", res.code);
        form.hidden = true; $("#successState").hidden = false;
        icons(); 
        toast("success","تم النشر!", `رمزك: ${res.code}`);
      } catch(err) {
        console.error(err);
        toast("error","فشل النشر", err.message);
      } finally {
        btn.disabled = false; btn.innerHTML = "انشر واحصل على رمزك";
      }
    });
  }

  // --- SEARCH PAGE ---
  async function initSearch() {
    const results = $("#results");
    const tabs = $$("#searchTabs .seg-btn");
    let currentTab = "teams";
    let cache = [];

    async function load() {
      results.innerHTML = `<div class="empty"><h3>جارٍ التحميل...</h3></div>`;
      const all = await getAllProfiles();
      cache = all.filter(p => p.kind === currentTab);
      render();
    }

    function render() {
      if(!cache.length) { results.innerHTML = `<div class="empty"><h3>لا نتائج</h3></div>`; icons(); return; }
      results.innerHTML = cache.map(p => {
        const isTeam = p.kind === "team";
        const chips = isTeam ? (p.neededSpecialties||[]).slice(0,3).map(s=>`<span class="chip">${esc(s)}</span>`).join("") : (p.skills||[]).slice(0,3).map(s=>`<span class="chip">${esc(s)}</span>`).join("");
        return `
          <article class="card team-card">
            <div class="tc-head">
              <div class="tc-avatar ${isTeam?'':'round'}">${esc(initial(isTeam?p.title:p.name))}</div>
              <div><h3 class="tc-title">${esc(isTeam?p.title:p.name)}</h3><div class="tc-meta">${esc(p.faculty)} · ${esc(isTeam?p.projectType:p.specialty)}</div></div>
            </div>
            <p class="tc-desc">${esc(isTeam?p.description:p.bio)}</p>
            <div class="tc-chips">${chips}</div>
            <div class="tc-foot">
              <button class="btn btn-primary btn-sm btn-block" data-code="${esc(p.code)}" data-name="${esc(isTeam?p.title:p.name)}">
                <i data-lucide="send"></i> ${isTeam?"اطلب الانضمام":"تواصل معه"}
              </button>
            </div>
          </article>
        `;
      }).join("");
      icons(); 
    }

    tabs.forEach(b => b.onclick = () => {
      tabs.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      currentTab = b.dataset.tab;
      load();
    });

    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-code]");
      if(!btn) return;
      const code = btn.dataset.code;
      const name = btn.dataset.name;
      $("#reqTo").textContent = name;
      $("#reqMsg").value = "";
      $("#sendReq").onclick = async () => {
        const msg = $("#reqMsg").value.trim();
        if(!msg) return toast("error","أدخل رسالة","");
        
        const res = await sendRequest(code, msg);
        if(res.ok) { closeModals(); toast("success","تم الإرسال","سيصل للطرف في لوحته."); }
        else if(res.error==="no_profile") toast("warning","سجل أولاً","أنشئ ملفك لإرسال الطلبات.");
        else if(res.error==="duplicate") toast("warning","طلب معلّق","لديك طلب سابق لنفس الشخص.");
        else if(res.error==="rate_limited") toast("warning","بلغت الحد","5 طلبات يومياً فقط.");
        else toast("error","فشل الإرسال", res.error);
      };
      openModal("reqModal");
    });

    load();
  }

  // --- DASHBOARD PAGE (FIXED AUTH ISSUE) ---
  async function initDashboard() {
    const gate = $("#gate");
    const panel = $("#panel");
    
    // Show loading state
    gate.hidden = false; panel.hidden = true;
    $("#gateTitle").textContent = "جارٍ التحقق...";
    $("#gateText").textContent = "لحظات.";
    icons(); 

    // CRITICAL FIX: Wait for auth state to settle
    const user = await waitForAuth();

    if (!user) {
      showNoSession();
      return;
    }

    const profile = await getUserProfile(user.uid);
    if (!profile) {
      showNoProfile();
      return;
    }

    // Success: Render Dashboard
    gate.hidden = true; panel.hidden = false;
    renderDashHead(profile);
    bindDashActions(user.uid);
    refreshDashLists(user.uid);
  }

  function showNoSession() {
    $("#gate").hidden=false; $("#panel").hidden=true;
    $("#gateTitle").textContent="لا توجد جلسة";
    $("#gateText").textContent="أنشئ ملفك لتبدأ.";
    $("#gateBtn").innerHTML='<i data-lucide="user-plus"></i> أنشئ ملفّي';
    $("#gateBtn").onclick=()=>location.href="../register/register.html";
    icons(); 
  }
  function showNoProfile() {
    $("#gate").hidden=false; $("#panel").hidden=true;
    $("#gateTitle").textContent="أكمل التسجيل";
    $("#gateText").textContent="وُجدت جلسة لكن لا ملف.";
    $("#gateBtn").innerHTML='<i data-lucide="square-pen"></i> أنشئ ملفّي';
    $("#gateBtn").onclick=()=>location.href="../register/register.html";
    icons(); 
  }

  function renderDashHead(p) {
    $("#dashHead").innerHTML = `
      <div class="avatar">${esc(initial(p.name))}</div>
      <div>
        <div class="dash-name">${esc(p.name)}</div>
        <div class="dash-meta">${esc(p.kind==='team'?'صاحب مشروع':'شريك')} · ${esc(p.faculty)}</div>
      </div>
      <button class="dash-code" data-copy="${esc(p.code)}"><i data-lucide="hash"></i> ${esc(p.code)}</button>
    `;
    icons(); 
  }

  function bindDashActions(uid) {
    // Tabs
    $$("#dashTabs .seg-btn").forEach(b => b.onclick = () => {
      $$("#dashTabs .seg-btn").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      refreshDashLists(uid, b.dataset.d);
    });

    // Accept/Reject/Delete Request
    document.addEventListener("click", async e => {
      const act = e.target.closest("[data-action]");
      if(!act) return;
      const id = act.dataset.id;
      const action = act.dataset.action; // accept, reject, delete_req
      
      if(action === "delete_req") {
        if(confirm("حذف هذا الطلب؟")) {
          await db.collection(COL_R).doc(id).delete();
          toast("info","تم الحذف","");
          refreshDashLists(uid);
        }
        return;
      }

      const status = action === "accept" ? "accepted" : "rejected";
      await updateRequestStatus(id, status);
      toast("success", action==="accept"?"قبلت الطلب":"رفضت الطلب", "");
      refreshDashLists(uid);
    });

    // Logout / Switch Account
    $("#switchAcc").onclick = async () => {
      if(confirm("إنهاء الجلسة على هذا الجهاز؟")) {
        await auth.signOut();
        location.reload();
      }
    };

    // DELETE MY PROFILE BUTTON (New Feature)
    const delBtn = $("#deleteProfileBtn");
    if(delBtn) {
      delBtn.onclick = async () => {
        if(confirm("⚠️ تحذير: سيتم حذف ملفك وعرضك نهائياً من المنصة. هل أنت متأكد؟")) {
          delBtn.disabled = true; delBtn.textContent = "جارٍ الحذف...";
          try {
            await deleteMyAccount();
            alert("تم حذف حسابك بنجاح. ستعود للصفحة الرئيسية.");
            location.href = "../index.html";
          } catch(err) {
            alert("خطأ: " + err.message);
            delBtn.disabled = false; delBtn.textContent = "حذف عرضي / ملفي";
          }
        }
      };
    }
  }

  async function refreshDashLists(uid, tab="incoming") {
    const listEl = $("#reqList");
    listEl.innerHTML = `<div class="empty"><h3>جارٍ التحميل...</h3></div>`;
    icons(); 
    
    const reqs = await getMyRequests(tab);
    
    if(!reqs.length) {
      listEl.innerHTML = `<div class="empty"><h3>${tab==='incoming'?'لا طلبات واردة':'لا طلبات صادرة'}</h3></div>`;
      icons();
      return;
    }

    listEl.innerHTML = reqs.map(r => {
      const otherName = tab==='incoming' ? r.fromName : r.toName;
      const stClass = r.status;
      const actions = r.status === 'pending' && tab === 'incoming' 
        ? `<button class="btn btn-primary btn-sm" data-action="accept" data-id="${r.id}">قبل</button>
           <button class="btn btn-glass btn-sm" data-action="reject" data-id="${r.id}">ارفض</button>`
        : `<button class="btn btn-quiet btn-sm" data-action="delete_req" data-id="${r.id}"><i data-lucide="trash-2"></i> حذف</button>`;
      
      return `
        <article class="req ${stClass}">
          <div class="req-top">
            <div class="avatar">${esc(initial(otherName))}</div>
            <div class="req-who"><b>${esc(otherName)}</b><span>${esc(r.fromFaculty||r.toFaculty)}</span></div>
            <span class="status ${stClass}">${r.status==='pending'?'معلّق':r.status==='accepted'?'مقبول':'مرفوض'}</span>
          </div>
          <div class="req-msg">${esc(r.message)}</div>
          <div class="req-actions">${actions}</div>
        </article>
      `;
    }).join("");
    icons(); 
  }

  // --- ADMIN PAGE ---
  async function initAdmin() {
    const container = $("#messagesList");
    if(!container) return;
    container.innerHTML = `<div class="empty"><h3>جارٍ التحميل...</h3></div>`;
    icons(); 
    
    await ensureUser(); // Ensure we have an ID to pass security rules
    const snap = await db.collection(COL_S).orderBy("createdAt","desc").limit(100).get();
    
    if(snap.empty) { container.innerHTML = `<div class="empty"><h3>لا رسائل</h3></div>`; icons(); return; }
    
    container.innerHTML = snap.docs.map(d => {
      const m = d.data();
      const isMsg = m.type === "contact_message";
      return `
        <div class="msg-card">
          <div class="msg-head">
            <div class="msg-from">
              <span class="msg-name">${esc(m.senderName||m.name||"زائر")}</span>
              <span class="msg-email">${esc(m.senderEmail||m.email||"")}</span>
            </div>
            <span class="msg-type">${isMsg?"رسالة":"اقتراح"}</span>
          </div>
          <div class="msg-body">${esc(m.messageBody||m.content||"")}</div>
          <div class="msg-actions">
             <a href="mailto:${esc(m.senderEmail||m.email)}" class="btn btn-primary btn-sm">رد</a>
          </div>
        </div>
      `;
    }).join("");
    icons(); 
  }

  // Router
  if(page==="home") initHome();
  else if(page==="register") initRegister();
  else if(page==="search") initSearch();
  else if(page==="dashboard") initDashboard();
  else if(page==="admin") initAdmin();

})();
