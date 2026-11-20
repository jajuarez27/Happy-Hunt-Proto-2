-- Happy Hunt — seed data
-- Run AFTER db/01_schema.sql. Inserts 4 rows per table in FK dependency order:
-- users → restaurants → locations → happy_hours → deals → saved_places
-- (password_hash values are placeholders, not real credentials)

begin;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
insert into users (user_id, name, email, password_hash, created_at) values
    ('11111111-1111-4111-8111-111111111101', 'Alex Rivera', 'alex.rivera@example.edu', '$2b$10$examplehashalexrivera000000000000000000000000000001', '2026-09-10T18:00:00+00:00'),
    ('11111111-1111-4111-8111-111111111102', 'Jordan Kim', 'jordan.kim@example.edu', '$2b$10$examplehashjordankim000000000000000000000000000002', '2026-09-12T20:15:00+00:00'),
    ('11111111-1111-4111-8111-111111111103', 'Maya Patel', 'maya.patel@example.edu', '$2b$10$examplehashmayapatel000000000000000000000000000003', '2026-09-15T17:30:00+00:00'),
    ('11111111-1111-4111-8111-111111111104', 'Devon Brooks', 'devon.brooks@example.edu', '$2b$10$examplehashdevonbrooks000000000000000000000000000004', '2026-09-18T19:45:00+00:00');

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
insert into restaurants (restaurant_id, name, restaurant_type, phone, website, created_at) values
    ('22222222-2222-4222-8222-222222222201', 'The Copper Tap & Grill', 'Gastropub', '916-555-0141', 'https://coppertapgrill.example.com', '2026-09-01T12:00:00+00:00'),
    ('22222222-2222-4222-8222-222222222202', 'Sol & Agave Cantina', 'Mexican & Mezcal Bar', '916-555-0188', 'https://solagavecantina.example.com', '2026-09-02T12:00:00+00:00'),
    ('22222222-2222-4222-8222-222222222203', 'Noodle & Hop Kitchen', 'Izakaya & Taproom', '916-555-0192', 'https://noodleandhop.example.com', '2026-09-03T12:00:00+00:00'),
    ('22222222-2222-4222-8222-222222222204', 'Cornerstone Pizza & Ale', 'Pizza & Craft Beer', '916-555-0164', 'https://cornerstonepizza.example.com', '2026-09-04T12:00:00+00:00');

-- ---------------------------------------------------------------------------
-- locations (references restaurants)
-- ---------------------------------------------------------------------------
insert into locations (location_id, restaurant_id, address, city, state, zip_code, latitude, longitude) values
    ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', '1020 K St', 'Sacramento', 'CA', '95814', 38.579200, -121.491800),
    ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222202', '724 J St', 'Sacramento', 'CA', '95814', 38.581100, -121.495200),
    ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222203', '1905 J St', 'Sacramento', 'CA', '95811', 38.575400, -121.481200),
    ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222204', '8510 Laguna Grove Dr', 'Elk Grove', 'CA', '95757', 38.414800, -121.469300);

-- ---------------------------------------------------------------------------
-- happy_hours (references locations; end_time > start_time enforced)
-- ---------------------------------------------------------------------------
insert into happy_hours (happy_hour_id, location_id, source_url, day_of_week, start_time, end_time, active, last_verified) values
    ('44444444-4444-4444-8444-444444444401', '33333333-3333-4333-8333-333333333301', 'https://coppertapgrill.example.com/happy-hour', 'Friday', '15:00:00', '18:00:00', true, '2026-11-15T16:00:00+00:00'),
    ('44444444-4444-4444-8444-444444444402', '33333333-3333-4333-8333-333333333302', 'https://solagavecantina.example.com/specials', 'Thursday', '16:00:00', '19:00:00', true, '2026-11-16T15:30:00+00:00'),
    ('44444444-4444-4444-8444-444444444403', '33333333-3333-4333-8333-333333333303', 'https://noodleandhop.example.com/hh', 'Wednesday', '17:00:00', '19:30:00', true, '2026-11-17T18:10:00+00:00'),
    ('44444444-4444-4444-8444-444444444404', '33333333-3333-4333-8333-333333333304', 'https://cornerstonepizza.example.com/deals', 'Friday', '14:30:00', '17:30:00', true, '2026-11-18T14:45:00+00:00');

-- ---------------------------------------------------------------------------
-- deals (references happy_hours; deal_type in ('food','drink'))
-- ---------------------------------------------------------------------------
insert into deals (deal_id, happy_hour_id, deal_name, description, deal_type, regular_price, happy_hour_price) values
    ('55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444401', 'Crispy Fries & Sliders', 'Basket of seasoned fries and two mini cheeseburgers', 'food', 16.00, 9.00),
    ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444402', 'House Lime Margarita', '12 oz house margarita on the rocks with salted rim', 'drink', 13.00, 7.50),
    ('55555555-5555-4555-8555-555555555503', '44444444-4444-4444-8444-444444444403', 'Pork Gyoza (6 pc)', 'Pan-seared dumplings served with ponzu dipping sauce', 'food', 11.00, 6.50),
    ('55555555-5555-4555-8555-555555555504', '44444444-4444-4444-8444-444444444404', 'Local IPA Pint', 'Rotating California draft IPA', 'drink', 8.50, 5.00);

-- ---------------------------------------------------------------------------
-- saved_places (references users and restaurants; unique (user_id, restaurant_id))
-- ---------------------------------------------------------------------------
insert into saved_places (saved_place_id, user_id, restaurant_id, saved_at) values
    ('66666666-6666-4666-8666-666666666601', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222201', '2026-11-14T19:00:00+00:00'),
    ('66666666-6666-4666-8666-666666666602', '11111111-1111-4111-8111-111111111101', '22222222-2222-4222-8222-222222222202', '2026-11-15T12:20:00+00:00'),
    ('66666666-6666-4666-8666-666666666603', '11111111-1111-4111-8111-111111111102', '22222222-2222-4222-8222-222222222203', '2026-11-16T17:10:00+00:00'),
    ('66666666-6666-4666-8666-666666666604', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222204', '2026-11-17T11:05:00+00:00');

commit;
