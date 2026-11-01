/* ============================================================
   شريك — Simple & Stable Engine (No Auth Complexity)
   Strategy: Direct Read/Write to Firestore 'projects' collection.
   Relies on Open Security Rules for simplicity and stability.
   ============================================================ */

(function() {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyCJC93gVdQgYjLUBOOW9JA0m_44xBximIs",
    authDomain: "shriki-813a9.firebaseapp.com",
    projectId: "shriki-813a9",
    storageBucket: "shriki-813a9.firebasestorage.app",
    messagingSenderId: "177417794605",
    appId: "1:177417794605:web:c2a332887cb53787cfb4a4"
  };

  let db;
  
  document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    bindGlobalUI();
    
    const page = document.body.dataset.page;
    if (page === 'home') initHomePage();
    else if (page === 'register') initRegisterPage();
    else if (page === 'dashboard') initDashboardPage();
    else if (page === 'search') initSearchPage();
    
    // Set Year
    const y = document.getElementById('year');
    if(y) y.textContent = new Date().getFullYear();
  });

  function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("✅ Firebase Ready (Direct Access Mode)");
  }

  // ==========================================
  // Global UI (Menu, Modals, Share)
  // ==========================================
  function bindGlobalUI() {
    // Mobile Menu
    const menuBtn = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    if(menuBtn && navLinks) {
      menuBtn.onclick = (e) => { e.stopPropagation(); navLinks.classList.toggle('open'); };
      document.addEventListener('click', (e) => {
        if(navLinks.classList.contains('open') && !navLinks.contains(e.target) && !menuBtn.contains(e.target)) {
          navLinks.classList.remove('open');
        }
      });
    }

    // Contact Dropdown
    const contactBtn = document.getElementById('contactMenuBtn');
    const contactMenu = document.getElementById('contactMenu');
    if(contactBtn && contactMenu) {
      contactBtn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const isOpen = contactMenu.style.display === 'flex';
        document.querySelectorAll('.pop-menu').forEach(m => m.style.display = 'none');
        contactMenu.style.display = isOpen ? 'none' : 'flex';
      };
      document.addEventListener('click', () => contactMenu.style.display = 'none');
    }

    // Modals
    document.querySelectorAll('[data-open]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const modal = document.getElementById(btn.dataset.open);
        if(modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
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

    // Share
    document.querySelectorAll('[data-share]').forEach(btn => {
      btn.onclick = async () => {
        const url = window.location.href;
        if(navigator.share) { try { await navigator.share({ title: 'شريك', text: 'منصة تكوين الفرق', url }); } catch(e){} }
        else { try { await navigator.clipboard.writeText(url); alert('تم نسخ الرابط!'); } catch(e){ alert('انسخ يدويا.'); } }
      };
    });

    // Forms Mock
    const sugForm = document.getElementById('sugForm');
    if(sugForm) sugForm.onsubmit = (e) => { e.preventDefault(); alert('شكرا!'); sugForm.reset(); document.getElementById('suggestModal').classList.remove('open'); };
    const contForm = document.getElementById('directContactForm');
    if(contForm) contForm.onsubmit = (e) => { e.preventDefault(); alert('وصلتنا!'); contForm.reset(); document.getElementById('contactModal').classList.remove('open'); };
  }

  // ==========================================
  // HOME PAGE Logic
  // ==========================================
  function initHomePage() {
    const row = document.getElementById('teamsRow');
    const summary = document.getElementById('results-summary');
    let cache = [];
    let filters = { type: 'all', keyword: '', faculty: '' };

    async function load() {
      if(!row) return;
      row.innerHTML = `<div class="empty rail-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>جارٍ التحميل...</p></div>`;
      try {
        // DIRECT READ - No Auth Check needed anymore
        const snap = await db.collection('projects').orderBy('createdAt','desc').limit(50).get();
        cache = snap.docs.map(d => ({id:d.id, ...d.data()}));
        render();
      } catch(e) {
        console.error(e);
        row.innerHTML = `<div class="empty rail-empty"><h3>خطأ في الاتصال</h3><p>${e.message}</p></div>`;
      }
    }

    function render() {
      if(!row) return;
      let filtered = [...cache];
      if(filters.type !== 'all') filtered = filtered.filter(p=>p.type===filters.type);
      if(filters.faculty) filtered = filtered.filter(p=>p.faculty&&p.faculty.includes(filters.faculty));
      if(filters.keyword.trim()) {
        const t = filters.keyword.toLowerCase();
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
        filters.type = tab.dataset.type;
        render();
      };
    });

    const searchInput = document.getElementById('local-search-input');
    let debounce;
    if(searchInput) searchInput.oninput = (e)=>{
      clearTimeout(debounce);
      debounce=setTimeout(()=>{filters.keyword=e.target.value;render();},300);
    };

    const facSelect = document.getElementById('local-faculty-select');
    if(facSelect) facSelect.onchange = (e)=>{filters.faculty=e.target.value;render();};

    load();
  }

  // ==========================================
  // REGISTER PAGE Logic
  // ==========================================
  function initRegisterPage() {
    const form = document.getElementById('registerForm');
    if(!form) return;

    populateSelects();

    // Kind Tabs
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
        if(kind === 'team') { paneTeam.hidden = false; paneStudent.hidden = true; }
        else { paneTeam.hidden = true; paneStudent.hidden = false; }
      };
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const origTxt = btn.innerText;
      btn.disabled=true; btn.innerText="جارٍ النشر...";

      const fd = new FormData(form);
      const kind = fd.get('kind');
      
      const data = {
        kind: kind,
        name: fd.get('name'),
        faculty: fd.get('faculty'),
        year: fd.get('year'),
        email: fd.get('email'),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if(kind === 'team') {
        Object.assign(data, {
          title: fd.get('title'),
          description: fd.get('description'),
          type: fd.get('projectType'), 
          neededSkill: fd.get('neededSpecialties'),
        });
      } else {
        Object.assign(data, {
          specialty: fd.get('specialty'),
          skills: fd.get('skills'),
          bio: fd.get('bio'),
        });
      }

      try {
        // DIRECT WRITE - No Auth Check needed
        await db.collection('projects').add(data);
        
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

    const fill = (sel, opts, ph) => {
      const el = document.querySelector(sel);
      if(el) el.innerHTML = `<option value="" disabled selected>${ph}</option>` + opts.map(o=>`<option value="${o}">${o}</option>`).join('');
    };

    fill('select[name="faculty"]', faculties, 'اختر كليتك');
    fill('select[name="year"]', years, 'اختر سنتك');
    fill('select[name="projectType"]', types, 'اختر نوع المشروع');
  }

  // ==========================================
  // DASHBOARD PAGE Logic (Simplified View)
  // ==========================================
  function initDashboardPage() {
    const gate = document.getElementById('gate');
    const panel = document.getElementById('panel');
    if(!gate || !panel) return;

    // Since we removed auth dependency for writing, Dashboard is now just a view of "My Projects"
    // We can identify "My Projects" by matching the Email entered during registration? 
    // Or simpler: Just show all projects as a management list for demo purposes until real auth is added back properly.
    
    gate.hidden = true; panel.hidden = false;
    
    const dashHead = document.getElementById('dashHead');
    if(dashHead) {
      dashHead.innerHTML = `
        <div class="avatar">U</div>
        <div>
          <div class="dash-name">لوحة العرض العام</div>
          <div class="dash-meta">جميع المشاريع المنشورة</div>
        </div>
      `;
    }

    // Load all projects into dashboard list
    const reqList = document.getElementById('reqList');
    if(reqList) {
      reqList.innerHTML = `<div class="empty"><h3>جارٍ التحميل...</h3></div>`;
      db.collection('projects').orderBy('createdAt','desc').limit(20).get().then(snap => {
        if(snap.empty) {
          reqList.innerHTML = `<div class="empty"><h3>لا توجد مشاريع بعد</h3></div>`;
          return;
        }
        reqList.innerHTML = snap.docs.map(d => {
          const p = d.data();
          return `
          <article class="req">
            <div class="req-top">
              <div class="avatar">${esc((p.name||'ط').charAt(0))}</div>
              <div class="req-who"><b>${esc(p.title||p.name)}</b><span>${esc(p.faculty)}</span></div>
              <span class="status accepted">${getTypeLabel(p.type)}</span>
            </div>
            <div class="req-msg">${esc(p.description||p.bio||'')}</div>
            <div class="req-actions">
              <a href="mailto:${esc(p.email)}" class="btn btn-primary btn-sm">تواصل</a>
            </div>
          </article>`;
        }).join("");
      }).catch(e => {
        reqList.innerHTML = `<div class="empty"><h3>خطأ: ${e.message}</h3></div>`;
      });
    }
  }

  function initSearchPage() { initHomePage(); }

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
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

})();
