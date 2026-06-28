-- SE7EN FIT production gym-owner management extensions.

create table if not exists public.gym_manual_members (
  member_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  phone text,
  email text,
  gender text,
  membership_plan text,
  status public.membership_status not null default 'active',
  source text not null default 'walk_in',
  payment_status text default 'none',
  join_date date not null default current_date,
  last_visit date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_classes (
  class_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  coach_name text,
  class_type text,
  start_time timestamptz,
  end_time timestamptz,
  capacity integer,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_class_bookings (
  booking_id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.gym_classes(class_id) on delete cascade,
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  manual_member_id uuid references public.gym_manual_members(member_id) on delete cascade,
  status text not null default 'booked',
  created_at timestamptz not null default now()
);

create table if not exists public.gym_reviews (
  review_id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(gym_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  manual_member_id uuid references public.gym_manual_members(member_id) on delete set null,
  reviewer_name text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  status text not null default 'published',
  source public.platform_source not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gym_manual_members_gym on public.gym_manual_members(gym_id, status);
create index if not exists idx_gym_classes_gym_start on public.gym_classes(gym_id, start_time);
create index if not exists idx_gym_reviews_gym on public.gym_reviews(gym_id, status);

drop trigger if exists trg_gym_manual_members_updated_at on public.gym_manual_members;
create trigger trg_gym_manual_members_updated_at before update on public.gym_manual_members for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_classes_updated_at on public.gym_classes;
create trigger trg_gym_classes_updated_at before update on public.gym_classes for each row execute function public.set_updated_at();

drop trigger if exists trg_gym_reviews_updated_at on public.gym_reviews;
create trigger trg_gym_reviews_updated_at before update on public.gym_reviews for each row execute function public.set_updated_at();

alter table public.gym_manual_members enable row level security;
alter table public.gym_classes enable row level security;
alter table public.gym_class_bookings enable row level security;
alter table public.gym_reviews enable row level security;
