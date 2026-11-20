-- Q-Pass database. Paste all of this into Supabase: SQL Editor > New query > Run.
-- Safe to run again: it only creates what's missing and replaces the functions.

create table if not exists events (
  name        text primary key check (name ~ '^[A-Za-z0-9 -]{1,40}$'),
  date        text not null default '',
  venue       text not null default '',
  details     text not null default '',
  ticket_from text not null,
  ticket_to   text not null,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now()
);

create table if not exists tickets (
  event         text not null references events(name) on delete cascade,
  ticket        text not null check (ticket ~ '^\d{4}$'),
  name          text not null default '',
  info          text not null default '',
  notes         text not null default '',
  checked_in_at timestamptz,
  checked_in_by text not null default '',
  method        text not null default '' check (method in ('', 'QR', 'manual')),
  primary key (event, ticket)
);

create table if not exists log (
  id         bigint generated always as identity primary key,
  time       timestamptz not null default now(),
  event      text not null,
  ticket     text not null default '',
  result     text not null,
  staff_name text not null default '',
  staff_role text not null default '',
  method     text not null default ''
);
create index if not exists log_event_id on log (event, id desc);

-- Only the app's server (service_role key) may read or write. Browsers using the public key get nothing.
-- Newer Supabase projects don't grant table access automatically, so grant it to the server role only.
grant select, insert, update, delete on events, tickets, log to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on events, tickets, log from anon, authenticated;
alter table events  enable row level security;
alter table tickets enable row level security;
alter table log     enable row level security;

-- One atomic step: mark the ticket checked in if it's still free, and log the attempt.
-- Returns the ticket as it was BEFORE this scan, or null if the ticket doesn't exist.
create or replace function check_in(p_event text, p_ticket text, p_staff_name text, p_staff_role text, p_method text)
returns json language plpgsql security definer set search_path = public as $$
declare
  before tickets%rowtype;
  res text;
begin
  select * into before from tickets where event = p_event and ticket = p_ticket for update;
  if not found then
    res := 'not_found';
  elsif before.checked_in_at is not null then
    res := 'already_checked_in';
  else
    res := 'checked_in';
    update tickets set checked_in_at = now(), checked_in_by = p_staff_name, method = p_method
      where event = p_event and ticket = p_ticket;
  end if;
  insert into log (event, ticket, result, staff_name, staff_role, method)
    values (p_event, p_ticket, res, p_staff_name, p_staff_role, p_method);
  return case when res = 'not_found' then null else row_to_json(before) end;
end $$;

-- Everything the dashboard shows, in one round trip.
create or replace function dashboard(p_event text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total',          (select count(*) from tickets where event = p_event),
    'named',          (select count(*) from tickets where event = p_event and name <> ''),
    'namedCheckedIn', (select count(*) from tickets where event = p_event and name <> '' and checked_in_at is not null),
    'checkedIn',      (select count(*) from tickets where event = p_event and checked_in_at is not null),
    'perStaff', coalesce((
      select json_agg(json_build_object('name', checked_in_by, 'count', n) order by n desc)
      from (select checked_in_by, count(*) n from tickets
            where event = p_event and checked_in_at is not null group by checked_in_by) s), '[]'::json),
    'recent', coalesce((
      select json_agg(json_build_object(
        'time', time, 'event', event, 'ticket', ticket, 'result', result,
        'staffName', staff_name, 'staffRole', staff_role, 'method', method) order by id desc)
      from (select * from log where event = p_event order by id desc limit 30) l), '[]'::json)
  )
$$;

revoke all on function check_in(text, text, text, text, text) from public, anon, authenticated;
revoke all on function dashboard(text) from public, anon, authenticated;
grant execute on function check_in(text, text, text, text, text) to service_role;
grant execute on function dashboard(text) to service_role;
