-- Happy Hunt Level 2 — seed data
-- Run AFTER db/01_schema.sql. Inserts 4 rows per table in FK dependency order.
-- Fixed UUIDs are used so foreign keys can reference seed rows deterministically.

begin;

-- ---------------------------------------------------------------------------
-- locations (1)
-- ---------------------------------------------------------------------------
insert into locations (id, name, city) values
    ('a0000000-0000-4000-8000-000000000001', 'West Village', 'New York'),
    ('a0000000-0000-4000-8000-000000000002', 'SoHo', 'New York'),
    ('a0000000-0000-4000-8000-000000000003', 'Williamsburg', 'Brooklyn'),
    ('a0000000-0000-4000-8000-000000000004', 'Midtown East', 'New York');

-- ---------------------------------------------------------------------------
-- users (2)
-- ---------------------------------------------------------------------------
insert into users (id, email, username) values
    ('b0000000-0000-4000-8000-000000000001', 'maya@example.com', 'maya_h'),
    ('b0000000-0000-4000-8000-000000000002', 'jordan@example.com', 'jordan_eats'),
    ('b0000000-0000-4000-8000-000000000003', 'priya@example.com', 'priyafoodie'),
    ('b0000000-0000-4000-8000-000000000004', 'sam@example.com', 'sam_sips');

-- ---------------------------------------------------------------------------
-- restaurants (3) — references locations
-- ---------------------------------------------------------------------------
insert into restaurants (id, name, description, cuisine, address, location_id) values
    ('c0000000-0000-4000-8000-000000000001', 'The Rusty Anchor', 'Coastal seafood and craft cocktails', 'Seafood', '88 Bedford St', 'a0000000-0000-4000-8000-000000000001'),
    ('c0000000-0000-4000-8000-000000000002', 'Ember & Oak', 'Wood-fired small plates and natural wine', 'American', '412 Hudson St', 'a0000000-0000-4000-8000-000000000002'),
    ('c0000000-0000-4000-8000-000000000003', 'Taco Loco', 'Late-night tacos and agave cocktails', 'Mexican', '156 Bedford Ave', 'a0000000-0000-4000-8000-000000000003'),
    ('c0000000-0000-4000-8000-000000000004', 'Pasta La Vista', 'Roman-style pasta and aperitivo hour', 'Italian', '210 E 44th St', 'a0000000-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------------------
-- happy_hours (4) — references restaurants; end_time > start_time enforced
-- ---------------------------------------------------------------------------
insert into happy_hours (id, restaurant_id, day_of_week, start_time, end_time, source_url, last_verified) values
    ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 4, '16:00', '19:00', 'https://rustyanchor.example.com/happy-hour', '2026-11-01'),
    ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 3, '17:00', '20:00', 'https://emberandoak.example.com/events', '2026-11-05'),
    ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 5, '21:00', '23:30', 'https://tacoloco.example.com/deals', '2026-11-10'),
    ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 2, '15:00', '18:00', 'https://pastalavista.example.com/aperitivo', '2026-11-15');

-- ---------------------------------------------------------------------------
-- deals (5) — references restaurants and happy_hours
-- ---------------------------------------------------------------------------
insert into deals (id, restaurant_id, happy_hour_id, title, description, deal_type, discount_pct, price) values
    ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Oyster Hour', 'Half-price oysters on the half shell', 'food', 50, null),
    ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'House White Pour', '$6 glass of house white', 'drink', null, 6.00),
    ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'Smash Burger Special', 'Wood-fired smash burger with fries', 'food', 20, null),
    ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'Taco Tuesday Trio', 'Any three tacos for $12', 'food', null, 12.00),
    ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'Aperitivo Spritz', 'Classic spritz with antipasti plate', 'drink', 15, 8.00);

-- ---------------------------------------------------------------------------
-- saved_places (6) — references users and restaurants; unique (user_id, restaurant_id)
-- ---------------------------------------------------------------------------
insert into saved_places (user_id, restaurant_id) values
    ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
    ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004'),
    ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002'),
    ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003');

commit;
