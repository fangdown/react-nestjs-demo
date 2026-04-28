-- 用户名展示：public.nestjs_profiles，与 auth.users.id 一对一
-- 执行一次即可（可与 fix_rls_recursion.sql 无关先后）

create table if not exists public.nestjs_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  updated_at timestamptz not null default now ()
);

alter table public.nestjs_profiles enable row level security;

drop policy if exists nestjs_profiles_select_any on public.nestjs_profiles;
drop policy if exists nestjs_profiles_insert_own on public.nestjs_profiles;
drop policy if exists nestjs_profiles_update_own on public.nestjs_profiles;

create policy nestjs_profiles_select_any on public.nestjs_profiles
for select to authenticated using (true);

create policy nestjs_profiles_insert_own on public.nestjs_profiles
for insert to authenticated with check (id = (select auth.uid ()));

create policy nestjs_profiles_update_own on public.nestjs_profiles
for update to authenticated using (id = (select auth.uid ()));

-- 注册时写入默认展示名（邮箱 @ 前缀，或 metadata）
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

-- 已有账号补一行（按需执行）
insert into public.nestjs_profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(u.email, ''), '@', 1),
    '用户'
  )
from auth.users u
where not exists (
  select 1 from public.nestjs_profiles p where p.id = u.id
);
