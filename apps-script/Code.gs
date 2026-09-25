/* ===================================================================
   ENACTUS SPIT — SUBCOM APPLICATION 2026-27
   Google Apps Script backend.

   Every validated submission is appended as exactly one row to a
   PRIVATE CSV file in the script owner's Google Drive. The file is
   never shared, its ID is never returned to the client, and no
   applicant data is ever read back out over HTTP.

   SETUP
     1. Paste this file into a new Apps Script project.
     2. Run setupApplicationCsv() once and authorize Drive access.
     3. Deploy > New deployment > Web app
          Execute as:      Me (the owner)
          Who has access:  Anyone   (required so applicants can POST)
     4. Copy the /exec URL into APPS_SCRIPT_URL in js/script.js.

   The "Anyone" access setting only exposes doPost/doGet below. doGet
   returns a bare liveness string and doPost only ever writes.
=================================================================== */

var FILE_NAME = 'Enactus_SPIT_Subcom_Applications_2026-27.csv';
var APPLICATION_YEAR = '2026–27';   // 2026–27 (en dash)
var CSV_FILE_ID = 'APPLICATIONS_CSV_ID';   // Script Property key holding the Drive file ID

var HEADERS = [
  'Timestamp',
  'Name',
  'Branch',
  'UID',
  'SPIT Email',
  'Mobile Number',
  'Preferred Domains',
  'Why Join Enactus',
  'Social Impact',
  'Creative Portfolio / Work Link',
  'Application Year'
];

var BRANCHES = ['CE', 'CSE', 'EXTC'];

/* The only six domains that may be stored, in canonical display form.
   Incoming values are matched case-insensitively, so "TECH", "tech" and
   "Tech" all normalise to "Tech". Anything else is discarded. */
var DOMAIN_LABELS = ['PR', 'Marketing', 'Creatives', 'Social Media', 'Tech', 'Projects', 'Operations'];

/* ===================================================================
   ONE-TIME SETUP
=================================================================== */
function setupApplicationCsv() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty(CSV_FILE_ID);

  if (existingId) {
    try {
      var current = DriveApp.getFileById(existingId);
      Logger.log('CSV already initialised: "' + current.getName() + '" (kept private).');
      return;
    } catch (err) {
      Logger.log('Stored file ID is unreachable, creating a fresh CSV.');
    }
  }

  var file = DriveApp.createFile(FILE_NAME, buildCsvContent([]), MimeType.CSV);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  props.setProperty(CSV_FILE_ID, file.getId());

  Logger.log('Created private CSV "' + FILE_NAME + '" in your Drive root.');
  Logger.log('Deploy this project as a Web App next. Do not share the CSV.');
}

/* ===================================================================
   WEB APP ENTRY POINTS
=================================================================== */
function doPost(e) {
  try {
    var data = readRequest(e);
    var row = validateAndBuildRow(data);
    appendRowToCsv(row);

    return jsonOut({ success: true, message: 'Application submitted successfully.' });
  } catch (err) {
    return jsonOut({ success: false, message: err.message || 'Something went wrong. Please try again.' });
  }
}

function doGet() {
  return jsonOut({ success: true, message: 'Enactus SPIT Subcom Application API is running.' });
}

/* Accepts any of the three shapes a browser might send:
     1. URL-encoded form fields   -> e.parameter.name, e.parameter.email, ...
     2. A `payload` form field holding a JSON string
     3. A raw JSON request body   -> e.postData.contents
   This keeps the endpoint working regardless of how the frontend posts. */
function readRequest(e) {
  if (!e) throw new Error('No application data was received.');

  // 2. a JSON blob inside a form field
  if (e.parameter && e.parameter.payload) {
    try {
      return JSON.parse(e.parameter.payload);
    } catch (err) {
      throw new Error('Malformed application data.');
    }
  }

  // 1. plain form fields
  if (e.parameter && e.parameter.email) {
    return e.parameter;
  }

  // 3. a raw JSON body
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      throw new Error('Malformed application data.');
    }
  }

  throw new Error('No application data was received.');
}

/* ===================================================================
   VALIDATION — never trust the frontend; re-check everything.
=================================================================== */
function validateAndBuildRow(d) {
  var name = str(d.name).replace(/\s+/g, ' ').trim();
  var branch = str(d.branch).trim().toUpperCase();
  var uid = str(d.uid).trim().toUpperCase();
  var email = str(d.email).trim().toLowerCase();
  var mobile = normalizeMobile(str(d.mobile));
  var domains = normalizeDomains(d.domains);
  var whyJoin = str(d.whyJoin).replace(/[ \t]+/g, ' ').trim();
  var impact = str(d.socialImpact).replace(/[ \t]+/g, ' ').trim();
  var portfolio = str(d.portfolio).trim();

  if (!/^(?=.*[A-Za-z])[A-Za-z][A-Za-z .'-]{1,49}$/.test(name)) {
    throw new Error('Please enter a valid name.');
  }
  if (BRANCHES.indexOf(branch) === -1) {
    throw new Error('Branch must be CE, CSE or EXTC.');
  }
  if (!isPlausibleUid(uid)) {
    throw new Error('Please enter your real SPIT UID.');
  }
  if (!/^[A-Z0-9._%+-]+@spit\.ac\.in$/i.test(email)) {
    throw new Error('Only official SPIT email IDs (@spit.ac.in) are accepted.');
  }
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }
  if (!domains.length) {
    throw new Error('Choose at least one domain.');
  }
  if (!isMeaningfulText(whyJoin, 30)) {
    throw new Error('Tell us a little more about why you want to join.');
  }
  if (!isMeaningfulText(impact, 30)) {
    throw new Error('Tell us a little more about the impact you want to create.');
  }

  /* The portfolio link is only accepted alongside a Creatives choice,
     and is optional even then. */
  /* Compare case-insensitively: `domains` holds canonical display
     labels ("Creatives"), not upper-case ones. */
  var wantsCreatives = domains.join('|').toUpperCase().indexOf('CREATIVES') !== -1;
  if (!wantsCreatives) {
    portfolio = '';
  } else if (portfolio && !isHttpUrl(portfolio)) {
    throw new Error('The portfolio link must be a valid http:// or https:// URL.');
  }

  /* Bound every free-text field so a single row cannot be abused. */
  if (whyJoin.length > 4000 || impact.length > 4000 || portfolio.length > 600) {
    throw new Error('One of your answers is too long.');
  }

  return [
    formatTimestamp(new Date()),
    name,
    branch,
    uid,
    email,
    mobile,
    domains.join(', '),
    whyJoin,
    impact,
    portfolio,
    APPLICATION_YEAR
  ];
}

function normalizeMobile(v) {
  return v.replace(/[\s()\-.]/g, '').replace(/^(\+91|0091|0)/, '').replace(/^91(?=\d{10}$)/, '');
}

/* Accepts either a comma-separated string or an array; keeps only the
   six known labels, de-duplicated and in canonical order. */
function normalizeDomains(input) {
  var parts = [];
  if (Object.prototype.toString.call(input) === '[object Array]') {
    parts = input.map(function (x) { return str(x); });
  } else {
    parts = str(input).split(',');
  }

  var seen = {};
  parts.forEach(function (p) {
    var incoming = p.trim().toUpperCase();
    for (var i = 0; i < DOMAIN_LABELS.length; i++) {
      if (DOMAIN_LABELS[i].toUpperCase() === incoming) {
        seen[DOMAIN_LABELS[i]] = true;   // store the canonical display form
        break;
      }
    }
  });

  return DOMAIN_LABELS.filter(function (label) { return seen[label]; });
}

function isPlausibleUid(v) {
  if (!/^[A-Z0-9/-]{5,20}$/.test(v)) return false;
  var bare = v.replace(/[^A-Z0-9]/g, '');
  if (!/\d/.test(bare)) return false;
  if (/^(.)\1+$/.test(bare)) return false;
  if (/^0+$/.test(bare)) return false;
  return uniqueChars(bare) >= 3;
}

function isMeaningfulText(v, min) {
  if (v.length < min) return false;
  if (!/[A-Za-z]/.test(v)) return false;
  var words = v.split(/\s+/).filter(function (w) { return w.length > 1; });
  if (words.length < 5) return false;
  return uniqueChars(v.toUpperCase().replace(/[^A-Z]/g, '')) >= 8;
}

function isHttpUrl(v) {
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v);
}

function uniqueChars(s) {
  var seen = {};
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    if (!seen[s.charAt(i)]) { seen[s.charAt(i)] = true; n++; }
  }
  return n;
}

function str(v) {
  return (v === null || v === undefined) ? '' : String(v);
}

function formatTimestamp(date) {
  return Utilities.formatDate(date, 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');
}

/* ===================================================================
   CSV WRITING

   The file is a summary report followed by the applicant table, so every
   write is a read-modify-rewrite:

     read existing CSV -> extract applicant records -> append the new one
     -> recalculate statistics -> rebuild the whole file -> setContent

   LockService serialises concurrent submissions, so two writers can never
   interleave and lose a record.
=================================================================== */
function appendRowToCsv(row) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    throw new Error('The server is busy right now. Please submit again in a moment.');
  }

  try {
    var file = getApplicationFile();
    var existing = extractRecords(file.getBlob().getDataAsString('UTF-8'));
    existing.push(row);
    file.setContent(buildCsvContent(existing));
  } finally {
    lock.releaseLock();
  }
}

/* -------------------------------------------------------------------
   READING BACK
------------------------------------------------------------------- */

/* A minimal RFC-4180 reader: handles quoted fields, doubled quotes and
   embedded newlines. Returns an array of string arrays. */
function parseCsv(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);

    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text.charAt(i + 1) === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* Pulls just the applicant records out of a stored file, ignoring the
   summary block. Understands both the current format (records follow an
   "APPLICANT DATA" marker) and the original flat format (a bare header
   row followed by records), so an existing file upgrades in place on the
   next submission without losing anybody. */
function extractRecords(text) {
  if (!text) return [];

  var rows = parseCsv(text);
  var start = -1;

  // current format: the marker row, then the header row, then records
  for (var i = 0; i < rows.length; i++) {
    if (str(rows[i][0]).trim().toUpperCase() === 'APPLICANT DATA') {
      start = i + 1;
      break;
    }
  }

  // legacy format: find the header row directly
  if (start === -1) {
    for (var j = 0; j < rows.length; j++) {
      if (str(rows[j][0]).trim() === 'Timestamp') { start = j; break; }
    }
  }
  if (start === -1) start = 0;

  // skip the header row itself if that is where we landed
  if (rows[start] && str(rows[start][0]).trim() === 'Timestamp') start++;

  var records = [];
  for (var k = start; k < rows.length; k++) {
    var r = rows[k];
    if (!r || r.length < 2) continue;                  // blank line
    if (!str(r[0]).trim() || !str(r[1]).trim()) continue;  // no timestamp/name

    // normalise to exactly the column count, un-doing the injection guard
    var rec = [];
    for (var c2 = 0; c2 < HEADERS.length; c2++) {
      rec.push(stripInjectionGuard(str(r[c2])));
    }
    records.push(rec);
  }
  return records;
}

/* csvEscape prefixes a formula-shaped value with an apostrophe. Remove it
   on read so repeated rewrites cannot accumulate ' ' ' ' in front of a value. */
function stripInjectionGuard(s) {
  if (s.charAt(0) === "'" && /^[=+\-@\t\r]/.test(s.substring(1))) {
    return s.substring(1);
  }
  return s;
}

/* -------------------------------------------------------------------
   STATISTICS — always recalculated from the records themselves
------------------------------------------------------------------- */
function calculateStats(records) {
  var stats = {
    total: records.length,
    branches: {},
    domains: {}
  };

  var b, d;
  for (b = 0; b < BRANCHES.length; b++) stats.branches[BRANCHES[b]] = 0;
  for (d = 0; d < DOMAIN_LABELS.length; d++) stats.domains[DOMAIN_LABELS[d]] = 0;

  for (var i = 0; i < records.length; i++) {
    // one applicant counts once towards their branch
    var branch = str(records[i][2]).trim().toUpperCase();
    if (stats.branches.hasOwnProperty(branch)) stats.branches[branch]++;

    // ...but towards EVERY domain they selected
    var picked = str(records[i][6]).split(',');
    var seen = {};
    for (var p = 0; p < picked.length; p++) {
      var want = picked[p].trim().toUpperCase();
      if (!want || seen[want]) continue;
      seen[want] = true;
      for (var q = 0; q < DOMAIN_LABELS.length; q++) {
        if (DOMAIN_LABELS[q].toUpperCase() === want) {
          stats.domains[DOMAIN_LABELS[q]]++;
          break;
        }
      }
    }
  }
  return stats;
}

/* -------------------------------------------------------------------
   BUILDING THE FILE
------------------------------------------------------------------- */

/* Returns the complete file: summary report, then the applicant table.
   Every line is valid CSV — the summary lines are single-column rows, so
   the file still opens cleanly in Sheets/Excel. */
function buildCsvContent(records) {
  var stats = calculateStats(records);
  var out = '';
  var i;

  out += toCsvRow(['ENACTUS SPIT SUBCOM APPLICATIONS ' + APPLICATION_YEAR]);
  out += BLANK_ROW;
  out += toCsvRow(['TOTAL APPLICANTS: ' + stats.total]);
  out += BLANK_ROW;

  out += toCsvRow(['BRANCH BREAKDOWN']);
  for (i = 0; i < BRANCHES.length; i++) {
    out += toCsvRow([BRANCHES[i] + ': ' + stats.branches[BRANCHES[i]]]);
  }
  out += BLANK_ROW;

  out += toCsvRow(['DOMAIN APPLICATIONS']);
  for (i = 0; i < DOMAIN_LABELS.length; i++) {
    out += toCsvRow([DOMAIN_LABELS[i] + ': ' + stats.domains[DOMAIN_LABELS[i]]]);
  }
  out += BLANK_ROW;

  out += toCsvRow(['APPLICANT DATA']);
  out += toCsvRow(HEADERS);
  for (i = 0; i < records.length; i++) {
    out += toCsvRow(records[i]);
  }

  return out;
}

var BLANK_ROW = '\r\n';

/* -------------------------------------------------------------------
   MAINTENANCE — run manually from the Apps Script editor
------------------------------------------------------------------- */

/* Rewrites the file in the current format without changing any records.
   Safe to run at any time; useful after upgrading this script. */
function rebuildCsvFile() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Busy, try again.');
  try {
    var file = getApplicationFile();
    var records = extractRecords(file.getBlob().getDataAsString('UTF-8'));
    file.setContent(buildCsvContent(records));
    Logger.log('Rebuilt "' + file.getName() + '" with ' + records.length + ' applicant(s).');
  } finally {
    lock.releaseLock();
  }
}

/* DESTRUCTIVE. Deletes every applicant record and leaves an empty,
   correctly formatted file with all counts at 0. Run this once to clear
   test submissions before the form goes live. */
function resetApplications() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Busy, try again.');
  try {
    var file = getApplicationFile();
    var removed = extractRecords(file.getBlob().getDataAsString('UTF-8')).length;
    file.setContent(buildCsvContent([]));
    Logger.log('Cleared ' + removed + ' applicant record(s). The file is now empty.');
  } finally {
    lock.releaseLock();
  }
}

/* Finds the private CSV, or creates it on first use. Self-healing, so a
   forgotten setupApplicationCsv() run can never lose a submission:
     1. the file ID remembered in Script Properties
     2. an existing file in Drive with the expected name
     3. a freshly created, private CSV with just the header row */
function getApplicationFile() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CSV_FILE_ID);

  if (id) {
    try {
      var known = DriveApp.getFileById(id);
      if (!known.isTrashed()) return known;
    } catch (err) {
      // fall through and re-resolve below
    }
  }

  var matches = DriveApp.getFilesByName(FILE_NAME);
  while (matches.hasNext()) {
    var found = matches.next();
    if (!found.isTrashed()) {
      props.setProperty(CSV_FILE_ID, found.getId());
      return found;
    }
  }

  var created = DriveApp.createFile(FILE_NAME, buildCsvContent([]), MimeType.CSV);
  created.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  props.setProperty(CSV_FILE_ID, created.getId());
  return created;
}

/* Builds one CRLF-terminated CSV line. */
function toCsvRow(values) {
  return values.map(csvEscape).join(',') + '\r\n';
}

/* Quotes every field, doubles embedded quotes, and defuses spreadsheet
   formula injection by prefixing a leading =, +, -, @, tab or CR. */
function csvEscape(value) {
  var s = str(value).replace(/\r\n?|\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
