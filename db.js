// ============================================================
//  e-BusPass database adapter
//  1) Uses MySQL (XAMPP) if it is running  -> tables are created automatically
//  2) If MySQL is not running, it falls back to a local JSON file (data/db.json)
//     so the app ALWAYS starts with zero setup.
//  Force JSON mode:  set DB_MODE=json
// ============================================================
const fs = require('fs');
const path = require('path');
let mysql = null;
try { mysql = require('mysql2/promise'); } catch { /* mysql2 not installed -> JSON mode */ }

const EMPTY = {
  users: [], sessions: [], applications: [], passes: [], payments: [],
  notifications: [], updateRequests: [], trips: [], counters: {},
};

const DB_NAME = process.env.DB_NAME || 'ebuspass';
const CFG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const JSON_FILE = path.join(__dirname, 'data', 'db.json');
let pool = null;
let mode = 'mysql';

// Creates the database + all tables from database/ebuspass.sql (no phpMyAdmin import needed)
async function ensureSchema() {
  const conn = await mysql.createConnection({ ...CFG, multipleStatements: true, connectTimeout: 4000 });
  try {
    const sqlFile = [path.join(__dirname, 'database', 'ebuspass.sql'), path.join(__dirname, 'ebuspass.sql')].find(f => fs.existsSync(f));
    const sql = fs.readFileSync(sqlFile, 'utf8')
      .replace(/^\s*(CREATE DATABASE|USE)\b.*$/gmi, '');
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci; USE \`${DB_NAME}\`;` + sql);
  } finally { await conn.end(); }
}

let data = null;
let saveQueue = Promise.resolve();

function parseJson(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}
function dateValue(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString();
  return String(value).replace(' ', 'T');
}
function sqlDateTime(value) {
  if (!value) return null;
  const s = String(value).replace('T', ' ');
  return s.length >= 19 ? s.slice(0, 19) : s;
}

async function loadMysql() {
  const next = structuredClone(EMPTY);
  const [users] = await pool.query('SELECT * FROM users');
  next.users = users.map(r => ({
    id: r.id, name: r.name, email: r.email, mobile: r.mobile, role: r.role,
    provider: r.provider, depot: r.depot, salt: r.salt, hash: r.password_hash,
    createdAt: dateValue(r.created_at),
  }));

  const [sessions] = await pool.query('SELECT * FROM sessions');
  next.sessions = sessions.map(r => ({ token: r.token, userId: r.user_id, createdAt: dateValue(r.created_at) }));

  const [applications] = await pool.query('SELECT * FROM applications');
  next.applications = applications.map(r => ({
    id: r.id, userId: r.user_id, type: r.type, passCode: r.pass_code,
    category: r.category, personal: parseJson(r.personal), details: parseJson(r.details),
    route: parseJson(r.route), files: parseJson(r.files), fare: parseJson(r.fare),
    amount: Number(r.amount || 0), status: r.status, rejectReason: r.reject_reason,
    createdAt: dateValue(r.created_at), paidAt: dateValue(r.paid_at), issuedAt: dateValue(r.issued_at),
  }));

  const [passes] = await pool.query('SELECT * FROM passes');
  next.passes = passes.map(r => ({
    code: r.code, applicationId: r.application_id, userId: r.user_id, name: r.name,
    mobile: r.mobile, category: r.category, from: r.from_station, to: r.to_station,
    km: Number(r.km || 0), depot: r.depot, validFrom: r.valid_from, validTill: r.valid_till,
    issuedAt: dateValue(r.issued_at), issuedBy: r.issued_by, institution: r.institution,
    escort: !!r.escort, blocked: !!r.blocked, renewals: Number(r.renewals || 0),
  }));

  const [payments] = await pool.query('SELECT * FROM payments');
  next.payments = payments.map(r => ({
    receiptNo: r.receipt_no, applicationId: r.application_id, userId: r.user_id,
    amount: Number(r.amount || 0), method: r.method, txnId: r.transaction_id,
    paidAt: dateValue(r.paid_at),
  }));

  const [notifications] = await pool.query('SELECT * FROM notifications');
  next.notifications = notifications.map(r => ({
    id: r.id, userId: r.user_id, mobile: r.mobile, title: r.title, text: r.message,
    read: !!r.is_read, createdAt: dateValue(r.created_at), appId: r.app_id,
  }));

  const [updates] = await pool.query('SELECT * FROM update_requests');
  next.updateRequests = updates.map(r => ({
    id: r.id, userId: r.user_id, passCode: r.pass_code, field: r.field,
    value: r.value, reason: r.reason, proof: r.proof, status: r.status,
    createdAt: dateValue(r.created_at),
  }));

  const [trips] = await pool.query('SELECT * FROM trips');
  next.trips = trips.map(r => ({
    id: r.id, passCode: r.pass_code, date: r.trip_date, at: dateValue(r.trip_time),
    busNo: r.bus_no, conductor: r.conductor, boarding: r.boarding,
  }));

  const [counters] = await pool.query('SELECT * FROM counters');
  for (const r of counters) next.counters[r.name] = Number(r.counter_value || 0);

  data = next;
  return data;
}

async function writeSnapshot(snapshot) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // These tables intentionally have no foreign-key constraints because this adapter
    // replaces a complete in-memory snapshot on each API write.
    for (const table of ['sessions','applications','passes','payments','notifications','update_requests','trips','counters','users']) {
      await conn.query(`DELETE FROM \`${table}\``);
    }

    for (const u of snapshot.users) await conn.execute(
      `INSERT INTO users (id,name,email,mobile,role,provider,depot,salt,password_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [u.id,u.name || null,u.email || null,u.mobile || null,u.role || null,u.provider || null,u.depot || null,u.salt || null,u.hash || null,sqlDateTime(u.createdAt)]);
    for (const s of snapshot.sessions) await conn.execute(
      `INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)`, [s.token,s.userId,sqlDateTime(s.createdAt)]);
    for (const a of snapshot.applications) await conn.execute(
      `INSERT INTO applications (id,user_id,type,pass_code,category,personal,details,route,files,fare,amount,status,reject_reason,created_at,paid_at,issued_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [a.id,a.userId,a.type || null,a.passCode || null,a.category || null,JSON.stringify(a.personal || {}),JSON.stringify(a.details || {}),JSON.stringify(a.route || {}),JSON.stringify(a.files || {}),JSON.stringify(a.fare || {}),Number(a.amount || 0),a.status || null,a.rejectReason || null,sqlDateTime(a.createdAt),sqlDateTime(a.paidAt),sqlDateTime(a.issuedAt)]);
    for (const p of snapshot.passes) await conn.execute(
      `INSERT INTO passes (code,application_id,user_id,name,mobile,category,from_station,to_station,km,depot,valid_from,valid_till,issued_at,issued_by,institution,escort,blocked,renewals) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.code,p.applicationId,p.userId,p.name || null,p.mobile || null,p.category || null,p.from || null,p.to || null,Number(p.km || 0),p.depot || null,p.validFrom || null,p.validTill || null,sqlDateTime(p.issuedAt),p.issuedBy || null,p.institution || null,!!p.escort,!!p.blocked,Number(p.renewals || 0)]);
    for (const p of snapshot.payments) await conn.execute(
      `INSERT INTO payments (receipt_no,application_id,user_id,amount,method,transaction_id,paid_at) VALUES (?,?,?,?,?,?,?)`,
      [p.receiptNo,p.applicationId,p.userId,Number(p.amount || 0),p.method || null,p.txnId || null,sqlDateTime(p.paidAt)]);
    for (const n of snapshot.notifications) await conn.execute(
      `INSERT INTO notifications (id,user_id,mobile,title,message,is_read,created_at,app_id) VALUES (?,?,?,?,?,?,?,?)`,
      [n.id,n.userId,n.mobile || null,n.title || null,n.text || null,!!n.read,sqlDateTime(n.createdAt),n.appId || null]);
    for (const r of snapshot.updateRequests) await conn.execute(
      `INSERT INTO update_requests (id,user_id,pass_code,field,value,reason,proof,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [r.id,r.userId,r.passCode,r.field,r.value || null,r.reason || null,r.proof || null,r.status || null,sqlDateTime(r.createdAt)]);
    for (const t of snapshot.trips) await conn.execute(
      `INSERT INTO trips (id,pass_code,trip_date,trip_time,bus_no,conductor,boarding) VALUES (?,?,?,?,?,?,?)`,
      [t.id,t.passCode,t.date || null,sqlDateTime(t.at),t.busNo || null,t.conductor || null,t.boarding || null]);
    for (const [name, value] of Object.entries(snapshot.counters)) await conn.execute(
      `INSERT INTO counters (name,counter_value) VALUES (?,?)`, [name,Number(value || 0)]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function load() {
  if (process.env.DB_MODE !== 'json' && mysql) {
    try {
      await ensureSchema();
      pool = mysql.createPool({ ...CFG, database: DB_NAME, waitForConnections: true, connectionLimit: 10, queueLimit: 0, dateStrings: true });
      mode = 'mysql';
      return await loadMysql();
    } catch (err) {
      console.warn(`\n⚠  MySQL not available (${err.code || err.message}).`);
      console.warn('   Using local file database (data/db.json) instead. Start XAMPP MySQL and restart to use MySQL.\n');
      if (pool) { try { await pool.end(); } catch {} pool = null; }
    }
  }
  mode = 'json';
  fs.mkdirSync(path.dirname(JSON_FILE), { recursive: true });
  data = fs.existsSync(JSON_FILE)
    ? { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')) }
    : structuredClone(EMPTY);
  return data;
}

function save() {
  if (!data) return Promise.reject(new Error('Database has not been loaded'));
  if (mode === 'json') {
    const tmp = JSON_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, JSON_FILE);
    return Promise.resolve();
  }
  const snapshot = structuredClone(data);
  saveQueue = saveQueue.then(() => writeSnapshot(snapshot));
  return saveQueue;
}

function nextId(name, prefix = '', pad = 4) {
  data.counters[name] = (data.counters[name] || 0) + 1;
  return prefix + String(data.counters[name]).padStart(pad, '0');
}

async function close() { if (pool) await pool.end(); }
module.exports = {
  load, save, nextId, close,
  get data() { return data; },
  get mode() { return mode; },
  get info() { return mode === 'mysql' ? `MySQL → ${DB_NAME} on ${CFG.host}:${CFG.port}` : 'Local file → data/db.json (MySQL not running)'; },
};
