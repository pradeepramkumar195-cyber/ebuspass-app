// ============================================================
//  e-BusPass – Frontend (single page app, plain JavaScript)
// ============================================================
const S = {
  token: localStorage.getItem('token'), user: null, meta: null, unread: 0,
  lang: localStorage.getItem('lang') || 'en', draft: {}, cleanups: [], lastNotif: null,
};
const app = document.getElementById('app');

// ---------------- small helpers ----------------
function t(key, vars = {}) {
  let s = (I18N[S.lang] && I18N[S.lang][key]) ?? I18N.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v);
  return s;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const go = h => { if (location.hash === h) render(); else location.hash = h; };
const rupee = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtDT = d => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
function stName(code) {
  const s = S.meta && S.meta.stations.find(x => x.code === code);
  if (!s) return code || '-';
  return S.lang === 'te' ? s.te : S.lang === 'hi' ? s.hi : s.name;
}
function toast(msg, bad = false) {
  const el = $('#toast');
  el.textContent = msg; el.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 3200);
}
// Fake phone SMS popup (shows what SMS the user gets)
function smsPop(text, delay = 0) {
  setTimeout(() => {
    const el = document.createElement('div');
    el.className = 'sms-pop';
    el.innerHTML = `<div class="s-ic">✉</div><div><small>SMS • AP-EBUSPS • now</small><p>${esc(text)}</p></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 5200);
  }, delay);
}

async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error(t('offline')); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.token && !path.includes('/auth/')) { logout(true); }
  if (!res.ok) throw new Error(data.error || t('err'));
  return data;
}

function logout(silent) {
  if (!silent) api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  S.token = null; S.user = null; localStorage.removeItem('token'); go('#/login');
}

// ---------------- icons ----------------
const I = {
  bell: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5-6.7V3.5a2 2 0 1 0-4 0v.8A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 16l4-4-4-4M19 12H9"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5C6.5 5 2.7 8.6 1 12c1.7 3.4 5.5 7 11 7s9.3-3.6 11-7c-1.7-3.4-5.5-7-11-7zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-3.3 0-9 1.7-9 5v2h18v-2c0-3.3-5.7-5-9-5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  bus: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .9.4 1.7 1 2.2V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.8c.6-.5 1-1.3 1-2.2V6c0-3.5-3.6-4-8-4S4 2.5 4 6zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1.5-6H6V6h12z"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.5-1.3 1.4-2 2.5-2s2 .7 2.5 2M14 10h4M14 13h3"/></svg>',
  renew: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  rupee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12M6 9h12M14 20 7 13h2.5a4.5 4.5 0 0 0 0-9"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  google: '<svg class="g-logo" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
};
// Colourful category illustrations
const CAT_ART = {
  student: '<svg class="c-ico" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#3a4f8f"/><circle cx="32" cy="30" r="10" fill="#f2c39b"/><path d="M14 22 32 14l18 8-18 8z" fill="#10204a"/><path d="M44 24v9" stroke="#ffd166" stroke-width="2.5"/><circle cx="44" cy="34" r="2.5" fill="#ffd166"/><path d="M18 56c1-9 7-14 14-14s13 5 14 14z" fill="#b4c5ff"/><rect x="26" y="46" width="12" height="9" rx="1.5" fill="#ffd166"/></svg>',
  employee: '<svg class="c-ico" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#1f5868"/><circle cx="32" cy="24" r="9" fill="#d9a77c"/><path d="M16 56c1-11 8-16 16-16s15 5 16 16z" fill="#4dd9e6"/><path d="M32 40l-3 6 3 10 3-10z" fill="#10204a"/><rect x="40" y="44" width="14" height="11" rx="2" fill="#ffd166"/><rect x="44" y="41" width="6" height="4" rx="1" fill="none" stroke="#ffd166" stroke-width="2"/></svg>',
  pwd: '<svg class="c-ico" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#5b3f8f"/><circle cx="30" cy="14" r="5" fill="#f2c39b"/><path d="M29 20v13h12l5 12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 26h9" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="28" cy="43" r="11" fill="none" stroke="#c9b6ff" stroke-width="4"/></svg>',
  ngo: '<svg class="c-ico" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#2f6b45"/><path d="M32 46S16 36 16 25a8 8 0 0 1 16-2 8 8 0 0 1 16 2c0 11-16 21-16 21z" fill="#ff8fa3"/><path d="M8 44c6-2 10 0 14 4l8 4h12M56 44c-6-2-10 0-14 4" stroke="#ffd9b0" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
  journalist: '<svg class="c-ico" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#8f4a2f"/><rect x="24" y="10" width="16" height="26" rx="8" fill="#e3e2e9"/><path d="M18 30a14 14 0 0 0 28 0" stroke="#ffd166" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M32 44v8M24 54h16" stroke="#ffd166" stroke-width="3.5" stroke-linecap="round"/><rect x="26" y="18" width="12" height="3" rx="1.5" fill="#8f4a2f"/></svg>',
};

// ---------------- layout pieces ----------------
function langSelect() {
  const opts = [['en', 'English'], ['te', 'తెలుగు'], ['hi', 'हिंदी'], ['tg', 'Tenglish']];
  return `<select class="lang-select" id="lang" aria-label="${t('language')}">${opts.map(([v, l]) => `<option value="${v}" ${S.lang === v ? 'selected' : ''}>🌐 ${l}</option>`).join('')}</select>`;
}
function topbar({ back, title } = {}) {
  const right = S.user ? `
    <button class="icon-btn" onclick="go('#/notifications')" aria-label="${t('notifications')}">${I.bell}${S.unread ? `<span class="badge">${S.unread}</span>` : ''}</button>
    <button class="icon-btn" onclick="logout()" aria-label="${t('logout')}">${I.logout}</button>` : '';
  const left = back
    ? `<button class="back" onclick="go('${back}')">${I.back} <span>${esc(title || '')}</span></button>`
    : `<div class="brand"><img src="/img/logo.svg" alt=""><div><b>${t('appName')}</b><small>${S.user ? t(S.user.role === 'passenger' ? 'passenger' : S.user.role === 'conductor' ? 'conductor' : 'depotStaff') : ''}</small></div></div>`;
  return `<div class="topbar">${left}<div style="display:flex;align-items:center;gap:4px">${langSelect()}${right}</div></div>`;
}
function bindCommon() {
  const l = $('#lang');
  if (l) l.onchange = () => { S.lang = l.value; localStorage.setItem('lang', S.lang); document.documentElement.lang = S.lang === 'tg' ? 'te' : S.lang; render(); };
  $$('[data-eye]').forEach(b => b.onclick = () => { const i = b.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; });
}
const field = (id, label, { type = 'text', icon, value = '', req = true, extra = '', hint = '', eye } = {}) => `
  <div class="field">
    <label for="${id}">${label}${req ? ' <span class="req">*</span>' : ''}</label>
    <div class="in-wrap">${icon ? `<span class="ico">${I[icon]}</span>` : ''}
    <input class="input ${icon ? 'with-icon' : ''}" id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${extra} />
    ${eye ? `<button type="button" class="icon-btn eye" data-eye>${I.eye}</button>` : ''}</div>
    ${hint ? `<div class="hint">${hint}</div>` : ''}
  </div>`;
function modal(html) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal">${html}</div></div>`;
  $('.modal-bg', root).onclick = e => { if (e.target.classList.contains('modal-bg')) closeModal(); };
  return $('.modal', root);
}
const closeModal = () => $('#modal-root').innerHTML = '';
function busy(btn, on) {
  if (on) { btn._txt = btn.innerHTML; btn.innerHTML = t('loading'); btn.disabled = true; }
  else { btn.innerHTML = btn._txt || btn.innerHTML; btn.disabled = false; }
}

// Read file → data URL (photos are made smaller to save space)
function readFile(file, maxW = 900) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > 8 * 1024 * 1024) return reject(new Error('File too big (max 8 MB)'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read file'));
    fr.onload = () => {
      if (file.type === 'application/pdf') {
        if (file.size > 2.5 * 1024 * 1024) return reject(new Error('PDF must be below 2.5 MB'));
        return resolve({ name: file.name, type: file.type, data: fr.result });
      }
      if (!file.type.startsWith('image/')) return reject(new Error('Only photo or PDF allowed'));
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve({ name: file.name, type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.82) });
      };
      img.onerror = () => reject(new Error('Bad image file'));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function uploadBox(key, label, file, { req = true, accept = 'image/*,application/pdf' } = {}) {
  const prev = file ? (file.type.startsWith('image/') ? `<img class="prev" src="${file.data}">` : `<div class="up-ico">PDF</div>`) : `<div class="up-ico">${I.upload}</div>`;
  return `<div class="field"><label>${label}${req ? ' <span class="req">*</span>' : ''}</label>
    <label class="upload ${file ? 'done' : ''}" data-up="${key}">${prev}
      <div><b style="font-size:15px">${file ? t('uploaded') : t('uploadHint')}</b><div class="hint" style="margin:2px 0 0">${file ? esc(file.name) : ''}</div></div>
      <input type="file" accept="${accept}" hidden data-file="${key}">
    </label></div>`;
}

// ============================================================
//  VIEWS
// ============================================================

// ---------- LOGIN / SIGN UP ----------
function viewLogin(mode = 'in') {
  app.innerHTML = `
    <div class="topbar"><div class="brand"><img src="/img/logo.svg" alt=""><b>${t('appName')}</b></div>${langSelect()}</div>
    <img class="hero-img" src="/img/hero.svg" alt="Bus at bus stand">
    <div class="title-block"><h1>e-BusPass Transit</h1><p class="muted">${t('tagline')}</p></div>
    <div class="card">
      <div class="tabs"><button class="${mode === 'in' ? 'on' : ''}" data-mode="in">${t('signIn')}</button><button class="${mode === 'up' ? 'on' : ''}" data-mode="up">${t('signUp')}</button></div>
      <form id="authForm" novalidate>
        ${mode === 'in' ? `
          ${field('email', t('emailId'), { type: 'email', icon: 'mail', extra: 'autocomplete="email"' })}
          ${field('password', t('password'), { type: 'password', icon: 'lock', eye: true, extra: 'autocomplete="current-password"' })}
        ` : `
          ${field('mobile', t('mobileNo'), { type: 'tel', icon: 'phone', extra: 'maxlength="10" inputmode="numeric"' })}
          ${field('email', t('emailId'), { type: 'email', icon: 'mail' })}
          ${field('password', t('createPassword'), { type: 'password', icon: 'lock', eye: true, hint: 'Min 6' })}
          ${field('password2', t('confirmPassword'), { type: 'password', icon: 'lock', eye: true })}
        `}
        <div class="err" id="authErr"></div>
        <button class="btn btn-primary" type="submit">${mode === 'in' ? t('signIn') : t('signUp')}</button>
      </form>
      <div class="divider">${t('or')}</div>
      <button class="btn btn-white" id="gBtn">${I.google} ${t('google')}</button>
      <p class="center" style="margin-top:16px">${mode === 'in' ? t('noAccount') : t('haveAccount')} <button class="link-btn" data-mode="${mode === 'in' ? 'up' : 'in'}">${mode === 'in' ? t('signUp') : t('signIn')}</button></p>
    </div>
    <h3 class="center muted" style="font-weight:600">${t('demoAccounts')}</h3>
    <div class="demo-grid">
      <button class="btn btn-outline" data-demo="passenger@demo.in|demo123">${t('passenger')}</button>
      <button class="btn btn-outline" data-demo="conductor@demo.in|cond123">${t('conductor')}</button>
      <button class="btn btn-outline" data-demo="depot@demo.in|depot123">${t('depotStaff')}</button>
    </div>`;
  bindCommon();
  $$('[data-mode]').forEach(b => b.onclick = () => viewLogin(b.dataset.mode));
  $$('[data-demo]').forEach(b => b.onclick = async () => {
    const [email, password] = b.dataset.demo.split('|');
    try { afterLogin(await api('/api/auth/login', { method: 'POST', body: { email, password } })); } catch (e) { toast(e.message, true); }
  });
  $('#gBtn').onclick = googleModal;
  $('#authForm').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const err = $('#authErr'); err.textContent = '';
    if (mode === 'up' && f.password !== f.password2) { err.textContent = t('pwMismatch'); return; }
    const btn = e.target.querySelector('button[type=submit]'); busy(btn, true);
    try { afterLogin(await api(mode === 'in' ? '/api/auth/login' : '/api/auth/signup', { method: 'POST', body: f })); }
    catch (ex) { err.textContent = ex.message; busy(btn, false); }
  };
}
function googleModal() {
  const m = modal(`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">${I.google}<h2 style="margin:0">${t('googleTitle')}</h2></div>
    <p class="muted small" style="margin-bottom:16px">${t('googleNote')}</p>
    <form id="gForm" novalidate>
      ${field('email', t('gmailId'), { type: 'email', icon: 'mail', extra: 'placeholder="yourname@gmail.com"' })}
      ${field('name', t('yourName'), { icon: 'user', req: false })}
      ${field('mobile', t('mobileNo'), { type: 'tel', icon: 'phone', extra: 'maxlength="10" inputmode="numeric"' })}
      ${field('password', t('createPassword'), { type: 'password', icon: 'lock', eye: true })}
      <div class="err" id="gErr"></div>
      <button class="btn btn-primary" type="submit">${t('continue')}</button>
      <button class="btn btn-outline" type="button" style="margin-top:10px" onclick="closeModal()">${t('cancel')}</button>
    </form>`);
  bindCommon();
  $('#gForm', m).onsubmit = async e => {
    e.preventDefault();
    try { afterLogin(await api('/api/auth/google', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) })); closeModal(); }
    catch (ex) { $('#gErr').textContent = ex.message; }
  };
}
function afterLogin(r) {
  S.token = r.token; S.user = r.user; localStorage.setItem('token', r.token);
  toast(`${t('hello')}, ${r.user.name}!`);
  S.lastNotif = new Date(Date.now() - 8000).toISOString();
  setTimeout(() => refreshUnread(true), 400);
  go(r.user.role === 'conductor' ? '#/conductor' : r.user.role === 'depot' ? '#/depot' : '#/home');
}

// ---------- HOME ----------
async function viewHome() {
  const [passes, apps] = await Promise.all([api('/api/my-passes'), api('/api/applications')]);
  const pending = apps.filter(a => a.status === 'PENDING_PAYMENT');
  const toCollect = apps.filter(a => a.status === 'PAID');
  const u = S.user;
  const tile = (href, ico, color, k, extraCls = '') => `<button class="tile ${extraCls}" onclick="go('${href}')"><div class="t-ico" style="background:${color}22;color:${color}">${I[ico]}</div><div><b>${t('t_' + k)}</b><br><span>${t('t_' + k + '_d')}</span></div></button>`;
  app.innerHTML = `
    ${topbar()}
    <div class="profile"><div class="avatar">${esc(u.name[0] || 'U').toUpperCase()}</div>
      <div><h2>${t('hello')}, ${esc(u.name)}</h2><p>📞 +91 ${esc(u.mobile)}</p><p>✉ ${esc(u.email)}</p></div></div>
    ${pending.map(a => `<div class="warn-box">⏳ ${a.id} – ${t('st_PENDING_PAYMENT')} (${rupee(a.amount)}) &nbsp; <button class="btn btn-sm btn-red" onclick="go('#/pay/${a.id}')">${t('payPending')}</button></div>`).join('')}
    ${toCollect.map(a => `<div class="info-box">🏢 ${a.id} – ${t('st_PAID')}: <b>${esc(stName(a.route.collectAt))}</b></div>`).join('')}
    ${passes.length ? `<h2>${t('yourPasses')}</h2>` + passes.map(p => `
      <div class="app-item"><div class="top"><div><b style="font-size:18px">${t(p.category)}</b><div class="muted small">${t('passCode')}: <b style="color:var(--teal)">${p.code}</b></div></div><span class="chip ${p.status}">${p.status === 'ACTIVE' ? t('daysLeft', { d: p.daysLeft }) : t(p.status === 'EXPIRED' ? 'expiredPass' : 'notStarted')}</span></div>
      <div class="route-box"><div class="stop"><span class="dot"></span>${esc(stName(p.from))}</div><div class="vline"></div><div class="stop"><span class="pin">${I.pin.replace('<svg', '<svg width="14" height="14"')}</span>${esc(stName(p.to))}</div></div>
      <div class="app-actions"><button class="btn btn-sm btn-outline" onclick="go('#/renew/${p.code}')">${I.renew} ${t('t_renew')}</button><button class="btn btn-sm btn-primary" onclick="go('#/pass/${p.code}')">${I.card} ${t('showPass')}</button></div></div>`).join('') : ''}
    <h2>${t('whatToDo')}</h2>
    <div class="grid-tiles">
      ${tile('#/new', 'plus', '#b4c5ff', 'new', 'big')}
      ${tile('#/pass', 'card', '#4dd9e6', 'mypass')}
      ${tile('#/renew', 'renew', '#4ade80', 'renew')}
      ${tile('#/update', 'edit', '#ffd166', 'update')}
      ${tile('#/apps', 'list', '#c9b6ff', 'track')}
      ${tile('#/nearby', 'pin', '#ff8fa3', 'nearby')}
      ${tile('#/fares', 'rupee', '#7dd3fc', 'fares')}
      ${tile('#/help', 'help', '#fdba74', 'help')}
    </div>
    <div class="card soft"><h3>${t('howItWorks')}</h3>
      <div class="steps"><div><div class="s-ico">📝</div>${t('step1')}</div><div><div class="s-ico">💳</div>${t('step2')}</div><div><div class="s-ico">🏢</div>${t('step3')}</div><div><div class="s-ico">🚌</div>${t('step4')}</div></div></div>
    <button class="btn fab" onclick="go('#/new')">${I.plus} ${t('t_new')}</button>
    <button class="bot-btn" onclick="botModal()" title="${t('aiHelp')}">💬</button>`;
  bindCommon();
}

// ---------- NEW APPLICATION: choose category ----------
function viewNew() {
  const cats = [
    ['student', '#/sub/student', 100], ['employee', '#/sub/employee', 20], ['pwd', '#/form/pwd', 100], ['ngo', '#/form/ngo', 50], ['journalist', '#/form/journalist', 50],
  ];
  app.innerHTML = `${topbar({ back: '#/home', title: t('t_new') })}
    <h2>${t('whoAreYou')}</h2><p class="muted" style="margin:-8px 0 16px">${t('chooseOne')}</p>
    <div class="cat-list">${cats.map(([k, href, d]) => `
      <button class="cat" onclick="go('${href}')">${CAT_ART[k]}<div><b>${t('c_' + k)}</b><span>${t('c_' + k + '_d')}</span></div>
      <span class="tag">${d === 100 ? t('free') : t('discountOff', { p: (k === 'employee' ? 'Up to ' : '') + d })}</span></button>`).join('')}</div>`;
  bindCommon();
}
function viewSub(group) {
  const opts = group === 'student' ? ['student_below_ssc', 'student_above_ssc'] : ['govt_employee', 'corporate_employee'];
  app.innerHTML = `${topbar({ back: '#/new', title: t('c_' + group) })}
    <div style="text-align:center;margin:10px 0 18px">${CAT_ART[group].replace('class="c-ico"', 'style="width:96px;height:96px"')}</div>
    <h2 class="center">${t(group === 'student' ? 'studentType' : 'employeeType')}</h2>
    <div class="cat-list">${opts.map(k => {
      const d = S.meta.categories[k].discount;
      return `<button class="cat" onclick="go('#/form/${k}')"><div style="font-size:34px;width:56px;text-align:center">${{ student_below_ssc: '🎒', student_above_ssc: '🎓', govt_employee: '🏛️', corporate_employee: '🏢' }[k]}</div>
      <div><b>${t(k)}</b><span>${t(k + '_d')}</span></div><span class="tag">${d === 100 ? t('free') : d ? t('discountOff', { p: d }) : '—'}</span></button>`;
    }).join('')}</div>`;
  bindCommon();
}

// ---------- APPLICATION FORM ----------
function viewForm(cat) {
  if (!S.meta.categories[cat]) return go('#/new');
  const d = S.draft[cat] = S.draft[cat] || {
    personal: { mobile: S.user.mobile, email: S.user.email, fullName: S.user.name.includes('@') ? '' : S.user.name },
    details: {}, route: { duration: 1 }, files: {},
  };
  const P = d.personal, R = d.route, F = d.files;
  const back = S.meta.categories[cat].group === 'student' ? '#/sub/student' : S.meta.categories[cat].group === 'employee' ? '#/sub/employee' : '#/new';
  const stOpts = sel => `<option value="">${t('select')}</option>` + S.meta.stations.map(s => `<option value="${s.code}" ${sel === s.code ? 'selected' : ''}>${esc(stName(s.code))}</option>`).join('');
  const catFields = S.meta.fields[cat].map(f => {
    const label = t('f_' + f.key);
    if (f.type === 'file') return uploadBox(f.key, label, F[f.key]);
    if (f.type === 'select') return `<div class="field"><label>${label} <span class="req">*</span></label><select class="input" data-det="${f.key}"><option value="">${t('select')}</option>${f.options.map(o => `<option ${d.details[f.key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    if (f.type === 'yesno') return `<div class="field"><label>${label} <span class="req">*</span></label><div class="seg" data-seg-det="${f.key}"><button type="button" data-v="yes" class="${d.details[f.key] === 'yes' ? 'on' : ''}">${t('yes')}</button><button type="button" data-v="no" class="${d.details[f.key] === 'no' ? 'on' : ''}">${t('no')}</button></div></div>`;
    return `<div class="field"><label>${label} <span class="req">*</span></label><input class="input" data-det="${f.key}" type="${f.type}" ${f.min ? `min="${f.min}" max="${f.max}"` : ''} value="${esc(d.details[f.key] || '')}"></div>`;
  }).join('');

  app.innerHTML = `${topbar({ back, title: t(cat) })}
    <div class="two-col"><div>
      <div class="card"><div class="section-title"><span class="num">1</span>${t('sec_personal')}</div>
        <div class="field"><label>${t('f_fullName')} <span class="req">*</span></label><input class="input" data-p="fullName" value="${esc(P.fullName || '')}"></div>
        <div class="field"><label>${t('f_guardianName')} <span class="req">*</span></label><input class="input" data-p="guardianName" value="${esc(P.guardianName || '')}"></div>
        <div class="row2">
          <div class="field"><label>${t('f_dob')} <span class="req">*</span></label><input class="input" type="date" data-p="dob" value="${esc(P.dob || '')}" max="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>${t('f_gender')} <span class="req">*</span></label><select class="input" data-p="gender"><option value="">${t('select')}</option>${['Male', 'Female', 'Other'].map(g => `<option value="${g}" ${P.gender === g ? 'selected' : ''}>${t(g.toLowerCase())}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>${t('f_mobile')} <span class="req">*</span></label><input class="input" type="tel" maxlength="10" inputmode="numeric" data-p="mobile" value="${esc(P.mobile || '')}"></div>
        <div class="field"><label>${t('f_email')}</label><input class="input" type="email" data-p="email" value="${esc(P.email || '')}"></div>
        <div class="field"><label>${t('f_aadhaar')} <span class="req">*</span></label><input class="input" inputmode="numeric" maxlength="14" data-p="aadhaar" value="${esc(P.aadhaar || '')}" placeholder="1234 5678 9012"><div class="hint">🔒 ${t('aadhaarNote')}</div></div>
        <div class="field"><label>${t('f_address')} <span class="req">*</span></label><textarea class="input" data-p="address">${esc(P.address || '')}</textarea></div>
      </div>
      <div class="card"><div class="section-title"><span class="num">2</span>${t('sec_category')}</div>${catFields}</div>
      <div class="card"><div class="section-title"><span class="num">3</span>${t('sec_route')}</div>
        <div class="field"><label>${t('f_from')} <span class="req">*</span></label><select class="input" data-r="from">${stOpts(R.from)}</select></div>
        <div class="field"><label>${t('f_to')} <span class="req">*</span></label><select class="input" data-r="to">${stOpts(R.to)}</select></div>
        <div class="field"><label>${t('f_duration')} <span class="req">*</span></label><div class="seg" id="durSeg">${[1, 3, 6].map(m => `<button type="button" data-v="${m}" class="${+R.duration === m ? 'on' : ''}">${t('m' + m)}</button>`).join('')}</div></div>
        <div class="field"><label>${t('f_collectAt')} <span class="req">*</span></label><select class="input" data-r="collectAt">${stOpts(R.collectAt)}</select></div>
      </div>
      <div class="card"><div class="section-title"><span class="num">4</span>${t('sec_docs')}</div>${uploadBox('photo', t('f_photo'), F.photo, { accept: 'image/*' })}</div>
    </div>
    <div><div class="fare" id="fareBox"></div>
      <div class="err" id="formErr" style="margin-top:12px"></div>
      <button class="btn btn-primary" id="saveBtn" style="margin-top:4px">${t('saveAndPay')} →</button>
    </div></div>`;
  bindCommon();

  // keep values in draft (so language change does not lose data)
  $$('[data-p]').forEach(el => el.oninput = el.onchange = () => { P[el.dataset.p] = el.value; });
  $$('[data-det]').forEach(el => el.oninput = el.onchange = () => { d.details[el.dataset.det] = el.value; });
  $$('[data-seg-det]').forEach(seg => $$('button', seg).forEach(b => b.onclick = () => { d.details[seg.dataset.segDet] = b.dataset.v; $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); }));
  $$('[data-r]').forEach(el => el.onchange = () => {
    R[el.dataset.r] = el.value;
    if (el.dataset.r === 'from' && !R.collectAt) { R.collectAt = el.value; $('[data-r=collectAt]').value = el.value; }
    updateFare();
  });
  $$('#durSeg button').forEach(b => b.onclick = () => { R.duration = +b.dataset.v; $$('#durSeg button').forEach(x => x.classList.toggle('on', x === b)); updateFare(); });
  $$('[data-file]').forEach(inp => inp.onchange = async () => {
    try { F[inp.dataset.file] = await readFile(inp.files[0], inp.dataset.file === 'photo' ? 500 : 1100); viewForm(cat); window.scrollTo(0, window.scrollY); }
    catch (e) { toast(e.message, true); }
  });

  async function updateFare() {
    const box = $('#fareBox');
    if (!R.from || !R.to) { box.innerHTML = `<h3>${t('fareTitle')}</h3><p class="muted">${t('fareHint')}</p>`; return; }
    try {
      const q = await api('/api/quote', { method: 'POST', body: { category: cat, from: R.from, to: R.to, duration: R.duration } });
      box.innerHTML = `<h3>${t('fareTitle')}</h3>
        <div class="line"><span>${t('distance')}</span><span>${q.km} km</span></div>
        <div class="line"><span>${t('normalFare')} (${t('m' + q.months)})</span><span>${rupee(q.normalFare)}</span></div>
        <div class="line disc"><span>${t('yourDiscount')} (${q.discountPct}%)</span><span>− ${rupee(q.discount)}</span></div>
        <div class="line"><span>${t('cardFee')}</span><span>${rupee(q.cardFee)}</span></div>
        <div class="tot"><span>${t('total')}</span><b>${rupee(q.total)}</b></div>`;
    } catch (e) { box.innerHTML = `<h3>${t('fareTitle')}</h3><p class="err">${esc(e.message)}</p>`; }
  }
  updateFare();

  $('#saveBtn').onclick = async () => {
    const btn = $('#saveBtn'); $('#formErr').textContent = '';
    busy(btn, true);
    try {
      const a = await api('/api/applications', { method: 'POST', body: { category: cat, personal: P, details: d.details, route: R, files: F } });
      delete S.draft[cat];
      go('#/pay/' + a.id);
    } catch (e) { $('#formErr').textContent = '⚠ ' + e.message; toast(e.message, true); busy(btn, false); }
  };
}

// ---------- PAYMENT ----------
async function viewPay(id) {
  const a = await api('/api/applications/' + id);
  if (a.status !== 'PENDING_PAYMENT') return go('#/success/' + id);
  let method = 'UPI';
  const draw = () => {
    app.innerHTML = `${topbar({ back: '#/apps', title: t('payment') })}
      <div class="pay-head"><div class="muted small" style="color:#cfe">${t('payFor')}: ${t(a.category)} • ${a.type === 'renewal' ? t('renewal') + ' ' + a.passCode : t('newPass')}</div>
        <div class="amt">${rupee(a.amount)}</div><div class="small" style="color:#cfe">${t('appNo')}: ${a.id} • ${esc(stName(a.route.from))} → ${esc(stName(a.route.to))} • ${t('m' + a.fare.months)}</div></div>
      <h3>${t('chooseMethod')}</h3>
      ${[['UPI', '📱', 'upi'], ['CARD', '💳', 'card'], ['NETBANKING', '🏦', 'netbanking']].map(([m, ic, k]) => `<div class="method ${method === m ? 'on' : ''}" data-m="${m}"><span class="radio"></span><span class="m-ico">${ic}</span><b>${t(k)}</b></div>`).join('')}
      <div class="card soft" style="margin-top:6px">
        ${method === 'UPI' ? `<div class="upi-apps"><span>PhonePe</span><span>GPay</span><span>Paytm</span><span>BHIM</span></div>${field('upi', t('upiId'), { extra: 'placeholder="name@okaxis"', req: false })}`
        : method === 'CARD' ? `${field('cardno', t('cardNo'), { extra: 'placeholder="4111 1111 1111 1111" inputmode="numeric" maxlength="19"', req: false })}<div class="row2">${field('exp', 'MM/YY', { req: false, extra: 'placeholder="12/29"' })}${field('cvv', 'CVV', { type: 'password', req: false, extra: 'maxlength="3"' })}</div>`
        : `<div class="field"><label>${t('bank')}</label><select class="input">${['SBI', 'Andhra Bank / Union Bank', 'HDFC', 'ICICI', 'Axis', 'Canara'].map(b => `<option>${b}</option>`).join('')}</select></div>`}
        <p class="hint">🔒 ${t('secure')} • ${t('demoPay')}</p>
      </div>
      <button class="btn btn-green" id="payBtn">${t('payNow', { a: Number(a.amount).toLocaleString('en-IN') })}</button>`;
    bindCommon();
    $$('[data-m]').forEach(el => el.onclick = () => { method = el.dataset.m; draw(); });
    $('#payBtn').onclick = async () => {
      const m = modal(`<div class="center"><div class="spinner"></div><h2>${t('processing')}</h2><p class="muted">${t('dontClose')}</p></div>`);
      try {
        await new Promise(r => setTimeout(r, 1800));
        await api('/api/payments/' + id, { method: 'POST', body: { method } });
        closeModal();
        go('#/success/' + id);
        await refreshUnread(true);
      } catch (e) { closeModal(); toast(e.message, true); }
    };
  };
  draw();
}

// ---------- PAYMENT SUCCESS + RECEIPT ----------
async function viewSuccess(id) {
  const a = await api('/api/applications/' + id);
  if (a.status === 'PENDING_PAYMENT') return go('#/pay/' + id);
  const p = a.payment;
  app.innerHTML = `${topbar({ back: '#/home', title: t('receipt') })}
    <div class="center"><div class="success-ico">${I.check}</div><h2>${t('paySuccess')}</h2><p class="muted">📩 ${t('smsSent', { m: a.personal.mobile })}</p></div>
    <div class="card" style="margin-top:16px"><h3>${t('receipt')}</h3><div class="kv">
      <span>${t('receiptNo')}</span><b>${p.receiptNo}</b><span>${t('appNo')}</span><b>${a.id}</b>
      <span>${t('f_fullName')}</span><b>${esc(a.personal.fullName)}</b><span>${t('category')}</span><b>${t(a.category)}</b>
      <span>${t('route')}</span><b>${esc(stName(a.route.from))} → ${esc(stName(a.route.to))}</b>
      <span>${t('paidOn')}</span><b>${fmtDT(p.paidAt)}</b><span>${t('payMethod')}</span><b>${p.method}</b><span>${t('txnId')}</span><b>${p.txnId}</b>
      <span>${t('amountPaid')}</span><b style="color:var(--green);font-size:20px">${rupee(p.amount)}</b></div></div>
    <div class="info-box"><b>${t('nextStep')}</b><br>${a.type === 'renewal' ? t('renewDoneText') : t('nextStepText', { s: esc(stName(a.route.collectAt)), t: S.meta.counterTimings })}</div>
    ${a.type === 'renewal' ? `<button class="btn btn-primary" onclick="go('#/pass/${a.passCode}')">${I.card} ${t('showPass')}</button>` : `<button class="btn btn-primary" onclick="printForm('${a.id}')">⬇ ${t('dlForm')}</button>`}
    <button class="btn btn-outline" style="margin-top:10px" onclick="printReceipt('${a.id}')">⬇ ${t('dlReceipt')}</button>
    <button class="btn btn-outline" style="margin-top:10px" onclick="go('#/home')">${t('goHome')}</button>`;
  bindCommon();
}

// ---------- PRINTABLE DOCUMENTS (Save as PDF) ----------
function printWindow(title, body) {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to download', true);
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:13px} .doc{max-width:760px;margin:auto;border:2px solid #10204a;padding:22px}
    .hd{display:flex;align-items:center;gap:14px;border-bottom:3px double #10204a;padding-bottom:12px;margin-bottom:14px}.hd h1{margin:0;font-size:20px;color:#10204a}.hd p{margin:2px 0;color:#444}
    table{width:100%;border-collapse:collapse;margin:8px 0 14px} td,th{border:1px solid #999;padding:7px 9px;text-align:left;vertical-align:top} th{background:#eef1fa;width:36%}
    h3{background:#10204a;color:#fff;padding:6px 10px;font-size:13px;margin:14px 0 0} .photo{width:110px;height:135px;border:1px solid #333;object-fit:cover}
    .sign{display:flex;justify-content:space-between;margin-top:40px}.sign div{border-top:1px solid #333;padding-top:4px;width:40%;text-align:center}
    .big{font-size:22px;font-weight:bold;letter-spacing:2px} .office{border:2px dashed #888;padding:10px;margin-top:16px} .note{font-size:11.5px;color:#444}
    @media print{body{margin:0}.noprint{display:none}}</style></head><body>${body}
    <p class="noprint" style="text-align:center;margin-top:18px"><button onclick="print()" style="padding:12px 22px;font-size:16px;background:#10204a;color:#fff;border:0;border-radius:8px">Print / Save as PDF</button></p>
    <script>setTimeout(()=>print(),600)<\/script></body></html>`);
  w.document.close();
}
async function printForm(id) {
  const a = await api('/api/applications/' + id);
  const st = c => (S.meta.stations.find(s => s.code === c) || {}).name || c;
  const det = Object.entries(a.details).map(([k, v]) => `<tr><th>${I18N.en['f_' + k] || k}</th><td>${esc(v)}</td></tr>`).join('');
  const docs = Object.keys(a.files).filter(k => k !== 'photo').map(k => I18N.en['f_' + k] || k).join(', ');
  printWindow('Application ' + a.id, `<div class="doc">
    <div class="hd"><img src="/img/logo.svg" width="54"><div><h1>e-BusPass – Bus Pass Application Form</h1><p>Online application • Take this form to the bus stand counter</p></div></div>
    <table><tr><th>Application No.</th><td class="big">${a.id}</td><td rowspan="5" style="width:130px;text-align:center"><img class="photo" src="${a.files.photo}"><br><small>Applicant photo</small></td></tr>
    <tr><th>Applied on</th><td>${fmtDT(a.createdAt)}</td></tr><tr><th>Pass category</th><td><b>${I18N.en[a.category]}</b></td></tr>
    <tr><th>Payment</th><td>${a.payment ? `PAID ₹${a.payment.amount} • ${a.payment.receiptNo} • ${a.payment.method}` : 'NOT PAID'}</td></tr>
    <tr><th>Collect pass at</th><td><b>${st(a.route.collectAt)} Bus Stand</b> (${S.meta.counterTimings})</td></tr></table>
    <h3>1. Applicant details</h3><table>
    <tr><th>Full name</th><td>${esc(a.personal.fullName)}</td></tr><tr><th>Father / Guardian</th><td>${esc(a.personal.guardianName)}</td></tr>
    <tr><th>Date of birth / Gender</th><td>${fmtDate(a.personal.dob)} / ${esc(a.personal.gender)}</td></tr>
    <tr><th>Mobile / Email</th><td>+91 ${esc(a.personal.mobile)} / ${esc(a.personal.email || '-')}</td></tr>
    <tr><th>Aadhaar</th><td>${esc(a.personal.aadhaar)}</td></tr><tr><th>Address</th><td>${esc(a.personal.address)}</td></tr></table>
    <h3>2. Category details</h3><table>${det || '<tr><td>-</td></tr>'}<tr><th>Documents uploaded</th><td>${esc(docs || '-')}</td></tr></table>
    <h3>3. Route & fare</h3><table><tr><th>From → To</th><td>${st(a.route.from)} → ${st(a.route.to)} (${a.route.km} km)</td></tr>
    <tr><th>Duration</th><td>${a.fare.months} month(s)</td></tr><tr><th>Fare</th><td>Normal ₹${a.fare.normalFare} − Discount ${a.fare.discountPct}% (₹${a.fare.discount}) + Card fee ₹${a.fare.cardFee} = <b>₹${a.fare.total}</b></td></tr></table>
    <p class="note"><b>Declaration:</b> I declare that the above details are true. I will carry my original Aadhaar and category certificate while collecting the pass.</p>
    <div class="sign"><div>Applicant signature</div><div>Counter staff signature & seal</div></div>
    <div class="office"><b>FOR OFFICE USE</b><br><br>Originals verified: ☐ Aadhaar &nbsp; ☐ Certificate &nbsp; ☐ Photo &nbsp;&nbsp; Pass code issued: ________________ &nbsp; Date: __________</div></div>`);
}
async function printReceipt(id) {
  const a = await api('/api/applications/' + id); const p = a.payment;
  printWindow('Receipt ' + p.receiptNo, `<div class="doc" style="max-width:480px">
    <div class="hd"><img src="/img/logo.svg" width="46"><div><h1>Payment Receipt</h1><p>e-BusPass Transit</p></div></div>
    <table><tr><th>Receipt No.</th><td><b>${p.receiptNo}</b></td></tr><tr><th>Application No.</th><td>${a.id}</td></tr><tr><th>Name</th><td>${esc(a.personal.fullName)}</td></tr>
    <tr><th>Category</th><td>${I18N.en[a.category]} (${a.type})</td></tr><tr><th>Paid on</th><td>${fmtDT(p.paidAt)}</td></tr><tr><th>Method / Txn ID</th><td>${p.method} / ${p.txnId}</td></tr>
    <tr><th>Amount</th><td class="big">₹${p.amount}</td></tr></table><p class="note">This is a computer generated receipt. No signature needed.</p></div>`);
}

// ---------- MY APPLICATIONS ----------
async function viewApps() {
  const apps = await api('/api/applications');
  app.innerHTML = `${topbar({ back: '#/home', title: t('myApps') })}
    ${apps.length ? apps.map(a => `<div class="app-item">
      <div class="top"><div><b style="font-size:17px">${t(a.category)}</b><div class="muted small">${a.id} • ${a.type === 'renewal' ? t('renewal') : t('newPass')} • ${fmtDate(a.createdAt)}</div></div><span class="chip ${a.status}">${t('st_' + a.status)}</span></div>
      <div class="route-box"><div class="stop"><span class="dot"></span>${esc(stName(a.route.from))}</div><div class="vline"></div><div class="stop"><span class="pin">📍</span>${esc(stName(a.route.to))}</div></div>
      ${a.passCode ? `<p style="margin-bottom:8px">${t('passCode')}: <b style="color:var(--teal);font-size:18px">${a.passCode}</b></p>` : ''}
      ${a.rejectReason ? `<p class="err">${esc(a.rejectReason)}</p>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><span class="muted small">${t('total')}</span><div class="price">${rupee(a.amount)}</div></div>
      <div class="app-actions">${a.status === 'PENDING_PAYMENT' ? `<button class="btn btn-sm btn-green" onclick="go('#/pay/${a.id}')">${t('payPending')}</button>` : `
        ${a.type === 'new' ? `<button class="btn btn-sm btn-outline" onclick="printForm('${a.id}')">⬇ ${t('form')}</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="printReceipt('${a.id}')">⬇ ${t('receipt')}</button>
        ${a.passCode ? `<button class="btn btn-sm btn-primary" onclick="go('#/pass/${a.passCode}')">${t('showPass')}</button>` : ''}`}</div></div>
    </div>`).join('') : `<div class="card center"><p class="muted">${t('noApps')}</p><br><button class="btn btn-primary" onclick="go('#/new')">${t('t_new')}</button></div>`}`;
  bindCommon();
}

// ---------- MY PASS (enter code → secure soft copy) ----------
async function viewPass(code) {
  const passes = await api('/api/my-passes');
  app.innerHTML = `${topbar({ back: '#/home', title: t('t_mypass') })}
    <div class="card"><form id="codeForm">${field('code', t('enterCode'), { icon: 'card', value: code || '', hint: t('codeExample'), extra: 'style="text-transform:uppercase;letter-spacing:2px;font-weight:700" autocomplete="off"' })}
      <button class="btn btn-primary">${t('showPass')}</button></form>
      ${passes.length ? `<div class="chips" style="margin:14px 0 0">${passes.map(p => `<button onclick="go('#/pass/${p.code}')">🎫 ${p.code}</button>`).join('')}</div>` : ''}</div>
    <div id="passArea"></div>`;
  bindCommon();
  $('#codeForm').onsubmit = e => { e.preventDefault(); const c = $('#code').value.trim().toUpperCase(); if (c) go('#/pass/' + c); };
  if (code) await showSecurePass(code.toUpperCase());
}
async function showSecurePass(code) {
  const area = $('#passArea');
  let p;
  try { p = await api('/api/pass/' + encodeURIComponent(code)); }
  catch (e) { area.innerHTML = `<div class="warn-box">⚠ ${esc(e.message)}</div>`; return; }
  const stTxt = { ACTIVE: t('validPass'), EXPIRED: t('expiredPass'), NOT_STARTED: t('notStarted'), BLOCKED: t('blocked') }[p.status];
  const wmLine = `${p.code} • +91 ${p.mobile} • ${new Date().toLocaleDateString('en-IN')} • e-BusPass • `;
  area.innerHTML = `
    <div class="warn-box">🚫 ${t('noScreenshot')}</div>
    <div class="pass-wrap secure" id="pw">
      <div class="pass-card ${p.status !== 'ACTIVE' ? 'expired' : ''}">
        <div class="holo"></div><div class="wm">${Array(14).fill(`<div>${wmLine.repeat(5)}</div>`).join('')}</div>
        <div class="pass-top"><span class="star">★</span><b>e-BusPass Transit</b><span style="margin-left:auto" class="chip ${p.status}">${t(p.category).split('–')[0]}</span></div>
        <div class="pass-body"><img class="pass-photo" src="${esc(p.photo || '/img/avatar.svg')}" alt="" draggable="false">
          <div class="pass-name"><small>Passenger name</small><b>${esc(p.name)}</b><div class="small" style="margin-top:6px;color:#cfe">${esc(p.institution || '')}</div>${p.escort ? `<div class="small" style="color:var(--yellow)">+ Escort allowed</div>` : ''}</div></div>
        <div class="pass-grid">
          <div><small>From</small><b>${esc(stName(p.from))}</b></div><div><small>To</small><b>${esc(stName(p.to))}</b></div>
          <div><small>${t('validFrom')}</small><b>${fmtDate(p.validFrom)}</b></div><div><small>${t('validTill')}</small><b>${fmtDate(p.validTill)}</b></div>
          <div><small>${t('category')}</small><b style="color:var(--teal)">${t(p.category)}</b></div><div><small>${t('tripsToday')}</small><b>${p.tripsToday} / ${p.tripsPerDay}</b><div class="meter"><i style="width:${p.tripsToday / p.tripsPerDay * 100}%"></i></div></div>
        </div>
        <div class="pass-code"><small style="color:#a9c4d6;letter-spacing:2px">PASS CODE</small><br><b>${p.code}</b></div>
        <div class="pass-foot"><span class="live-dot" style="${p.status !== 'ACTIVE' ? 'color:var(--red)' : ''}">${stTxt}</span><span class="clock" id="clock"></span></div>
      </div>
      <div class="shield" id="shield"><div style="font-size:42px">🛡️</div><b style="font-size:19px">${t('hiddenTitle')}</b><span class="muted">${t('tapShow')}</span></div>
    </div>
    ${p.status === 'ACTIVE' ? `<p class="center muted small" style="margin:10px 0">${t('daysLeft', { d: p.daysLeft })}</p>` : `<button class="btn btn-green" style="margin-top:14px" onclick="go('#/renew/${p.code}')">${I.renew} ${t('t_renew')}</button>`}
    <div class="card" style="margin-top:14px"><h3>${t('tripHistory')}</h3>
      ${p.trips.length ? p.trips.map(tr => `<div class="trip-row"><span>🚌 ${fmtDT(tr.at)}</span><span class="muted">${t('bus')}: ${esc(tr.busNo || '-')}</span></div>`).join('') : `<p class="muted">${t('noTrips')}</p>`}</div>`;
  secureGuards(code);
}
// Screenshot protection (best possible on a website)
function secureGuards(code) {
  const pw = $('#pw'); if (!pw) return;
  let lockTimer;
  const lock = () => pw.classList.add('locked');
  const unlock = () => { pw.classList.remove('locked'); clearTimeout(lockTimer); lockTimer = setTimeout(lock, 60000); };
  const tick = () => { const c = $('#clock'); if (c) c.textContent = new Date().toLocaleTimeString('en-IN', { hour12: true }); };
  const onKey = e => {
    const k = (e.key || '').toLowerCase();
    if (k === 'printscreen' || k === 'snapshot') { lock(); try { navigator.clipboard.writeText(''); } catch {} toast(t('noScreenshot'), true); }
    if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(k)) { e.preventDefault(); lock(); }
    if (e.metaKey && e.shiftKey) lock();               // Win+Shift+S / Mac Cmd+Shift+3/4
  };
  const onVis = () => { if (document.hidden) lock(); };
  const noCtx = e => { if (e.target.closest('#pw')) e.preventDefault(); };
  $('#shield').onclick = unlock;
  tick(); unlock();
  const clockI = setInterval(tick, 1000);
  const refreshI = setInterval(async () => {          // live refresh: conductor's trip marks appear here
    if (document.hidden || pw.classList.contains('locked')) return;
    try { const p = await api('/api/pass/' + code); const cur = $$('.trip-row').length; if (p.trips.length !== cur) showSecurePass(code); } catch {}
  }, 15000);
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', lock);
  document.addEventListener('contextmenu', noCtx); window.addEventListener('beforeprint', lock);
  S.cleanups.push(() => {
    clearInterval(clockI); clearInterval(refreshI); clearTimeout(lockTimer);
    document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', lock);
    document.removeEventListener('contextmenu', noCtx); window.removeEventListener('beforeprint', lock);
  });
}

// ---------- RENEW ----------
async function viewRenew(code) {
  const passes = await api('/api/my-passes');
  let dur = 1;
  app.innerHTML = `${topbar({ back: '#/home', title: t('t_renew') })}
    <h2>${t('renewTitle')}</h2><div class="info-box">✅ ${t('renewNote')}</div>
    <div class="card"><div class="field"><label>${t('passCode')}</label><select class="input" id="rc"><option value="">${t('select')}</option>${passes.map(p => `<option value="${p.code}" ${p.code === code ? 'selected' : ''}>${p.code} – ${esc(stName(p.from))} → ${esc(stName(p.to))}</option>`).join('')}</select></div>
    <div id="rInfo"></div></div>`;
  bindCommon();
  const show = async () => {
    const c = $('#rc').value, box = $('#rInfo');
    if (!c) { box.innerHTML = passes.length ? '' : `<p class="muted">${t('noApps')}</p>`; return; }
    const p = passes.find(x => x.code === c);
    const q = await api('/api/quote', { method: 'POST', body: { category: p.category, from: p.from, to: p.to, duration: dur } });
    box.innerHTML = `<div class="kv" style="margin-bottom:14px"><span>${t('category')}</span><b>${t(p.category)}</b><span>${t('validTill')}</span><b>${fmtDate(p.validTill)} <span class="chip ${p.status}">${p.status === 'ACTIVE' ? t('daysLeft', { d: p.daysLeft }) : t('expiredPass')}</span></b></div>
      <div class="field"><label>${t('f_duration')}</label><div class="seg" id="rSeg">${[1, 3, 6].map(m => `<button type="button" data-v="${m}" class="${dur === m ? 'on' : ''}">${t('m' + m)}</button>`).join('')}</div></div>
      <div class="fare" style="position:static;margin-bottom:14px"><div class="line"><span>${t('normalFare')}</span><span>${rupee(q.normalFare)}</span></div><div class="line disc"><span>${t('yourDiscount')} (${q.discountPct}%)</span><span>− ${rupee(q.discount)}</span></div><div class="line"><span>${t('cardFee')}</span><span>₹0</span></div><div class="tot"><span>${t('total')}</span><b>${rupee(q.total - q.cardFee)}</b></div></div>
      <button class="btn btn-green" id="rBtn">${t('renewPay')} →</button>`;
    $$('#rSeg button').forEach(b => b.onclick = () => { dur = +b.dataset.v; show(); });
    $('#rBtn').onclick = async () => { try { const a = await api('/api/renew', { method: 'POST', body: { code: c, duration: dur } }); go('#/pay/' + a.id); } catch (e) { toast(e.message, true); } };
  };
  $('#rc').onchange = show; show();
}

// ---------- UPDATE DETAILS ----------
async function viewUpdate() {
  const [passes, reqs] = await Promise.all([api('/api/my-passes'), api('/api/update-requests')]);
  const st = { field: 'mobile', photo: null, proof: null };
  const draw = () => {
    app.innerHTML = `${topbar({ back: '#/home', title: t('t_update') })}
      <h2>${t('updTitle')}</h2>
      <div class="card"><form id="uForm" novalidate>
        <div class="field"><label>${t('passCode')} <span class="req">*</span></label><select class="input" name="code">${passes.map(p => `<option value="${p.code}">${p.code} – ${esc(p.name)}</option>`).join('') || `<option value="">-</option>`}</select></div>
        <div class="field"><label>${t('updWhat')} <span class="req">*</span></label><select class="input" id="uField">${['mobile', 'email', 'address', 'institution', 'photo'].map(f => `<option value="${f}" ${st.field === f ? 'selected' : ''}>${t('u_' + f)}</option>`).join('')}</select></div>
        ${st.field === 'photo' ? uploadBox('photo', t('newPhoto'), st.photo, { accept: 'image/*' }) : st.field === 'address' ? `<div class="field"><label>${t('newValue')} <span class="req">*</span></label><textarea class="input" name="value"></textarea></div>` : field('value', t('newValue'), { type: st.field === 'mobile' ? 'tel' : st.field === 'email' ? 'email' : 'text' })}
        <div class="field"><label>${t('reason')} <span class="req">*</span></label><input class="input" name="reason"></div>
        ${uploadBox('proof', t('proofOpt'), st.proof, { req: false })}
        <p class="hint" style="margin-bottom:12px">ℹ ${t('routeChangeNote')}</p>
        <button class="btn btn-primary" ${passes.length ? '' : 'disabled'}>${t('sendReq')}</button></form></div>
      ${reqs.length ? `<h3>${t('myRequests')}</h3>` + reqs.map(r => `<div class="app-item"><div class="top"><div><b>${t('u_' + r.field)}</b><div class="muted small">${r.id} • ${r.passCode} • ${fmtDate(r.createdAt)}</div></div><span class="chip ${r.status}">${t('st_' + r.status)}</span></div></div>`).join('') : ''}`;
    bindCommon();
    $('#uField').onchange = e => { st.field = e.target.value; draw(); };
    $$('[data-file]').forEach(inp => inp.onchange = async () => { try { st[inp.dataset.file] = await readFile(inp.files[0], 600); draw(); } catch (e) { toast(e.message, true); } });
    $('#uForm').onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        await api('/api/update-requests', { method: 'POST', body: { ...f, field: st.field, newPhoto: st.photo, proof: st.proof } });
        toast(t('reqSent')); refreshUnread(true); viewUpdate();
      } catch (ex) { toast(ex.message, true); }
    };
  };
  draw();
}

// ---------- NEARBY BUS STANDS ----------
function viewNearby(pos) {
  const dist = (a, b) => { const R = 6371, r = x => x * Math.PI / 180; const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  let list = S.meta.stations.map(s => ({ ...s, d: pos ? dist(pos, s) : null }));
  if (pos) list.sort((a, b) => a.d - b.d);
  app.innerHTML = `${topbar({ back: '#/home', title: t('t_nearby') })}
    <h2>${t('nearbyTitle')}</h2>
    <button class="btn btn-primary" id="locBtn" style="margin-bottom:14px">📍 ${t('useLocation')}</button>
    <p class="muted small" style="margin-bottom:12px">🕗 ${t('counterTime')}: ${S.meta.counterTimings}</p>
    ${list.map((s, i) => `<div class="station"><div class="s-code">${s.code}</div><div style="flex:1"><b>${esc(stName(s.code))}</b> ${pos && i === 0 ? '⭐' : ''}<div class="muted small">${s.d != null ? t('kmAway', { k: s.d.toFixed(1) }) : 'APSRTC Bus Stand'}</div></div>
      <a class="btn btn-sm btn-outline" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + ' bus stand')}">${t('openMaps')}</a></div>`).join('')}`;
  bindCommon();
  $('#locBtn').onclick = () => {
    if (!navigator.geolocation) return toast(t('locError'), true);
    navigator.geolocation.getCurrentPosition(p => viewNearby({ lat: p.coords.latitude, lng: p.coords.longitude }), () => toast(t('locError'), true), { timeout: 8000 });
  };
}

// ---------- FARE CHART ----------
function viewFares() {
  const m = S.meta, kms = [10, 25, 50];
  const price = (km, disc) => { const n = Math.round(Math.max(m.minFare, km * m.ratePerKm) / 10) * 10; return Math.max(m.cardFee, Math.round((n - Math.round(n * disc / 100) + m.cardFee) / 10) * 10); };
  const stOpts = S.meta.stations.map(s => `<option value="${s.code}">${esc(stName(s.code))}</option>`).join('');
  app.innerHTML = `${topbar({ back: '#/home', title: t('t_fares') })}
    <h2>${t('faresTitle')}</h2><p class="muted" style="margin:-6px 0 14px">${t('faresNote')}</p>
    <div class="card" style="overflow-x:auto"><table class="fares"><tr><th>${t('category')}</th><th>${t('discount')}</th>${kms.map(k => `<th>${k} km</th>`).join('')}</tr>
      ${Object.entries(m.categories).map(([k, c]) => `<tr><td>${t(k)}</td><td><span class="chip ${c.discount ? 'ISSUED' : 'PAID'}">${c.discount === 100 ? t('free') : c.discount + '%'}</span></td>${kms.map(km => `<td>${rupee(price(km, c.discount))}</td>`).join('')}</tr>`).join('')}</table></div>
    <div class="card"><h3>🧮 ${t('calc')}</h3>
      <div class="field"><label>${t('category')}</label><select class="input" id="cCat">${Object.keys(m.categories).map(k => `<option value="${k}">${t(k)}</option>`).join('')}</select></div>
      <div class="row2"><div class="field"><label>${t('f_from')}</label><select class="input" id="cFrom">${stOpts}</select></div><div class="field"><label>${t('f_to')}</label><select class="input" id="cTo">${stOpts}</select></div></div>
      <div class="field"><label>${t('f_duration')}</label><select class="input" id="cDur">${[1, 3, 6].map(x => `<option value="${x}">${t('m' + x)}</option>`).join('')}</select></div>
      <div class="fare" style="position:static" id="cOut"></div></div>`;
  bindCommon();
  $('#cTo').selectedIndex = 1;
  const calc = async () => {
    try { const q = await api('/api/quote', { method: 'POST', body: { category: $('#cCat').value, from: $('#cFrom').value, to: $('#cTo').value, duration: +$('#cDur').value } });
      $('#cOut').innerHTML = `<div class="line"><span>${t('distance')}</span><span>${q.km} km</span></div><div class="line"><span>${t('normalFare')}</span><span>${rupee(q.normalFare)}</span></div><div class="line disc"><span>${t('yourDiscount')}</span><span>− ${rupee(q.discount)}</span></div><div class="tot"><span>${t('total')}</span><b>${rupee(q.total)}</b></div>`;
    } catch (e) { $('#cOut').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  $$('#cCat,#cFrom,#cTo,#cDur').forEach(el => el.onchange = calc); calc();
}

// ---------- HELP ----------
function viewHelp() {
  app.innerHTML = `${topbar({ back: '#/home', title: t('t_help') })}
    <h2>${t('helpTitle')}</h2>
    <div class="card" style="display:flex;align-items:center;gap:14px"><div style="font-size:34px">☎️</div><div><b>${t('helpline')}</b><div class="muted">1800-000-0000 (sample) • ${S.meta.counterTimings}</div></div></div>
    <h3>${t('faq')}</h3>${[1, 2, 3, 4, 5].map(i => `<details class="faq"><summary>${t('q' + i)}</summary><p>${t('a' + i)}</p></details>`).join('')}
    <button class="btn btn-primary" style="margin-top:8px" onclick="botModal()">💬 ${t('aiHelp')}</button>`;
  bindCommon();
}

// ---------- HELP BOT (simple, works offline) ----------
function botAnswer(q) {
  q = q.toLowerCase();
  const has = (...w) => w.some(x => q.includes(x));
  if (has('screen', 'స్క్రీన్', 'स्क्रीन', 'photo theeya')) return t('a3');
  if (has('code', 'conductor', 'కోడ్', 'కండక్టర్', 'कोड', 'कंडक्टर')) return t('a2');
  if (has('document', 'proof', 'certificate', 'డాక్యుమెంట్', 'कागज', 'सर्टिफिकेट')) return t('a4');
  if (has('lost', 'poyindi', 'పోయింది', 'खो')) return t('a5');
  if (has('renew', 'రెన్యూ', 'रिन्यू', 'extend')) return t('renewNote');
  if (has('price', 'fare', 'amount', 'cost', 'rate', 'ధర', 'డబ్బు', 'किराया', 'कीमत', 'entha')) return t('faresNote') + ' → ' + t('t_fares');
  if (has('change', 'update', 'mobile', 'address', 'మార్చ', 'बदल', 'marcha')) return t('t_update') + ': ' + t('t_update_d');
  if (has('where', 'collect', 'bus stand', 'ekkada', 'ఎక్కడ', 'कहाँ')) return t('nextStepText', { s: '—', t: S.meta.counterTimings }).replace(/<[^>]+>/g, '');
  if (has('online', 'apply', 'how', 'ela', 'ఎలా', 'कैसे')) return t('a1');
  return t('botHi') + ' ' + t('helpline') + ': 1800-000-0000';
}
function botModal() {
  const m = modal(`<h2>💬 ${t('aiHelp')}</h2><div class="bot-msgs" id="bm"><div class="bot">${t('botHi')}</div></div>
    <div class="chips">${[1, 2, 3, 4].map(i => `<button data-q="${esc(t('q' + i))}">${t('q' + i)}</button>`).join('')}</div>
    <form id="bf" style="display:flex;gap:8px"><input class="input" id="bq" placeholder="${t('botPh')}" autocomplete="off"><button class="btn btn-primary btn-sm">➤</button></form>`);
  const ask = q => { if (!q.trim()) return; const bm = $('#bm', m); bm.innerHTML += `<div class="me">${esc(q)}</div><div class="bot">${esc(botAnswer(q))}</div>`; bm.scrollTop = bm.scrollHeight; };
  $$('[data-q]', m).forEach(b => b.onclick = () => ask(b.dataset.q));
  $('#bf', m).onsubmit = e => { e.preventDefault(); ask($('#bq', m).value); $('#bq', m).value = ''; };
}

// ---------- NOTIFICATIONS ----------
async function viewNotifications() {
  const list = await api('/api/notifications');
  app.innerHTML = `${topbar({ back: S.user.role === 'passenger' ? '#/home' : '#/' + S.user.role, title: t('notifications') })}
    ${list.length ? list.map(n => `<div class="notif ${n.read ? '' : 'unread'}"><div class="n-ico">✉</div><div><b>${esc(n.title)}</b><p>${esc(n.text)}</p><span class="muted small">SMS → +91 ${esc(n.mobile)} • ${fmtDT(n.createdAt)}</span></div></div>`).join('') : `<div class="card center muted">${t('noNotif')}</div>`}`;
  bindCommon();
  await api('/api/notifications/read', { method: 'POST' }); S.unread = 0;
}
async function refreshUnread(popNew) {
  try {
    const list = await api('/api/notifications');
    const newOnes = S.lastNotif ? list.filter(n => n.createdAt > S.lastNotif) : [];
    if (list[0]) S.lastNotif = list[0].createdAt;
    S.unread = list.filter(n => !n.read).length;
    if (popNew) newOnes.reverse().forEach((n, i) => smsPop(n.text, i * 1500));
    const b = $('.icon-btn .badge'); if (b) b.textContent = S.unread;
  } catch {}
}

// ---------- CONDUCTOR MACHINE ----------
function viewConductor() {
  let recent = JSON.parse(sessionStorage.getItem('recent') || '[]');
  app.innerHTML = `${topbar()}
    <h2>🎫 ${t('condTitle')}</h2><p class="muted" style="margin:-8px 0 14px">${t('condNote')}</p>
    <div class="machine">
      <div class="screen" id="scr"><span class="menu">APSRTC TIM • 1. TICKET 2. WOMEN FREE 3. <b>BUS PASS</b></span><br>&gt; ${t('enterCode')}...</div>
      <div class="row2" style="margin-top:14px"><div class="field"><label>${t('busNo')}</label><input class="input" id="busNo" value="${esc(sessionStorage.getItem('bus') || 'AP16Z1234')}"></div>
      <div class="field"><label>${t('passCode')}</label><input class="input" id="cCode" placeholder="GDV_0001" autocomplete="off"></div></div>
      <div class="chips">${S.meta.stations.map(s => `<button data-pre="${s.code}_" style="background:#fbfaf6;color:#222;border-color:#bbb">${s.code}_</button>`).join('')}</div>
      <div class="keypad">${['1', '2', '3', 'DEL', '4', '5', '6', '_', '7', '8', '9', 'CLR', '0'].map(k => `<button data-k="${k}" class="${k === 'DEL' || k === 'CLR' ? 'k-del' : ''}">${k}</button>`).join('')}<button class="k-ok" data-k="OK" style="grid-column:span 3">OK – ${t('checkPass')}</button></div>
      <button class="btn btn-green" id="punch" style="margin-top:12px" disabled>✔ ${t('markTrip')}</button>
    </div>
    <div class="card" style="margin-top:16px"><h3>${t('lastChecked')}</h3><div id="recent">${recent.map(r => `<div class="trip-row"><span>${r.code} – ${esc(r.name)}</span><span class="muted">${r.time}</span></div>`).join('') || `<p class="muted">-</p>`}</div></div>`;
  bindCommon();
  const inp = $('#cCode'), scr = $('#scr'), punch = $('#punch');
  let current = null;
  const say = html => scr.innerHTML = `<span class="menu">APSRTC TIM • BUS PASS</span><br>${html}`;
  const check = async () => {
    const code = inp.value.trim().toUpperCase(); if (!code) return;
    say('&gt; Checking ' + esc(code) + ' ...');
    try {
      const p = await api('/api/pass/' + encodeURIComponent(code)); current = p;
      const ok = p.status === 'ACTIVE' && p.tripsToday < p.tripsPerDay;
      say(`<b>${esc(p.name)}</b><br>${esc(p.code)} | ${t(p.category)}<br>${esc(p.from)} ⇄ ${esc(p.to)} | ${t('validTill')}: ${p.validTill}<br>${t('tripsToday')}: ${p.tripsToday}/${p.tripsPerDay}<br>${ok ? '<b style="color:#7dff9f">✔ VALID – ALLOW</b>' : `<b style="color:#ff8a80">✖ ${p.status !== 'ACTIVE' ? p.status : 'DAILY LIMIT'}</b>`}
        ${p.photo ? `<img src="${esc(p.photo)}" style="float:right;width:56px;height:68px;object-fit:cover;border-radius:6px;margin-top:-70px">` : ''}`);
      punch.disabled = !ok;
    } catch (e) { current = null; punch.disabled = true; say(`<b style="color:#ff8a80">✖ ${esc(e.message)}</b>`); }
  };
  $$('[data-pre]').forEach(b => b.onclick = () => { inp.value = b.dataset.pre; inp.focus(); });
  $$('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'OK') return check();
    if (k === 'DEL') inp.value = inp.value.slice(0, -1); else if (k === 'CLR') inp.value = ''; else inp.value += k;
  });
  inp.onkeydown = e => { if (e.key === 'Enter') check(); };
  punch.onclick = async () => {
    if (!current) return;
    sessionStorage.setItem('bus', $('#busNo').value);
    try {
      const r = await api('/api/conductor/punch', { method: 'POST', body: { code: current.code, busNo: $('#busNo').value } });
      const time = new Date(r.trip.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      say(`<b style="color:#7dff9f">${t('tripMarked', { t: time })}</b><br>${esc(r.pass.name)} • ${r.pass.code}<br>${t('tripsToday')}: ${r.pass.tripsToday}/${r.pass.tripsPerDay}<br>🖨 Ticket printed: ₹0 (PASS)`);
      recent.unshift({ code: r.pass.code, name: r.pass.name, time }); recent = recent.slice(0, 8);
      sessionStorage.setItem('recent', JSON.stringify(recent));
      $('#recent').innerHTML = recent.map(x => `<div class="trip-row"><span>${x.code} – ${esc(x.name)}</span><span class="muted">${x.time}</span></div>`).join('');
      punch.disabled = true; current = null; inp.value = '';
    } catch (e) { say(`<b style="color:#ff8a80">✖ ${esc(e.message)}</b>`); punch.disabled = true; }
  };
}

// ---------- BUS STAND COUNTER (Depot staff) ----------
async function viewDepot(tab = 'apps') {
  const [stats, apps, reqs] = await Promise.all([api('/api/depot/stats'), api('/api/depot/applications'), api('/api/depot/update-requests')]);
  const docLinks = a => `<div class="doc-links">${Object.entries(a.files || {}).map(([k, v]) => `<a href="${esc(v)}" target="_blank">📎 ${k === 'photo' ? t('sec_docs') : t('f_' + k)}</a>`).join('')}</div>`;
  app.innerHTML = `${topbar()}
    <h2>🏢 ${t('depotTitle')}</h2><p class="muted" style="margin:-8px 0 14px">${t('depotNote')}</p>
    <div class="stats"><div><b>${stats.waiting}</b><span>${t('waiting')}</span></div><div><b>${stats.issued}</b><span>${t('issued')}</span></div><div><b>${stats.pendingUpdates}</b><span>${t('pendingUpd')}</span></div><div><b>${rupee(stats.collected)}</b><span>${t('collected')}</span></div></div>
    <div class="tabs"><button class="${tab === 'apps' ? 'on' : ''}" data-tab="apps">${t('tab_apps')}</button><button class="${tab === 'upd' ? 'on' : ''}" data-tab="upd">${t('tab_upd')}</button></div>
    ${tab === 'apps' ? (apps.length ? apps.map(a => `<div class="app-item">
        <div class="top"><div style="display:flex;gap:12px"><img src="${esc(a.files.photo)}" style="width:52px;height:62px;object-fit:cover;border-radius:10px"><div><b style="font-size:17px">${esc(a.personal.fullName)}</b><div class="muted small">${a.id} • ${t(a.category)}</div><div class="small">📞 ${esc(a.personal.mobile)} • ${esc(a.personal.aadhaar)}</div></div></div><span class="chip ${a.status}">${t('st_' + a.status)}</span></div>
        <div class="route-box"><div class="stop"><span class="dot"></span>${esc(stName(a.route.from))} → ${esc(stName(a.route.to))} • ${t('m' + a.fare.months)}</div><div class="small muted" style="margin-top:6px">🏢 ${esc(stName(a.route.collectAt))} • ${rupee(a.amount)}</div></div>
        ${docLinks(a)}
        <div class="app-actions">${a.status === 'PAID' ? `<button class="btn btn-sm btn-red" data-rej="${a.id}">${t('reject')}</button><button class="btn btn-sm btn-green" data-issue="${a.id}">✔ ${t('issuePass')}</button>` : a.passCode ? `<b style="color:var(--teal);font-size:18px;margin-right:auto">${a.passCode}</b><button class="btn btn-sm btn-outline" data-card="${a.passCode}">🖨 Pass card</button>` : ''}</div>
      </div>`).join('') : `<div class="card muted center">-</div>`)
    : (reqs.length ? reqs.map(r => `<div class="app-item"><div class="top"><div><b>${t('u_' + r.field)}</b> → ${r.field === 'photo' ? `<a href="${esc(r.value)}" target="_blank">📷</a>` : `<b>${esc(r.value)}</b>`}<div class="muted small">${r.id} • ${r.passCode} • ${esc(r.reason)}</div>${r.proof ? `<a class="small" href="${esc(r.proof)}" target="_blank">📎 Proof</a>` : ''}</div><span class="chip ${r.status}">${t('st_' + r.status)}</span></div>
        ${r.status === 'PENDING' ? `<div class="app-actions" style="margin-top:10px"><button class="btn btn-sm btn-red" data-ur="${r.id}|0">${t('reject')}</button><button class="btn btn-sm btn-green" data-ur="${r.id}|1">${t('approve')}</button></div>` : ''}</div>`).join('') : `<div class="card muted center">-</div>`)}`;
  bindCommon();
  $$('[data-tab]').forEach(b => b.onclick = () => viewDepot(b.dataset.tab));
  $$('[data-issue]').forEach(b => b.onclick = async () => {
    try { const p = await api('/api/depot/issue/' + b.dataset.issue, { method: 'POST' }); toast(t('passIssued', { c: p.code })); printPassCard(p); viewDepot('apps'); } catch (e) { toast(e.message, true); }
  });
  $$('[data-rej]').forEach(b => b.onclick = async () => {
    const reason = prompt(t('rejectReason'), 'Documents not matching'); if (reason === null) return;
    try { await api('/api/depot/reject/' + b.dataset.rej, { method: 'POST', body: { reason } }); viewDepot('apps'); } catch (e) { toast(e.message, true); }
  });
  $$('[data-card]').forEach(b => b.onclick = async () => printPassCard(await api('/api/pass/' + b.dataset.card)));
  $$('[data-ur]').forEach(b => b.onclick = async () => {
    const [id, ok] = b.dataset.ur.split('|');
    try { await api('/api/depot/update-requests/' + id, { method: 'POST', body: { approve: ok === '1' } }); viewDepot('upd'); } catch (e) { toast(e.message, true); }
  });
}
// Physical pass card (print at counter)
function printPassCard(p) {
  const st = c => (S.meta.stations.find(s => s.code === c) || {}).name || c;
  printWindow('Pass ' + p.code, `<div style="width:340px;margin:auto;border-radius:16px;overflow:hidden;border:2px solid #0f5d6e;font-family:Arial">
    <div style="background:#0f5d6e;color:#fff;padding:10px 14px;font-weight:bold;display:flex;justify-content:space-between"><span>★ e-BusPass Transit</span><span>${I18N.en[p.category].split('–')[0]}</span></div>
    <div style="padding:14px;display:flex;gap:12px"><img src="${p.photo || '/img/avatar.svg'}" style="width:80px;height:96px;object-fit:cover;border:1px solid #333">
    <div style="font-size:13px;line-height:1.6"><b style="font-size:16px">${esc(p.name)}</b><br>${st(p.from)} ⇄ ${st(p.to)}<br>Valid: ${fmtDate(p.validFrom)} – ${fmtDate(p.validTill)}<br>${esc(p.institution || '')}</div></div>
    <div style="background:#eef6f8;text-align:center;padding:10px"><small style="letter-spacing:2px">PASS CODE</small><div style="font-size:30px;font-weight:bold;letter-spacing:4px">${p.code}</div><small>Tell this code to the conductor • Renew online</small></div></div>`);
}

// ============================================================
//  ROUTER
// ============================================================
const VIEWS = {
  login: () => viewLogin(), home: viewHome, new: viewNew, sub: viewSub, form: viewForm, pay: viewPay, success: viewSuccess,
  apps: viewApps, pass: viewPass, renew: viewRenew, update: viewUpdate, nearby: () => viewNearby(), fares: viewFares,
  help: viewHelp, notifications: viewNotifications, conductor: viewConductor, depot: viewDepot,
};
const ROLE_PAGES = { conductor: ['conductor', 'notifications'], depot: ['depot', 'notifications'] };

async function render() {
  S.cleanups.forEach(f => f()); S.cleanups = []; closeModal();
  document.documentElement.lang = S.lang === 'tg' ? 'te' : S.lang;
  const [, name = '', arg] = location.hash.split('/');
  try {
    if (!S.meta) S.meta = await api('/api/meta');
    if (!S.token) { if (name !== 'login') return go('#/login'); return viewLogin(); }
    if (!S.user) { const me = await api('/api/me'); S.user = me.user; S.unread = me.unread; }
    if (!S.user) return;
    let view = name;
    if (!VIEWS[view] || view === 'login') view = S.user.role === 'passenger' ? 'home' : S.user.role;
    if (ROLE_PAGES[S.user.role] && !ROLE_PAGES[S.user.role].includes(view)) view = S.user.role;
    if (S.user.role === 'passenger' && ['conductor', 'depot'].includes(view)) view = 'home';
    window.scrollTo(0, 0);
    await VIEWS[view](arg ? decodeURIComponent(arg) : undefined);
  } catch (e) {
    app.innerHTML = `${topbar()}<div class="card center"><h3>⚠ ${t('err')}</h3><p class="muted">${esc(e.message)}</p><br><button class="btn btn-primary" onclick="location.reload()">Retry</button></div>`;
    bindCommon();
  }
}
window.addEventListener('hashchange', render);
setInterval(() => { if (S.token && S.user && !document.hidden) refreshUnread(true); }, 20000);
render().then(() => { if (S.token) refreshUnread(false); });
