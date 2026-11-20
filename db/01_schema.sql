-- Happy Hunt — database schema (Supabase / PostgreSQL)
-- Matches the live project schema. Run in order: db/01_schema.sql then db/02_seed.sql

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users: app users (auth is handled separately; this mirrors profile data)
-- ---------------------------------------------------------------------------
create table if not exists users (
    user_id       uuid primary key default gen_random_uuid(),
    name          text not null,
    email         text not null unique,
    password_hash text not null,
    created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- restaurants: venues that may offer happy hours / deals
-- ---------------------------------------------------------------------------
create table if not exists restaurants (
    restaurant_id     uuid primary key default gen_random_uuid(),
    name              text not null,
    restaurant_type   text,
    phone             text,
    website           text,
    created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- locations: physical address per restaurant (1:1)
-- ---------------------------------------------------------------------------
create table if not exists locations (
    location_id  uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null unique references restaurants(restaurant_id) on delete cascade,
    address      text not null,
    city         text not null,
    state        text not null,
    zip_code     text not null,
    latitude     numeric(9, 6),
    longitude    numeric(9, 6)
);

create index if not exists idx_locations_restaurant on locations(restaurant_id);

-- ---------------------------------------------------------------------------
-- happy_hours: recurring time windows; linked to a location (thus a restaurant)
-- ---------------------------------------------------------------------------
create table if not exists happy_hours (
    happy_hour_id  uuid primary key default gen_random_uuid(),
    location_id    uuid not null references locations(location_id) on delete cascade,
    source_url     text,
    day_of_week    text not null check (day_of_week in
                      ('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
    start_time     time not null,
    end_time       time not null check (end_time > start_time),
    active         boolean not null default true,
    last_verified  timestamptz
);

create index if not exists idx_happy_hours_location on happy_hours(location_id);

-- ---------------------------------------------------------------------------
-- deals: food/drink specials offered during a happy hour
-- ---------------------------------------------------------------------------
create table if not exists deals (
    deal_id          uuid primary key default gen_random_uuid(),
    happy_hour_id    uuid not null references happy_hours(happy_hour_id) on delete cascade,
    deal_name        text not null,
    description      text,
    deal_type        text not null check (deal_type in ('food', 'drink')),
    regular_price    numeric(10, 2) check (regular_price >= 0),
    happy_hour_price numeric(10, 2) check (happy_hour_price >= 0)
);

create index if not exists idx_deals_happy_hour on deals(happy_hour_id);

-- ---------------------------------------------------------------------------
-- saved_places: users' bookmarked restaurants
-- ---------------------------------------------------------------------------
create table if not exists saved_places (
    saved_place_id uuid primary key default gen_random_uuid(),
    user_id        uuid not null references users(user_id) on delete cascade,
    restaurant_id  uuid not null references restaurants(restaurant_id) on delete cascade,
    saved_at       timestamptz not null default now(),
    unique (user_id, restaurant_id)
);

create index if not exists idx_saved_places_user on saved_places(user_id);
