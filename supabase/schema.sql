-- 共读打卡 · 多人小队 — 在 Supabase SQL Editor 中执行（练习环境）
-- 表名统一前缀 nestjs_，避免与其他应用表混淆
-- 前置：Dashboard → Authentication → Providers 启用 Email

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 小队、成员、打卡（nestjs_*）
-- ---------------------------------------------------------------------------

create table public.nestjs_squads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  book_title text not null check (char_length(trim(book_title)) > 0),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.nestjs_squad_members (
  squad_id uuid not null references public.nestjs_squads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

create table public.nestjs_check_ins (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references public.nestjs_squads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  note text,
  progress text not null default '',
  checked_in_at date not null default ((now() at time zone 'utc'))::date,
  created_at timestamptz not null default now(),
  unique (squad_id, user_id, checked_in_at)
);

create index idx_nestjs_squad_members_user on public.nestjs_squad_members (user_id);
create index idx_nestjs_check_ins_squad on public.nestjs_check_ins (squad_id, checked_in_at desc);

-- 新建小队时自动把创建者写成 owner（避免第二条 insert 时被 RLS 卡住）
create or replace function public.nestjs_on_squad_created ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nestjs_squad_members (squad_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

drop trigger if exists trg_nestjs_squad_created on public.nestjs_squads;
create trigger trg_nestjs_squad_created
after insert on public.nestjs_squads
for each row execute function public.nestjs_on_squad_created ();

-- ---------------------------------------------------------------------------
-- RPC（SECURITY DEFINER）：PostgREST 直接 insert 在部分环境下仍会触发 RLS 与 JWT 不一致；统一走 RPC 写入
-- ---------------------------------------------------------------------------

create or replace function public.nestjs_rpc_create_squad (p_name text, p_book_title text)
returns public.nestjs_squads
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid ());
  r public.nestjs_squads;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.nestjs_squads (name, book_title, created_by)
  values (trim(p_name), trim(p_book_title), uid)
  returning * into r;
  return r;
end;
$$;

create or replace function public.nestjs_rpc_join_squad (p_squad_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid ());
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.nestjs_squad_members (squad_id, user_id, role)
  values (p_squad_id, uid, 'member');
  return json_build_object('ok', true, 'alreadyMember', false);
exception
  when unique_violation then
    return json_build_object('ok', true, 'alreadyMember', true);
  when foreign_key_violation then
    raise exception 'Squad not found';
end;
$$;

create or replace function public.nestjs_rpc_create_check_in (
  p_squad_id uuid,
  p_note text,
  p_progress text,
  p_checked_in_at date default null
)
returns public.nestjs_check_ins
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid ());
  d date := coalesce(
    p_checked_in_at,
    ((now() at time zone 'utc'))::date
  );
  r public.nestjs_check_ins;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.nestjs_check_ins (squad_id, user_id, note, progress, checked_in_at)
  values (
    p_squad_id,
    uid,
    nullif(trim(coalesce(p_note, '')), ''),
    trim(coalesce(p_progress, '')),
    d
  )
  returning * into r;
  return r;
exception
  when unique_violation then
    raise exception 'duplicate_check_in';
end;
$$;

revoke all on function public.nestjs_rpc_create_squad (text, text) from public;
revoke all on function public.nestjs_rpc_join_squad (uuid) from public;
revoke all on function public.nestjs_rpc_create_check_in (uuid, text, text, date) from public;

grant execute on function public.nestjs_rpc_create_squad (text, text) to authenticated;
grant execute on function public.nestjs_rpc_join_squad (uuid) to authenticated;
grant execute on function public.nestjs_rpc_create_check_in (uuid, text, text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS 辅助函数（SECURITY DEFINER：读 nestjs_squad_members 时不再次套用 RLS，避免策略自引用导致 infinite recursion）
-- ---------------------------------------------------------------------------

create or replace function public.nestjs_uid_in_squad (_squad_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.nestjs_squad_members m
    where m.squad_id = _squad_id
      and m.user_id = (select auth.uid ())
  );
$$;

create or replace function public.nestjs_uid_is_squad_owner (_squad_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.nestjs_squad_members m
    where m.squad_id = _squad_id
      and m.user_id = (select auth.uid ())
      and m.role = 'owner'
  );
$$;

grant execute on function public.nestjs_uid_in_squad (uuid) to authenticated;
grant execute on function public.nestjs_uid_is_squad_owner (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.nestjs_squads enable row level security;
alter table public.nestjs_squad_members enable row level security;
alter table public.nestjs_check_ins enable row level security;

create policy nestjs_squads_select_member on public.nestjs_squads
for select to authenticated using (public.nestjs_uid_in_squad (id));

-- INSERT：必须限定 authenticated，并用 (select auth.uid())（Supabase 推荐，避免 WITH CHECK 判空失败）
create policy nestjs_squads_insert_creator on public.nestjs_squads
for insert to authenticated
with check (created_by = (select auth.uid ()));

create policy nestjs_squads_update_owner on public.nestjs_squads
for update to authenticated using (public.nestjs_uid_is_squad_owner (id));

-- 队员可看本小队全部成员行（通过 uid_in_squad，不再在策略里直接 select 同表）
create policy nestjs_squad_members_select_peer on public.nestjs_squad_members
for select to authenticated using (public.nestjs_uid_in_squad (squad_id));

create policy nestjs_squad_members_insert_self on public.nestjs_squad_members
for insert to authenticated
with check (user_id = (select auth.uid ()));

create policy nestjs_check_ins_select_member on public.nestjs_check_ins
for select to authenticated using (public.nestjs_uid_in_squad (squad_id));

create policy nestjs_check_ins_insert_self_member on public.nestjs_check_ins
for insert to authenticated
with check (
  user_id = (select auth.uid ())
  and public.nestjs_uid_in_squad (squad_id)
);

-- ---------------------------------------------------------------------------
-- 展示名（与 auth.users 同步，供小队 / 打卡列表显示）
-- ---------------------------------------------------------------------------

create table public.nestjs_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  updated_at timestamptz not null default now ()
);

alter table public.nestjs_profiles enable row level security;

create policy nestjs_profiles_select_any on public.nestjs_profiles
for select to authenticated using (true);

create policy nestjs_profiles_insert_own on public.nestjs_profiles
for insert to authenticated with check (id = (select auth.uid ()));

create policy nestjs_profiles_update_own on public.nestjs_profiles
for update to authenticated using (id = (select auth.uid ()));

create or replace function public.nestjs_on_auth_user_created ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nestjs_profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      '用户'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_nestjs_auth_user_created on auth.users;
create trigger trg_nestjs_auth_user_created
after insert on auth.users for each row execute function public.nestjs_on_auth_user_created ();
