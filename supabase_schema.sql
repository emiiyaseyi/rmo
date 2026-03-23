-- DSN Resource Management System — Supabase Schema
-- Run this in your Supabase SQL Editor to set up all tables

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- STAFF TABLE
-- ─────────────────────────────────────────────
create table if not exists staff (
  id            text primary key,
  name          text not null,
  email         text unique not null,
  department    text,
  role          text default 'staff' check (role in ('staff','owner','admin')),
  "leadId"      text references staff(id) on delete set null,
  "leadName"    text,
  phone         text,
  pin           text not null,
  "first_login" boolean default true,
  suspended     boolean default false,
  photo         text,
  points        integer default 0,
  streak        integer default 0,
  badges        jsonb default '[]',
  "weekly_cap"  integer,
  "weekly_goal" integer,
  "last_login"  timestamptz,
  "createdAt"   timestamptz default now(),
  "updatedAt"   timestamptz default now()
);

-- Row Level Security: staff can only see their own record; admins see all
alter table staff enable row level security;
create policy "Staff see own record" on staff for select using (auth.uid()::text = id or exists (select 1 from staff where id = auth.uid()::text and role = 'admin'));
create policy "Admins manage staff" on staff for all using (exists (select 1 from staff where id = auth.uid()::text and role in ('admin')));

-- ─────────────────────────────────────────────
-- ENTRIES TABLE (timesheet)
-- ─────────────────────────────────────────────
create table if not exists entries (
  id              text primary key,
  "staffId"       text references staff(id) on delete cascade,
  "staffName"     text,
  "weekKey"       text not null,
  project         text not null,
  lead            text,
  description     text,
  date            date not null,
  hours           numeric(5,2) not null,
  category        text,
  status          text default 'draft' check (status in ('draft','submitted','approved','rejected','resubmitted','clarification_needed')),
  "submittedAt"   timestamptz,
  "approvedAt"    timestamptz,
  "approvedBy"    text,
  "approvedByName" text,
  "rejectedAt"    timestamptz,
  "rejectedBy"    text,
  "rejectionReason" text,
  "resubmitNote"  text,
  "correctionNote" text,
  corrected       boolean default false,
  "overriddenBy"  text,
  "overriddenAt"  timestamptz,
  "overrideNote"  text,
  "noWork"        boolean default false,
  deleted         boolean default false,
  "deletedAt"     timestamptz,
  "createdAt"     timestamptz default now(),
  "updatedAt"     timestamptz default now()
);

alter table entries enable row level security;
-- Staff see own entries; owners see their team; admins see all
create policy "Staff own entries" on entries for select using (
  "staffId" = auth.uid()::text
  or exists (select 1 from staff s where s.id = auth.uid()::text and s.role in ('owner','admin'))
);
create policy "Staff insert own" on entries for insert with check ("staffId" = auth.uid()::text or exists (select 1 from staff where id = auth.uid()::text and role = 'admin'));
create policy "Manage entries" on entries for update using ("staffId" = auth.uid()::text or exists (select 1 from staff where id = auth.uid()::text and role in ('owner','admin')));
create policy "Admin delete" on entries for delete using (exists (select 1 from staff where id = auth.uid()::text and role = 'admin'));

-- ─────────────────────────────────────────────
-- MESSAGES TABLE
-- ─────────────────────────────────────────────
create table if not exists messages (
  id            text primary key,
  "senderId"    text references staff(id) on delete set null,
  "senderName"  text,
  "recipientId" text references staff(id) on delete set null,
  "channelId"   text,
  type          text check (type in ('dm','channel')),
  text          text not null,
  read          jsonb default '[]',
  "createdAt"   timestamptz default now()
);

alter table messages enable row level security;
create policy "See own messages" on messages for select using (
  "senderId" = auth.uid()::text
  or "recipientId" = auth.uid()::text
  or type = 'channel'
);
create policy "Send messages" on messages for insert with check ("senderId" = auth.uid()::text);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────
create table if not exists notifications (
  id          text primary key,
  "userId"    text references staff(id) on delete cascade,
  message     text not null,
  type        text,
  read        boolean default false,
  "createdAt" timestamptz default now()
);

alter table notifications enable row level security;
create policy "Own notifications" on notifications for all using ("userId" = auth.uid()::text or exists (select 1 from staff where id = auth.uid()::text and role = 'admin'));

-- ─────────────────────────────────────────────
-- LEAVES TABLE
-- ─────────────────────────────────────────────
create table if not exists leaves (
  id            text primary key,
  "staffId"     text references staff(id) on delete cascade,
  "staffName"   text,
  type          text,
  "from"        date,
  "to"          date,
  reason        text,
  status        text default 'pending' check (status in ('pending','approved','rejected')),
  "approvedBy"  text,
  "approvedAt"  timestamptz,
  "rejectionReason" text,
  "createdAt"   timestamptz default now()
);

alter table leaves enable row level security;
create policy "Own leaves" on leaves for select using ("staffId" = auth.uid()::text or exists (select 1 from staff where id = auth.uid()::text and role in ('owner','admin')));
create policy "Submit leave" on leaves for insert with check ("staffId" = auth.uid()::text);
create policy "Approve leave" on leaves for update using (exists (select 1 from staff where id = auth.uid()::text and role in ('owner','admin')));

-- ─────────────────────────────────────────────
-- DELEGATIONS TABLE
-- ─────────────────────────────────────────────
create table if not exists delegations (
  id              text primary key,
  "delegatorId"   text references staff(id) on delete cascade,
  "delegatorName" text,
  "delegateeId"   text references staff(id) on delete cascade,
  "delegateeName" text,
  "from"          date,
  until           date not null,
  reason          text,
  active          boolean default true,
  "revokedAt"     timestamptz,
  "createdAt"     timestamptz default now()
);

-- ─────────────────────────────────────────────
-- REWARDS & REDEEMS
-- ─────────────────────────────────────────────
create table if not exists rewards (
  id          text primary key,
  name        text not null,
  description text,
  cost        integer not null,
  icon        text default '🎁',
  active      boolean default true,
  "createdAt" timestamptz default now()
);

create table if not exists redeems (
  id            text primary key,
  "staffId"     text references staff(id) on delete cascade,
  "staffName"   text,
  "rewardId"    text references rewards(id),
  "rewardName"  text,
  cost          integer,
  status        text default 'pending' check (status in ('pending','approved','rejected')),
  "createdAt"   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- PROJECTS & BUDGETS
-- ─────────────────────────────────────────────
create table if not exists projects (
  id          text primary key,
  name        text not null unique,
  active      boolean default true,
  budget      numeric(10,2) default 0,
  "createdAt" timestamptz default now()
);

create table if not exists budgets (
  id          text primary key default gen_random_uuid()::text,
  project     text not null unique,
  hours       numeric(10,2) not null,
  "updatedAt" timestamptz default now()
);

-- ─────────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────────
create table if not exists audit_logs (
  id          text primary key,
  action      text not null,
  detail      text,
  "userId"    text,
  "userName"  text,
  timestamp   timestamptz default now()
);

-- Only admins can read audit logs
alter table audit_logs enable row level security;
create policy "Admin audit" on audit_logs for all using (exists (select 1 from staff where id = auth.uid()::text and role = 'admin'));

-- ─────────────────────────────────────────────
-- SETTINGS (single row)
-- ─────────────────────────────────────────────
create table if not exists app_settings (
  id      integer primary key default 1,
  data    jsonb not null,
  check (id = 1)
);

-- ─────────────────────────────────────────────
-- REAL-TIME: Enable replication for live updates
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table entries;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table staff;

-- ─────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────

-- Get submission stats for a given week
create or replace function get_week_stats(week_key text)
returns table(submitted_count bigint, approved_count bigint, rejected_count bigint, total_hours numeric)
language sql as $$
  select
    count(distinct "staffId") filter (where status in ('submitted','approved','resubmitted')) as submitted_count,
    count(*) filter (where status = 'approved') as approved_count,
    count(*) filter (where status = 'rejected') as rejected_count,
    coalesce(sum(hours) filter (where status = 'approved'), 0) as total_hours
  from entries
  where "weekKey" = week_key and deleted = false;
$$;

-- Get staff leaderboard
create or replace function get_leaderboard()
returns table(id text, name text, department text, points integer, streak integer, badge_count bigint)
language sql as $$
  select id, name, department, coalesce(points,0) as points, coalesce(streak,0) as streak,
         jsonb_array_length(coalesce(badges,'[]'::jsonb)) as badge_count
  from staff
  where suspended = false
  order by points desc
  limit 30;
$$;

-- Indexes for performance
create index if not exists entries_staff_week on entries("staffId", "weekKey");
create index if not exists entries_status on entries(status) where deleted = false;
create index if not exists entries_week on entries("weekKey") where deleted = false;
create index if not exists notifications_user on notifications("userId") where read = false;
