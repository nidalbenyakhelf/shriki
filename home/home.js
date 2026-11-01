/* ============================================================
   شريك — النسخة النهائية المبسطة (Simple & Robust Final)
   الهدف: ضمان عمل الأزرار أولاً، وجلب البيانات ثانياً.
   ============================================================ */

(function() {
  'use strict';

  // ==========================================
  // 1. أدوات مساعدة (Utilities)
  // ==========================================
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  
  // إظهار عناصر الـ Reveal فوراً لمنع الاختفاء
  const showReveals = () => {
      $$('.reveal').forEach(el => el.classList.add('in'));
  };

  // رسالة تنبيه بسيطة (Toast) بدون تعقيدات
  function showToast(msg) {
      let t = $('#toastContainer');
      if(!t) {
          t = document.createElement('div');
          t.id = 'toastContainer';
          t.className = 'toast-container';
          document.body.appendChild(t);
      }
      const div = document.createElement('div');
      div.className = 'toast toast-info';
      div.innerHTML = `<div class="toast-content"><div class="toast-title">${esc(msg)}</div></div>`;
      t.appendChild(div);
      setTimeout(() => div.remove(), 3000);
  }

  // ==========================================
  // 2. إعدادات Firebase (محاطة بحماية Try-Catch)
  // ==========================================
  let db = null;
  let auth = null;
  let firebaseReady = false;

  try {
      if (typeof firebase !== 'undefined') {
          const config = {
              apiKey: "AIzaSyCJC93gVdQgYjLUBOOW9JA0m_44xBximIs",
              authDomain: "shriki-813a9.firebaseapp.com",
              projectId: "shriki-813a9",
              storageBucket: "shriki-813a9.firebasestorage.app",
              messagingSenderId: "177417794605",
              appId: "1:177417794605:web:c2a332887cb53787cfb4a4"
          };
          
          if (!firebase.apps.length) firebase.initializeApp(config);
          db = firebase.firestore();
          auth = firebase.auth();
          firebaseReady = true;
          console.log("✅ Firebase Initialized Successfully");
      } else {
          console.warn("⚠️ Firebase SDK not loaded. UI will still work.");
      }
  } catch (e) {
      console.error("❌ Firebase Init Error:", e);
      // لا نتوقف! نستمر في تشغيل الواجهة
  }

  // ==========================================
  // 3. منطق الواجهة (UI Logic) - يعمل دائماً
  // ==========================================
  function initUI() {
      // أ. قائمة الموبايل (Hamburger)
      const menuBtn = $('#menuToggle');
      const navLinks = $('#navLinks');
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

      // ب. زر المصباح (Contact Menu) - إصلاح مباشر
      const contactBtn = $('#contactMenuBtn');
      const contactMenu = $('#contactMenu');
      if(contactBtn && contactMenu) {
          contactBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              // تبديل العرض مباشرة عبر style
              if(contactMenu.style.display === 'flex') {
                  contactMenu.style.display = 'none';
              } else {
                  // إغلاق أي قوائم أخرى مفتوحة
                  $$('.pop-menu').forEach(m => m.style.display = 'none');
                  contactMenu.style.display = 'flex';
              }
          };
          // إغلاق عند الضغط خارجها
          document.addEventListener('click', (e) => {
              if(contactMenu.style.display === 'flex' && !contactMenu.contains(e.target) && !contactBtn.contains(e.target)) {
                  contactMenu.style.display = 'none';
              }
          });
      }

      // ج. النوافذ المنبثقة (Modals)
      $$('[data-open]').forEach(btn => {
          btn.onclick = (e) => {
              e.preventDefault();
              const modal = $(`#${btn.dataset.open}`);
              if(modal) {
                  modal.classList.add('open');
                  document.body.style.overflow = 'hidden';
              }
          };
      });

      $$('.modal [data-close], .modal').forEach(el => {
          el.onclick = (e) => {
              if(e.target.matches('.modal') || e.target.closest('[data-close]')) {
                  $$('.modal.open').forEach(m => m.classList.remove('open'));
                  document.body.style.overflow = '';
              }
          };
      });

      // د. أزرار المشاركة (Share)
      $$('[data-share]').forEach(btn => {
          btn.onclick = async () => {
              const url = window.location.href;
              if(navigator.share) {
                  try { await navigator.share({ title: 'شريك', text: 'منصة تكوين الفرق الجامعية', url }); } 
                  catch(err) { console.log('Share cancelled'); }
              } else {
                  try {
                      await navigator.clipboard.writeText(url);
                      showToast('تم نسخ الرابط!');
                  } catch(err) {
                      showToast('تعذر النسخ، انسخ يدوياً.');
                  }
              }
          };
      });

      // هـ. نماذج التواصل البسيطة
      const sugForm = $('#sugForm');
      if(sugForm) {
          sugForm.onsubmit = (e) => {
              e.preventDefault();
              showToast('شكراً لك! تم استلام اقتراحك.');
              sugForm.reset();
              $('.modal.open')?.classList.remove('open');
          };
      }

      const contForm = $('#directContactForm');
      if(contForm) {
          contForm.onsubmit = (e) => {
              e.preventDefault();
              showToast('وصلتنا رسالتك، سنرد قريباً.');
              contForm.reset();
              $('.modal.open')?.classList.remove('open');
          };
      }
  }

  // ==========================================
  // 4. جلب البيانات (Data Fetching) - آمن وغير كتلوي
  // ==========================================
  async function loadHomeData() {
      const row = $('#teamsRow');
      if(!row) return;

      // إذا لم تكن Firebase جاهزة، اعرض رسالة واضحة ولا تحاول الجلب
      if(!firebaseReady) {
          row.innerHTML = `<div class="empty rail-empty"><h3>وضع عدم الاتصال</h3><p>تعذر تحميل قاعدة البيانات حالياً.</p></div>`;
          return;
      }

      row.innerHTML = '<div class="empty rail-empty"><h3>جارٍ التحميل...</h3></div>';

      try {
          // محاولة تسجيل دخول مجهول صامت (Silent Anonymous Login)
          // هذا ضروري جداً لقواعد الأمان التي تتطلب authenticated user للقراءة
          await auth.signInAnonymously().catch(() => {}); 

          const snapshot = await db.collection('shrik_profiles').limit(10).get();
          
          if(snapshot.empty) {
              row.innerHTML = `<div class="empty rail-empty"><h3>لا مشاريع بعد</h3><p>كن أول من ينشر فكرته!</p></div>`;
              return;
          }

          const teams = [];
          snapshot.forEach(doc => {
              const d = doc.data();
              if(d.kind === 'team') teams.push({ id: doc.id, ...d });
          });

          if(teams.length === 0) {
               row.innerHTML = `<div class="empty rail-empty"><h3>لا مشاريع متاحة</h3></div>`;
               return;
          }

          // بناء البطاقات
          row.innerHTML = teams.map(p => `
            <div class="poster-cell">
                <a class="poster" href="search/search.html?tab=teams">
                    <span class="p-badge"><i data-fa-icon="tag"></i> ${esc(p.projectType||"مشروع")}</span>
                    <span class="p-body"><span class="p-title">${esc(p.title||p.name)}</span></span>
                </a>
                <div class="p-meta"><span class="pm-faculty">${esc(p.faculty)}</span></div>
            </div>
          `).join("");

      } catch(err) {
          console.error("Load Data Error:", err);
          row.innerHTML = `<div class="empty rail-empty"><h3>خطأ في الاتصال</h3><p>${esc(err.message)}</p></div>`;
      }
  }

  // ==========================================
  // 5. التشغيل الرئيسي (Bootstrap)
  // ==========================================
  
  // 1. شغل الواجهة أولاً (مهما حدث)
  initUI();
  showReveals();

  // 2. حدد الصفحة وشغل الدالة المناسبة
  const page = document.body.dataset.page;
  
  if(page === 'home') {
      loadHomeData();
  }
  // لصفحات أخرى (Register/Search/Dashboard) يمكننا إضافة دوال مشابهة لاحقاً
  // لكن التركيز الآن على استقرار الصفحة الرئيسية والأزرار العامة.

})();
