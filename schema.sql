create table if not exists public.broadcast_state (
  id integer primary key check (id = 1),
  mode text not null default 'fireplace' check (mode in ('fireplace','special')),
  command_id text,
  updated_at timestamptz not null default now()
);
insert into public.broadcast_state (id,mode) values (1,'fireplace')
on conflict (id) do nothing;

alter table public.broadcast_state enable row level security;
drop policy if exists "Broadcast status is readable" on public.broadcast_state;
create policy "Broadcast status is readable" on public.broadcast_state
for select to anon, authenticated using (true);

grant select on public.broadcast_state to anon, authenticated;
revoke insert, update, delete on public.broadcast_state from anon, authenticated;

-- Zet daarna in Supabase: Database > Publications > supabase_realtime
-- en schakel broadcast_state in voor Postgres Changes.
