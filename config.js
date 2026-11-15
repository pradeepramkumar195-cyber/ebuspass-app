// ============================================================
//  e-BusPass  –  Settings (stations, fares, form fields)
//  Change prices / stations here. No other file needs changes.
//  NOTE: All fares are SAMPLE values for the project demo.
// ============================================================

// Bus stands (code is used in the pass code, e.g. GDV_0001)
const STATIONS = [
  { code: 'GDV', name: 'Gudivada',          te: 'గుడివాడ',          hi: 'गुडिवाडा',        lat: 16.4350, lng: 80.9930 },
  { code: 'GDL', name: 'Gudlavalleru',      te: 'గుడ్లవల్లేరు',      hi: 'गुड्लवल्लेरु',     lat: 16.3480, lng: 81.0510 },
  { code: 'MTM', name: 'Machilipatnam',     te: 'మచిలీపట్నం',       hi: 'मछलीपट्टनम',      lat: 16.1875, lng: 81.1389 },
  { code: 'VJA', name: 'Vijayawada (PNBS)', te: 'విజయవాడ (PNBS)',   hi: 'विजयवाड़ा (PNBS)', lat: 16.5090, lng: 80.6170 },
  { code: 'PMR', name: 'Pamarru',           te: 'పామర్రు',           hi: 'पामर्रु',          lat: 16.3270, lng: 80.9610 },
  { code: 'HNJ', name: 'Hanuman Junction',  te: 'హనుమాన్ జంక్షన్',  hi: 'हनुमान जंक्शन',    lat: 16.6310, lng: 80.9720 },
  { code: 'ELR', name: 'Eluru',             te: 'ఏలూరు',            hi: 'एलुरु',           lat: 16.7107, lng: 81.0952 },
  { code: 'KKL', name: 'Kaikaluru',         te: 'కైకలూరు',          hi: 'कैकलूरु',          lat: 16.5530, lng: 81.2140 },
  { code: 'NZD', name: 'Nuzvid',            te: 'నూజివీడు',          hi: 'नूज़िवीडु',         lat: 16.7880, lng: 80.8460 },
  { code: 'AVN', name: 'Avanigadda',        te: 'అవనిగడ్డ',          hi: 'अवनिगड्डा',        lat: 16.0210, lng: 80.9180 },
];

// Discount (%) for each category  — SAMPLE values
const CATEGORIES = {
  student_below_ssc:  { discount: 100, group: 'student'  },  // free (only card fee)
  student_above_ssc:  { discount: 66,  group: 'student'  },
  govt_employee:      { discount: 20,  group: 'employee' },
  corporate_employee: { discount: 0,   group: 'employee' },
  pwd:                { discount: 100, group: 'pwd'      },  // free (only card fee)
  ngo:                { discount: 50,  group: 'ngo'      },
  journalist:         { discount: 50,  group: 'journalist' },
};

// Pass duration → price multiplier (longer pass = small saving)
const DURATIONS = {
  1: { months: 1, factor: 1 },
  3: { months: 3, factor: 2.8 },
  6: { months: 6, factor: 5.4 },
};

const RATE_PER_KM_PER_MONTH = 45;   // normal monthly fare = km x 45
const MIN_MONTHLY_FARE      = 300;  // minimum normal fare per month
const CARD_FEE              = 30;   // pass card / processing fee
const TRIPS_PER_DAY         = 4;    // how many rides allowed per day
const COUNTER_TIMINGS       = '8:00 AM – 6:00 PM';

// Extra fields for each category (common fields like name, photo are in the frontend)
// type: text | number | select | file | yesno
const CATEGORY_FIELDS = {
  student_below_ssc: [
    { key: 'schoolName',  type: 'text',   req: true },
    { key: 'studentClass', type: 'select', req: true, options: ['1','2','3','4','5','6','7','8','9','10'] },
    { key: 'schoolIdNo',  type: 'text',   req: true },
    { key: 'bonafide',    type: 'file',   req: true },
  ],
  student_above_ssc: [
    { key: 'collegeName', type: 'text',   req: true },
    { key: 'course',      type: 'select', req: true, options: ['Intermediate','Diploma / Polytechnic','ITI','Degree','B.Tech / B.E','PG / M.Tech','Other'] },
    { key: 'studyYear',   type: 'select', req: true, options: ['1','2','3','4','5'] },
    { key: 'rollNo',      type: 'text',   req: true },
    { key: 'bonafide',    type: 'file',   req: true },
  ],
  govt_employee: [
    { key: 'department',  type: 'text', req: true },
    { key: 'designation', type: 'text', req: true },
    { key: 'employeeId',  type: 'text', req: true },
    { key: 'officeAddress', type: 'text', req: true },
    { key: 'idCard',      type: 'file', req: true },
  ],
  corporate_employee: [
    { key: 'companyName', type: 'text', req: true },
    { key: 'designation', type: 'text', req: true },
    { key: 'employeeId',  type: 'text', req: true },
    { key: 'officeAddress', type: 'text', req: true },
    { key: 'idCard',      type: 'file', req: true },
  ],
  pwd: [
    { key: 'disabilityType', type: 'select', req: true, options: ['Locomotor (walking)','Visual (eyes)','Hearing / Speech','Intellectual','Multiple','Other'] },
    { key: 'disabilityPercent', type: 'number', req: true, min: 40, max: 100 },
    { key: 'sadaremNo',   type: 'text', req: true },
    { key: 'needEscort',  type: 'yesno', req: true },
    { key: 'disabilityCert', type: 'file', req: true },
  ],
  ngo: [
    { key: 'ngoName',     type: 'text', req: true },
    { key: 'ngoRegNo',    type: 'text', req: true },
    { key: 'ngoRole',     type: 'text', req: true },
    { key: 'ngoCert',     type: 'file', req: true },
  ],
  journalist: [
    { key: 'mediaName',   type: 'text', req: true },
    { key: 'accreditationNo', type: 'text', req: true },
    { key: 'pressCard',   type: 'file', req: true },
  ],
};

// ------------------------------------------------------------
function station(code) { return STATIONS.find(s => s.code === code); }

// Road distance ≈ straight distance x 1.3
function distanceKm(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.asin(Math.sqrt(h));
  return Math.max(3, Math.round(straight * 1.3));
}

const round10 = n => Math.round(n / 10) * 10;

// Returns full price breakdown, or { error }
function quote({ category, from, to, duration }) {
  const cat = CATEGORIES[category];
  const a = station(from), b = station(to);
  const d = DURATIONS[duration];
  if (!cat) return { error: 'Choose a category' };
  if (!a || !b) return { error: 'Choose From and To bus stands' };
  if (a.code === b.code) return { error: 'From and To cannot be same' };
  if (!d) return { error: 'Choose pass duration' };

  const km = distanceKm(a, b);
  const monthly = Math.max(MIN_MONTHLY_FARE, km * RATE_PER_KM_PER_MONTH);
  const normalFare = round10(monthly * d.factor);
  const discount = Math.round(normalFare * cat.discount / 100);
  const total = Math.max(CARD_FEE, round10(normalFare - discount + CARD_FEE));
  return { km, months: d.months, normalFare, discountPct: cat.discount, discount, cardFee: CARD_FEE, total };
}

module.exports = {
  STATIONS, CATEGORIES, DURATIONS, CATEGORY_FIELDS, CARD_FEE, TRIPS_PER_DAY, COUNTER_TIMINGS,
  RATE_PER_KM_PER_MONTH, MIN_MONTHLY_FARE, station, distanceKm, quote,
};
