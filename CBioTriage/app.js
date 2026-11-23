/* CMUbiotrage – offline-first first-response guide (demo). All content lives in data.json. */
const STALE_MS = 24 * 3600 * 1000;
let D = null, deferredInstall = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isNum = n => /^[+\d][\d\s\-()]{5,}$/.test(n || '');
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const back = (to = '#/home') => `<a class="back" href="${to}">‹ Back</a>`;
const pending = '<span class="review">Content pending medical review</span>';

function dial(c, cls = 'btn dial') {
  return isNum(c.number)
    ? `<a class="${cls}" href="tel:${esc(c.number.replace(/\s/g, ''))}">📞 Tap to dial ${esc(c.label)}</a>`
    : `<span class="review">${esc(c.label)}: number not set yet</span>`;
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'msg toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.remove(), 3000);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('✔ Copied to clipboard'); }
  catch { const a = document.createElement('textarea'); a.value = text; document.body.append(a); a.select(); try { document.execCommand('copy'); toast('✔ Copied to clipboard'); } catch { toast('Could not copy. Select the text and copy it by hand.'); } a.remove(); }
}
async function share(text, url = location.href) {
  if (navigator.share) { try { await navigator.share({ title: 'CMUbiotrage', text, url }); return; } catch { return; } }
  copy(url ? `${text} ${url}` : text);
}

/* ---------- Public screens ---------- */
const screens = {
  home: () => `<div class="home">
    <section class="call" aria-label="Call now">
      <h1>Call now</h1>
      <div class="nums">
        <div><div>${esc(D.primary.label)}</div><span class="num">${esc(D.primary.number)}</span>${dial(D.primary)}</div>
        <div><div>${esc(D.alternate.label)}</div><span class="num">${esc(D.alternate.number)}</span>${dial(D.alternate)}</div>
      </div>
      <a class="btn dial" href="tel:911">📞 Call 911 (national emergency)</a>
      <a class="btn dial" href="#/nosignal">⚠ Call didn’t connect</a>
    </section>
    <nav class="tiles" aria-label="Guide sections">
      <a class="tile" href="#/do"><b>What to do now</b><span>Do and don’t</span></a>
      <a class="tile" href="#/tell"><b>Tell the responder</b><span>Tap answers, no typing</span></a>
      <a class="tile" href="#/before"><b>Before an emergency</b><span>Save this guide offline</span></a>
      <a class="tile" href="#/about"><b>About this guide</b><span>Limits and version</span></a>
    </nav></div>`,

  do: () => `${back()}<h1>What to do now</h1>${pending}
    <div class="cols">
      <div class="card do"><h2>✔ Do</h2><ul class="clean">${D.dos.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="card dont"><h2>✖ Don’t</h2><ul class="clean">${D.donts.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    <a class="btn primary" href="#/tell">Tell the responder</a>
    <a class="btn dial" style="background:var(--alarm);color:var(--onalarm)" href="#/home">Go to call block</a>`,

  tell: () => `${back()}<h1>Tell the responder</h1>
    <p class="lead">Tap an answer. Choose “Unknown” instead of guessing.</p>
    <div class="cols">
      <section class="card"><h2>Where are you?</h2>
        ${sel('area','Area',D.options.areas)}${sel('surr','Surroundings',D.options.surroundings)}
        ${chips('meet','Can someone meet responders at the road?',D.options.meet,true)}
        ${txt('landmark','Nearest landmark (optional)')}
        <button class="btn primary" id="mapBtn" type="button">🗺 Pick my location on the map</button>
        <div id="mapBox" hidden><p class="lead">Tap the map where you are. Zoom in for accuracy.</p><div id="map"></div>
          <p id="mapNote" class="review" hidden>Map needs internet for new areas. Use GPS or the area list instead.</p></div>
        <button class="btn" id="gps" type="button">📍 Use my GPS</button><div id="gpsOut" aria-live="polite"></div>
        <div id="pinOut" aria-live="polite"></div></section>
      <section class="card"><h2>What happened?</h2>${pending}
        ${sel('time','Time of the bite',D.options.times)}
        ${chips('cond','Victim’s condition (tap all that apply)',D.options.conditions)}
        ${chips('done','Actions already taken',D.options.actions)}
        ${sel('snake','Snake (only if safe to note)',D.options.snakes)}</section>
    </div>
    <section class="card"><h2>Send your report to staff</h2><p>Submit the details above so staff can see your report and attached location. Internet is required. Submitting does not confirm that help is on the way; call for urgent assistance.</p><button class="btn primary" id="submitReport" type="button">Submit report to staff</button><div id="submitStatus" role="status" aria-live="polite"></div></section>
    <button class="btn" id="sum" type="button">Build and copy summary</button><pre id="sumOut" hidden></pre>
    <div id="sumBtns" hidden><a class="btn small primary" id="sumSms" href="#">Send by SMS</a><button class="btn small" id="sumShare" type="button">Share</button></div>`,

  nosignal: () => `${back()}<h1>Call didn’t connect</h1>
    <div class="card"><h2>Try next</h2><ul class="clean">
      <li>Call the alternate number.</li>
      <li>If it is safe, send someone to an area with signal.</li>
      <li>Ask someone nearby to open this guide or call for you.</li></ul></div>
    ${dial(D.alternate, 'btn primary')}<a class="btn dial" href="tel:911">📞 Call 911 (national emergency)</a>
    <div class="card"><span class="num big">${esc(D.alternate.number)}</span></div>
    <button class="btn" id="shareBtn">Share this guide</button>`,

  before: () => `${back()}<h1>Before an emergency</h1>
    <div class="card"><h2>Save for offline use</h2><p>The guide must be saved on your phone before you go where there is no signal.</p>
    <button class="btn primary" id="save">Save for offline use</button><div id="saveOut" aria-live="polite"></div>
    <button class="btn" id="install" hidden>Install app</button></div>
    <div class="card"><h2>Add to home screen</h2><p><b>Android (Chrome):</b> menu ⋮ → Add to Home screen / Install app.</p><p><b>iPhone (Safari):</b> Share → Add to Home Screen.</p></div>
    <button class="btn" id="shareBtn">Share this guide</button>`,

  about: () => `${back()}<h1>About this guide</h1>
    <div class="card"><p>A first-response guide for snakebites at CMU, with a referral tool for UH staff.</p>
    <p><b>Limits:</b> This is not medical treatment and not a diagnostic tool. It does not guarantee antivenom stock or hospital capacity.</p></div>
    <div class="card"><p><b>Content owner:</b> ${esc(D.owner)}</p><p><b>Version:</b> ${esc(D.version)}</p><p><b>Reviewed:</b> ${esc(D.reviewed)}</p>
    <p><b>Report outdated information:</b> ${esc(D.reportContact)}</p>${pending}</div>`
};

const optHtml = o => o.map(x => `<option>${esc(x)}</option>`).join('');
function sel(id, label, opts) {
  return `<div class="f"><label for="f_${id}">${label}</label><select id="f_${id}" data-sel="${id}"><option value="">Choose…</option>${optHtml(opts)}<option>Other (type)</option><option>Unknown</option></select><input id="o_${id}" class="other" placeholder="Type here" hidden></div>`;
}
function chips(id, label, opts, single) {
  return `<div class="f"><div class="lbl" id="l_${id}">${label}</div><div class="chips" role="group" aria-labelledby="l_${id}" data-chips="${id}" ${single ? 'data-single' : ''}>${[...opts, 'Unknown'].map(o => `<button type="button" class="chip" aria-pressed="false">${esc(o)}</button>`).join('')}</div></div>`;
}
function txt(id, label, type = 'text', v = '') {
  return `<div class="f"><label for="f_${id}">${label}</label><input id="f_${id}" type="${type}" value="${esc(v)}"></div>`;
}
function val(id) {
  const g = document.querySelector(`[data-chips="${id}"]`);
  if (g) { const on = [...g.querySelectorAll('.chip[aria-pressed="true"]')].map(b => b.textContent); return on.join(', ') || 'Unknown'; }
  const e = document.getElementById('f_' + id); if (!e) return 'Unknown';
  if (e.tagName === 'SELECT') { if (e.value === 'Other (type)') return document.getElementById('o_' + id).value.trim() || 'Unknown'; return e.value || 'Unknown'; }
  return e.value.trim() || 'Unknown';
}
function bindUnknown() {
  document.querySelectorAll('[data-sel]').forEach(e => e.addEventListener('change', () => {
    const o = document.getElementById('o_' + e.dataset.sel); o.hidden = e.value !== 'Other (type)'; if (!o.hidden) o.focus();
  }));
  document.querySelectorAll('[data-chips]').forEach(g => g.addEventListener('click', ev => {
    const b = ev.target.closest('.chip'); if (!b) return;
    const was = b.getAttribute('aria-pressed') === 'true', unk = b.textContent === 'Unknown';
    if (unk || g.hasAttribute('data-single')) g.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    else g.querySelectorAll('.chip').forEach(c => { if (c.textContent === 'Unknown') c.setAttribute('aria-pressed', 'false'); });
    b.setAttribute('aria-pressed', was ? 'false' : 'true');
  }));
}

/* ---------- Map pin ---------- */
let map = null, pinMarker = null;
const getPin = () => { try { return JSON.parse(sessionStorage.getItem('ss_pin')); } catch { return null; } };
const pinLink = p => `https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
const pinText = () => { const p = getPin(); return p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} ${pinLink(p)}` : 'Unknown'; };
const pinNote = () => { const p = getPin(); return p ? `<p class="review">Map pin attached: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}. Clear it on the Tell the responder screen if it is old.</p>` : ''; };
function renderPin() {
  const o = $('#pinOut'); if (!o) return; const p = getPin(); if (!p) { o.innerHTML = ''; return; }
  const link = pinLink(p), body = 'Snakebite location: ' + link;
  o.innerHTML = `<div class="card"><div class="lbl">Your pin</div><span class="big">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span>
    <p><a href="${link}" target="_blank" rel="noopener">Open in maps</a> (needs internet)</p>
    <button class="btn small" id="cpPin" type="button">Copy link</button>
    <a class="btn small primary" href="sms:?&body=${encodeURIComponent(body)}">Send location by SMS</a>
    <button class="btn small" id="clrPin" type="button">Clear pin</button></div>`;
  $('#cpPin').onclick = () => copy(link);
  $('#clrPin').onclick = () => { sessionStorage.removeItem('ss_pin'); if (pinMarker) { pinMarker.remove(); pinMarker = null; } renderPin(); };
}
function setPin(lat, lng, center) {
  sessionStorage.setItem('ss_pin', JSON.stringify({ lat, lng }));
  if (map) { if (pinMarker) pinMarker.setLatLng([lat, lng]); else pinMarker = L.marker([lat, lng]).addTo(map); if (center) map.setView([lat, lng], 17); }
  renderPin();
}
function openMap() {
  $('#mapBox').hidden = false;
  if (!window.L) { $('#mapNote').hidden = false; return; }
  if (map) { map.invalidateSize(); return; }
  const p = getPin(), c = p ? { lat: p.lat, lng: p.lng, zoom: 17 } : D.mapCenter;
  map = L.map('map').setView([c.lat, c.lng], c.zoom || 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map)
    .on('tileerror', () => { $('#mapNote').hidden = false; });
  if (p) pinMarker = L.marker([p.lat, p.lng]).addTo(map);
  map.on('click', e => setPin(e.latlng.lat, e.latlng.lng, false));
}

/* ---------- Optional shared sync (Firebase Realtime Database REST) ---------- */
const SYNC = () => (D.syncUrl || '').replace(/\/$/, '');
const syncNote = () => SYNC() ? '<p class="review">Shared board: syncs when online.</p>' : '<p class="review">This device only: shared sync is not set up yet.</p>';
const pulled = {};
async function pullStatus() {
  const u = SYNC(); if (!u || !navigator.onLine) return;
  try { const remote = (await (await fetch(u + '/status.json')).json()) || {}; const all = hStatus();
    D.hospitals.forEach((h, i) => { const rm = remote['h' + i]; if (rm && (!all[h.name] || rm.at > all[h.name].at)) all[h.name] = rm; });
    store.set('ss_status', all); } catch {}
}
function pushStatus(i, rec) { const u = SYNC(); if (u && navigator.onLine) fetch(`${u}/status/h${i}.json`, { method: 'PUT', body: JSON.stringify(rec) }).catch(() => {}); }
async function pullLog() {
  const u = SYNC(); if (!u || !navigator.onLine) return;
  try { const remote = (await (await fetch(u + '/log.json')).json()) || {}; const l = store.get('ss_log', []); const have = new Set(l.map(x => x.id));
    Object.values(remote).forEach(e => { if (e && e.id && !have.has(e.id)) l.push(e); }); l.sort((a, b) => String(a.id).localeCompare(String(b.id))); store.set('ss_log', l); } catch {}
}
function pushLog(e) { const u = SYNC(); if (u && navigator.onLine) fetch(`${u}/log/${e.id}.json`, { method: 'PUT', body: JSON.stringify(e) }).catch(() => {}); }

/* ---------- Staff mode ---------- */
const hStatus = () => store.get('ss_status', {});
function hState(h) {
  const s = hStatus()[h.name];
  if (!s || !s.at) return { tag: 'Unverified', note: 'Never confirmed.' };
  if (Date.now() - s.at > STALE_MS) return { tag: 'Stale', note: 'Last confirmation is over 24 hours old.', s };
  return { tag: s.status || 'Unverified', note: '', s };
}
const screensStaff = {
  staff: () => sessionStorage.getItem('ss_staff') ? (location.hash = '#/staff-reports', '') : `${back()}<h1>Staff access</h1>
    <p>For UH staff and responders.</p><label for="pin">PIN</label><input id="pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="128">
    <button class="btn primary" id="pinGo">Open staff mode</button><div id="pinOut" aria-live="polite"></div>`,

  'staff-dir': () => staffNav() + `<h1>Referral directory</h1>${syncNote()}<button class="btn small" id="refresh" type="button">⟳ Refresh</button>
    <p class="review">Call to confirm antivenom. Listing does not guarantee stock or capacity.</p>
    <div class="card"><div class="f"><label for="staffName">Your name (used for every confirmation)</label><input id="staffName" autocomplete="name" placeholder="Type once"></div></div>
    ${D.hospitals.map((h, i) => { const st = hState(h), s = st.s;
      return `<div class="card"><b>${esc(h.name)}</b><br>${esc(h.number)}<br>
      <span class="tag t-${st.tag}">${st.tag}</span> ${st.note ? `<small>${st.note}</small>` : ''}
      <div><small>${s ? `Last confirmed by ${esc(s.by)} on ${new Date(s.at).toLocaleString()}` : 'Not confirmed yet'}</small></div>
            <button class="btn small primary" data-conf="${i}">Mark confirmed now</button>
      <button class="btn small" data-unconf="${i}">Mark unverified</button>
      ${isNum(h.number) ? `<a class="btn small" href="tel:${esc(h.number.replace(/\s/g, ''))}">📞 Call</a>` : ''}</div>`; }).join('')}`,

  'staff-alert': () => staffNav() + `<h1>Pre-alert message</h1>${pinNote()}
    <div class="cols"><section class="card">
      <div class="f"><label for="p_h">Receiving hospital</label><select id="p_h">${optHtml(D.hospitals.map(h => h.name))}</select></div>
      ${sel('pl','Location',D.options.areas)}${sel('pe','ETA',D.options.etas)}</section>
    <section class="card">${sel('pt','Time of bite',D.options.times)}${chips('pc','Victim’s condition',D.options.conditions)}${sel('ps','Snake',D.options.snakes)}</section></div>
    <button class="btn primary" id="gen">Generate message</button><div id="genOut"></div>`,

  'staff-log': () => staffNav() + `<h1>Incident log</h1>${syncNote()}
    <section class="card cols">${txt('ld','Date','date',new Date().toISOString().slice(0, 10))}${sel('ll','Location',D.options.areas)}${sel('ln','Outcome',D.options.outcomes)}</section>
    <button class="btn primary" id="addLog">Save entry</button><button class="btn" id="csv">Export CSV</button>
    <div id="logList">${logList()}</div>`,
};
const staffNav = () => `<nav><a class="btn small primary" href="#/staff-reports">Submitted reports</a><a class="btn small" href="#/staff-dir">Directory</a><a class="btn small" href="#/staff-alert">Pre-alert</a><a class="btn small" href="#/staff-log">Log</a><a class="btn small" href="#/staff-out">Log out</a></nav>`;
const logList = () => store.get('ss_log', []).map(l => `<div class="card">${esc(l.d)} – ${esc(l.l)}<br>${esc(l.n)}</div>`).join('') || '<p>No entries yet.</p>';


/* ---------- API helpers (work in any folder, on XAMPP/PHP; no Netlify needed) ---------- */
const apiUrl = name => location.pathname.replace(/[^/]*$/, '') + 'api/' + name + '.php';
const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
function timeoutSignal(ms) {
  if (window.AbortSignal && AbortSignal.timeout) return AbortSignal.timeout(ms);
  const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal;
}

/* ---------- Shared submitted reports ---------- */
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, credentials: 'same-origin', cache: 'no-store', signal: options.signal || timeoutSignal(18000) });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Could not reach the service. Check your connection and try again.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The service is unavailable. Please try again.'); }
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed. Please try again.'); error.status = response.status; throw error;
  }
  return data;
}
let pendingSubmission = null;
async function submitReport() {
  const button = $('#submitReport'), out = $('#submitStatus');
  const details = Object.fromEntries(['area', 'surr', 'meet', 'landmark', 'time', 'cond', 'done', 'snake'].map(key => [key, val(key)]));
  const pin = getPin();
  if (!pin && details.area === 'Unknown' && details.landmark === 'Unknown') {
    out.textContent = 'Choose an area, enter a landmark, or attach a location using the map or GPS.'; return;
  }
  const signature = JSON.stringify({ details, pin });
  if (!pendingSubmission || pendingSubmission.signature !== signature) pendingSubmission = { signature, id: uuid() };
  button.disabled = true; out.textContent = 'Sending your report…';
  try {
    const result = await api(apiUrl('reports'), { method: 'POST', body: JSON.stringify({ id: pendingSubmission.id, details, pin }) });
    out.textContent = `Report submitted to staff. Reference: ${result.id.slice(0, 8)}. Call for urgent assistance; this is not confirmation that help is on the way.`;
    button.textContent = 'Report submitted';
    const reset = () => { button.disabled = false; button.textContent = 'Submit report to staff'; };
    $('#app').addEventListener('input', reset, { once: true });
    $('#app').addEventListener('click', e => { if (e.target.closest('.chip, #gps, #clrPin, #map')) reset(); });
  } catch (error) {
    out.textContent = `${error.message} Submission is not confirmed. Retry to confirm delivery, or use the summary tools below to send by SMS. Your answers remain on this screen.`;
    button.disabled = false;
  }
}
let staffMap = null, reportMarkers = null, reportTimer = null, reportController = null;
let reportRows = [], reportNext = null, reportFilter = 'active';
screensStaff['staff-reports'] = () => staffNav() + `<h1>Submitted reports</h1>
  <p class="lead">Reports from users, with their submitted locations.</p>
  <button class="btn small" id="refreshReports" type="button">Refresh reports</button>
  <div class="chips" id="reportFilter" role="group" aria-label="Show reports">${[['active', 'Active'], ['handled', 'Handled'], ['all', 'All']].map(([k, t]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === reportFilter}">${t}</button>`).join('')}</div>
  <p id="reportsStatus" role="status" aria-live="polite">Loading submitted reports…</p>
  <section class="card"><h2>Report locations</h2><div id="staffMap" aria-label="Map of submitted report locations"></div>
  <p id="staffMapNote" class="review" hidden>Map tiles could not load. Coordinates and map links are available in each report below.</p>
  <p id="locationCount"></p></section>
  <section aria-label="Submitted report details" id="reportsList" aria-busy="true"></section>
  <button class="btn" id="olderReports" type="button" hidden>Load older reports</button>`;
function stopReportView() {
  clearInterval(reportTimer); reportTimer = null;
  reportController?.abort(); reportController = null;
  if (staffMap) { staffMap.remove(); staffMap = null; reportMarkers = null; }
  reportRows = []; reportNext = null;
}
function startReportView() {
  if (window.L) {
    staffMap = L.map('staffMap').setView([D.mapCenter.lat, D.mapCenter.lng], D.mapCenter.zoom || 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(staffMap)
      .on('tileerror', () => { const note = $('#staffMapNote'); if (note) note.hidden = false; });
    reportMarkers = L.featureGroup().addTo(staffMap);
  } else $('#staffMapNote').hidden = false;
  document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
    reportFilter = b.dataset.filter; reportRows = []; reportNext = null;
    document.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (reportController) { reportController.abort(); reportController = null; }
    loadReports(false, false);
  });
  $('#refreshReports').onclick = () => loadReports(false, false);
  $('#olderReports').onclick = () => loadReports(true, false);
  loadReports(false, false);
  reportTimer = setInterval(() => { if (!document.hidden && navigator.onLine) loadReports(false, true); }, 15000);
}
async function loadReports(older, automatic) {
  if (reportController) return;
  const controller = new AbortController(); reportController = controller;
  const timeout = setTimeout(() => controller.abort(), 18000);
  const list = $('#reportsList'), status = $('#reportsStatus');
  list.setAttribute('aria-busy', 'true');
  $('#refreshReports').disabled = true; $('#olderReports').disabled = true;
  if (!automatic) status.textContent = 'Loading submitted reports…';
  try {
    const result = await api(apiUrl('reports') + '?' + new URLSearchParams(Object.assign({ status: reportFilter }, older && reportNext ? { before: reportNext } : {})), { signal: controller.signal });
    if (controller.signal.aborted) return;
    const previousIds = new Set(reportRows.map(r => r.id));
    const newReports = result.reports.filter(r => !previousIds.has(r.id));
    if (automatic) {
      // Keep older pages while polling the latest submissions.
      reportRows = [...newReports, ...reportRows];
      if (!reportNext && result.next) reportNext = result.next;
    } else if (older) { reportRows.push(...newReports); reportNext = result.next; }
    else { reportRows = result.reports; reportNext = result.next; }
    if (!automatic || newReports.length) renderReports(!automatic && !older);
    status.textContent = `${reportRows.length} report${reportRows.length === 1 ? '' : 's'} loaded. Updated ${new Date().toLocaleTimeString()}. Checks for new reports every 15 seconds.`;
  } catch (error) {
    if (!$('#reportsStatus')) return;
    if (error.status === 401) { sessionStorage.removeItem('ss_staff'); location.hash = '#/staff'; return; }
    status.textContent = (error.name === 'AbortError' ? 'Loading timed out. Please refresh to try again.' : error.message) + (reportRows.length ? ' Showing previously loaded reports.' : ' Use Refresh reports to retry.');
  } finally {
    clearTimeout(timeout);
    if (reportController === controller) reportController = null;
    if (list.isConnected) {
      list.setAttribute('aria-busy', 'false');
      $('#refreshReports').disabled = false; $('#olderReports').disabled = false;
    }
  }
}
async function reportAction(id, request, apply) {
  try { await api(apiUrl('report') + request.query, request.options); apply(); renderReports(false);
    const st = $('#reportsStatus'); if (st) st.textContent = `${reportRows.length} report${reportRows.length === 1 ? '' : 's'} shown.`; toast('✔ Done');
  } catch (error) {
    if (error.status === 401) { sessionStorage.removeItem('ss_staff'); location.hash = '#/staff'; return; }
    if (error.status === 404) { reportRows = reportRows.filter(r => r.id !== id); renderReports(false); }
    toast(error.message);
  }
}
function renderReports(fit) {
  reportMarkers?.clearLayers();
  let mapped = 0;
  $('#reportsList').innerHTML = reportRows.map(report => {
    const d = report.details, hasPin = Number.isFinite(report.lat) && Number.isFinite(report.lng);
    const title = `${d.area} · ${report.id.slice(0, 8)}`;
    if (hasPin) {
      mapped++;
      if (staffMap) L.marker([report.lat, report.lng]).addTo(reportMarkers).bindPopup(`<b>${esc(title)}</b><br>${esc(new Date(report.submittedAt).toLocaleString())}<br>${esc(d.cond)}`);
    }
    return `<article class="card report-card" id="report-${report.id}"><h2>${esc(title)}</h2>
      <p class="report-time">Submitted ${esc(new Date(report.submittedAt).toLocaleString())} ${report.handled ? '<span class="tag t-Confirmed">Handled</span>' : ''}</p>
      <dl class="report-details">${[['Area', d.area], ['Surroundings', d.surr], ['Landmark', d.landmark], ['Can meet responders', d.meet], ['Time of bite', d.time], ['Condition', d.cond], ['Actions taken', d.done], ['Snake', d.snake]].map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
      ${hasPin ? `<p>Location: ${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}</p><button class="btn small primary" data-report-map="${report.id}" type="button">Show on map</button><a class="btn small" href="${pinLink(report)}" target="_blank" rel="noopener">Open in maps</a>` : '<p class="review">No map pin attached. Use the area and landmark provided.</p>'}<div class="report-actions"><button class="btn small" data-handle="${report.id}" data-to="${report.handled ? 0 : 1}" type="button">${report.handled ? 'Reopen' : '✔ Mark as handled'}</button><button class="btn small danger" data-del="${report.id}" type="button">Delete…</button></div></article>`;
  }).join('') || '<div class="card"><h2>No reports yet</h2><p>Reports appear here after a user submits them from “Tell the responder”.</p></div>';
  $('#locationCount').textContent = `${mapped} of ${reportRows.length} loaded reports have map locations.`;
  $('#olderReports').hidden = !reportNext;
  if (fit && mapped && staffMap) staffMap.fitBounds(reportMarkers.getBounds(), { padding: [30, 30], maxZoom: 17 });
  document.querySelectorAll('[data-handle]').forEach(b => b.onclick = () => {
    const id = b.dataset.handle, to = b.dataset.to === '1';
    reportAction(id, { query: '', options: { method: 'POST', body: JSON.stringify({ id, handled: to }) } }, () => {
      if (reportFilter === 'all') { const row = reportRows.find(r => r.id === id); if (row) row.handled = to; } else reportRows = reportRows.filter(r => r.id !== id);
    });
  });
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    const id = b.dataset.del;
    if (!confirm('Delete this report permanently? This cannot be undone.')) return;
    reportAction(id, { query: '?id=' + encodeURIComponent(id), options: { method: 'DELETE' } }, () => { reportRows = reportRows.filter(r => r.id !== id); });
  });
  document.querySelectorAll('[data-report-map]').forEach(button => button.onclick = () => {
    const report = reportRows.find(row => row.id === button.dataset.reportMap);
    if (!staffMap) { toast('Map unavailable. Use Open in maps.'); return; }
    staffMap.setView([report.lat, report.lng], 17);
    reportMarkers.getLayers().find(marker => marker.getLatLng().lat === report.lat && marker.getLatLng().lng === report.lng)?.openPopup();
    $('#staffMap').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* ---------- Router ---------- */
function route() {
  stopReportView();
  if (map) { map.remove(); map = null; pinMarker = null; }
  const r = (location.hash.replace('#/', '') || 'home');
  if (r === 'staff-out') {
    api(apiUrl('session'), { method: 'DELETE' }).then(() => { sessionStorage.removeItem('ss_staff'); location.hash = '#/home'; }).catch(() => { $('#app').innerHTML = '<p class="msg">Could not log out. Check your connection and <a href="#/staff-reports">try again</a>.</p>'; }); return;
  }
  const isStaff = r.startsWith('staff-');
  if (isStaff && !sessionStorage.getItem('ss_staff')) { location.hash = '#/staff'; return; }
  if ((r === 'staff-dir' || r === 'staff-log') && SYNC() && !pulled[r]) { pulled[r] = true; $('#app').innerHTML = '<p class="msg">Loading shared data…</p>'; (r === 'staff-dir' ? pullStatus() : pullLog()).finally(route); return; }
  const view = screens[r] || screensStaff[r] || screens.home;
  const html = view(); if (html === '' ) return;
  $('#app').innerHTML = html; $('#app').focus({ preventScroll: true }); window.scrollTo(0, 0);
  bindUnknown(); wire(r);
}
function wire(r) {
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
  on('shareBtn', () => share('Snakebite first-response guide for CMU.'));
  if (r === 'tell') {
    pendingSubmission = null;
    on('submitReport', submitReport);
    on('mapBtn', openMap); renderPin();
    on('gps', () => {
      const o = $('#gpsOut'); o.innerHTML = '<p>Finding location…</p>';
      if (!navigator.geolocation) { o.innerHTML = '<p class="msg">GPS is not available. Tap the map or choose an area instead.</p>'; return; }
      navigator.geolocation.getCurrentPosition(p => { o.innerHTML = `<p>GPS accuracy about ${Math.round(p.coords.accuracy)} m.</p>`; setPin(p.coords.latitude, p.coords.longitude, true); },
        () => { o.innerHTML = '<p class="msg">Could not get GPS. Tap the map or choose an area instead.</p>'; }, { enableHighAccuracy: true, timeout: 15000 });
    });
    on('sum', () => {
      const t = `SNAKEBITE REPORT (sent ${new Date().toLocaleTimeString()})\nArea: ${val('area')} | Surroundings: ${val('surr')} | Landmark: ${val('landmark')}\nSomeone can meet responders at road: ${val('meet')}\nMap pin: ${pinText()}\nTime of bite: ${val('time')}\nCondition: ${val('cond')}\nActions taken: ${val('done')}\nSnake: ${val('snake')}`;
      const p = $('#sumOut'); p.hidden = false; p.textContent = t; $('#sumBtns').hidden = false;
      $('#sumSms').href = 'sms:?&body=' + encodeURIComponent(t); $('#sumShare').onclick = () => share(t, '');
      copy(t);
    });
  }
  if (r === 'before') {
    on('save', async () => {
      const o = $('#saveOut');
      if (!('serviceWorker' in navigator)) { o.innerHTML = '<p class="msg">This browser cannot save offline. Add it to your home screen instead.</p>'; return; }
      try { const keys = await (await caches.open('cmubiotrage-v10')).keys();
        o.innerHTML = keys.length >= 6 ? `<p class="msg">✔ Saved offline: reviewed ${esc(D.reviewed)}</p>` : '<p class="msg">Not saved yet. Stay online a few seconds and tap again.</p>';
      } catch { o.innerHTML = '<p class="msg">Could not check. Reload the page while online and try again.</p>'; }
      netStatus();
    });
    if (deferredInstall) { const b = $('#install'); b.hidden = false; b.onclick = async () => { deferredInstall.prompt(); deferredInstall = null; b.hidden = true; }; }
  }
  if (r === 'staff') {
    on('pinGo', async () => {
      const button = $('#pinGo'); button.disabled = true;
      $('#pinOut').textContent = 'Checking PIN…';
      try {
        await api(apiUrl('session'), { method: 'POST', body: JSON.stringify({ pin: $('#pin').value }) });
        const session = await api(apiUrl('session'));
        if (!session.authenticated) {
          sessionStorage.removeItem('ss_staff');
          $('#pinOut').textContent = 'Your PIN was accepted, but this browser could not keep the staff session. Open this site in its own tab and allow cookies, then sign in again. ';
          const link = document.createElement('a');
          link.href = location.pathname + '#/staff';
          link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open staff login in a new tab';
          $('#pinOut').append(link);
          return;
        }
        sessionStorage.setItem('ss_staff', '1'); location.hash = '#/staff-reports';
      } catch (error) { $('#pinOut').textContent = error.message; }
      finally { button.disabled = false; }
    });
    $('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#pinGo').click(); });
  }
  if (r === 'staff-reports') startReportView();
  if (r === 'staff-dir') on('refresh', () => { pulled[r] = false; route(); });
  if (r === 'staff-dir') document.querySelectorAll('[data-conf],[data-unconf]').forEach(b => b.addEventListener('click', () => {
    const conf = b.dataset.conf !== undefined, i = +(b.dataset.conf ?? b.dataset.unconf), h = D.hospitals[i];
    const by = $('#staffName').value.trim(); if (conf && !by) { toast('Enter your name at the top first.'); $('#staffName').focus(); return; }
    const all = hStatus(); all[h.name] = conf ? { status: 'Confirmed', by, at: Date.now() } : { status: 'Unverified', by: by || 'staff', at: Date.now() };
    store.set('ss_status', all); pushStatus(i, all[h.name]); const keep = by; route(); const n = $('#staffName'); if (n) n.value = keep;
  }));
  if (r === 'staff-alert') on('gen', () => {
    const h = $('#p_h').value;
    const msg = `PRE-ALERT: Snakebite patient arriving at ${h}.\nCondition: ${val('pc')}\nTime of bite: ${val('pt')}\nLocation: ${val('pl')}\nETA: ${val('pe')}\nSnake: ${val('ps')}\nMap pin: ${pinText()}\nPlease confirm antivenom availability.`;
    const script = `Call script: "This is [name] from CMU University Hospital. We are bringing a snakebite patient. Bitten at ${val('pt')}. Condition: ${val('pc')}. ETA ${val('pe')}. Can you confirm antivenom and bed availability?"`;
    $('#genOut').innerHTML = `<pre>${esc(msg)}</pre><pre>${esc(script)}</pre>
      <a class="btn small primary" href="sms:?&body=${encodeURIComponent(msg)}">Open in SMS</a><button class="btn small" id="cp">Copy</button><button class="btn small" id="sh">Share</button>`;
    on('cp', () => copy(msg)); on('sh', () => share(msg, ''));
  });
  if (r === 'staff-log') {
    on('addLog', () => { const l = store.get('ss_log', []); const e = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 6), d: val('ld'), l: val('ll'), n: val('ln') }; l.push(e); store.set('ss_log', l); pushLog(e); route(); });
    on('csv', () => { const rows = [['date', 'location', 'notes'], ...store.get('ss_log', []).map(x => [x.d, x.l, x.n])];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'cmubiotrage-log.csv'; a.click(); });
  }
}

/* ---------- Status banner + boot ---------- */
function netStatus() {
  const ok = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
  const n = $('#net'); if (!n) return; n.textContent = ok ? `Saved offline · reviewed ${D.reviewed}` : 'Not saved for offline use yet';
  n.className = 'pill' + (ok ? '' : ' off');
}
function applyPrefs() {
  const p = store.get('ss_pref', { ts: 1, sun: false });
  document.documentElement.style.setProperty('--ts', p.ts); document.documentElement.classList.toggle('sun', !!p.sun);
  const b = $('#sunBtn'); if (b) b.setAttribute('aria-pressed', String(!!p.sun));
}
function bindPrefs() {
  $('#tsBtn').onclick = () => { const p = store.get('ss_pref', { ts: 1, sun: false }); const o = [1, 1.25, 1.5]; p.ts = o[(o.indexOf(p.ts) + 1) % 3]; store.set('ss_pref', p); applyPrefs(); toast(p.ts === 1 ? 'Normal text' : p.ts === 1.25 ? 'Large text' : 'Extra large text'); };
  $('#sunBtn').onclick = () => { const p = store.get('ss_pref', { ts: 1, sun: false }); p.sun = !p.sun; store.set('ss_pref', p); applyPrefs(); };
  applyPrefs();
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
window.addEventListener('hashchange', route);
(async function boot() {
  try { D = await (await fetch('data.json')).json(); }
  catch { $('#app').innerHTML = location.protocol === 'file:'
    ? '<div class="card"><h1>Open this through Apache</h1><p>You opened the file directly from the folder, which browsers block. Start Apache in XAMPP, then open:</p><p class="big">http://localhost/CMUBioTriage/</p></div>'
    : '<p class="msg">Could not load guide data. Reload while online once, then it will work offline.</p>'; return; }
  if (window.L) L.Icon.Default.imagePath = 'lib/images/'; bindPrefs();
  if ($('#ver')) $('#ver').textContent = `Version ${D.version} · Reviewed ${D.reviewed}`;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => { netStatus(); }).catch(() => {});
  try { const session = await api(apiUrl('session')); if (session.authenticated) sessionStorage.setItem('ss_staff', '1'); else sessionStorage.removeItem('ss_staff'); } catch { sessionStorage.removeItem('ss_staff'); }
  netStatus(); route();
  navigator.serviceWorker && navigator.serviceWorker.addEventListener('controllerchange', netStatus);
})();
