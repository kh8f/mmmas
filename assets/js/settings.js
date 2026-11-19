'use strict';
/* ============================================================================
   MASOUB AI — طبقة الإعدادات المشتركة
   ---------------------------------------------------------------------------
   • تقرأ القيم الافتراضية من assets/js/site-config.js
   • تسمح بتجاوزها من لوحة التحكم (تُحفظ في localStorage على هذا المتصفح)
   • تطبّق القيم على أي عنصر يحمل data-price / data-save / data-trial-days …
   ========================================================================== */
(function () {
  const KEY = 'msb_settings_v1';
  const BASE = Object.assign({
    prices: { m1: 49, m3: 119, m6: 199, y1: 349 },
    trialDays: 1,
    phone: '0578166461',
    whatsapp: '966578166461',
    downloadUrl: 'https://github.com/kh8f/mmmas/releases/download/v1.0.0/MASOUB-AI-Setup-1.0.0.exe',
    appVersion: '1.0.0',
    appSize: '108 ميجابايت',
  }, window.MSB_CONFIG || {});

  const MONTHS = { m1: 1, m3: 3, m6: 6, y1: 12 };
  const LABELS = {
    m1: 'شهر واحد',
    m3: '3 أشهر',
    m6: '6 أشهر',
    y1: 'سنة كاملة',
  };

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  }

  function normalize(raw) {
    const out = clone(BASE);
    if (!raw || typeof raw !== 'object') return out;
    const p = raw.prices || {};
    out.prices = {
      m1: num(p.m1, BASE.prices.m1),
      m3: num(p.m3, BASE.prices.m3),
      m6: num(p.m6, BASE.prices.m6),
      y1: num(p.y1, BASE.prices.y1),
    };
    out.trialDays = num(raw.trialDays, BASE.trialDays) || 1;
    out.phone = String(raw.phone || BASE.phone).trim() || BASE.phone;
    out.whatsapp = digits(raw.whatsapp || BASE.whatsapp) || BASE.whatsapp;
    out.downloadUrl = String(raw.downloadUrl || BASE.downloadUrl).trim() || BASE.downloadUrl;
    out.appVersion = String(raw.appVersion || BASE.appVersion);
    out.appSize = String(raw.appSize || BASE.appSize);
    return out;
  }

  function digits(v) {
    return String(v == null ? '' : v)
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[^\d]/g, '');
  }

  function intlPhone(phone) {
    const d = digits(phone);
    if (!d) return BASE.whatsapp;
    if (d.startsWith('966')) return d;
    if (d.startsWith('0')) return '966' + d.slice(1);
    return d;
  }

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : clone(BASE);
    } catch { return clone(BASE); }
  }

  let current = read();

  function save(patch) {
    current = normalize(Object.assign({}, current, patch, {
      prices: Object.assign({}, current.prices, (patch && patch.prices) || {}),
    }));
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
    apply();
    return current;
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    current = clone(BASE);
    apply();
    return current;
  }

  function savings(plan) {
    const months = MONTHS[plan];
    const base = current.prices.m1 * months;
    if (!months || !base) return 0;
    const pct = Math.round((1 - current.prices[plan] / base) * 100);
    return Math.max(0, Math.min(95, pct));
  }

  function perDay(plan) {
    const days = plan === 'y1' ? 365 : MONTHS[plan] * 30;
    const v = current.prices[plan] / days;
    return Math.round(v * 100) / 100;
  }

  function daysLabel(n) {
    const d = Number(n) || 1;
    if (d === 1) return 'يوم واحد';
    if (d === 2) return 'يومين';
    if (d <= 10) return `${d} أيام`;
    return `${d} يوماً`;
  }

  function waMessage(kind) {
    const p = current.prices;
    const t = daysLabel(current.trialDays);
    const map = {
      general: 'مرحباً MASOUB STORE 🌿\nأرغب بالاستفسار عن برنامج MASOUB AI.',
      trial: `مرحباً MASOUB STORE 🌿\nأرغب بتجربة MASOUB AI المجانية لمدة ${t}.`,
      m1: `مرحباً MASOUB STORE 🌿\nأرغب بباقة MASOUB AI — ${LABELS.m1} (${p.m1} ريال).`,
      m3: `مرحباً MASOUB STORE 🌿\nأرغب بباقة MASOUB AI — ${LABELS.m3} (${p.m3} ريال).`,
      m6: `مرحباً MASOUB STORE 🌿\nأرغب بباقة MASOUB AI — ${LABELS.m6} (${p.m6} ريال).`,
      y1: `مرحباً MASOUB STORE 🌿\nأرغب بباقة MASOUB AI — ${LABELS.y1} (${p.y1} ريال).`,
      support: 'مرحباً MASOUB STORE 🌿\nأحتاج دعماً فنياً بخصوص MASOUB AI.',
      activation: 'مرحباً MASOUB STORE 🌿\nأرغب باستلام كود تفعيل MASOUB AI.',
    };
    return map[kind] || map.general;
  }

  function waLink(kind) {
    return `https://wa.me/${current.whatsapp}?text=${encodeURIComponent(waMessage(kind))}`;
  }

  /* يحدّد نوع الرسالة من النص أو من data-wa */
  function kindFromLabel(label, text) {
    const s = `${label || ''} ${text || ''}`;
    if (/تجرب|مجان/.test(s)) return 'trial';
    if (/3\s*أشهر|ثلاثة أشهر/.test(s)) return 'm3';
    if (/6\s*أشهر|ستة أشهر/.test(s)) return 'm6';
    if (/سنة|سنوي|12 شهر/.test(s)) return 'y1';
    if (/شهر واحد|باقة شهر|شهري/.test(s)) return 'm1';
    if (/دعم|مشكلة|فني/.test(s)) return 'support';
    if (/تفعيل|كود/.test(s)) return 'activation';
    return 'general';
  }

  function apply() {
    const doc = document;
    const p = current.prices;

    doc.querySelectorAll('[data-price]').forEach((el) => {
      const k = el.dataset.price;
      if (p[k] != null) el.textContent = String(p[k]);
    });
    doc.querySelectorAll('[data-save]').forEach((el) => {
      const k = el.dataset.save;
      const v = savings(k);
      el.textContent = v > 0 ? `توفير ${v}%` : 'أفضل قيمة';
    });
    doc.querySelectorAll('[data-trial-days]').forEach((el) => {
      el.textContent = String(current.trialDays);
    });
    doc.querySelectorAll('[data-trial-label]').forEach((el) => {
      el.textContent = daysLabel(current.trialDays);
    });
    doc.querySelectorAll('[data-phone]').forEach((el) => {
      if (el.tagName === 'A') el.href = `tel:${digits(current.phone)}`;
      el.textContent = current.phone;
    });
    doc.querySelectorAll('[data-whatsapp]').forEach((el) => {
      el.textContent = current.whatsapp.replace(/^(\d{3})(\d{2})(\d{3})(\d{4})$/, '+$1 $2 $3 $4');
    });
    doc.querySelectorAll('[data-version]').forEach((el) => { el.textContent = current.appVersion; });
    doc.querySelectorAll('[data-size]').forEach((el) => { el.textContent = current.appSize; });
    doc.querySelectorAll('[data-dl]').forEach((el) => {
      el.setAttribute('href', current.downloadUrl);
    });
    doc.querySelectorAll('[data-wa]').forEach((el) => {
      const kind = el.dataset.waKind || kindFromLabel(el.dataset.wa, el.textContent);
      el.href = waLink(kind);
    });
    doc.querySelectorAll('[data-per-day]').forEach((el) => {
      el.textContent = String(perDay(el.dataset.perDay));
    });
  }

  function configSource() {
    const c = current;
    return `'use strict';
window.MSB_CONFIG = ${JSON.stringify({
    prices: c.prices,
    trialDays: c.trialDays,
    phone: c.phone,
    whatsapp: c.whatsapp,
    downloadUrl: c.downloadUrl,
    appVersion: c.appVersion,
    appSize: c.appSize,
  }, null, 2)};
`;
  }

  window.MSBSettings = {
    BASE: clone(BASE),
    get: () => current,
    save, reset, apply,
    savings, perDay, daysLabel,
    waMessage, waLink, kindFromLabel, intlPhone, digits,
    configSource,
    labels: LABELS,
  };
})();
