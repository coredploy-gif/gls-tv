-- Game high scores for first-party hosted HTML5 games.
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  profile_id uuid null,
  display_name text not null default 'Player',
  score integer not null check (score >= 0 and score <= 100000000),
  created_at timestamptz not null default now()
);

create index if not exists game_scores_game_score_idx
  on public.game_scores (game_id, score desc, created_at asc);

create index if not exists game_scores_user_game_idx
  on public.game_scores (user_id, game_id, score desc);

alter table public.game_scores enable row level security;

create policy "Anyone authenticated can read game scores"
  on public.game_scores
  for select
  to authenticated
  using (true);

create policy "Users insert their own game scores"
  on public.game_scores
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own game scores"
  on public.game_scores
  for delete
  to authenticated
  using (auth.uid() = user_id);
