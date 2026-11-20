require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

// Server-only Supabase client — never expose the service role key to the browser.
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws }
});

const PORT = process.env.PORT || 3000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const RESTAURANT_SELECT =
  '*, locations(*, happy_hours(*, deals(*)))';

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw)).digest('hex');
}

function supabaseError(res, error, fallback = 'Database error') {
  console.error(error);
  return res.status(500).json({ error: fallback });
}

// GET /health
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Restaurants
// ---------------------------------------------------------------------------

// GET /api/restaurants?restaurant_type=&city=&q=
app.get('/api/restaurants', async (req, res) => {
  const { restaurant_type, city, q } = req.query;

  let query = supabase
    .from('restaurants')
    .select(RESTAURANT_SELECT)
    .order('name');

  if (restaurant_type) query = query.eq('restaurant_type', restaurant_type);
  if (city) query = query.eq('locations.city', city);
  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return supabaseError(res, error);
  res.status(200).json({ restaurants: data });
});

// GET /api/restaurants/:id
app.get('/api/restaurants/:id', async (req, res) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select(RESTAURANT_SELECT)
    .eq('restaurant_id', req.params.id)
    .maybeSingle();

  if (error) return supabaseError(res, error);
  if (!data) return res.status(404).json({ error: 'Restaurant not found' });
  res.status(200).json({ restaurant: data });
});

// ---------------------------------------------------------------------------
// Auth (prototype: sha256 password hash stored in users.password_hash)
// ---------------------------------------------------------------------------

// POST /api/auth/signin  { email, password }
app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'email must be a valid email address' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('user_id, name, email, password_hash')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) return supabaseError(res, error);
  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.status(200).json({
    user: { user_id: user.user_id, name: user.name, email: user.email }
  });
});

// POST /api/auth/register  { name, email, password }
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'email must be a valid email address' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const { data: existing } = await supabase
    .from('users').select('user_id').eq('email', email.toLowerCase()).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const { data, error } = await supabase
    .from('users')
    .insert({
      user_id: crypto.randomUUID(),
      name: String(name).trim(),
      email: email.toLowerCase(),
      password_hash: hashPassword(password)
    })
    .select('user_id, name, email')
    .single();

  if (error) return supabaseError(res, error);
  res.status(201).json({ user: data });
});

// ---------------------------------------------------------------------------
// Saved places
// ---------------------------------------------------------------------------

// GET /api/saved-places?user_id=
app.get('/api/saved-places', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id query param is required' });
  if (!isUuid(user_id)) return res.status(400).json({ error: 'user_id must be a valid UUID' });

  const { data, error } = await supabase
    .from('saved_places')
    .select('*, restaurants(*, locations(*))')
    .eq('user_id', user_id)
    .order('saved_at', { ascending: false });

  if (error) return supabaseError(res, error);
  res.status(200).json({ saved_places: data });
});

// POST /api/saved-places  { user_id, restaurant_id }
app.post('/api/saved-places', async (req, res) => {
  const { user_id, restaurant_id } = req.body || {};

  if (!user_id || !restaurant_id) {
    return res.status(400).json({ error: 'user_id and restaurant_id are required' });
  }
  if (!isUuid(user_id) || !isUuid(restaurant_id)) {
    return res.status(400).json({ error: 'user_id and restaurant_id must be valid UUIDs' });
  }

  const { data: user } = await supabase
    .from('users').select('user_id').eq('user_id', user_id).maybeSingle();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { data: restaurant } = await supabase
    .from('restaurants').select('restaurant_id').eq('restaurant_id', restaurant_id).maybeSingle();
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

  const { data, error } = await supabase
    .from('saved_places')
    .insert({ user_id, restaurant_id })
    .select('*, restaurants(name)')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Place already saved' });
    }
    return supabaseError(res, error);
  }

  res.status(201).json({ saved_place: data });
});

// DELETE /api/saved-places/:id?user_id=
app.delete('/api/saved-places/:id', async (req, res) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  let query = supabase
    .from('saved_places')
    .delete()
    .eq('saved_place_id', req.params.id);
  if (req.query.user_id) {
    if (!isUuid(req.query.user_id)) {
      return res.status(400).json({ error: 'user_id must be a valid UUID' });
    }
    query = query.eq('user_id', req.query.user_id);
  }

  const { data, error } = await query.select('saved_place_id');
  if (error) return supabaseError(res, error);
  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Saved place not found' });
  }
  res.status(200).json({ deleted: data[0].saved_place_id });
});

// ---------------------------------------------------------------------------
// Deal submission
// ---------------------------------------------------------------------------

// POST /api/deals
// { restaurant_id, day_of_week, start_time, end_time, source_url,
//   deal_name, description, deal_type, regular_price, happy_hour_price }
app.post('/api/deals', async (req, res) => {
  const b = req.body || {};
  const errors = {};

  if (!isUuid(b.restaurant_id)) errors.restaurant_id = 'a valid restaurant_id is required';
  if (!DAYS.includes(b.day_of_week)) errors.day_of_week = `day_of_week must be one of: ${DAYS.join(', ')}`;
  if (!b.start_time || !/^\d{2}:\d{2}(:\d{2})?$/.test(b.start_time)) {
    errors.start_time = 'start_time is required (HH:MM or HH:MM:SS)';
  }
  if (!b.end_time || !/^\d{2}:\d{2}(:\d{2})?$/.test(b.end_time)) {
    errors.end_time = 'end_time is required (HH:MM or HH:MM:SS)';
  }
  if (b.start_time && b.end_time && b.start_time >= b.end_time) {
    errors.end_time = 'end_time must be after start_time';
  }
  if (!b.source_url || !/^https?:\/\//i.test(b.source_url)) {
    errors.source_url = 'source_url is required and must be a valid http(s) URL';
  } else {
    try { new URL(b.source_url); } catch { errors.source_url = 'source_url must be a valid URL'; }
  }
  if (!b.deal_name || !String(b.deal_name).trim()) errors.deal_name = 'deal_name is required';
  if (!['food', 'drink'].includes(b.deal_type)) errors.deal_type = "deal_type must be 'food' or 'drink'";
  if (b.regular_price === undefined || b.regular_price === null || Number(b.regular_price) < 0) {
    errors.regular_price = 'regular_price is required and must be >= 0';
  }
  if (b.happy_hour_price === undefined || b.happy_hour_price === null || Number(b.happy_hour_price) < 0) {
    errors.happy_hour_price = 'happy_hour_price is required and must be >= 0';
  }
  if (Number(b.regular_price) >= 0 && Number(b.happy_hour_price) > Number(b.regular_price)) {
    errors.happy_hour_price = 'happy_hour_price must be <= regular_price';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Validation failed', fields: errors });
  }

  // Resolve restaurant → location
  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('location_id')
    .eq('restaurant_id', b.restaurant_id)
    .maybeSingle();
  if (locErr) return supabaseError(res, locErr);
  if (!location) return res.status(404).json({ error: 'Restaurant has no location' });

  // Reuse an existing matching happy hour, else create one
  const { data: existingHH } = await supabase
    .from('happy_hours')
    .select('happy_hour_id')
    .eq('location_id', location.location_id)
    .eq('day_of_week', b.day_of_week)
    .eq('start_time', b.start_time)
    .eq('end_time', b.end_time)
    .eq('active', true)
    .maybeSingle();

  let happyHourId = existingHH && existingHH.happy_hour_id;
  if (!happyHourId) {
    const { data: hh, error: hhErr } = await supabase
      .from('happy_hours')
      .insert({
        location_id: location.location_id,
        day_of_week: b.day_of_week,
        start_time: b.start_time,
        end_time: b.end_time,
        source_url: b.source_url,
        last_verified: new Date().toISOString()
      })
      .select('happy_hour_id')
      .single();
    if (hhErr) return supabaseError(res, hhErr);
    happyHourId = hh.happy_hour_id;
  }

  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .insert({
      happy_hour_id: happyHourId,
      deal_name: String(b.deal_name).trim(),
      description: b.description ? String(b.description).trim() : null,
      deal_type: b.deal_type,
      regular_price: Number(b.regular_price),
      happy_hour_price: Number(b.happy_hour_price)
    })
    .select('*')
    .single();

  if (dealErr) return supabaseError(res, dealErr);
  res.status(201).json({ deal, happy_hour_id: happyHourId });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Happy Hunt API listening on http://localhost:${PORT}`);
});
