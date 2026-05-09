alter table public.profiles
add column if not exists monthly_income numeric(12,2);

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
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    monthly_income = coalesce(public.profiles.monthly_income, excluded.monthly_income);

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
