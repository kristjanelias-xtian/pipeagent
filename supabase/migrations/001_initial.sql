-- Enable required extensions
create extension if not exists "pgcrypto";

-- Connections (Pipedrive OAuth tokens)
create table connections (
  id uuid primary key default gen_random_uuid(),
  pipedrive_user_id integer not null,
  pipedrive_company_id integer not null,
  api_domain text not null,
  access_token text not null,
  refresh_token text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipedrive_user_id, pipedrive_company_id)
);

-- Agent runs
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  lead_id text not null,
  trigger text not null check (trigger in ('webhook', 'chat', 'manual')),
  status text not null default 'running' check (status in ('running', 'paused', 'completed', 'failed')),
  graph_state jsonb,
  score integer,
  label text check (label in ('hot', 'warm', 'cold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activity logs (powers the Agent Inspector)
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  node_name text not null,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Org memory (agent research cache)
create table org_memory (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  pipedrive_org_id integer not null,
  org_name text not null,
  research_data jsonb not null default '{}',
  last_researched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, pipedrive_org_id)
);

-- Email drafts
create table email_drafts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'discarded', 'edited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_agent_runs_connection on agent_runs(connection_id);
create index idx_agent_runs_lead on agent_runs(lead_id);
create index idx_activity_logs_run on activity_logs(run_id);
create index idx_activity_logs_created on activity_logs(created_at);
create index idx_org_memory_lookup on org_memory(connection_id, pipedrive_org_id);

-- Enable realtime for activity_logs (powers live Inspector)
alter publication supabase_realtime add table activity_logs;
alter publication supabase_realtime add table agent_runs;
alter publication supabase_realtime add table email_drafts;

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger connections_updated_at before update on connections
  for each row execute function update_updated_at();
create trigger agent_runs_updated_at before update on agent_runs
  for each row execute function update_updated_at();
create trigger org_memory_updated_at before update on org_memory
  for each row execute function update_updated_at();
create trigger email_drafts_updated_at before update on email_drafts
  for each row execute function update_updated_at();
