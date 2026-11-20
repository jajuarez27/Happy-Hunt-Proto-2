require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const path = require('path');
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

const RESTAURANT_SELECT =
  '*, locations(*, happy_hours(*, deals(*)))';

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

function supabaseError(res, error, fallback = 'Database error') {
  console.error(error);
  return res.status(500).json({ error: fallback });
}

// GET /health
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

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

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Happy Hunt API listening on http://localhost:${PORT}`);
});
