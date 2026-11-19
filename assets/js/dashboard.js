'use strict';
/* ============================================================================
   MASOUB AI — لوحة تحكم الموقع (محلية بالكامل، بدون سيرفر)
   ========================================================================== */

const EVENTS_KEY = 'msb_events_v1';
const SESSION_KEY = 'msb_admin_session_v1';
const RL_KEY = 'msb_gate_rl_v1';
const SESSION_MS = 30 * 60 * 1000;

/* الرمز لا يُخزَّن كنص: PBKDF2-SHA256 + ملح خاص + مقارنة ثابتة الزمن */
const GATE = {
  salt: 'c1a608af6f2594929244a44626e1f394',
  iterations: 310000,
  key: 'ccb33bf247b21c2c5c377d3d4b5b7a7078b4f90fb4389257e86e40a817dbd7c1',
};
const RL = { maxFails: 5, windowMs: 15 * 60 * 1000, lockMs: 10 * 60 * 1000 };

const S = window.MSBSettings || {
  get: () => ({ prices: { m1: 49, m3: 119, m6: 199, y1: 349 }, trialDays: 1, phone: '0578166461', whatsapp: '966578166461', downloadUrl: 'downloads/MASOUB-AI-Setup-1.0.0.exe' }),
  save() {},
  reset() {},
  apply() {},
  waMessage: () => '',
  waLink: () => 'https://wa.me/966578166461',
  configSource: () => '',
  daysLabel: (n) => String(n),
  savings: () => 0,
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ أدوات */
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function fmtDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtTime(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let toastTimer = null;
function toast(text) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

/* --------------------------------------------------------------- الإحصاءات */
function readEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function typeLabel(e) {
  const map = {
    pageview: 'زيارة صفحة',
    wa: 'نقرة واتساب',
    download: 'تحميل المثبّت',
    gallery: 'فتح صورة',
    demo_handoff: 'تجربة التحويل',
  };
  return map[e.type] || e.type;
}
function detailLabel(e) {
  const m = e.meta || {};
  if (e.type === 'wa') return m.kind ? `الطلب: ${m.kind}` : '';
  if (e.type === 'download') return 'المثبّت';
  if (e.type === 'gallery') return m.cap || '';
  return '';
}

function renderStats() {
  const all = readEvents();
  const today = startOfToday();
  const visits = all.filter((e) => e.type === 'pageview');
  const wa = all.filter((e) => e.type === 'wa');
  const dl = all.filter((e) => e.type === 'download');

  $('#kVisits').textContent = visits.length;
  $('#kWa').textContent = wa.length;
  $('#kDl').textContent = dl.length;
  $('#kEvents').textContent = all.length;

  $('#kVisitsToday').textContent = `${visits.filter((e) => e.t >= today).length} اليوم`;
  $('#kWaToday').textContent = `${wa.filter((e) => e.t >= today).length} اليوم`;
  $('#kDlToday').textContent = `${dl.filter((e) => e.t >= today).length} اليوم`;

  const now = new Date();
  $('#todayLine').textContent = `آخر تحديث ${fmtTime(Date.now())} · ${fmtDate(now.getTime())}`;

  // الرسم البياني
  const chart = $('#chart');
  const names = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ start: d.getTime(), end: d.getTime() + 86400000, name: names[d.getDay()], count: 0 });
  }
  visits.forEach((e) => {
    const d = days.find((x) => e.t >= x.start && e.t < x.end);
    if (d) d.count++;
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  if (chart) {
    chart.innerHTML = days.map((d) => `
      <div class="bar" title="${d.count} زيارة">
        <em>${d.count}</em>
        <i style="height:${Math.max(4, Math.round((d.count / max) * 100))}%"></i>
        <span>${d.name}</span>
      </div>`).join('');
  }

  // السجل
  const body = $('#logsBody');
  if (body) {
    const rows = all.slice(-60).reverse();
    body.innerHTML = rows.length
      ? rows.map((e) => `<tr>
          <td>${fmtTime(e.t)}</td>
          <td>${typeLabel(e)}</td>
          <td>${e.page || '—'}</td>
          <td>${detailLabel(e) || '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="4"><div class="empty">لا توجد أحداث بعد — افتح الموقع في نفس المتصفح لتظهر هنا.</div></td></tr>';
  }
}

/* ------------------------------------------------------------ فحص الترخيص */
const PLANS = {
  0: 'تجربة', 1: 'شهر واحد', 2: '3 أشهر', 3: '6 أشهر', 4: 'سنة كاملة', 5: 'أيام مخصصة',
};
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PUBLIC_KEY_B64 = 'MCowBQYDK2VwAyEA6g3JkQnBc2GyWVoRVz6f1rqD/n6J8im1RILt+gFLyHY=';

function normalizeCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}
function base32Decode(text) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of String(text).toUpperCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`حرف غير مسموح: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function deviceHashFromCode(code) {
  const raw = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return 0;
  const data = new TextEncoder().encode(`MASOUB-AI-DEVICE-V1|code:${raw}`);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return ((h[0] << 24) >>> 0) + (h[1] << 16) + (h[2] << 8) + h[3];
}

async function verifyLicense() {
  const box = $('#licResult');
  const code = $('#licCode').value;
  const devCode = $('#devCode').value;
  if (!box) return;

  const raw = normalizeCode(code);
  if (!raw) { box.innerHTML = '<span class="bad">أدخل كود الترخيص أولاً.</span>'; return; }

  if (!raw.startsWith('MSA1')) {
    box.innerHTML = '<span class="bad">صيغة غير صحيحة — الكود يجب أن يبدأ بـ MSA1.</span>';
    return;
  }
  const bodyRaw = raw.slice(4);
  if (bodyRaw.length !== 128) {
    box.innerHTML = `<span class="bad">طول الكود غير صحيح (${bodyRaw.length}/128) — تأكد من نسخه كاملاً.</span>`;
    return;
  }

  let bytes;
  try { bytes = base32Decode(bodyRaw); } catch (e) {
    box.innerHTML = `<span class="bad">${e.message}</span>`;
    return;
  }
  if (bytes.length !== 80) {
    box.innerHTML = '<span class="bad">بيانات الكود غير مكتملة.</span>';
    return;
  }

  const payload = bytes.slice(0, 16);
  const sig = bytes.slice(16);

  if (!crypto.subtle) {
    box.innerHTML = '<span class="warn">متصفحك لا يدعم WebCrypto — افتح اللوحة في Chrome أو Edge حديث.</span>';
    return;
  }

  let sigOk = false;
  try {
    const der = Uint8Array.from(atob(PUBLIC_KEY_B64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
    sigOk = await crypto.subtle.verify({ name: 'Ed25519' }, key, sig, payload);
  } catch {
    box.innerHTML = '<span class="warn">تعذّر التحقق: المتصفح لا يدعم Ed25519. استخدم Chrome أو Edge حديث.</span>';
    return;
  }

  const view = new DataView(payload.buffer);
  const version = view.getUint8(0);
  const planId = view.getUint8(1);
  const days = view.getUint16(2);
  const issuedAt = view.getUint32(4) * 1000;
  const serial = view.getUint32(8);
  const machineHash = view.getUint32(12);
  const expiresAt = issuedAt + days * 86400000;
  const now = Date.now();
  const remaining = Math.ceil((expiresAt - now) / 86400000);

  let status = 'ok';
  let statusTxt = 'صالح ونشط';
  if (!sigOk) { status = 'bad'; statusTxt = 'التوقيع غير صالح — الكود معدّل أو مزوّر'; }
  else if (version !== 1) { status = 'bad'; statusTxt = 'إصدار غير مدعوم'; }
  else if (!days || days > 3650) { status = 'bad'; statusTxt = 'مدة غير صحيحة'; }
  else if (issuedAt > now + 86400000) { status = 'warn'; statusTxt = 'تاريخ البداية في المستقبل'; }
  else if (now > expiresAt) { status = 'warn'; statusTxt = 'منتهي الصلاحية'; }
  else if (machineHash !== 0) {
    if (!devCode.trim()) { status = 'warn'; statusTxt = 'مربوط بجهاز — أدخل رمز الجهاز للتحقق'; }
    else if ((await deviceHashFromCode(devCode)) >>> 0 !== machineHash >>> 0) {
      status = 'bad'; statusTxt = 'الكود مخصص لجهاز آخر';
    } else { statusTxt = 'صالح ونشط — مطابق للجهاز'; }
  }

  box.innerHTML = `
    <div class="row"><span>الحالة</span><b class="${status}">${statusTxt}</b></div>
    <div class="row"><span>التوقيع</span><b class="${sigOk ? 'ok' : 'bad'}">${sigOk ? 'موقّع وصحيح' : 'غير صالح'}</b></div>
    <div class="row"><span>الباقة</span><b>${PLANS[planId] || 'غير معروفة'} · ${days} يوم</b></div>
    <div class="row"><span>تاريخ الإصدار</span><b dir="ltr">${fmtDate(issuedAt)}</b></div>
    <div class="row"><span>تاريخ الانتهاء</span><b dir="ltr">${fmtDate(expiresAt)}</b></div>
    <div class="row"><span>الأيام المتبقية</span><b class="${remaining > 0 ? 'ok' : 'warn'}">${remaining > 0 ? remaining + ' يوم' : 'انتهى'}</b></div>
    <div class="row"><span>الرقم التسلسلي</span><b class="mono">${serial.toString(16).toUpperCase().padStart(8, '0')}</b></div>
    <div class="row"><span>ربط الجهاز</span><b>${machineHash === 0 ? 'غير مربوط — يعمل على أي جهاز' : 'مربوط (بصمة ' + machineHash.toString(16).toUpperCase().padStart(8, '0') + ')'}</b></div>
  `;
}

/* ---------------------------------------------------------------- البوابة */
function readRL() {
  try {
    const raw = localStorage.getItem(RL_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return {
      fails: Array.isArray(o.fails) ? o.fails : [],
      lockUntil: Number(o.lockUntil) || 0,
    };
  } catch { return { fails: [], lockUntil: 0 }; }
}
function writeRL(o) {
  try { localStorage.setItem(RL_KEY, JSON.stringify(o)); } catch { /* ignore */ }
}
function pruneRL(o) {
  const now = Date.now();
  return {
    fails: o.fails.filter((t) => now - t < RL.windowMs),
    lockUntil: o.lockUntil > now ? o.lockUntil : 0,
  };
}

function sessionValid() {
  try {
    const v = Number(sessionStorage.getItem(SESSION_KEY) || 0);
    return v > Date.now();
  } catch { return false; }
}
function openDash() {
  const gate = $('#gate');
  const dash = $('#dash');
  if (gate) gate.style.display = 'none';
  if (dash) dash.style.display = 'block';
  renderStats();
}

async function derivePin(pin) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(GATE.salt), iterations: GATE.iterations, hash: 'SHA-256' },
    base, 256,
  );
  return toHex(bits);
}

function initGate() {
  const form = $('#gateForm');
  const input = $('#pin');
  const btn = $('#gateBtn');
  const msg = $('#gateMsg');
  const lockEl = $('#gateLock');
  if (!form || !input) return;

  $('#logout')?.addEventListener('click', () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    location.reload();
  });

  if (sessionValid()) { openDash(); return; }

  let locked = 0;
  let timer = null;

  const updateLock = () => {
    const now = Date.now();
    if (locked > now) {
      const left = Math.ceil((locked - now) / 1000);
      const m = Math.floor(left / 60);
      const s = left % 60;
      lockEl.classList.add('on');
      lockEl.textContent = `تم إيقاف المحاولات مؤقتاً — حاول بعد ${m}:${pad(s)}`;
      btn.disabled = true;
      if (!timer) timer = setInterval(updateLock, 1000);
      return true;
    }
    if (locked) {
      locked = 0;
      btn.disabled = false;
      lockEl.classList.remove('on');
      lockEl.textContent = '';
      if (timer) { clearInterval(timer); timer = null; }
    }
    return false;
  };

  const rl0 = pruneRL(readRL());
  if (rl0.lockUntil) locked = rl0.lockUntil;
  updateLock();
  setTimeout(() => input.focus(), 250);

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    input.classList.remove('error');
    if (input.value.length < 6) msg.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (updateLock()) return;
    const pin = input.value.trim();
    if (pin.length !== 6) { msg.textContent = 'الرمز 6 أرقام.'; return; }

    btn.disabled = true;
    btn.textContent = 'جارٍ التحقق…';
    msg.className = 'gate-msg';
    msg.textContent = '';

    let ok = false;
    try {
      const derived = await derivePin(pin);
      ok = safeEqual(derived, GATE.key);
    } catch (err) {
      msg.className = 'gate-msg';
      msg.textContent = 'تعذّر التحقق في هذا المتصفح (WebCrypto).';
      btn.disabled = false;
      btn.textContent = 'دخول';
      return;
    }

    if (ok) {
      writeRL({ fails: [], lockUntil: 0 });
      try { sessionStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_MS)); } catch { /* ignore */ }
      msg.className = 'gate-msg ok';
      msg.textContent = 'تم التحقق — جارٍ الدخول…';
      setTimeout(openDash, 300);
      return;
    }

    // رمز خاطئ
    const st = pruneRL(readRL());
    st.fails.push(Date.now());
    if (st.fails.length >= RL.maxFails) {
      st.lockUntil = Date.now() + RL.lockMs;
      st.fails = [];
      writeRL(st);
      locked = st.lockUntil;
      msg.textContent = '';
      updateLock();
    } else {
      writeRL(st);
      const left = RL.maxFails - st.fails.length;
      msg.className = 'gate-msg';
      msg.textContent = `الرمز غير صحيح — تبقّى ${left} ${left === 1 ? 'محاولة' : 'محاولات'}.`;
      input.classList.add('error');
      input.value = '';
      setTimeout(() => input.focus(), 80);
    }

    btn.disabled = false;
    btn.textContent = 'دخول';
  });
}

/* ------------------------------------------------------------------ أدوات اللوحة */
function initActions() {
  const copy = async (kind) => {
    const ok = await copyText(S.waMessage(kind) || S.waMessage('general'));
    toast(ok ? 'تم النسخ' : 'تعذّر النسخ — حدّد النص يدوياً');
  };

  $$('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy)));

  const waBtn = $('[data-wa-admin]');
  if (waBtn) {
    waBtn.addEventListener('click', () => {
      window.open(S.waLink('general'), '_blank', 'noopener');
    });
  }

  $('#btnDownload')?.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = S.get().downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  $('#btnHome')?.addEventListener('click', () => { location.href = 'index.html'; });

  $('#btnRefresh')?.addEventListener('click', () => { renderStats(); toast('تم تحديث البيانات'); });

  $('#btnClear')?.addEventListener('click', () => {
    if (!confirm('سيتم حذف كل الإحصائيات المحفوظة في هذا المتصفح. متابعة؟')) return;
    try { localStorage.removeItem(EVENTS_KEY); } catch { /* ignore */ }
    renderStats();
    toast('تم تصفير الإحصائيات');
  });

  $('#btnCopyScript')?.addEventListener('click', async () => {
    const p = S.get().prices;
    const t = S.daysLabel(S.get().trialDays);
    const text = [
      'مرحباً 🌿 معك MASOUB STORE.',
      '',
      'MASOUB AI: مساعد واتساب ذكي يرد على عملاء متجرك 24/7، يعرف منتجاتك وأسعارك وطرق الدفع، ويحوّل لك المحادثات المهمة.',
      '',
      '✅ يعمل على ويندوز بدون سيرفرات',
      '✅ رد بلهجة سعودية طبيعية',
      '✅ ربط واتساب بمسح QR',
      `✅ يبدأ من ${p.m1} ريال شهرياً — وسنة كاملة ${p.y1} ريال`,
      `🎁 تجربة مجانية ${t}`,
      '',
      'تحب أرسل لك فيديو قصير يوضح البرنامج؟',
    ].join('\n');
    const ok = await copyText(text);
    toast(ok ? 'تم نسخ رسالة العرض' : 'تعذّر النسخ');
  });

  $('#btnVerify')?.addEventListener('click', async () => {
    const btn = $('#btnVerify');
    btn.disabled = true;
    btn.textContent = 'جارٍ الفحص…';
    try { await verifyLicense(); } finally {
      btn.disabled = false;
      btn.textContent = 'فحص الكود';
    }
  });

  $('#btnPaste')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { $('#licCode').value = text.trim(); toast('تم اللصق'); }
    } catch { toast('تعذّر الوصول للحافظة — الصق يدوياً'); }
  });

  $('#licCode')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); $('#btnVerify')?.click(); }
  });
}

/* ------------------------------------------------------- إعدادات الموقع */
function initSettings() {
  const f = {
    m1: $('#cfg-m1'), m3: $('#cfg-m3'), m6: $('#cfg-m6'), y1: $('#cfg-y1'),
    trial: $('#cfg-trial'), phone: $('#cfg-phone'), wa: $('#cfg-wa'), dl: $('#cfg-dl'),
  };
  if (!f.m1) return;

  const preview = () => {
    const el = $('#cfgPreview');
    if (!el) return;
    const p = {
      m1: Number(f.m1.value) || 0,
      m3: Number(f.m3.value) || 0,
      m6: Number(f.m6.value) || 0,
      y1: Number(f.y1.value) || 0,
    };
    const save = (price, months) => (p.m1 > 0 ? Math.max(0, Math.round((1 - price / (p.m1 * months)) * 100)) : 0);
    el.textContent = `شهر ${p.m1} · 3 أشهر ${p.m3} (${save(p.m3, 3)}%) · 6 أشهر ${p.m6} (${save(p.m6, 6)}%) · سنة ${p.y1} (${save(p.y1, 12)}%) · تجربة ${f.trial.value || 1} يوم`;
  };

  const fill = () => {
    const c = S.get();
    f.m1.value = c.prices.m1;
    f.m3.value = c.prices.m3;
    f.m6.value = c.prices.m6;
    f.y1.value = c.prices.y1;
    f.trial.value = c.trialDays;
    f.phone.value = c.phone;
    f.wa.value = c.whatsapp;
    f.dl.value = c.downloadUrl;
    preview();
  };

  const collect = () => ({
    prices: {
      m1: Number(f.m1.value),
      m3: Number(f.m3.value),
      m6: Number(f.m6.value),
      y1: Number(f.y1.value),
    },
    trialDays: Number(f.trial.value),
    phone: f.phone.value.trim(),
    whatsapp: f.wa.value.trim(),
    downloadUrl: f.dl.value.trim(),
  });

  Object.values(f).forEach((el) => el && el.addEventListener('input', preview));
  fill();

  $('#btnSaveCfg')?.addEventListener('click', () => {
    S.save(collect());
    fill();
    toast('تم حفظ الإعدادات وتطبيقها');
  });

  $('#btnResetCfg')?.addEventListener('click', () => {
    if (!confirm('استعادة الأسعار والبيانات الافتراضية؟')) return;
    S.reset();
    fill();
    toast('تمت استعادة الافتراضي');
  });

  $('#btnCopyCfg')?.addEventListener('click', async () => {
    const ok = await copyText(S.configSource());
    toast(ok ? 'تم نسخ محتوى site-config.js' : 'تعذّر النسخ');
  });

  $('#btnDownloadCfg')?.addEventListener('click', () => {
    const blob = new Blob([S.configSource()], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'site-config.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('تم تنزيل site-config.js — ضعه في assets/js/');
  });
}

/* ------------------------------------------------------------------ boot */
function boot() {
  S.apply();
  initGate();
  initActions();
  initSettings();
  if (sessionValid()) {
    setInterval(() => { if (sessionValid()) renderStats(); }, 30000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
