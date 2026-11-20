-- Happy Hunt Level 2 — database schema (Supabase / PostgreSQL)
-- Run in order: db/01_schema.sql then db/02_seed.sql

-- Enables gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- locations: neighborhoods / areas where restaurants operate
-- ---------------------------------------------------------------------------
create table if not exists locations (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    city        text not null,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- users: app users
-- ---------------------------------------------------------------------------
create table if not exists users (
    id         uuid primary key default gen_random_uuid(),
    email      text not null unique,
    username   text not null unique,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- restaurants: venues that may offer happy hours / deals
-- ---------------------------------------------------------------------------
create table if not exists restaurants (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    description text,
    cuisine     text,
    address     text not null,
    location_id uuid not null references locations(id) on delete restrict,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- happy_hours: time windows during which deals apply
-- ---------------------------------------------------------------------------
create table if not exists happy_hours (
    id            uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    day_of_week   smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
    start_time    time not null,
    end_time      time not null check (end_time > start_time),
    source_url    text,
    last_verified date,
    created_at    timestamptz not null default now()
);

create index if not exists idx_happy_hours_restaurant on happy_hours(restaurant_id);

-- ---------------------------------------------------------------------------
-- deals: food/drink specials tied to a restaurant (optionally to a happy hour)
-- ---------------------------------------------------------------------------
create table if not exists deals (
    id             uuid primary key default gen_random_uuid(),
    restaurant_id  uuid not null references restaurants(id) on delete cascade,
    happy_hour_id  uuid references happy_hours(id) on delete set null,
    title          text not null,
    description    text,
    deal_type      text not null check (deal_type in ('food', 'drink')),
    discount_pct   integer check (discount_pct between 0 and 100),
    price          numeric(10, 2) check (price >= 0),
    created_at     timestamptz not null default now()
);

create index if not exists idx_deals_restaurant on deals(restaurant_id);

-- ---------------------------------------------------------------------------
-- saved_places: users' bookmarked restaurants
-- ---------------------------------------------------------------------------
create table if not exists saved_places (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references users(id) on delete cascade,
    restaurant_id uuid not null references restaurants(id) on delete cascade,
    created_at    timestamptz not null default now(),
    unique (user_id, restaurant_id)
);

create index if not exists idx_saved_places_user on saved_places(user_id);
