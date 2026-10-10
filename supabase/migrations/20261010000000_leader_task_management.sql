grant update, delete on public.tasks to authenticated;

create policy "Leaders can update tasks"
  on public.tasks for update to authenticated
  using (public.is_team_leader())
  with check (public.is_team_leader());

create policy "Leaders can delete tasks"
  on public.tasks for delete to authenticated
  using (public.is_team_leader());
