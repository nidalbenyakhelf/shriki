/* ============================================================
   شريك — Stable Release vFinal (Hybrid Design)
   Strategy: One-time Fetch + Client-Side Search (Kayak Logic)
   Target: Preserve Original Visuals, Fix Functionality.
   ============================================================ */

(function() {
  'use strict';

  // ==========================================
  // 1. Config & Init
  // ==========================================
  const firebaseConfig = {
    apiKey: "AIzaSyCJC93gVdQgYjLUBOOW9JA0m_44xBximIs",
    authDomain: "shriki-813a9.firebaseapp.com",
    projectId: "shriki-813a9",
    storageBucket: "shriki-813a9.firebasestorage.app",
    messagingSenderId: "177417794605",
    appId: "1:177417794605:web:c2a332887cb53787cfb4a4"
  };

  let db;
  let auth;
  let projectsCache = []; // ذاكرة التخزين المؤقت للبحث السريع
  
  // State for current filters
  let currentState = {
    type: 'all',
    keyword: '',
    faculty: ''
  };

  document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    bindUIEvents(); // ربط الأزرار أولاً لضمان عملها حتى لو فشلت البيانات
    loadInitialData(); // ثم جلب البيانات
  });

  function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    
    // Silent Auth attempt to satisfy security rules if needed
    auth.signInAnonymously().catch(err => console.warn("Auth silent fail:", err));
  }

  // ==========================================
  // 2. Data Layer (Fetch Once, Render Many)
  // ==========================================
  async function loadInitialData() {
    const row = document.getElementById('teamsRow');
    const summary = document.getElementById('results-summary');
    
    if(row) row.innerHTML = `<div class="empty rail-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>جارٍ تحميل المواهب...</p></div>`;
    if(summary) summary.textContent = "جارٍ التحديث...";

    try {
      // Fetch latest 50 projects (Enough for homepage scroll)
      const snapshot = await db.collection('projects')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      projectsCache = [];
      snapshot.forEach(doc => {
        projectsCache.push({ id: doc.id, ...doc.data() });
      });

      renderProjects(); // Initial Render

    } catch (error) {
      console.error("DB Error:", error);
      if(row) row.innerHTML = `<div class="empty rail-empty"><h3>تعذر الاتصال بالخادم</h3><p>${error.message}</p></div>`;
      if(summary) summary.textContent = "خطأ في الاتصال";
    }
  }

  // ==========================================
  // 3. Rendering Logic (The Core)
  // ==========================================
  function renderProjects() {
    const row = document.getElementById('teamsRow');
    const summary = document.getElementById('results-summary');
    if(!row) return;

    // Apply Filters locally (Super Fast!)
    let filtered = [...projectsCache];

    // Filter by Type (Tabs)
    if (currentState.type !== 'all') {
      filtered = filtered.filter(p => p.type === currentState.type);
    }

    // Filter by Faculty (Dropdown)
    if (currentState.faculty) {
      filtered = filtered.filter(p => 
        p.faculty && p.faculty.includes(currentState.faculty)
      );
    }

    // Filter by Keyword (Search Input)
    if (currentState.keyword.trim()) {
      const term = currentState.keyword.toLowerCase();
      filtered = filtered.filter(p => 
        (p.title && p.title.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        (p.neededSkill && p.neededSkill.toLowerCase().includes(term))
      );
    }

    // Update Summary Text
    if(summary) {
      summary.textContent = `${filtered.length} مشروع مطابق`;
    }

    // Generate HTML
    if (filtered.length === 0) {
      row.innerHTML = `<div class="empty rail-empty"><h3>لا توجد نتائج مطابقة</h3><p>جرّب تغيير كلمات البحث.</p></div>`;
      return;
    }

    row.innerHTML = filtered.map((p, index) => {
      // Staggered animation delay for visual polish
      const delay = Math.min(index * 50, 500); 
      
      // Determine Badge Color/Icon based on type
      let badgeClass = 'neutral';
      let icon = 'tag';
      if(p.type === 'thesis') { badgeClass = 'blue'; icon = 'graduation-cap'; }
      else if(p.type === 'startup') { badgeClass = 'green'; icon = 'rocket'; }
      else if(p.type === 'initiative') { badgeClass = 'purple'; icon = 'heart'; }

      return `
        <div class="poster-cell" style="animation-delay: ${delay}ms">
          <a class="poster" href="search/search.html?id=${p.id}">
            <span class="p-badge ${badgeClass}"><i class="fa-solid ${icon}"></i> ${esc(getTypeLabel(p.type))}</span>
            <span class="p-body">
              <span class="p-title">${esc(p.title)}</span>
            </span>
          </a>
          <div class="p-meta">
            <span class="pm-faculty"><i class="fa-solid fa-building-columns"></i> ${esc(p.faculty || 'عام')}</span>
            <span class="pm-needs">${esc(p.neededSkill ? 'يحتاج: '+p.neededSkill : '')}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  // Helper for labels
  function getTypeLabel(type) {
    switch(type) {
      case 'thesis': return 'مذكرة تخرج';
      case 'startup': return 'شركة ناشئة';
      case 'initiative': return 'مبادرة';
      default: return 'مشروع';
    }
  }

  // ==========================================
  // 4. UI Event Binding (Robust & Independent)
  // ==========================================
  function bindUIEvents() {
    // A. Mobile Menu Toggle
    const menuBtn = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    if(menuBtn && navLinks) {
      menuBtn.onclick = () => navLinks.classList.toggle('open');
      // Close when clicking outside
      document.addEventListener('click', e => {
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
        e.stopPropagation();
        const isOpen = contactMenu.style.display === 'flex';
        // Close others first
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
          try { await navigator.clipboard.writeText(url); alert('تم نسخ الرابط!'); } catch(e){ alert('انسخ الرابط يدوياً.'); }
        }
      };
    });

    // E. Forms Submission (Mock/Simple)
    const sugForm = document.getElementById('sugForm');
    if(sugForm) sugForm.onsubmit = (e) => { e.preventDefault(); alert('شكراً لاقتراحك!'); sugForm.reset(); document.getElementById('suggestModal').classList.remove('open'); };
    
    const contForm = document.getElementById('directContactForm');
    if(contForm) contForm.onsubmit = (e) => { e.preventDefault(); alert('وصلتنا رسالتك!'); contForm.reset(); document.getElementById('contactModal').classList.remove('open'); };

    // F. SEARCH ENGINE LOGIC (The Kayak Part)
    
    // Tabs
    document.querySelectorAll('.se-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.se-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentState.type = tab.dataset.type;
        renderProjects();
      };
    });

    // Inputs (Debounced for performance)
    const searchInput = document.getElementById('local-search-input');
    let debounceTimer;
    if(searchInput) {
      searchInput.oninput = (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          currentState.keyword = e.target.value;
          renderProjects();
        }, 300);
      };
    }

    // Select
    const facultySelect = document.getElementById('local-faculty-select');
    if(facultySelect) {
      facultySelect.onchange = (e) => {
        currentState.faculty = e.target.value;
        renderProjects();
      };
    }
  }

  // Utility
  function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

})();
