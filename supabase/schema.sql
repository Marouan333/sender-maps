-- Run this in your Supabase SQL editor

create table campaigns (
  id             uuid primary key default gen_random_uuid(),
  city           text not null,
  business_types text[] not null,
  timezone       text not null default 'UTC',
  status         text not null default 'active' check (status in ('active','paused','done')),
  created_at     timestamptz not null default now()
);

create table leads (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name        text not null,
  phone       text,
  address     text,
  website     text,            -- null = no website found
  status      text not null default 'pending'
                check (status in ('pending','sent','failed','skipped')),
  created_at  timestamptz not null default now()
);

-- Prevent duplicate phone entries across all campaigns
create unique index leads_phone_unique on leads(phone) where phone is not null;

create table sent_log (
  id       uuid primary key default gen_random_uuid(),
  lead_id  uuid not null references leads(id) on delete cascade,
  sent_at  timestamptz not null default now()
);

-- Indexes
create index leads_status_idx    on leads(status, campaign_id);
create index sent_log_sent_at_idx on sent_log(sent_at desc);
