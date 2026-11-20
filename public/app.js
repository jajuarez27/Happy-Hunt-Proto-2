// Happy Hunt client — talks ONLY to the local backend API (same origin).
// No direct Supabase calls and no secrets in the browser.

const API = ''; // same origin (e.g. http://localhost:3000)

const listEl = document.getElementById('restaurant-list');
const detailEl = document.getElementById('detail');
const detailBody = document.getElementById('detail-body');
const searchInput = document.getElementById('search');
const typeSelect = document.getElementById('type');
const cityInput = document.getElementById('city');

// Response shape: restaurant → locations[] → happy_hours[] → deals[]
function locationOf(r) {
  return (r.locations && r.locations[0]) || null;
}

function happyHoursOf(r) {
  const loc = locationOf(r);
  return (loc && loc.happy_hours) || [];
}

function dealsOf(r) {
  return happyHoursOf(r).flatMap(hh => hh.deals || []);
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function dealText(d) {
  const hh = d.happy_hour_price != null ? `$${Number(d.happy_hour_price).toFixed(2)}` : '';
  const reg = d.regular_price != null ? ` (reg. $${Number(d.regular_price).toFixed(2)})` : '';
  return hh + reg;
}

function renderCard(r) {
  const loc = locationOf(r);
  const hh = happyHoursOf(r)[0];
  const deals = dealsOf(r).slice(0, 3);
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h3>${escapeHtml(r.name)}</h3>
    <div class="meta">${escapeHtml(r.restaurant_type || '')}${loc ? ` · ${escapeHtml(loc.city)}, ${escapeHtml(loc.state)}` : ''}</div>
    ${hh ? `<span class="badge">${escapeHtml(hh.day_of_week)} ${escapeHtml(hh.start_time)}–${escapeHtml(hh.end_time)}</span>` : ''}
    ${deals.map(d => `<div class="deal"><span class="type">${escapeHtml(d.deal_type)}</span> ${escapeHtml(d.deal_name)} — ${escapeHtml(dealText(d))}</div>`).join('')}
  `;
  card.addEventListener('click', () => showDetail(r.restaurant_id));
  return card;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function loadRestaurants() {
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

async function showDetail(id) {
  try {
    const { restaurant: r } = await api(`/api/restaurants/${id}`);
    const loc = locationOf(r);
    const hours = happyHoursOf(r).map(h =>
      `<li><strong>${escapeHtml(h.day_of_week)}</strong>: ${escapeHtml(h.start_time)}–${escapeHtml(h.end_time)}${h.last_verified ? ` (verified ${escapeHtml(String(h.last_verified).slice(0, 10))})` : ''}${h.source_url ? ` — <a href="${escapeHtml(h.source_url)}" target="_blank" rel="noopener">source</a>` : ''}</li>`
    ).join('');
    const deals = dealsOf(r).map(d =>
      `<li><strong>${escapeHtml(d.deal_name)}</strong> — ${escapeHtml(d.deal_type)} · HH $${Number(d.happy_hour_price ?? 0).toFixed(2)} (reg. $${Number(d.regular_price ?? 0).toFixed(2)})${d.description ? ` · ${escapeHtml(d.description)}` : ''}</li>`
    ).join('');
    detailBody.innerHTML = `
      <h2>${escapeHtml(r.name)}</h2>
      <p class="meta">${escapeHtml(r.restaurant_type || '')}${loc ? ` · ${escapeHtml(loc.address || '')}, ${escapeHtml(loc.city)}, ${escapeHtml(loc.state)} ${escapeHtml(loc.zip_code || '')}` : ''}${r.phone ? ` · ${escapeHtml(r.phone)}` : ''}</p>
      ${r.website ? `<p><a href="${escapeHtml(r.website)}" target="_blank" rel="noopener">${escapeHtml(r.website)}</a></p>` : ''}
      <h3>Happy hours</h3><ul>${hours || '<li>None listed</li>'}</ul>
      <h3>Deals</h3><ul>${deals || '<li>None listed</li>'}</ul>
    `;
    listEl.classList.add('hidden');
    detailEl.classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  }
}

searchInput.addEventListener('input', debounce(loadRestaurants, 300));
typeSelect.addEventListener('change', loadRestaurants);
cityInput.addEventListener('input', debounce(loadRestaurants, 300));
document.getElementById('refresh').addEventListener('click', loadRestaurants);
document.getElementById('back').addEventListener('click', () => {
  detailEl.classList.add('hidden');
  listEl.classList.remove('hidden');
});

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

loadRestaurants();
