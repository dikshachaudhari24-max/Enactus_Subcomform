# Enactus SPIT — Subcom Application 2026-27

A game-world application experience. Vanilla HTML/CSS/JS, no build step and no
dependencies. Each validated submission is appended as one row to a **private
CSV in the script owner's Google Drive** via Google Apps Script. There is no
database, no public applicant list and no dashboard.

```
Enactus/
  index.html            four screens + the persistent parallax world
  css/style.css         design tokens, pixel components, responsive rules
  js/script.js          Sfx / Fx / Hud / World / Screens / Domains / Validate / Submit
  apps-script/Code.gs   the Web App backend
```

## Run locally

Serve the `Enactus` folder with any static server and open it:

```bash
npx serve Enactus        # or: python -m http.server
```

Opening `index.html` directly over `file://` works for the UI, but submissions
will fail — use a local server.

---

## The endpoint must be a PUBLIC deployment

The live endpoint is configured in one place only — `SCRIPT_URL` at the top of
`js/script.js`.

Apps Script hands out two URL shapes, and only one works from a web page:

| URL shape | Works from the site? |
| --- | --- |
| `script.google.com/macros/s/AKfy.../exec` | ✅ yes — public |
| `script.google.com/a/macros/<domain>/s/AKfy.../exec` | ❌ no — login-walled |

The `/a/macros/<domain>/` form answers *you* (your browser sends your Workspace
session cookie) but returns `401` plus a Google sign-in page to everyone else.
`fetch` omits cookies by default, so the site always gets the 401, the browser
blocks the response for lacking CORS headers, and the form shows
`COULDN'T REACH THE SERVER`. `js/script.js` logs a console warning if it ever
detects that URL shape.

To deploy publicly: **Deploy → New deployment → Web app**, *Execute as* **Me**,
*Who has access* **Anyone** (not "Anyone with a Google account").

### Verifying an endpoint

```bash
curl -s -o /dev/null -w '%{http_code}
' "<your /exec URL>"
```

`200` means public. `302` or `401` means still restricted.

To confirm a real write end to end, POST and then follow the redirect by hand —
Apps Script answers a POST with a 302 to `script.googleusercontent.com`, and the
JSON body lives at that second URL:

```bash
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' -X POST "<url>"   --data-urlencode 'name=Test Applicant' --data-urlencode 'branch=CSE'   --data-urlencode 'uid=TEST123' --data-urlencode 'email=test@spit.ac.in'   --data-urlencode 'mobile=9876543210' --data-urlencode 'domains=PR, Tech'   --data-urlencode 'whyJoin=...' --data-urlencode 'socialImpact=...')
curl -s "$LOC"
# {"success":true,"message":"Application submitted successfully."}
```

Plain `curl -L` does **not** work here: it mangles the method or drops the body
across the redirect and returns a misleading 405/411. That is a curl artifact,
not a fault in the endpoint.

Note that a successful check writes a real row — delete test rows from the CSV
before going live.

Editing `Code.gs` does not update the live Web App. After any backend change:
**Deploy → Manage deployments → ✏️ → Version: New version → Deploy**, or you
will keep hitting the old code.

## Backend setup

1. Open [script.google.com](https://script.google.com) → **New project**.
2. Paste [`apps-script/Code.gs`](apps-script/Code.gs), replacing everything.
3. Run `setupApplicationCsv()` once and authorize Drive access.
4. Check the execution log — it confirms the private CSV was created as
   `Enactus_SPIT_Subcom_Applications_2026-27.csv` in your Drive root.
5. Deploy as a Web App using the settings above.
6. Paste the `/exec` URL into `APPS_SCRIPT_URL` in `js/script.js`.
7. Submit one test application with a real `@spit.ac.in` address and confirm a
   single new row appears in the CSV.

### CSV layout

The file is one master CSV holding a summary report followed by the applicant
table. Every line is valid CSV — the summary lines are single-column rows — so
it still opens cleanly in Sheets or Excel.

```
"ENACTUS SPIT SUBCOM APPLICATIONS 2026–27"

"TOTAL APPLICANTS: 3"

"BRANCH BREAKDOWN"
"CE: 0"
"CSE: 2"
"EXTC: 1"

"DOMAIN APPLICATIONS"
"PR: 2"
"Marketing: 0"
"Creatives: 1"
"Social Media: 0"
"Tech: 2"
"Projects: 1"
"Operations: 0"

"APPLICANT DATA"
"Timestamp","Name","Branch","UID","SPIT Email","Mobile Number","Preferred Domains","Why Join Enactus","Social Impact","Creative Portfolio / Work Link","Application Year"
"2026-09-25 10:20:30","Applicant One","CSE","2024CSE001",...,"PR, Tech",...,"2026–27"
```

Every count is recalculated from the stored records on each write — nothing is
cached or hardcoded. An applicant counts **once** towards their branch and
**once per domain** they selected, so the domain numbers routinely exceed the
applicant total.

Because the summary sits above the table, each submission is a
read-modify-rewrite: parse the file, extract the existing records, append the
new one, recalculate, rewrite. `LockService` serialises this so two concurrent
submissions cannot lose a record. A file still in the original flat format
(bare header + rows) is detected and upgraded in place on the next submission,
keeping every existing applicant.

### Maintenance functions

Run these by hand from the Apps Script editor:

| Function | Effect |
| --- | --- |
| `setupApplicationCsv()` | Creates the private CSV. Run once. |
| `rebuildCsvFile()` | Rewrites the file in the current format. Records untouched. Safe anytime. |
| `resetApplications()` | **Destructive.** Deletes every applicant record, leaving an empty formatted file with all counts at 0. |

### Backend guarantees

- Re-validates every field; the frontend is never trusted.
- Every field is quoted, embedded quotes doubled, newlines flattened.
- Values starting with `= + - @ TAB CR` are prefixed with `'` to defuse
  spreadsheet formula injection.
- `LockService` serialises concurrent writes so two submissions can't truncate
  the file.
- The Drive file ID lives in Script Properties and is never returned to the
  client. `doGet` only reports liveness; no applicant data is ever readable
  over HTTP.

---

## Frontend → backend contract

The endpoint lives in exactly one place — `SCRIPT_URL` at the top of
`js/script.js`. Both sides use these keys:

```js
{ name, branch, uid, email, mobile, domains, whyJoin, socialImpact, portfolio, applicationYear }
```

The request is sent as `application/x-www-form-urlencoded` (a CORS-simple
request, so no preflight `OPTIONS` — which Apps Script cannot answer). Each key
is a form field, and the same object is mirrored into a `payload` field as JSON.
`doPost` therefore accepts all three shapes:

| Sent as | Read in `Code.gs` as |
| --- | --- |
| form fields | `e.parameter.name`, `e.parameter.email`, … |
| `payload` JSON field | `JSON.parse(e.parameter.payload)` |
| raw JSON body | `JSON.parse(e.postData.contents)` |

`domains` is a comma-separated string, e.g. `PR, Creatives, Tech` — every
selected domain, no maximum, nothing truncated. `portfolio` is sent as `""`
unless **Creatives** is selected.

## Validation rules

| Field        | Rule                                                              |
| ------------ | ----------------------------------------------------------------- |
| Name         | 2+ characters, letters required, not numeric                       |
| Branch       | `CE`, `CSE` or `EXTC` only                                          |
| UID          | 5–20 alphanumerics, must contain digits, rejects `111111`-style junk |
| SPIT Email   | `/^[A-Z0-9._%+-]+@spit\.ac\.in$/i`, trimmed and lowercased          |
| Mobile       | `/^[6-9]\d{9}$/` after stripping spaces, dashes and a `+91` prefix   |
| Domains      | at least one, no maximum                                            |
| Why / Impact | 30+ characters, 5+ words, rejects repeated-character filler         |
| Portfolio    | optional; if present must be a valid `http(s)` URL                  |

## Data policy

Nothing an applicant types is written to `localStorage`, `sessionStorage`,
cookies or IndexedDB. A reload always starts blank. On a **confirmed** success
the form is cleared; on failure every value is kept so the applicant can retry.

## Accessibility & performance

- Full keyboard navigation, visible focus rings, labels tied to inputs, errors
  associated via `aria-describedby`, live regions on progress and selections.
- `prefers-reduced-motion` disables parallax, particles and transitions while
  keeping every screen reachable.
- Animations are limited to `transform`/`opacity`; particles are DOM nodes with
  a hard cap of 90 live at once and self-removal. Mouse tilt and parallax are
  disabled on touch devices, and the heavier world layers are dropped below
  768px.
