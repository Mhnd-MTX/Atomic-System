create extension if not exists pg_cron with schema pg_catalog;

create table public.team_members (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  password_hash text,
  role text not null default 'member' check (role in ('leader', 'member')),
  red_points integer not null default 0 check (red_points >= 0),
  green_points integer not null default 0 check (green_points >= 0),
  avatar text,
  created_at timestamptz not null default now()
);

create unique index team_members_name_lower_idx on public.team_members (lower(name));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  assigned_to uuid references public.team_members (id) on delete set null,
  deadline timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'submitted', 'overdue', 'completed')),
  submission_link text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index tasks_assigned_deadline_idx on public.tasks (assigned_to, deadline);
create index tasks_status_deadline_idx on public.tasks (status, deadline);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.team_members (id) on delete set null,
  member_id uuid references public.team_members (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  action text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index activity_logs_member_time_idx on public.activity_logs (member_id, created_at desc);

alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_logs enable row level security;

create or replace function public.is_team_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where id = (select auth.uid()) and role = 'leader'
  );
$$;

create policy "Authenticated teammates can view member profiles"
  on public.team_members for select to authenticated using (true);
create policy "Leaders can create tasks"
  on public.tasks for insert to authenticated with check (public.is_team_leader());
create policy "Teammates can view tasks"
  on public.tasks for select to authenticated using (true);
create policy "Teammates can view activity"
  on public.activity_logs for select to authenticated using (true);
create policy "Teammates can log their own activity"
  on public.activity_logs for insert to authenticated with check (actor_id = (select auth.uid()));

grant select on public.tasks, public.activity_logs to authenticated;
grant insert on public.tasks, public.activity_logs to authenticated;
revoke all on public.team_members from anon;
revoke all on public.tasks from anon;
revoke all on public.activity_logs from anon;
revoke all on public.team_members from authenticated;
grant select (id, name, email, role, red_points, green_points, avatar, created_at) on public.team_members to authenticated;
revoke update, delete on public.tasks from authenticated;
revoke update, delete on public.activity_logs from authenticated;

create or replace function public.check_overdue_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  with changed as (
    update public.tasks
    set status = 'overdue'
    where deadline < now()
      and status not in ('completed', 'overdue')
    returning id, title, assigned_to
  ), point_updates as (
    update public.team_members members
    set red_points = members.red_points + overdue.point_count
    from (
      select assigned_to, count(*) as point_count
      from changed
      where assigned_to is not null
      group by assigned_to
    ) overdue
    where members.id = overdue.assigned_to
  )
  insert into public.activity_logs (action, description, task_id, member_id)
  select 'task_overdue', 'Task "' || title || '" passed its deadline.', id, assigned_to
  from changed;

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

create or replace function public.submit_task(task_id uuid, submission_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.tasks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.' using errcode = '42501';
  end if;
  if submission_link is null or length(trim(submission_link)) = 0 then
    raise exception 'A submission link is required.' using errcode = '22023';
  end if;

  select * into target from public.tasks where id = task_id for update;
  if not found or target.assigned_to is distinct from auth.uid() then
    raise exception 'Task not found.' using errcode = 'P0002';
  end if;
  if target.status in ('completed', 'submitted') then
    raise exception 'This task cannot be submitted in its current state.' using errcode = '22023';
  end if;

  update public.tasks
  set submission_link = trim(submission_link),
      submitted_at = now(),
      status = case when deadline < now() then 'overdue' else 'submitted' end
  where id = task_id;

  insert into public.activity_logs (actor_id, member_id, task_id, action, description)
  values (auth.uid(), auth.uid(), task_id, 'task_submitted', 'Submitted "' || target.title || '" for review.');
end;
$$;

create or replace function public.review_task(task_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.tasks%rowtype;
  award_point boolean;
begin
  if not public.is_team_leader() then
    raise exception 'Leader access is required.' using errcode = '42501';
  end if;

  select * into target from public.tasks where id = task_id for update;
  if not found or target.status not in ('submitted', 'overdue') or target.submission_link is null then
    raise exception 'This task is not awaiting review.' using errcode = '22023';
  end if;

  award_point := approve and target.submitted_at is not null and target.submitted_at <= target.deadline;
  update public.tasks
  set status = case when approve then 'completed' when deadline < now() then 'overdue' else 'pending' end,
      completed_at = case when approve then now() else null end,
      submission_link = case when approve then submission_link else null end
  where id = task_id;

  if award_point then
    update public.team_members set green_points = green_points + 1 where id = target.assigned_to;
  end if;

  insert into public.activity_logs (actor_id, member_id, task_id, action, description)
  values (
    auth.uid(), target.assigned_to, task_id,
    case when approve and award_point then 'task_approved' when approve then 'task_approved_late' else 'task_returned' end,
    case when approve then 'Approved "' || target.title || '"' || case when award_point then ' and awarded one green point.' else '.' end
         else 'Returned "' || target.title || '" for more work.' end
  );
end;
$$;

revoke all on function public.is_team_leader() from public, anon;
revoke all on function public.check_overdue_tasks() from public, anon;
revoke all on function public.submit_task(uuid, text) from public, anon;
revoke all on function public.review_task(uuid, boolean) from public, anon;
grant execute on function public.is_team_leader() to authenticated;
grant execute on function public.check_overdue_tasks() to authenticated;
grant execute on function public.submit_task(uuid, text) to authenticated;
grant execute on function public.review_task(uuid, boolean) to authenticated;

select cron.schedule(
  'atomic-coders-overdue-check',
  '* * * * *',
  'select public.check_overdue_tasks();'
);