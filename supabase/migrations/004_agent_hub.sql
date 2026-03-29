-- Add agent_id to existing tables
ALTER TABLE agent_runs ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'lead-qualification';
ALTER TABLE activity_logs ADD COLUMN agent_id TEXT;

-- Hub-level config (one row per connection)
CREATE TABLE hub_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  global_context TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- Per-agent config (one row per connection + agent)
CREATE TABLE agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  local_context TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, agent_id)
);

-- Deal Coach: cached analyses
CREATE TABLE deal_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  pipedrive_deal_id INTEGER NOT NULL,
  health_score INTEGER NOT NULL,
  signals JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  raw_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, pipedrive_deal_id)
);

-- Deal Coach: chat messages
CREATE TABLE deal_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  pipedrive_deal_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_config_connection ON agent_config(connection_id);
CREATE INDEX idx_agent_config_agent ON agent_config(connection_id, agent_id);
CREATE INDEX idx_deal_analyses_connection ON deal_analyses(connection_id);
CREATE INDEX idx_deal_analyses_deal ON deal_analyses(connection_id, pipedrive_deal_id);
CREATE INDEX idx_deal_chat_connection_deal ON deal_chat_messages(connection_id, pipedrive_deal_id);
CREATE INDEX idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX idx_activity_logs_agent ON activity_logs(agent_id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE deal_analyses;
ALTER PUBLICATION supabase_realtime ADD TABLE deal_chat_messages;

-- Updated-at triggers
CREATE TRIGGER hub_config_updated_at BEFORE UPDATE ON hub_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_config_updated_at BEFORE UPDATE ON agent_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER deal_analyses_updated_at BEFORE UPDATE ON deal_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (multi-tenant isolation)
ALTER TABLE hub_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role bypasses RLS, so server-side access works.
CREATE POLICY "Users see own hub_config" ON hub_config FOR ALL USING (true);
CREATE POLICY "Users see own agent_config" ON agent_config FOR ALL USING (true);
CREATE POLICY "Users see own deal_analyses" ON deal_analyses FOR ALL USING (true);
CREATE POLICY "Users see own deal_chat_messages" ON deal_chat_messages FOR ALL USING (true);
