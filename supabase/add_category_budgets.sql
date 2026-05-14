create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null default 0 check (monthly_limit >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint category_budgets_household_category_unique unique (household_id, category)
);

create index if not exists idx_category_budgets_household_id
on public.category_budgets(household_id);

drop trigger if exists trg_category_budgets_updated_at on public.category_budgets;
create trigger trg_category_budgets_updated_at
before update on public.category_budgets
for each row execute function public.set_updated_at();

alter table public.category_budgets enable row level security;

drop policy if exists "category_budgets_read_member" on public.category_budgets;
create policy "category_budgets_read_member"
on public.category_budgets
for select
using (public.is_household_member(household_id));

drop policy if exists "category_budgets_manage_member" on public.category_budgets;
create policy "category_budgets_manage_member"
on public.category_budgets
for all
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
