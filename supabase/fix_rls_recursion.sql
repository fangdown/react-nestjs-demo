-- 合并修复：
-- 1) infinite recursion（SECURITY DEFINER 函数）
-- 2) POST / 创建小队时报「new row violates row-level security policy for nestjs_squads」
--    常见原因：缺少 FOR INSERT 策略，或仅用 auth.uid() 未写 (select auth.uid()) / 未限定 TO authenticated
--
-- 在 Supabase SQL Editor 执行一次即可（不删表）。

drop policy if exists nestjs_squads_select_member on public.nestjs_squads;
drop policy if exists nestjs_squads_insert_creator on public.nestjs_squads;
drop policy if exists nestjs_squads_update_owner on public.nestjs_squads;

drop policy if exists nestjs_squad_members_select_peer on public.nestjs_squad_members;
drop policy if exists nestjs_squad_members_insert_self on public.nestjs_squad_members;

drop policy if exists nestjs_check_ins_select_member on public.nestjs_check_ins;
drop policy if exists nestjs_check_ins_insert_self_member on public.nestjs_check_ins;

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

create policy nestjs_squads_select_member on public.nestjs_squads
for select to authenticated using (public.nestjs_uid_in_squad (id));

create policy nestjs_squads_insert_creator on public.nestjs_squads
for insert to authenticated
with check (created_by = (select auth.uid ()));

create policy nestjs_squads_update_owner on public.nestjs_squads
for update to authenticated using (public.nestjs_uid_is_squad_owner (id));

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
-- RPC：由 Nest/PostgREST 调用，避免部分环境下直接 insert 仍被 RLS 拒绝
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
