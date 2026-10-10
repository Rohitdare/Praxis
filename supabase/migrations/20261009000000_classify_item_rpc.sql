-- ==============================================================================
-- Migration: 20261009000000_classify_item_rpc.sql
-- Description: Transaction-safe classification, editing, and creation RPC
-- Source of Truth: docs/implementation-plans/phase-2-item-classification-editing.md
-- ==============================================================================

create or replace function public.classify_and_update_item(
  p_item_id uuid,
  p_type text,
  p_title text default null,
  p_content text default null,
  p_status text default null,
  -- Task parameters
  p_due_at timestamptz default null,
  p_priority text default 'normal',
  p_completed_at timestamptz default null,
  -- Resource parameters
  p_url text default null,
  p_domain text default null,
  p_resource_status text default 'unread',
  -- Calendar Event parameters
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_all_day boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.items%rowtype;
  v_resource public.resources%rowtype;
  v_task public.tasks%rowtype;
  v_event public.calendar_events%rowtype;
  v_parsed_domain text := p_domain;
begin
  -- 1. Security & Authentication boundary check
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- 2. Verify item existence or enforce cross-account isolation
  select * into v_item
  from public.items
  where id = p_item_id;

  if found and v_item.user_id <> v_user_id then
    raise exception 'Item not found or permission denied' using errcode = 'P0002';
  end if;

  -- 3. Validate item type
  if p_type not in ('unclassified', 'note', 'idea', 'task', 'resource', 'event') then
    raise exception 'Invalid item type: %', p_type using errcode = '22023';
  end if;

  -- 4. Type-specific validations
  if p_type = 'resource' then
    if p_url is null or trim(p_url) = '' then
      raise exception 'URL is required for resource items' using errcode = '22023';
    end if;
    if v_parsed_domain is null and p_url is not null then
      v_parsed_domain := substring(p_url from '^https?://([^/]+)');
    end if;
  elsif p_type = 'event' then
    if p_start_at is null then
      raise exception 'start_at is required for calendar events' using errcode = '22023';
    end if;
    if p_end_at is not null and p_end_at < p_start_at then
      raise exception 'end_at must be greater than or equal to start_at' using errcode = '22023';
    end if;
  elsif p_type = 'task' then
    if p_priority not in ('low', 'normal', 'high') then
      p_priority := 'normal';
    end if;
  end if;

  -- 5. Atomic core item insert or update (preserving immutable raw_input if existing)
  if v_item.id is null then
    insert into public.items (
      id,
      user_id,
      type,
      title,
      content,
      status,
      raw_input,
      captured_at,
      created_at,
      updated_at
    )
    values (
      p_item_id,
      v_user_id,
      p_type,
      p_title,
      p_content,
      coalesce(p_status, 'active'),
      coalesce(p_title, 'New ' || p_type),
      now(),
      now(),
      now()
    )
    returning * into v_item;
  else
    update public.items
    set
      type = p_type,
      title = p_title,
      content = p_content,
      status = coalesce(p_status, status),
      updated_at = now()
    where id = p_item_id and user_id = v_user_id
    returning * into v_item;
  end if;

  -- 6. Atomically manage extension tables (upsert active extension, delete stale ones)
  if p_type = 'task' then
    insert into public.tasks (item_id, user_id, due_at, priority, completed_at, updated_at)
    values (p_item_id, v_user_id, p_due_at, coalesce(p_priority, 'normal'), p_completed_at, now())
    on conflict (item_id) do update set
      due_at = excluded.due_at,
      priority = excluded.priority,
      completed_at = excluded.completed_at,
      updated_at = now()
    returning * into v_task;

    delete from public.resources where item_id = p_item_id and user_id = v_user_id;
    delete from public.calendar_events where item_id = p_item_id and user_id = v_user_id;

  elsif p_type = 'resource' then
    insert into public.resources (item_id, user_id, url, domain, resource_status, updated_at)
    values (p_item_id, v_user_id, p_url, v_parsed_domain, coalesce(p_resource_status, 'unread'), now())
    on conflict (item_id) do update set
      url = excluded.url,
      domain = coalesce(excluded.domain, resources.domain),
      resource_status = excluded.resource_status,
      updated_at = now()
    returning * into v_resource;

    delete from public.tasks where item_id = p_item_id and user_id = v_user_id;
    delete from public.calendar_events where item_id = p_item_id and user_id = v_user_id;

  elsif p_type = 'event' then
    insert into public.calendar_events (item_id, user_id, start_at, end_at, all_day, updated_at)
    values (p_item_id, v_user_id, p_start_at, p_end_at, coalesce(p_all_day, false), now())
    on conflict (item_id) do update set
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      all_day = excluded.all_day,
      updated_at = now()
    returning * into v_event;

    delete from public.tasks where item_id = p_item_id and user_id = v_user_id;
    delete from public.resources where item_id = p_item_id and user_id = v_user_id;

  else
    -- Note, idea, or unclassified: delete all extension records
    delete from public.tasks where item_id = p_item_id and user_id = v_user_id;
    delete from public.resources where item_id = p_item_id and user_id = v_user_id;
    delete from public.calendar_events where item_id = p_item_id and user_id = v_user_id;
  end if;

  -- 7. Return composite result
  return jsonb_build_object(
    'item', to_jsonb(v_item),
    'task', case when p_type = 'task' then to_jsonb(v_task) else null end,
    'resource', case when p_type = 'resource' then to_jsonb(v_resource) else null end,
    'event', case when p_type = 'event' then to_jsonb(v_event) else null end
  );
end;
$$;

-- Grant execution to authenticated users (required for PostgREST schema cache inclusion)
grant execute on function public.classify_and_update_item(
  uuid, text, text, text, text, timestamptz, text, timestamptz, text, text, text, timestamptz, timestamptz, boolean
) to authenticated;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
