alter table public.cards
add column if not exists credit_limit numeric(12,2),
add column if not exists closing_day integer check (closing_day between 1 and 31),
add column if not exists due_day integer check (due_day between 1 and 31);
