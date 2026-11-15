// ============================================================
//  e-BusPass  –  Backend server (no npm install needed)
//  Run:  node server.js     then open  http://localhost:3000
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const C = require('./config');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const D = () => db.data;

// ---------------- helpers ----------------
const DAY = 24 * 60 * 60 * 1000;
const now = () => new Date().toISOString();
const uid = () => crypto.randomBytes(8).toString('hex');
const todayStr = (d = new Date()) => {
  const z = new Date(d.getTime() + 5.5 * 60 * 60 * 1000); // India time
  return z.toISOString().slice(0, 10);
};
const addDays = (dateStr, n) => new Date(Date.parse(dateStr + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
function checkPassword(pw, user) {
  const { hash } = hashPassword(pw, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role, provider: u.provider, depot: u.depot };
}
class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new ApiError(status, msg); };

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new ApiError(413, 'Files are too big. Use smaller photos.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new ApiError(400, 'Bad request data')); }
    });
    req.on('error', reject);
  });
}

function currentUser(req, roles) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const s = D().sessions.find(x => x.token === token);
  const u = s && D().users.find(x => x.id === s.userId);
  if (!u) fail(401, 'Please login again');
  if (roles && !roles.includes(u.role)) fail(403, 'You are not allowed to do this');
  return u;
}

function newSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  D().sessions.push({ token, userId: user.id, createdAt: now() });
  return { token, user: publicUser(user) };
}

// Save an uploaded file (sent as data URL). Returns public path.
function saveFile(file, label) {
  if (!file || !file.data) return null;
  const m = /^data:(image\/jpeg|image\/png|image\/webp|application\/pdf);base64,(.+)$/.exec(file.data);
  if (!m) fail(400, `${label}: only JPG, PNG or PDF allowed`);
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) fail(400, `${label}: file must be below 3 MB`);
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[m[1]];
  const name = `${uid()}${uid()}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return '/uploads/' + name;
}

// -------- SMS / notifications --------
// To send REAL SMS later: put Fast2SMS / Twilio / MSG91 API call inside sendSMS().
function sendSMS(mobile, text) {
  console.log(`📱 SMS → +91 ${mobile}: ${text}`);
}
function notify(user, title, text, extra = {}) {
  const n = { id: uid(), userId: user.id, mobile: user.mobile, title, text, read: false, createdAt: now(), ...extra };
  D().notifications.unshift(n);
  sendSMS(user.mobile, text);
}

// -------- pass helpers --------
function passStatus(p) {
  if (!p) return null;
  const t = todayStr();
  if (p.blocked) return 'BLOCKED';
  if (t < p.validFrom) return 'NOT_STARTED';
  if (t > p.validTill) return 'EXPIRED';
  return 'ACTIVE';
}
function passView(p) {
  const app = D().applications.find(a => a.id === p.applicationId) || {};
  const trips = D().trips.filter(t => t.passCode === p.code).sort((a, b) => b.at.localeCompare(a.at));
  const today = todayStr();
  return {
    ...p, status: passStatus(p), daysLeft: Math.max(0, Math.round((new Date(p.validTill) - new Date(today)) / DAY) + 1),
    tripsToday: trips.filter(t => t.date === today).length, tripsPerDay: C.TRIPS_PER_DAY,
    trips: trips.slice(0, 30), photo: app.files && app.files.photo,
  };
}

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Check form + compute fare (used by new + renew)
function validateApplication(body) {
  const p = body.personal || {}, r = body.route || {}, det = body.details || {};
  const cat = body.category;
  if (!C.CATEGORIES[cat]) fail(400, 'Choose a category');
  const need = { fullName: 'Full name', guardianName: 'Father / Guardian name', dob: 'Date of birth', gender: 'Gender', mobile: 'Mobile number', aadhaar: 'Aadhaar number', address: 'Address' };
  for (const [k, label] of Object.entries(need)) if (!String(p[k] || '').trim()) fail(400, `${label} is required`);
  if (!MOBILE_RE.test(p.mobile)) fail(400, 'Mobile number must be 10 digits');
  if (!/^\d{12}$/.test(String(p.aadhaar).replace(/\s/g, ''))) fail(400, 'Aadhaar must be 12 digits');
  if (p.email && !EMAIL_RE.test(p.email)) fail(400, 'Email is not correct');
  if (!C.station(r.collectAt)) fail(400, 'Choose bus stand to collect pass');
  for (const f of C.CATEGORY_FIELDS[cat]) {
    if (f.type === 'file') { if (f.req && !(body.files && body.files[f.key])) fail(400, `Please upload: ${f.key}`); continue; }
    if (f.req && !String(det[f.key] ?? '').trim()) fail(400, `Please fill: ${f.key}`);
    if (f.type === 'number' && f.min && Number(det[f.key]) < f.min) fail(400, `${f.key} must be at least ${f.min}`);
  }
  if (!(body.files && body.files.photo)) fail(400, 'Please upload your photo');
  const q = C.quote({ category: cat, from: r.from, to: r.to, duration: r.duration });
  if (q.error) fail(400, q.error);
  return q;
}

// ---------------- routes ----------------
const routes = [];
const on = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });

// ---- meta / public ----
on('GET', '/api/meta', () => ({
  stations: C.STATIONS, categories: C.CATEGORIES, durations: C.DURATIONS, fields: C.CATEGORY_FIELDS,
  cardFee: C.CARD_FEE, tripsPerDay: C.TRIPS_PER_DAY, counterTimings: C.COUNTER_TIMINGS,
  ratePerKm: C.RATE_PER_KM_PER_MONTH, minFare: C.MIN_MONTHLY_FARE,
}));
on('POST', '/api/quote', ({ body }) => {
  const q = C.quote(body);
  if (q.error) fail(400, q.error);
  return q;
});

// ---- auth ----
on('POST', '/api/auth/signup', ({ body }) => {
  const email = String(body.email || '').trim().toLowerCase();
  const mobile = String(body.mobile || '').trim();
  if (!MOBILE_RE.test(mobile)) fail(400, 'Mobile number must be 10 digits');
  if (!EMAIL_RE.test(email)) fail(400, 'Email ID is not correct');
  if (String(body.password || '').length < 6) fail(400, 'Password must have at least 6 letters');
  if (D().users.some(u => u.email === email)) fail(409, 'This email already has an account. Please Sign In.');
  const user = { id: uid(), name: body.name || email.split('@')[0], email, mobile, role: 'passenger', provider: 'email', ...hashPassword(body.password), createdAt: now() };
  D().users.push(user);
  notify(user, 'Welcome', `Welcome to e-BusPass! Your account is ready. You can now apply for a bus pass from home.`);
  return newSession(user);
});

on('POST', '/api/auth/login', ({ body }) => {
  const email = String(body.email || '').trim().toLowerCase();
  const user = D().users.find(u => u.email === email);
  if (!user || !checkPassword(String(body.password || ''), user)) fail(401, 'Wrong Email ID or Password');
  return newSession(user);
});

// "Continue with Google" — demo version: user gives Gmail + creates a password.
// For real Google login, see README (Google Identity Services).
on('POST', '/api/auth/google', ({ body }) => {
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@gmail\.com$/.test(email)) fail(400, 'Please enter a Gmail ID (ends with @gmail.com)');
  let user = D().users.find(u => u.email === email);
  if (user) {
    if (!checkPassword(String(body.password || ''), user)) fail(401, 'This Gmail is already registered. Enter the same password.');
    return newSession(user);
  }
  if (String(body.password || '').length < 6) fail(400, 'Create a password with at least 6 letters');
  if (!MOBILE_RE.test(String(body.mobile || ''))) fail(400, 'Mobile number must be 10 digits (for SMS)');
  user = { id: uid(), name: body.name || email.split('@')[0], email, mobile: body.mobile, role: 'passenger', provider: 'google', ...hashPassword(body.password), createdAt: now() };
  D().users.push(user);
  notify(user, 'Welcome', `Welcome to e-BusPass! Your Google account is linked.`);
  return newSession(user);
});

on('POST', '/api/auth/logout', ({ req }) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  D().sessions = D().sessions.filter(s => s.token !== token);
  return { ok: true };
});

on('GET', '/api/me', ({ req }) => {
  const u = currentUser(req);
  return { user: publicUser(u), unread: D().notifications.filter(n => n.userId === u.id && !n.read).length };
});

// ---- applications ----
on('POST', '/api/applications', ({ req, body }) => {
  const u = currentUser(req, ['passenger']);
  const q = validateApplication(body);
  const files = {};
  files.photo = saveFile(body.files.photo, 'Photo');
  for (const f of C.CATEGORY_FIELDS[body.category]) if (f.type === 'file' && body.files[f.key]) files[f.key] = saveFile(body.files[f.key], f.key);
  const personal = { ...body.personal };
  const a12 = String(personal.aadhaar).replace(/\s/g, '');
  personal.aadhaar = 'XXXX XXXX ' + a12.slice(-4);   // never store full Aadhaar
  const app = {
    id: db.nextId('app', 'APP' + new Date().getFullYear() + '-', 5), userId: u.id, type: 'new',
    category: body.category, personal, details: body.details || {}, route: { ...body.route, km: q.km },
    files, fare: q, amount: q.total, status: 'PENDING_PAYMENT', createdAt: now(),
  };
  D().applications.unshift(app);
  return app;
});

on('GET', '/api/applications', ({ req }) => {
  const u = currentUser(req);
  return D().applications.filter(a => a.userId === u.id);
});

on('GET', '/api/applications/:id', ({ req, params }) => {
  const u = currentUser(req);
  const a = D().applications.find(x => x.id === params.id);
  if (!a || (a.userId !== u.id && u.role !== 'depot')) fail(404, 'Application not found');
  const pay = D().payments.find(p => p.applicationId === a.id);
  return { ...a, payment: pay || null };
});

// ---- payment (demo gateway) ----
// For real payments: connect Razorpay / PhonePe here (see README).
on('POST', '/api/payments/:id', ({ req, params, body }) => {
  const u = currentUser(req, ['passenger']);
  const a = D().applications.find(x => x.id === params.id && x.userId === u.id);
  if (!a) fail(404, 'Application not found');
  if (a.status !== 'PENDING_PAYMENT') fail(400, 'Already paid');
  const method = ['UPI', 'CARD', 'NETBANKING'].includes(body.method) ? body.method : 'UPI';
  const pay = {
    receiptNo: db.nextId('rcpt', 'RCPT-', 6), applicationId: a.id, userId: u.id, amount: a.amount,
    method, txnId: 'TXN' + Date.now().toString().slice(-9) + crypto.randomInt(100, 999), paidAt: now(),
  };
  D().payments.push(pay);
  a.paidAt = pay.paidAt;
  const stand = C.station(a.route.collectAt).name;
  const mobile = a.personal.mobile;

  if (a.type === 'renewal') {
    // Renewal: same pass card, validity is extended. No need to visit bus stand.
    const p = D().passes.find(x => x.code === a.passCode);
    const start = passStatus(p) === 'EXPIRED' ? todayStr() : addDays(p.validTill, 1);
    p.validFrom = passStatus(p) === 'EXPIRED' ? start : p.validFrom;
    p.validTill = addDays(start, a.fare.months * 30 - 1);
    p.renewals = (p.renewals || 0) + 1;
    a.status = 'ISSUED';
    notify({ ...u, mobile }, 'Pass renewed', `Payment of Rs.${a.amount} received (Receipt ${pay.receiptNo}). Your bus pass ${p.code} is renewed till ${p.validTill}. Use the same pass card.`, { appId: a.id });
  } else {
    a.status = 'PAID';
    notify({ ...u, mobile }, 'Payment received', `Payment of Rs.${a.amount} received for application ${a.id}. Receipt No: ${pay.receiptNo}. Thank you!`, { appId: a.id });
    notify({ ...u, mobile }, 'Collect your pass', `Download your application form and go to ${stand} bus stand counter (${C.COUNTER_TIMINGS}) with original ID proofs. Collect your bus pass there.`, { appId: a.id });
  }
  return { payment: pay, application: a };
});

// ---- passes (passenger) ----
on('GET', '/api/my-passes', ({ req }) => {
  const u = currentUser(req);
  return D().passes.filter(p => p.userId === u.id).map(passView);
});

// Enter code → soft copy (only the owner, conductor or depot staff can see)
on('GET', '/api/pass/:code', ({ req, params }) => {
  const u = currentUser(req);
  const code = params.code.toUpperCase();
  const p = D().passes.find(x => x.code === code);
  if (!p) fail(404, 'No pass found with this code. Check and try again.');
  if (u.role === 'passenger' && p.userId !== u.id) fail(403, 'This pass belongs to another person.');
  return passView(p);
});

// ---- renewal ----
on('POST', '/api/renew', ({ req, body }) => {
  const u = currentUser(req, ['passenger']);
  const p = D().passes.find(x => x.code === String(body.code || '').toUpperCase() && x.userId === u.id);
  if (!p) fail(404, 'Pass not found in your account');
  const old = D().applications.find(a => a.id === p.applicationId);
  const q = C.quote({ category: p.category, from: p.from, to: p.to, duration: body.duration });
  if (q.error) fail(400, q.error);
  const app = {
    id: db.nextId('app', 'APP' + new Date().getFullYear() + '-', 5), userId: u.id, type: 'renewal', passCode: p.code,
    category: p.category, personal: { ...old.personal, mobile: p.mobile }, details: old.details,
    route: { from: p.from, to: p.to, collectAt: p.depot, duration: body.duration, km: q.km },
    files: old.files, fare: { ...q, cardFee: 0, total: q.total - q.cardFee }, amount: q.total - q.cardFee,
    status: 'PENDING_PAYMENT', createdAt: now(),
  };
  D().applications.unshift(app);
  return app;
});

// ---- update details ----
const UPDATABLE = ['mobile', 'email', 'address', 'institution', 'photo'];
on('POST', '/api/update-requests', ({ req, body }) => {
  const u = currentUser(req, ['passenger']);
  const p = D().passes.find(x => x.code === String(body.code || '').toUpperCase() && x.userId === u.id);
  if (!p) fail(404, 'Pass not found in your account');
  if (!UPDATABLE.includes(body.field)) fail(400, 'Choose what you want to change');
  let value = String(body.value || '').trim();
  if (body.field === 'photo') value = saveFile(body.newPhoto, 'New photo');
  if (!value) fail(400, 'Enter the new value');
  if (body.field === 'mobile' && !MOBILE_RE.test(value)) fail(400, 'Mobile number must be 10 digits');
  if (body.field === 'email' && !EMAIL_RE.test(value)) fail(400, 'Email is not correct');
  if (!String(body.reason || '').trim()) fail(400, 'Please tell the reason');
  const r = {
    id: db.nextId('upd', 'UPD-', 5), userId: u.id, passCode: p.code, field: body.field, value,
    reason: body.reason, proof: body.proof ? saveFile(body.proof, 'Proof') : null, status: 'PENDING', createdAt: now(),
  };
  D().updateRequests.unshift(r);
  notify({ ...u, mobile: p.mobile }, 'Update request sent', `Your request ${r.id} to change ${body.field} for pass ${p.code} is received. We will inform you after checking.`);
  return r;
});
on('GET', '/api/update-requests', ({ req }) => {
  const u = currentUser(req);
  return D().updateRequests.filter(r => r.userId === u.id);
});

// ---- notifications ----
on('GET', '/api/notifications', ({ req }) => {
  const u = currentUser(req);
  const list = D().notifications.filter(n => n.userId === u.id);
  return list;
});
on('POST', '/api/notifications/read', ({ req }) => {
  const u = currentUser(req);
  D().notifications.forEach(n => { if (n.userId === u.id) n.read = true; });
  return { ok: true };
});

// ---- DEPOT STAFF (bus stand counter) ----
on('GET', '/api/depot/applications', ({ req }) => {
  currentUser(req, ['depot']);
  return D().applications.filter(a => a.type === 'new' && ['PAID', 'ISSUED', 'REJECTED'].includes(a.status)).slice(0, 100);
});
on('POST', '/api/depot/issue/:id', ({ req, params }) => {
  const staff = currentUser(req, ['depot']);
  const a = D().applications.find(x => x.id === params.id);
  if (!a) fail(404, 'Application not found');
  if (a.status !== 'PAID') fail(400, 'Only paid applications can be issued');
  const depot = a.route.collectAt;
  const code = db.nextId('pass_' + depot, depot + '_', 4);          // e.g. GDV_0001
  const validFrom = todayStr();
  const p = {
    code, applicationId: a.id, userId: a.userId, name: a.personal.fullName, mobile: a.personal.mobile,
    category: a.category, from: a.route.from, to: a.route.to, km: a.route.km, depot,
    validFrom, validTill: addDays(validFrom, a.fare.months * 30 - 1), issuedAt: now(), issuedBy: staff.name,
    institution: a.details.schoolName || a.details.collegeName || a.details.companyName || a.details.department || a.details.ngoName || a.details.mediaName || '',
    escort: a.details.needEscort === 'yes',
  };
  D().passes.push(p);
  a.status = 'ISSUED'; a.passCode = code; a.issuedAt = p.issuedAt;
  const user = D().users.find(x => x.id === a.userId);
  notify({ ...user, mobile: p.mobile }, 'Pass issued', `Your bus pass is issued! Pass code: ${code}. Valid till ${p.validTill}. Enter this code in e-BusPass to see your pass. Tell this code to the conductor while travelling.`, { appId: a.id });
  return p;
});
on('POST', '/api/depot/reject/:id', ({ req, params, body }) => {
  currentUser(req, ['depot']);
  const a = D().applications.find(x => x.id === params.id);
  if (!a || a.status !== 'PAID') fail(400, 'Cannot reject this application');
  a.status = 'REJECTED'; a.rejectReason = body.reason || 'Documents not matching';
  const user = D().users.find(x => x.id === a.userId);
  notify({ ...user, mobile: a.personal.mobile }, 'Application rejected', `Application ${a.id} was rejected: ${a.rejectReason}. Your money will be refunded in 5-7 days.`, { appId: a.id });
  return a;
});
on('GET', '/api/depot/update-requests', ({ req }) => {
  currentUser(req, ['depot']);
  return D().updateRequests.slice(0, 100);
});
on('POST', '/api/depot/update-requests/:id', ({ req, params, body }) => {
  currentUser(req, ['depot']);
  const r = D().updateRequests.find(x => x.id === params.id);
  if (!r || r.status !== 'PENDING') fail(400, 'Request not found');
  const p = D().passes.find(x => x.code === r.passCode);
  const user = D().users.find(x => x.id === r.userId);
  if (body.approve) {
    r.status = 'APPROVED';
    const a = D().applications.find(x => x.id === p.applicationId);
    if (r.field === 'mobile') { p.mobile = r.value; a.personal.mobile = r.value; }
    if (r.field === 'email') a.personal.email = r.value;
    if (r.field === 'address') a.personal.address = r.value;
    if (r.field === 'institution') p.institution = r.value;
    if (r.field === 'photo') a.files.photo = r.value;
    notify({ ...user, mobile: p.mobile }, 'Details updated', `Your ${r.field} change for pass ${p.code} is approved and updated.`);
  } else {
    r.status = 'REJECTED';
    notify({ ...user, mobile: p.mobile }, 'Update rejected', `Your ${r.field} change request for pass ${p.code} was not approved. Please visit the bus stand counter.`);
  }
  return r;
});
on('GET', '/api/depot/stats', ({ req }) => {
  currentUser(req, ['depot']);
  const d = D();
  return {
    waiting: d.applications.filter(a => a.status === 'PAID').length,
    issued: d.passes.length,
    pendingUpdates: d.updateRequests.filter(r => r.status === 'PENDING').length,
    collected: d.payments.reduce((s, p) => s + p.amount, 0),
  };
});

// ---- CONDUCTOR (ticket machine) ----
on('POST', '/api/conductor/punch', ({ req, body }) => {
  const c = currentUser(req, ['conductor']);
  const code = String(body.code || '').toUpperCase().trim();
  const p = D().passes.find(x => x.code === code);
  if (!p) fail(404, 'Invalid pass code');
  const st = passStatus(p);
  if (st !== 'ACTIVE') fail(400, st === 'EXPIRED' ? `Pass expired on ${p.validTill}` : 'Pass is not active');
  const today = todayStr();
  const usedToday = D().trips.filter(t => t.passCode === code && t.date === today).length;
  if (usedToday >= C.TRIPS_PER_DAY) fail(400, `Daily limit reached (${C.TRIPS_PER_DAY} trips)`);
  const trip = { id: uid(), passCode: code, date: today, at: now(), busNo: String(body.busNo || '').toUpperCase(), conductor: c.name, boarding: body.boarding || '' };
  D().trips.push(trip);
  const user = D().users.find(x => x.id === p.userId);
  const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  notify({ ...user, mobile: p.mobile }, 'Trip recorded', `Your pass ${code} was used at ${time} on bus ${trip.busNo || '-'}. Trips today: ${usedToday + 1}/${C.TRIPS_PER_DAY}.`);
  return { trip, pass: passView(p) };
});

// ---------------- demo data ----------------
function seed() {
  const d = D();
  if (d.users.length) return;
  const mk = (name, email, mobile, pw, role, depot) => {
    const u = { id: uid(), name, email, mobile, role, provider: 'email', depot, ...hashPassword(pw), createdAt: now() };
    d.users.push(u); return u;
  };
  const ravi = mk('Ravi Kumar', 'passenger@demo.in', '9876543210', 'demo123', 'passenger');
  mk('Depot Staff (Gudivada)', 'depot@demo.in', '9000000001', 'depot123', 'depot', 'GDV');
  mk('Conductor Srinu', 'conductor@demo.in', '9000000002', 'cond123', 'conductor');

  const q = C.quote({ category: 'student_above_ssc', from: 'GDL', to: 'GDV', duration: 1 });
  const appId = db.nextId('app', 'APP' + new Date().getFullYear() + '-', 5);
  d.applications.push({
    id: appId, userId: ravi.id, type: 'new', category: 'student_above_ssc',
    personal: { fullName: 'Ravi Kumar', guardianName: 'Suresh Kumar', dob: '2005-06-14', gender: 'Male', mobile: '9876543210', email: 'passenger@demo.in', aadhaar: 'XXXX XXXX 4321', address: 'Main Road, Gudlavalleru' },
    details: { collegeName: 'SRGEC, Gudlavalleru', course: 'B.Tech / B.E', studyYear: '3', rollNo: '24481A0000' },
    route: { from: 'GDV', to: 'GDL', collectAt: 'GDV', duration: 1, km: q.km }, files: { photo: '/img/avatar.svg' },
    fare: q, amount: q.total, status: 'ISSUED', createdAt: now(), paidAt: now(), issuedAt: now(), passCode: 'GDV_0001',
  });
  d.payments.push({ receiptNo: db.nextId('rcpt', 'RCPT-', 6), applicationId: appId, userId: ravi.id, amount: q.total, method: 'UPI', txnId: 'TXN000000001', paidAt: now() });
  d.counters['pass_GDV'] = 1;
  const vf = todayStr();
  d.passes.push({ code: 'GDV_0001', applicationId: appId, userId: ravi.id, name: 'Ravi Kumar', mobile: '9876543210', category: 'student_above_ssc', from: 'GDV', to: 'GDL', km: q.km, depot: 'GDV', validFrom: vf, validTill: addDays(vf, 29), issuedAt: now(), issuedBy: 'Depot Staff', institution: 'SRGEC, Gudlavalleru', escort: false });
  d.notifications.unshift({ id: uid(), userId: ravi.id, mobile: '9876543210', title: 'Pass issued', text: 'Your bus pass is issued! Pass code: GDV_0001. Enter this code in e-BusPass to see your pass.', read: false, createdAt: now() });
  console.log('✅ Demo data added');
}

// ---------------- static files ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res, urlPath) {
  let base = PUBLIC_DIR, rel = urlPath;
  if (urlPath.startsWith('/uploads/')) { base = UPLOAD_DIR; rel = urlPath.slice('/uploads'.length); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // Files uploaded without folders (all in one place)? Serve these safe files from the main folder.
      const FLAT_OK = ['index.html', 'style.css', 'app.js', 'i18n.js', 'hero.svg', 'avatar.svg', 'logo.svg'];
      const flatName = path.basename(file);
      if (base === PUBLIC_DIR && FLAT_OK.includes(flatName) && !req._flat) {
        const flatFile = path.join(__dirname, flatName);
        if (fs.existsSync(flatFile)) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(flatFile).toLowerCase()] || 'application/octet-stream' });
          return res.end(fs.readFileSync(flatFile));
        }
      }
      if (base === PUBLIC_DIR && !path.extname(rel)) return serveStatic(req, res, '/'); // SPA fallback
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ---------------- server ----------------
async function start() {
  try {
    await db.load();
    seed();
    await db.save();
    httpServer.listen(PORT, () => {
      console.log(`\n🚌 e-BusPass running →  http://localhost:${PORT}\n`);
      console.log('Demo logins:  passenger@demo.in / demo123   |   depot@demo.in / depot123   |   conductor@demo.in / cond123\n');
      console.log(`🗄️  Database: ${db.info}`);
    });
  } catch (err) {
    console.error('❌ Could not start the database.');
    console.error(err.message);
    process.exit(1);
  }
}
const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, decodeURIComponent(url.pathname));
  try {
    const route = routes.find(r => r.method === req.method && r.re.test(url.pathname));
    if (!route) fail(404, 'API not found');
    const params = url.pathname.match(route.re).groups || {};
    const body = req.method === 'POST' ? await readBody(req) : {};
    const out = await route.handler({ req, body, params, query: url.searchParams });
    await db.save();
    send(res, 200, out);
  } catch (e) {
    if (!(e instanceof ApiError)) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'Server error. Please try again.' });
  }
});
start();
