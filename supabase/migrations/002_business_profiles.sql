create table business_profiles (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  business_description text not null default '',
  value_proposition text not null default '',
  icp_criteria jsonb not null default '[]',
  outreach_tone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id)
);

-- Auto-update updated_at
create trigger set_updated_at_business_profiles
  before update on business_profiles
  for each row execute function update_updated_at();
