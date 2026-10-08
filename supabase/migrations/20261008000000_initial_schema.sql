-- ==============================================================================
-- Migration: 20261008000000_initial_schema.sql
-- Description: Initial schema, indexes, triggers, and Row Level Security (RLS)
-- Source of Truth: docs/architecture.md §6
-- ==============================================================================

-- 1. Helper trigger function for updated_at timestamps
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. TBL-profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  ai_enabled boolean not null default false,
  ai_public_resources boolean not null default true,
  ai_personal_types boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile trigger on auth.users sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. TBL-items
create table public.items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null default 'unclassified'
    check (type in ('unclassified','resource','note','task','event','idea')),
  status text not null default 'inbox'
    check (status in ('inbox','active','done','archived')),
  raw_input text not null,
  title text,
  content text,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  ai_type text,
  ai_tags text[],
  ai_confidence real,
  ai_model text,
  fts tsvector generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' ||
      coalesce(content,'') || ' ' ||
      raw_input)
  ) stored
);

create trigger set_items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- 4. TBL-resources
create table public.resources (
  item_id uuid primary key references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  domain text,
  fetched_title text,
  description text,
  image_url text,
  resource_status text not null default 'unread'
    check (resource_status in ('unread','reading','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_resources_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

-- 5. TBL-tasks
create table public.tasks (
  item_id uuid primary key references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_at timestamptz,
  priority text not null default 'normal'
    check (priority in ('low','normal','high')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- 6. TBL-calendar_events
create table public.calendar_events (
  item_id uuid primary key references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- 7. TBL-tags
create table public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unique(user_id, name)
);

-- 8. TBL-item_tags
create table public.item_tags (
  item_id uuid not null references public.items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(item_id, tag_id)
);

-- 9. TBL-item_relationships
create table public.item_relationships (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.items(id) on delete cascade,
  target_id uuid not null references public.items(id) on delete cascade,
  relationship_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, source_id, target_id, relationship_type)
);

create trigger set_item_relationships_updated_at
  before update on public.item_relationships
  for each row execute function public.set_updated_at();

-- ==============================================================================
-- Indexes (architecture.md §6)
-- ==============================================================================

create index items_user_updated_idx on public.items(user_id, updated_at, id);
create index items_fts_idx on public.items using gin(fts);
create index items_user_type_idx on public.items(user_id, type);
create index items_user_status_idx on public.items(user_id, status);
create index resources_user_id_idx on public.resources(user_id);
create index tasks_user_due_idx on public.tasks(user_id, due_at);
create index calendar_events_user_start_idx on public.calendar_events(user_id, start_at);
create index item_tags_user_tag_idx on public.item_tags(user_id, tag_id);
create index item_relationships_user_source_idx on public.item_relationships(user_id, source_id);
create index item_relationships_user_target_idx on public.item_relationships(user_id, target_id);

-- ==============================================================================
-- Row Level Security (RLS) Policies (architecture.md §6)
-- Distinct policy for each table with (select auth.uid()) ownership checks
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.resources enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.item_relationships enable row level security;

-- profiles
create policy own_profiles on public.profiles
for all
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- items
create policy own_items on public.items
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- resources
create policy own_resources on public.resources
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- tasks
create policy own_tasks on public.tasks
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- calendar_events
create policy own_calendar_events on public.calendar_events
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- tags
create policy own_tags on public.tags
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- item_tags
create policy own_item_tags on public.item_tags
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- item_relationships
create policy own_item_relationships on public.item_relationships
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
