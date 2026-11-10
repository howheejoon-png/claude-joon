-- Mahjong Tally live sharing (applied to Supabase project yxmzafodsreliuwpjoau).
-- Each shared game is an append-only, totally ordered log of operations.
-- Every phone replays the same log through the same pure scoring engine,
-- so all phones compute identical ledgers. The game id is a long random
-- secret carried in the share link; there are no accounts.

create table public.mt_games (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{20,64}$'),
  created_at timestamptz not null default now(),
  last_op_at timestamptz not null default now()
);

create table public.mt_ops (
  seq bigint generated always as identity primary key,
  game_id text not null references public.mt_games (id) on delete cascade,
  op_id uuid not null unique,
  device_id text not null check (char_length(device_id) between 1 and 64),
  created_at timestamptz not null default now(),
  payload jsonb not null
);

create index mt_ops_game_seq on public.mt_ops (game_id, seq);

-- Tables are never exposed directly: RLS on with no policies, and no grants.
alter table public.mt_games enable row level security;
alter table public.mt_ops enable row level security;
revoke all on table public.mt_games from anon, authenticated;
revoke all on table public.mt_ops from anon, authenticated;

-- Append one operation. Idempotent per op_id, so a phone can safely retry.
create function public.mt_append_op(p_game_id text, p_op_id uuid, p_device_id text, p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq bigint;
  v_game text;
begin
  if p_game_id is null or p_game_id !~ '^[A-Za-z0-9_-]{20,64}$' then
    raise exception 'invalid game id' using errcode = '22023';
  end if;
  if p_device_id is null or char_length(p_device_id) not between 1 and 64 then
    raise exception 'invalid device id' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 2000000 then
    raise exception 'operation too large' using errcode = '54000';
  end if;

  select o.seq, o.game_id into v_seq, v_game from public.mt_ops o where o.op_id = p_op_id;
  if found then
    if v_game <> p_game_id then
      raise exception 'operation id already used' using errcode = '23505';
    end if;
    return v_seq;
  end if;

  insert into public.mt_games (id) values (p_game_id)
  on conflict (id) do update set last_op_at = now();

  if (select count(*) from public.mt_ops o where o.game_id = p_game_id) >= 20000 then
    raise exception 'game has too many operations' using errcode = '54000';
  end if;

  insert into public.mt_ops (game_id, op_id, device_id, payload)
  values (p_game_id, p_op_id, p_device_id, p_payload)
  on conflict (op_id) do nothing
  returning seq into v_seq;

  if v_seq is null then
    select o.seq into v_seq from public.mt_ops o where o.op_id = p_op_id and o.game_id = p_game_id;
  end if;
  return v_seq;
end;
$$;

-- Read operations after a sequence number, oldest first.
create function public.mt_get_ops(p_game_id text, p_after bigint default 0, p_limit integer default 500)
returns table (seq bigint, op_id uuid, device_id text, created_at timestamptz, payload jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select o.seq, o.op_id, o.device_id, o.created_at, o.payload
  from public.mt_ops o
  where o.game_id = p_game_id
    and o.seq > coalesce(p_after, 0)
  order by o.seq
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

revoke all on function public.mt_append_op(text, uuid, text, jsonb) from public;
revoke all on function public.mt_get_ops(text, bigint, integer) from public;
grant execute on function public.mt_append_op(text, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.mt_get_ops(text, bigint, integer) to anon, authenticated;
