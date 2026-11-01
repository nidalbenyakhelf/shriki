/* ============================================================
   شريك — Universal Engine vFinal (All Pages Supported)
   Handles: Home Search, Register Form, Dashboard Auth, Global UI.
   ============================================================ */

(function() {
  'use strict';

  // ==========================================
  // 1. Global Config & Init
  // ==========================================
  const firebaseConfig = {
    apiKey: "AIzaSyCJC93gVdQgYjLUBOOW9JA0m_44xBximIs",
    authDomain: "shriki-813a9.firebaseapp.com",
    projectId: "shriki-813a9",
    storageBucket: "shriki-813a9.firebasestorage.app",
    messagingSenderId: "177417794605",
    appId: "1:177417794605:web:c2a332887cb53787cfb4a4"
  };

  let db, auth;
  let isFirebaseReady = false;

  document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    bindGlobalUI(); // Events that work everywhere (Menu, Modals, Share)
    
    const page = document.body.dataset.page;
    if (page === 'home') initHomePage();
    else if (page === 'register') initRegisterPage();
    else if (page === 'dashboard') initDashboardPage();
    else if (page === 'search') initSearchPage(); // Reuses home logic mostly
    
    // Set current year in footer
    const yearEl = document.getElementById('year');
    if(yearEl) yearEl.textContent = new Date().getFullYear();
  });

  function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    isFirebaseReady = true;
    
    // Try silent anonymous login for permissions
    auth.signInAnonymously().catch(err => console.warn("Silent Auth Fail:", err));
  }

  // ==========================================
  // 2. Global UI Logic (Works on ALL pages)
  // ==========================================
  function bindGlobalUI() {
    // A. Mobile Menu Toggle
    const menuBtn = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    if(menuBtn && navLinks) {
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        navLinks.classList.toggle('open');
      };
      document.addEventListener('click', (e) => {
        if(navLinks.classList.contains('open') && !navLinks.contains(e.target) && !menuBtn.contains(e.target)) {
          navLinks.classList.remove('open');
        }
      });
    }

    // B. Contact Dropdown (Lightbulb)
    const contactBtn = document.getElementById('contactMenuBtn');
    const contactMenu = document.getElementById('contactMenu');
    if(contactBtn && contactMenu) {
      contactBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = contactMenu.style.display === 'flex';
        document.querySelectorAll('.pop-menu').forEach(m => m.style.display = 'none');
        contactMenu.style.display = isOpen ? 'none' : 'flex';
      };
      document.addEventListener('click', () => contactMenu.style.display = 'none');
    }

    // C. Modals Open/Close
    document.querySelectorAll('[data-open]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const modal = document.getElementById(btn.dataset.open);
        if(modal) {
          modal.classList.add('open');
          document.body.style.overflow = 'hidden';
        }
      };
    });
    
    document.querySelectorAll('[data-close], .modal').forEach(el => {
      el.onclick = (e) => {
        if(e.target.matches('.modal') || e.target.closest('[data-close]')) {
          document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
          document.body.style.overflow = '';
        }
      };
    });

    // D. Share Buttons
    document.querySelectorAll('[data-share]').forEach(btn => {
      btn.onclick = async () => {
        const url = window.location.href;
        if(navigator.share) {
          try { await navigator.share({ title: 'شريك', text: 'منصة تكوين الفرق الجامعية', url }); } catch(e){}
        } else {
          try { await navigator.clipboard.writeText(url); alert('تم نسخ الرابط!'); } catch(e){ alert('انسخ يدويا.'); }
        }
      };
    });

    // E. Generic Forms (Suggestion/Contact) - Simple Mock for Stability
    const sugForm = document.getElementById('sugForm');
    if(sugForm) sugForm.onsubmit = (e) => { 
      e.preventDefault(); 
      alert('شكرا لك! تم استلام اقتراحك.'); 
      sugForm.reset(); 
      document.getElementById('suggestModal').classList.remove('open'); 
    };
    
    const contForm = document.getElementById('directContactForm');
    if(contForm) contForm.onsubmit = (e) => { 
      e.preventDefault(); 
      alert('وصلتنا رسالتك، سنرد قريبا.'); 
      contForm.reset(); 
      document.getElementById('contactModal').classList.remove('open'); 
    };
  }

  // ==========================================
  // 3. Page Specific Logic: HOME
  // ==========================================
  function initHomePage() {
    let projectsCache = [];
    let currentState = { type: 'all', keyword: '', faculty: '' };
    const row = document.getElementById('teamsRow');
    const summary = document.getElementById('results-summary');

    async function loadData() {
      if(!isFirebaseReady || !row) return;
      row.innerHTML = `<div class="empty rail-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>جارٍ التحميل...</p></div>`;
      try {
        const snapshot = await db.collection('projects').orderBy('createdAt','desc').limit(50).get();
        projectsCache = [];
        snapshot.forEach(doc => projectsCache.push({id:doc.id, ...doc.data()}));
        render();
      } catch(e) {
        row.innerHTML = `<div class="empty rail-empty"><h3>تعذر الاتصال</h3></div>`;
      }
    }

    function render() {
      if(!row) return;
      let filtered = [...projectsCache];
      if(currentState.type !== 'all') filtered = filtered.filter(p=>p.type===currentState.type);
      if(currentState.faculty) filtered = filtered.filter(p=>p.faculty&&p.faculty.includes(currentState.faculty));
      if(currentState.keyword.trim()) {
        const t = currentState.keyword.toLowerCase();
        filtered = filtered.filter(p=>(p.title||'').toLowerCase().includes(t)||(p.description||'').toLowerCase().includes(t));
      }
      
      if(summary) summary.textContent = `${filtered.length} مشروع`;
      
      if(filtered.length===0) {
        row.innerHTML = `<div class="empty rail-empty"><h3>لا توجد نتائج</h3></div>`;
        return;
      }

      row.innerHTML = filtered.map(p => {
        let badge='neutral', icon='tag';
        if(p.type==='thesis'){badge='blue';icon='graduation-cap';}
        else if(p.type==='startup'){badge='green';icon='rocket';}
        else if(p.type==='initiative'){badge='purple';icon='heart';}
        
        return `
        <div class="poster-cell">
          <a class="poster" href="search/search.html?id=${p.id}">
            <span class="p-badge ${badge}"><i class="fa-solid ${icon}"></i> ${getTypeLabel(p.type)}</span>
            <span class="p-body"><span class="p-title">${esc(p.title)}</span></span>
          </a>
          <div class="p-meta">
            <span class="pm-faculty"><i class="fa-solid fa-building-columns"></i> ${esc(p.faculty||'عام')}</span>
          </div>
        </div>`;
      }).join("");
    }

    // Bind Search Events
    document.querySelectorAll('.se-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.se-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        currentState.type = tab.dataset.type;
        render();
      };
    });

    const searchInput = document.getElementById('local-search-input');
    let debounce;
    if(searchInput) searchInput.oninput = (e)=>{
      clearTimeout(debounce);
      debounce=setTimeout(()=>{currentState.keyword=e.target.value;render();},300);
    };

    const facSelect = document.getElementById('local-faculty-select');
    if(facSelect) facSelect.onchange = (e)=>{currentState.faculty=e.target.value;render();};

    loadData();
  }

  // ==========================================
  // 4. Page Specific Logic: REGISTER
  // ==========================================
  function initRegisterPage() {
    const form = document.getElementById('registerForm');
    if(!form) return;

    // ★ IMPORTANT: Populate Selects Dynamically ★
    populateSelects();

    // Handle Kind Tabs (Team vs Student)
    const kindTabs = document.querySelectorAll('#kindTabs .seg-btn');
    const paneTeam = document.getElementById('paneTeam');
    const paneStudent = document.getElementById('paneStudent');
    const kindField = document.getElementById('kindField');

    kindTabs.forEach(btn => {
      btn.onclick = () => {
        kindTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const kind = btn.dataset.kind;
        kindField.value = kind;
        
        if(kind === 'team') {
          paneTeam.hidden = false;
          paneStudent.hidden = true;
        } else {
          paneTeam.hidden = true;
          paneStudent.hidden = false;
        }
      };
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      if(!isFirebaseReady) return alert("انتظر تحميل النظام...");

      const btn = form.querySelector('button[type="submit"]');
      const origTxt = btn.innerText;
      btn.disabled=true; btn.innerText="جارٍ النشر...";

      const fd = new FormData(form);
      const kind = fd.get('kind');
      
      const profileData = {
        kind: kind,
        name: fd.get('name'),
        faculty: fd.get('faculty'),
        year: fd.get('year'),
        email: fd.get('email'), // Stored for contact
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if(kind === 'team') {
        Object.assign(profileData, {
          title: fd.get('title'),
          description: fd.get('description'),
          type: fd.get('projectType'), 
          neededSkill: fd.get('neededSpecialties'),
        });
      } else {
        Object.assign(profileData, {
          specialty: fd.get('specialty'),
          skills: fd.get('skills'),
          bio: fd.get('bio'),
        });
      }

      try {
        // Save to Firestore Collection 'projects'
        await db.collection('projects').add(profileData);
        
        // Show Success State
        form.hidden = true;
        const successState = document.getElementById('successState');
        if(successState) successState.hidden = false;
        
        const codeBox = document.getElementById('resultCode');
        if(codeBox) codeBox.textContent = "SHRK-" + Math.random().toString(36).substr(2, 8).toUpperCase();
        
        alert("تم نشر مشروعك بنجاح!");
      } catch(err) {
        console.error(err);
        alert("فشل النشر: " + err.message);
      } finally {
        btn.disabled=false; btn.innerText=origTxt;
      }
    };
  }

  function populateSelects() {
    const faculties = ["كلية العلوم","كلية التكنولوجيا","كلية العلوم الإنسانية والاجتماعية","كلية الآداب واللغات","كلية الحقوق والعلوم السياسية","كلية العلوم الاقتصادية"];
    const years = ["السنة الأولى","السنة الثانية","السنة الثالثة","السنة الرابعة","ماستر","دكتوراه"];
    const types = ["مذكرة تخرج","شركة ناشئة","مشروع خارج الجامعة","مسابقة / بحث علمي","مبادرة خيرية"];

    const fillSelect = (selector, options, placeholder) => {
      const el = document.querySelector(selector);
      if(el) {
        el.innerHTML = `<option value="" disabled selected>${placeholder}</option>` + 
                       options.map(o => `<option value="${o}">${o}</option>`).join('');
      }
    };

    fillSelect('select[name="faculty"]', faculties, 'اختر كليتك');
    fillSelect('select[name="year"]', years, 'اختر سنتك');
    fillSelect('select[name="projectType"]', types, 'اختر نوع المشروع');
  }

  // ==========================================
  // 5. Page Specific Logic: DASHBOARD
  // ==========================================
  function initDashboardPage() {
    const gate = document.getElementById('gate');
    const panel = document.getElementById('panel');
    if(!gate || !panel) return;

    // Check Auth Status
    auth.onAuthStateChanged(user => {
      if(user) {
        loadUserProfile(user.uid);
      } else {
        showGate("لا توجد جلسة", "أنشئ ملفك لتبدأ.", "../register/register.html");
      }
    });

    function showGate(title, msg, link) {
      gate.hidden = false; panel.hidden = true;
      const gTitle = document.getElementById('gateTitle');
      const gText = document.getElementById('gateText');
      const gBtn = document.getElementById('gateBtn');
      
      if(gTitle) gTitle.textContent = title;
      if(gText) gText.textContent = msg;
      if(gBtn) gBtn.onclick = ()=>location.href=link;
    }

    async function loadUserProfile(uid) {
      try {
        // Query projects owned by this user (assuming we store uid or match by email/name for demo)
        // For robustness, let's assume we query all and filter client-side or use a dedicated 'users' collection.
        // Here we'll just fetch recent projects for the demo dashboard view.
        
        const snap = await db.collection('projects').where('email', '==', auth.currentUser.email).limit(5).get();
        
        gate.hidden = true; panel.hidden = false;
        
        const dashHead = document.getElementById('dashHead');
        if(dashHead) {
          dashHead.innerHTML = `
            <div class="avatar">U</div>
            <div>
              <div class="dash-name">مرحبا بك (${auth.currentUser.email})</div>
              <div class="dash-meta">عدد مشاريعك: ${snap.size}</div>
            </div>
          `;
        }

        // Logout Button
        const switchAcc = document.getElementById('switchAcc');
        if(switchAcc) switchAcc.onclick = async ()=>{
          if(confirm("إنهاء الجلسة؟")) {
            await auth.signOut();
            location.reload();
          }
        };

      } catch(e) {
        showGate("خطأ في التحميل", e.message, "#");
      }
    }
  }

  // ==========================================
  // 6. Page Specific Logic: SEARCH
  // ==========================================
  function initSearchPage() {
    // For now, reuse Home logic but maybe hide the Hero section if present
    initHomePage(); 
  }

  // Utilities
  function getTypeLabel(type) {
    switch(type) {
      case 'thesis': return 'مذكرة تخرج';
      case 'startup': return 'شركة ناشئة';
      case 'initiative': return 'مبادرة';
      default: return 'مشروع';
    }
  }
  
  function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"<").replace(/>/g,">");
  }

})();
