-- Pluri base schema
-- Execute this in the Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  monthly_income numeric(12,2),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique,
  household_type text not null check (household_type in ('solo', 'couple')),
  currency_code text not null default 'BRL',
  month_start_day integer not null default 1 check (month_start_day between 1 and 28),
  app_theme text,
  logo_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  color_key text not null default 'primary' check (color_key in ('primary', 'secondary')),
  custom_color text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint household_members_household_sort_unique unique (household_id, sort_order)
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  brand text,
  last_four text,
  color_hex text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cards_household_name_unique unique (household_id, name)
);

create table if not exists public.member_card_preferences (
  id uuid primary key default gen_random_uuid(),
  household_member_id uuid not null references public.household_members(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  is_favorite boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint member_card_preferences_member_unique unique (household_member_id)
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null default 0,
  current_amount numeric(12,2) not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete restrict,
  card_id uuid references public.cards(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  description text not null,
  payment_method text not null check (payment_method in ('pix', 'cash', 'debit_card', 'credit_card', 'bank_slip', 'other')),
  occurred_on date not null,
  is_fixed boolean not null default false,
  installment_group_id uuid,
  installment_number integer not null default 1 check (installment_number >= 1),
  installment_total integer not null default 1 check (installment_total >= 1),
  notes text,
  external_ref text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_households_owner_user_id on public.households(owner_user_id);
create index if not exists idx_household_members_household_id on public.household_members(household_id);
create index if not exists idx_household_members_user_id on public.household_members(user_id);
create index if not exists idx_cards_household_id on public.cards(household_id);
create index if not exists idx_goals_household_id on public.savings_goals(household_id);
create index if not exists idx_expenses_household_id on public.expenses(household_id);
create index if not exists idx_expenses_member_id on public.expenses(member_id);
create index if not exists idx_expenses_occurred_on on public.expenses(occurred_on desc);
create index if not exists idx_expenses_installment_group_id on public.expenses(installment_group_id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_households_updated_at on public.households;
create trigger trg_households_updated_at
before update on public.households
for each row execute function public.set_updated_at();

drop trigger if exists trg_household_members_updated_at on public.household_members;
create trigger trg_household_members_updated_at
before update on public.household_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_cards_updated_at on public.cards;
create trigger trg_cards_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

drop trigger if exists trg_member_card_preferences_updated_at on public.member_card_preferences;
create trigger trg_member_card_preferences_updated_at
before update on public.member_card_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_savings_goals_updated_at on public.savings_goals;
create trigger trg_savings_goals_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

drop trigger if exists trg_expenses_updated_at on public.expenses;
create trigger trg_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, monthly_income)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    nullif(new.raw_user_meta_data->>'monthly_income', '')::numeric
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.create_household_with_members(
  p_name text,
  p_household_type text,
  p_primary_name text,
  p_secondary_name text default null,
  p_monthly_income numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Nome da casa obrigatorio';
  end if;

  if p_primary_name is null or btrim(p_primary_name) = '' then
    raise exception 'Nome principal obrigatorio';
  end if;

  if p_household_type not in ('solo', 'couple') then
    raise exception 'Tipo de casa invalido';
  end if;

  if p_household_type = 'couple' and (p_secondary_name is null or btrim(p_secondary_name) = '') then
    raise exception 'Nome da segunda pessoa obrigatorio';
  end if;

  insert into public.households (
    owner_user_id,
    name,
    household_type,
    currency_code
  )
  values (
    v_user_id,
    btrim(p_name),
    p_household_type,
    'BRL'
  )
  returning id into v_household_id;

  insert into public.household_members (
    household_id,
    user_id,
    display_name,
    role,
    color_key,
    sort_order,
    is_active
  )
  values (
    v_household_id,
    v_user_id,
    btrim(p_primary_name),
    'owner',
    'primary',
    0,
    true
  );

  if p_household_type = 'couple' then
    insert into public.household_members (
      household_id,
      user_id,
      display_name,
      role,
      color_key,
      sort_order,
      is_active
    )
    values (
      v_household_id,
      null,
      btrim(p_secondary_name),
      'member',
      'secondary',
      1,
      true
    );
  end if;

  update public.profiles
  set
    onboarding_completed = true,
    full_name = coalesce(nullif(full_name, ''), btrim(p_primary_name)),
    monthly_income = coalesce(p_monthly_income, monthly_income)
  where id = v_user_id;

  return v_household_id;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace view public.my_household_ids as
select distinct hm.household_id
from public.household_members hm
where hm.user_id = auth.uid()
  and hm.is_active = true;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.households h
    where h.id = target_household_id
      and h.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.is_active = true
  )
  or public.is_household_owner(target_household_id);
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.cards enable row level security;
alter table public.member_card_preferences enable row level security;
alter table public.savings_goals enable row level security;
alter table public.expenses enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

create policy "households_read_member"
on public.households
for select
using (public.is_household_member(id));

create policy "households_insert_owner"
on public.households
for insert
with check (owner_user_id = auth.uid());

create policy "households_update_owner"
on public.households
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "household_members_read_member"
on public.household_members
for select
using (public.is_household_member(household_id));

create policy "household_members_manage_owner"
on public.household_members
for all
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

create policy "cards_read_member"
on public.cards
for select
using (public.is_household_member(household_id));

create policy "cards_manage_member"
on public.cards
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "member_card_preferences_read_member"
on public.member_card_preferences
for select
using (
  household_member_id in (
    select id from public.household_members where public.is_household_member(household_id)
  )
);

create policy "member_card_preferences_manage_member"
on public.member_card_preferences
for all
using (
  household_member_id in (
    select id from public.household_members where public.is_household_member(household_id)
  )
)
with check (
  household_member_id in (
    select id from public.household_members where public.is_household_member(household_id)
  )
);

create policy "goals_read_member"
on public.savings_goals
for select
using (public.is_household_member(household_id));

create policy "goals_manage_member"
on public.savings_goals
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "expenses_read_member"
on public.expenses
for select
using (public.is_household_member(household_id));

create policy "expenses_manage_member"
on public.expenses
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  delete from auth.users
  where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- Example bootstrap flow after signup:
-- 1. insert into public.households (...)
-- 2. insert first member as owner
-- 3. optionally insert second member if household_type = 'couple'
-- 4. optionally insert default cards
