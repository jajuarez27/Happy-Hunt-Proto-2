// Happy Hunt SPA — talks ONLY to the local backend API (http://localhost:3000).
// No direct Supabase calls and no secrets in the browser.

const API = 'http://localhost:3000';
const SESSION_KEY = 'hh_session';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const view = document.getElementById('view');
const sessionEl = document.getElementById('session');

// ---------- session ----------
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function setSession(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
  renderSession();
}
function renderSession() {
  const s = getSession();
  sessionEl.innerHTML = s
    ? `Signed in as <strong>${escapeHtml(s.name)}</strong><button id="signout" type="button">Sign out</button>`
    : `<a href="#/auth">Sign in</a>`;
  const btn = document.getElementById('signout');
  if (btn) btn.addEventListener('click', () => { setSession(null); navigate('saved'); });
}

// ---------- api helper ----------
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.fields = body.fields;
    throw err;
  }
  return body;
}

// ---------- shared data helpers ----------
function locationOf(r) { return (r.locations && r.locations[0]) || null; }
function happyHoursOf(r) {
  const loc = locationOf(r);
  return (loc && loc.happy_hours) || [];
}
function dealsOf(r) {
  return happyHoursOf(r).flatMap(hh => hh.deals || []);
}
function dealPrice(d) {
  return d.happy_hour_price != null ? `$${Number(d.happy_hour_price).toFixed(2)}` : '';
}
function dealReg(d) {
  return d.regular_price != null ? ` (reg. $${Number(d.regular_price).toFixed(2)})` : '';
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function setTitle(t, route) {
  document.title = `${t} — Happy Hunt`;
  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function fieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg || '';
}

// ---------- router ----------
function navigate(route) { location.hash = '#/' + route; }

window.addEventListener('hashchange', render);

function render() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [route, param] = hash.split('/');
  renderSession();
  if (route === 'details') return renderDetails(param);
  if (route === 'saved') return renderSaved();
  if (route === 'auth') return renderAuth();
  if (route === 'submit') return renderSubmit();
  return renderBrowse();
}

// ===========================================================================
// Page 1 — Browse Happy Hours
// ===========================================================================
async function renderBrowse() {
  setTitle('Browse Happy Hours','browse');
  view.innerHTML = `
    <h1>Browse Happy Hours</h1>
    <section class="filters">
      <div class="field"><label for="search">Search</label><input id="search" type="search" placeholder="Restaurant name…" /></div>
      <div class="field"><label for="type">Type</label><select id="type"><option value="">All types</option></select></div>
      <div class="field"><label for="city">City</label><input id="city" type="search" placeholder="City…" /></div>
      <button id="refresh" type="button">Refresh</button>
    </section>
    <section id="restaurant-list" class="restaurant-list"><p class="empty">Loading…</p></section>`;

  const listEl = document.getElementById('restaurant-list');
  const searchInput = document.getElementById('search');
  const typeSelect = document.getElementById('type');
  const cityInput = document.getElementById('city');

  // populate type filter from live data
  try {
    const { restaurants } = await api('/api/restaurants');
    const types = [...new Set(restaurants.map(r => r.restaurant_type).filter(Boolean))].sort();
    types.forEach(t => {
      const o = document.createElement('option');
      o.value = o.textContent = t;
      typeSelect.appendChild(o);
    });
  } catch { /* filters still work without the type list */ }

  async function load() {
    listEl.innerHTML = '<p class="empty">Loading…</p>';
    try {
      const params = new URLSearchParams();
      if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
      if (typeSelect.value) params.set('restaurant_type', typeSelect.value);
      if (cityInput.value.trim()) params.set('city', cityInput.value.trim());
      const qs = params.toString();
      const { restaurants } = await api(`/api/restaurants${qs ? '?' + qs : ''}`);
      listEl.innerHTML = '';
      if (!restaurants.length) {
        listEl.innerHTML = '<p class="empty">No restaurants found.</p>';
        return;
      }
      restaurants.forEach(r => listEl.appendChild(renderCard(r)));
    } catch (err) {
      listEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderCard(r) {
    const loc = locationOf(r);
    const hh = happyHoursOf(r)[0];
    const deals = dealsOf(r).slice(0, 3);
    const card = document.createElement('div');
    card.className = 'card clickable';
    card.innerHTML = `
      <h3>${escapeHtml(r.name)}</h3>
      <div class="meta">${escapeHtml(r.restaurant_type || '')}${loc ? ` · ${escapeHtml(loc.city)}, ${escapeHtml(loc.state)}` : ''}</div>
      ${hh ? `<span class="badge">${escapeHtml(hh.day_of_week)} ${escapeHtml(hh.start_time)}–${escapeHtml(hh.end_time)}</span>` : ''}
      ${deals.map(d => `<div class="deal"><span class="type">${escapeHtml(d.deal_type)}</span> ${escapeHtml(d.deal_name)} — ${escapeHtml(dealPrice(d))}${escapeHtml(dealReg(d))}</div>`).join('')}
    `;
    card.addEventListener('click', () => navigate(`details/${r.restaurant_id}`));
    return card;
  }

  searchInput.addEventListener('input', debounce(load, 300));
  typeSelect.addEventListener('change', load);
  cityInput.addEventListener('input', debounce(load, 300));
  document.getElementById('refresh').addEventListener('click', load);

  await load();
}

// ===========================================================================
// Page 2 — Restaurant Details
// ===========================================================================
let detailsCache = [];

async function renderDetails(param) {
  setTitle('Restaurant Details','details');
  view.innerHTML = `
    <h1>Restaurant Details</h1>
    <div class="field" style="max-width:420px">
      <label for="restaurant-picker">Select restaurant</label>
      <select id="restaurant-picker"><option>Loading…</option></select>
    </div>
    <div id="detail-body"><p class="empty">Loading…</p></div>`;

  const picker = document.getElementById('restaurant-picker');
  const body = document.getElementById('detail-body');

  try {
    if (!detailsCache.length) {
      const { restaurants } = await api('/api/restaurants');
      detailsCache = restaurants;
    }
  } catch (err) {
    body.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    return;
  }

  picker.innerHTML = '';
  detailsCache.forEach(r => {
    const o = document.createElement('option');
    o.value = r.restaurant_id;
    o.textContent = r.name;
    picker.appendChild(o);
  });

  // default: param id if valid, else first restaurant
  const wanted = param && detailsCache.some(r => r.restaurant_id === param)
    ? param : detailsCache[0].restaurant_id;
  picker.value = wanted;

  async function show(id) {
    body.innerHTML = '<p class="empty">Loading…</p>';
    try {
      const { restaurant: r } = await api(`/api/restaurants/${id}`);
      renderDetailBody(r);
    } catch (err) {
      body.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderDetailBody(r) {
    const loc = locationOf(r);
    const session = getSession();
    const hours = happyHoursOf(r).map(h => `
      <li><strong>${escapeHtml(h.day_of_week)}</strong>: ${escapeHtml(h.start_time)}–${escapeHtml(h.end_time)}
        ${h.active ? '' : ' <em>(inactive)</em>'}
        ${h.last_verified ? ` · verified ${escapeHtml(String(h.last_verified).slice(0, 10))}` : ''}
        ${h.source_url ? ` · <a href="${escapeHtml(h.source_url)}" target="_blank" rel="noopener">source</a>` : ''}
      </li>`).join('');
    const deals = dealsOf(r).map(d => `
      <li><strong>${escapeHtml(d.deal_name)}</strong> — ${escapeHtml(d.deal_type)}
        · HH ${escapeHtml(dealPrice(d))}${escapeHtml(dealReg(d))}
        ${d.description ? ` · ${escapeHtml(d.description)}` : ''}</li>`).join('');

    body.innerHTML = `
      <div class="detail-head">
        <div>
          <h2 style="margin:0">${escapeHtml(r.name)}</h2>
          <div class="meta muted">${escapeHtml(r.restaurant_type || '')}${loc ? ` · ${escapeHtml(loc.address || '')}, ${escapeHtml(loc.city)}, ${escapeHtml(loc.state)} ${escapeHtml(loc.zip_code || '')}` : ''}${r.phone ? ` · ${escapeHtml(r.phone)}` : ''}</div>
        </div>
        <div class="actions">
          <button id="save-place" class="btn" type="button">Save Place</button>
          <a class="btn secondary" href="#/browse" style="text-decoration:none;display:inline-block">← Back to Browse Happy Hours</a>
        </div>
      </div>
      ${r.website ? `<p><a href="${escapeHtml(r.website)}" target="_blank" rel="noopener">${escapeHtml(r.website)}</a></p>` : ''}
      <h2>Verified Happy Hour Schedule</h2>
      <ul>${hours || '<li class="empty">None listed</li>'}</ul>
      <h2>Deals</h2>
      <ul>${deals || '<li class="empty">None listed</li>'}</ul>
      <p class="muted" id="save-status"></p>`;

    document.getElementById('save-place').addEventListener('click', async () => {
      const status = document.getElementById('save-status');
      if (!session) {
        status.textContent = 'Please sign in to save places.';
        status.style.color = 'var(--danger)';
        navigate('auth');
        return;
      }
      try {
        await api('/api/saved-places', {
          method: 'POST',
          body: JSON.stringify({ user_id: session.user_id, restaurant_id: r.restaurant_id })
        });
        status.textContent = 'Saved!';
        status.style.color = 'var(--ok)';
      } catch (err) {
        status.textContent = err.message;
        status.style.color = 'var(--danger)';
      }
    });
  }

  picker.addEventListener('change', () => show(picker.value));
  await show(wanted);
}

// ===========================================================================
// Page 3 — Saved Places
// ===========================================================================
async function renderSaved() {
  setTitle('Saved Places','saved');
  const session = getSession();

  if (!session) {
    view.innerHTML = `
      <h1>Saved Places</h1>
      <p class="empty">You need to <a href="#/auth">sign in</a> to view your saved places.</p>`;
    return;
  }

  view.innerHTML = `
    <h1>Saved Places</h1>
    <p class="muted">Saved by ${escapeHtml(session.name)}</p>
    <section id="saved-list" class="restaurant-list"><p class="empty">Loading…</p></section>`;

  const listEl = document.getElementById('saved-list');

  try {
    const { saved_places } = await api(`/api/saved-places?user_id=${session.user_id}`);
    listEl.innerHTML = '';
    if (!saved_places.length) {
      listEl.innerHTML = '<p class="empty">No saved places yet. <a href="#/browse">Browse Happy Hours</a> to find some!</p>';
      return;
    }
    saved_places.forEach(sp => {
      const r = sp.restaurants || {};
      const loc = (r.locations && r.locations[0]) || {};
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${escapeHtml(r.name || 'Unknown')}</h3>
        <div class="meta">${escapeHtml(r.restaurant_type || '')}${loc.city ? ` · ${escapeHtml(loc.city)}, ${escapeHtml(loc.state || '')}` : ''}</div>
        <div class="actions">
          <a class="btn secondary" href="#/details/${escapeHtml(sp.restaurant_id)}" style="text-decoration:none;display:inline-block">View Details</a>
          <button class="btn danger" type="button">Remove</button>
        </div>`;
      card.querySelector('.btn.danger').addEventListener('click', async () => {
        try {
          await api(`/api/saved-places/${sp.saved_place_id}?user_id=${session.user_id}`, { method: 'DELETE' });
          card.remove();
          if (!listEl.children.length) {
            listEl.innerHTML = '<p class="empty">No saved places yet.</p>';
          }
        } catch (err) {
          toast(err.message);
        }
      });
      listEl.appendChild(card);
    });
  } catch (err) {
    listEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

// ===========================================================================
// Page 4 — Sign In / Register
// ===========================================================================
async function renderAuth() {
  setTitle('Sign In / Register','auth');
  const session = getSession();
  view.innerHTML = `
    <h1>Sign In / Register</h1>
    ${session ? `<p>Currently signed in as <strong>${escapeHtml(session.name)}</strong>. <a href="#" id="switch">Use a different account</a></p>` : ''}
    <div class="auth-grid">
      <div class="auth-card">
        <h2>Sign In</h2>
        <form id="signin-form" novalidate>
          <div class="field"><label for="si-email">Email</label><input id="si-email" type="email" required /><div class="field-error" id="si-email-err"></div></div>
          <div class="field"><label for="si-password">Password</label><input id="si-password" type="password" required /><div class="field-error" id="si-password-err"></div></div>
          <div class="form-error" id="si-error"></div>
          <button class="btn" type="submit">Sign In</button>
        </form>
      </div>
      <div class="auth-card">
        <h2>Register</h2>
        <form id="register-form" novalidate>
          <div class="field"><label for="rg-name">Name</label><input id="rg-name" type="text" required /><div class="field-error" id="rg-name-err"></div></div>
          <div class="field"><label for="rg-email">Email</label><input id="rg-email" type="email" required /><div class="field-error" id="rg-email-err"></div></div>
          <div class="field"><label for="rg-password">Password (min 8 characters)</label><input id="rg-password" type="password" required /><div class="field-error" id="rg-password-err"></div></div>
          <div class="form-error" id="rg-error"></div>
          <button class="btn" type="submit">Register</button>
        </form>
      </div>
    </div>`;

  const switchLink = document.getElementById('switch');
  if (switchLink) switchLink.addEventListener('click', e => { e.preventDefault(); setSession(null); render(); });

  document.getElementById('signin-form').addEventListener('submit', async e => {
    e.preventDefault();
    document.getElementById('si-error').textContent = '';
    const email = document.getElementById('si-email').value.trim();
    const password = document.getElementById('si-password').value;
    let ok = true;
    fieldError('si-email-err'); fieldError('si-password-err');
    if (!email) { fieldError('si-email-err', 'Email is required'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldError('si-email-err', 'Enter a valid email address'); ok = false; }
    if (!password) { fieldError('si-password-err', 'Password is required'); ok = false; }
    if (!ok) return;
    try {
      const { user } = await api('/api/auth/signin', {
        method: 'POST', body: JSON.stringify({ email, password })
      });
      setSession(user);
      toast(`Welcome back, ${user.name}!`);
      navigate('saved');
    } catch (err) {
      document.getElementById('si-error').textContent = err.message;
    }
  });

  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    document.getElementById('rg-error').textContent = '';
    const name = document.getElementById('rg-name').value.trim();
    const email = document.getElementById('rg-email').value.trim();
    const password = document.getElementById('rg-password').value;
    let ok = true;
    fieldError('rg-name-err'); fieldError('rg-email-err'); fieldError('rg-password-err');
    if (!name) { fieldError('rg-name-err', 'Name is required'); ok = false; }
    if (!email) { fieldError('rg-email-err', 'Email is required'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldError('rg-email-err', 'Enter a valid email address'); ok = false; }
    if (!password) { fieldError('rg-password-err', 'Password is required'); ok = false; }
    else if (password.length < 8) { fieldError('rg-password-err', 'Password must be at least 8 characters'); ok = false; }
    if (!ok) return;
    try {
      const { user } = await api('/api/auth/register', {
        method: 'POST', body: JSON.stringify({ name, email, password })
      });
      setSession(user);
      toast(`Account created — welcome, ${user.name}!`);
      navigate('saved');
    } catch (err) {
      if (err.fields) {
        for (const [k, msg] of Object.entries(err.fields)) {
          const map = { name: 'rg-name-err', email: 'rg-email-err', password: 'rg-password-err' };
          if (map[k]) fieldError(map[k], msg);
        }
      }
      document.getElementById('rg-error').textContent = err.fields ? 'Please fix the highlighted fields.' : err.message;
    }
  });
}

// ===========================================================================
// Page 5 — Submit / Report Deal
// ===========================================================================
async function renderSubmit() {
  setTitle('Submit / Report Deal','submit');
  view.innerHTML = `
    <h1>Submit / Report Deal</h1>
    <p class="muted">Report a happy hour deal. It will be verified against the restaurant's published happy hour.</p>
    <form id="deal-form" class="auth-card" style="max-width:640px" novalidate>
      <div class="form-error" id="deal-error"></div>
      <div class="form-success hidden" id="deal-success"></div>
      <div class="field">
        <label for="d-restaurant">Restaurant *</label>
        <select id="d-restaurant" required><option value="">Select a restaurant…</option></select>
        <div class="field-error" id="d-restaurant-err"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label for="d-day">Day of week *</label>
          <select id="d-day" required><option value="">Select…</option>${DAYS.map(d => `<option>${d}</option>`).join('')}</select>
          <div class="field-error" id="d-day-err"></div></div>
        <div class="field"><label for="d-start">Start time *</label>
          <input id="d-start" type="time" required /><div class="field-error" id="d-start-err"></div></div>
        <div class="field"><label for="d-end">End time *</label>
          <input id="d-end" type="time" required /><div class="field-error" id="d-end-err"></div></div>
      </div>
      <div class="field"><label for="d-source">Source URL *</label>
        <input id="d-source" type="url" placeholder="https://…" required /><div class="field-error" id="d-source-err"></div></div>
      <div class="field"><label for="d-name">Deal name *</label>
        <input id="d-name" type="text" placeholder="e.g. Half-price wings" /><div class="field-error" id="d-name-err"></div></div>
      <div class="field"><label for="d-desc">Description</label>
        <textarea id="d-desc" rows="2"></textarea></div>
      <div class="form-grid">
        <div class="field"><label for="d-type">Deal type *</label>
          <select id="d-type" required><option value="">Select…</option><option value="food">Food</option><option value="drink">Drink</option></select>
          <div class="field-error" id="d-type-err"></div></div>
        <div class="field"><label for="d-regular">Regular price ($) *</label>
          <input id="d-regular" type="number" min="0" step="0.01" placeholder="0.00" /><div class="field-error" id="d-regular-err"></div></div>
        <div class="field"><label for="d-hh">Happy hour price ($) *</label>
          <input id="d-hh" type="number" min="0" step="0.01" placeholder="0.00" /><div class="field-error" id="d-hh-err"></div></div>
      </div>
      <button class="btn" type="submit">Submit Deal</button>
    </form>`;

  const sel = document.getElementById('d-restaurant');
  try {
    const { restaurants } = await api('/api/restaurants');
    restaurants.forEach(r => {
      const o = document.createElement('option');
      o.value = r.restaurant_id;
      o.textContent = r.name;
      sel.appendChild(o);
    });
  } catch (err) {
    document.getElementById('deal-error').textContent = err.message;
  }

  document.getElementById('deal-form').addEventListener('submit', async e => {
    e.preventDefault();
    ['d-restaurant','d-day','d-start','d-end','d-source','d-name','d-type','d-regular','d-hh']
      .forEach(id => fieldError(id + '-err'));
    document.getElementById('deal-error').textContent = '';
    document.getElementById('deal-success').classList.add('hidden');

    const v = id => document.getElementById(id).value.trim();
    const restaurant_id = v('d-restaurant');
    const day_of_week = v('d-day');
    const start_time = v('d-start');
    const end_time = v('d-end');
    const source_url = v('d-source');
    const deal_name = v('d-name');
    const deal_type = v('d-type');
    const regular_price = v('d-regular');
    const happy_hour_price = v('d-hh');
    let ok = true;

    if (!restaurant_id) { fieldError('d-restaurant-err', 'Please select a restaurant'); ok = false; }
    if (!day_of_week) { fieldError('d-day-err', 'Please select a day'); ok = false; }
    if (!start_time) { fieldError('d-start-err', 'Start time is required'); ok = false; }
    if (!end_time) { fieldError('d-end-err', 'End time is required'); ok = false; }
    else if (start_time && end_time && end_time <= start_time) {
      fieldError('d-end-err', 'End time must be after start time'); ok = false;
    }
    if (!source_url) { fieldError('d-source-err', 'Source URL is required'); ok = false; }
    else {
      try { new URL(source_url); } catch { fieldError('d-source-err', 'Enter a valid URL (https://…)'); ok = false; }
    }
    if (!deal_name) { fieldError('d-name-err', 'Deal name is required'); ok = false; }
    if (!deal_type) { fieldError('d-type-err', 'Please select a deal type'); ok = false; }
    if (regular_price === '' || Number(regular_price) < 0) {
      fieldError('d-regular-err', 'Regular price is required and must be ≥ 0'); ok = false;
    }
    if (happy_hour_price === '' || Number(happy_hour_price) < 0) {
      fieldError('d-hh-err', 'Happy hour price is required and must be ≥ 0'); ok = false;
    } else if (regular_price !== '' && Number(happy_hour_price) > Number(regular_price)) {
      fieldError('d-hh-err', 'Happy hour price must be ≤ regular price'); ok = false;
    }
    if (!ok) return;

    try {
      await api('/api/deals', {
        method: 'POST',
        body: JSON.stringify({
          restaurant_id, day_of_week, start_time, end_time,
          source_url: source_url || null,
          deal_name,
          description: v('d-desc') || null,
          deal_type,
          regular_price: Number(regular_price),
          happy_hour_price: Number(happy_hour_price)
        })
      });
      detailsCache = []; // force refresh of restaurant cache
      const s = document.getElementById('deal-success');
      s.textContent = `Deal "${deal_name}" submitted successfully!`;
      s.classList.remove('hidden');
      e.target.reset();
    } catch (err) {
      if (err.fields) {
        const map = {
          restaurant_id: 'd-restaurant-err', day_of_week: 'd-day-err',
          start_time: 'd-start-err', end_time: 'd-end-err', source_url: 'd-source-err',
          deal_name: 'd-name-err', deal_type: 'd-type-err',
          regular_price: 'd-regular-err', happy_hour_price: 'd-hh-err'
        };
        for (const [k, msg] of Object.entries(err.fields)) {
          if (map[k]) fieldError(map[k], msg);
        }
        document.getElementById('deal-error').textContent = 'Please fix the highlighted fields.';
      } else {
        document.getElementById('deal-error').textContent = err.message;
      }
    }
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

render();
