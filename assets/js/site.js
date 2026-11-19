'use strict';
/* ============================================================================
   MASOUB AI — سكربت الموقع التسويقي
   ========================================================================== */

const EVENTS_KEY = 'msb_events_v1';
/* حماية: لو لم يُحمَّل settings.js لأي سبب، يبقى الموقع يعمل */
const S = window.MSBSettings || {
  apply() {},
  kindFromLabel() { return 'general'; },
  waLink() { return 'https://wa.me/966578166461'; },
  waMessage() { return ''; },
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------ analytics */
function readEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function track(type, meta = {}) {
  try {
    const arr = readEvents();
    arr.push({ t: Date.now(), type, page: location.pathname.split('/').pop() || 'index.html', meta });
    localStorage.setItem(EVENTS_KEY, JSON.stringify(arr.slice(-800)));
  } catch { /* التخزين قد يكون معطلاً */ }
}

/* ------------------------------------------------------------- whatsapp */
function wireWhatsApp() {
  $$('a[href*="wa.me"], a[data-wa]').forEach((a) => {
    const kind = S.kindFromLabel(a.dataset.wa || a.textContent);
    a.dataset.waKind = kind;
    a.href = S.waLink(kind);
    if (!a.target) { a.target = '_blank'; a.rel = 'noopener'; }
    if (!a.dataset.wa) a.dataset.wa = kind;
    a.addEventListener('click', () => track('wa', { kind, label: a.dataset.wa }));
  });
}

/* ---------------------------------------------------------------- nav */
function initNav() {
  const nav = $('#nav');
  const burger = $('#burger');
  const menu = $('#mobileMenu');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (burger && menu) {
    const setOpen = (open) => {
      menu.classList.toggle('on', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(!menu.classList.contains('on')));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
}

/* -------------------------------------------------------------- reveal */
function initReveal() {
  const items = $$('.reveal');
  if (!items.length) return;
  if (reduceMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
  items.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------- counters */
function initCounters() {
  const nums = $$('[data-count]');
  if (!nums.length) return;
  const run = (el) => {
    const target = Number(el.dataset.count) || 0;
    if (reduceMotion() || document.hidden) { el.textContent = String(target); return; }
    const dur = 1100;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(target * eased));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // شبكة أمان: لو توقّف rAF لأي سبب يظهر الرقم النهائي
    setTimeout(() => { el.textContent = String(target); }, dur + 200);
  };
  if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.6 });
  nums.forEach((n) => io.observe(n));
}

/* ---------------------------------------------------------------- tilt */
function initTilt() {
  const box = $('.hero-visual');
  const target = $('#heroTilt');
  if (!box || !target || reduceMotion()) return;
  if (window.matchMedia('(hover: none)').matches) return;
  box.addEventListener('pointermove', (e) => {
    const r = box.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    target.style.setProperty('--ry', `${px * 9}deg`);
    target.style.setProperty('--rx', `${-py * 7}deg`);
  });
  box.addEventListener('pointerleave', () => {
    target.style.setProperty('--ry', '0deg');
    target.style.setProperty('--rx', '0deg');
  });
}

/* ----------------------------------------------------------- card glow */
function initCardGlow() {
  $$('.f-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ------------------------------------------------------------ app tour */
const TOUR = [
  {
    id: 'dashboard', label: 'الرئيسية', num: '01', title: 'لوحة التحكم',
    desc: 'حالة الاتصال، رسائل اليوم، ردود الذكاء، والتحويلات — مع شريط الترخيص المتبقي.',
  },
  {
    id: 'conversations', label: 'المحادثات', num: '02', title: 'المحادثات',
    desc: 'راجع كل محادثة كاملة، أوقف الرد مؤقتاً، أو احظر رقماً بضغطة واحدة.',
  },
  {
    id: 'ai', label: 'الذكاء الاصطناعي', num: '03', title: 'إعدادات الذكاء',
    desc: 'اختر Gemini أو OpenAI، واضبط الموديل والحرارة وسرعة الرد وحدود الاستخدام.',
  },
  {
    id: 'persona', label: 'الشخصية والتعليمات', num: '04', title: 'شخصية البوت',
    desc: 'اسم المتجر والبوت، اللهجة، الترحيب، وكل التعليمات التي يتعلمها — قابلة للتعديل في أي وقت.',
  },
  {
    id: 'products', label: 'المنتجات والأسعار', num: '05', title: 'المنتجات والأسعار',
    desc: 'أضف منتجاتك وباقاتك وأسعارها، ويعرفها البوت فوراً دون إعادة تشغيل.',
  },
  {
    id: 'handoff', label: 'التحويل والتنبيهات', num: '06', title: 'التحويل الذكي',
    desc: 'حدد الكلمات التي تُحوّل المحادثة لك، ورقم التنبيه، وهل يرسل ملخص المحادثة.',
  },
  {
    id: 'license', label: 'الترخيص', num: '07', title: 'الترخيص',
    desc: 'فعّل نسختك بكود موقّع، وتابع الأيام المتبقية ورمز الجهاز — التحقق يتم محلياً على جهازك.',
  },
];

function initTour() {
  const root = $('#tourBox');
  if (!root) return;
  const tabs = $$('.tour-tab', root);
  const shots = $$('.tour-shot', root);
  const capNum = $('#tourNum');
  const capTitle = $('#tourTitle');
  const capDesc = $('#tourDesc');
  let index = 0;
  let timer = null;
  let paused = false;

  const render = (i) => {
    index = i;
    tabs.forEach((t, k) => {
      const on = k === i;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', String(on));
      const p = t.querySelector('.p');
      if (p) p.style.width = on ? '100%' : '0';
    });
    shots.forEach((s) => s.classList.toggle('on', s.dataset.shot === TOUR[i].id));
    if (capNum) capNum.textContent = TOUR[i].num;
    if (capTitle) capTitle.textContent = TOUR[i].title;
    if (capDesc) capDesc.textContent = TOUR[i].desc;
  };

  const next = () => {
    if (paused || document.hidden) return;
    render((index + 1) % TOUR.length);
  };

  const start = () => {
    stop();
    if (reduceMotion()) return;
    timer = setInterval(next, 5200);
  };
  const stop = () => { if (timer) clearInterval(timer); timer = null; };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => {
      render(i);
      start();
    });
    t.addEventListener('mouseenter', () => { paused = true; });
    t.addEventListener('mouseleave', () => { paused = false; });
  });

  root.addEventListener('mouseenter', () => { paused = true; });
  root.addEventListener('mouseleave', () => { paused = false; });
  root.addEventListener('focusin', () => { paused = true; });
  root.addEventListener('focusout', () => { paused = false; });

  render(0);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { start(); io.disconnect(); } });
  }, { threshold: 0.25 }) : null;
  if (io) io.observe(root); else start();
}

/* ------------------------------------------------------------ chat demo */
const CHAT = {
  price: {
    q: 'كم سعر شاهد سنة؟',
    a: 'اشتراك شاهد VIP سنة كاملة بـ 189 ريال ✅\nرسمي ومضمون طوال المدة، والتسليم فوري بعد الدفع.',
  },
  pay: {
    q: 'طرق الدفع؟',
    a: 'تقدر تحوّل على:\n• بنك الراجحي — 5580 1234 5678 9012\n• STC Pay — 0551234567\nوبعد التحويل أرسل صورة الإيصال هنا 🌿',
  },
  warranty: {
    q: 'هل فيه ضمان؟',
    a: 'أكيد ✅ ضمان كامل طوال المدة، وأي مشكلة في الحساب نستبدله مجاناً خلال 24 ساعة.',
  },
  handoff: {
    q: 'أبغى أتكلم مع صاحب المتجر',
    a: 'أبشر 🌿 حوّلت طلبك لصاحب المتجر ووصلّه تنبيه الآن — بيكلمك في أقرب وقت.',
    event: 'تم تحويل المحادثة لصاحب المتجر 🔔',
  },
};

function initChat() {
  const body = $('#waBody');
  const chips = $$('#chatChips .chip');
  if (!body) return;
  let busy = false;
  let started = false;

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const add = (role, text) => {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.innerHTML = `${String(text).replace(/\n/g, '<br>')}${role === 'event' ? '' : `<span class="t">${now()}</span>`}`;
    body.appendChild(el);
    // إجبار إعادة الرسم ثم إظهار الرسالة (لا نعتمد على rAF حتى لا تختفي في بعض البيئات)
    void el.offsetWidth;
    el.classList.add('show');
    body.scrollTop = body.scrollHeight;
    return el;
  };

  const typing = async () => {
    const el = document.createElement('div');
    el.className = 'typing';
    el.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    await sleep(750 + Math.random() * 500);
    el.remove();
  };

  const ask = async (key) => {
    if (busy) return;
    const item = CHAT[key];
    if (!item) return;
    busy = true;
    chips.forEach((c) => { c.disabled = true; });
    add('in', item.q);
    await sleep(320);
    await typing();
    add('out', item.a);
    if (item.event) {
      await sleep(420);
      add('event', item.event);
    }
    if (key === 'handoff') track('demo_handoff');
    busy = false;
    chips.forEach((c) => { c.disabled = false; });
  };

  chips.forEach((c) => c.addEventListener('click', () => ask(c.dataset.q)));

  const boot = async () => {
    if (started) return;
    started = true;
    const welcome = [
      ['in', 'السلام عليكم'],
      ['out', 'وعليكم السلام ورحمة الله 🌿\nهلا بك في متجر معصوب، كيف أقدر أخدمك؟'],
    ];
    for (const [role, text] of welcome) {
      await sleep(role === 'out' ? 650 : 100);
      if (role === 'out') await typing();
      add(role, text);
    }
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { boot(); io.disconnect(); } });
    }, { threshold: 0.35 });
    io.observe(body.closest('.phone') || body);
  } else {
    boot();
  }
}

/* ------------------------------------------------------------ lightbox */
function initLightbox() {
  const box = $('#lightbox');
  if (!box) return;
  const items = $$('.g-item');
  if (!items.length) return;
  const img = $('#lbImg');
  const cap = $('#lbCap');
  const count = $('#lbCount');
  let i = 0;
  let lastFocus = null;

  const open = (n) => {
    i = (n + items.length) % items.length;
    const it = items[i];
    img.src = it.dataset.full;
    img.alt = it.dataset.cap || '';
    cap.textContent = it.dataset.cap || '';
    count.textContent = `${i + 1} / ${items.length}`;
    box.classList.add('on');
    document.body.style.overflow = 'hidden';
    lastFocus = document.activeElement;
    $('#lbClose').focus();
    track('gallery', { index: i + 1, cap: it.dataset.cap || '' });
  };
  const close = () => {
    box.classList.remove('on');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  items.forEach((it, n) => {
    it.tabIndex = 0;
    it.setAttribute('role', 'button');
    it.addEventListener('click', () => open(n));
    it.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(n); }
    });
  });

  $('#lbClose').addEventListener('click', close);
  $('#lbPrev').addEventListener('click', () => open(i - 1));
  $('#lbNext').addEventListener('click', () => open(i + 1));
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') open(i - 1);
    if (e.key === 'ArrowLeft') open(i + 1);
  });
}

/* -------------------------------------------------------------- toast */
let toastTimer = null;
function toast(text) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

/* ------------------------------------------------------------- download */
function initDownload() {
  $$('[data-dl]').forEach((a) => {
    a.addEventListener('click', () => {
      track('download', { file: a.getAttribute('href') });
      toast('بدأ تحميل المثبّت — بعد التثبيت أدخل كود التفعيل');
    });
  });
}

/* ---------------------------------------------------------------- boot */
function boot() {
  S.apply();
  wireWhatsApp();
  initNav();
  initReveal();
  initCounters();
  initTilt();
  initCardGlow();
  initTour();
  initChat();
  initLightbox();
  initDownload();
  track('pageview');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
