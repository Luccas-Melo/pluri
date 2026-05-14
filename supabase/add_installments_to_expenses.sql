alter table public.expenses
add column if not exists installment_group_id uuid,
add column if not exists installment_number integer not null default 1,
add column if not exists installment_total integer not null default 1;

alter table public.expenses
drop constraint if exists expenses_installment_number_check;

alter table public.expenses
add constraint expenses_installment_number_check
check (installment_number >= 1);

alter table public.expenses
drop constraint if exists expenses_installment_total_check;

alter table public.expenses
add constraint expenses_installment_total_check
check (installment_total >= 1);

create index if not exists idx_expenses_installment_group_id
on public.expenses(installment_group_id);
