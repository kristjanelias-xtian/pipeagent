-- Identity refactor: consolidate business_profiles + hub_config + agent_config
-- into company_profile + agent_identity. All work happens in a single
-- transaction so a mid-migration failure rolls back cleanly.

BEGIN;

-- New: company profile, one row per connection
CREATE TABLE IF NOT EXISTS company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  value_proposition TEXT NOT NULL DEFAULT '',
  service_area TEXT NOT NULL DEFAULT '',
  extra_context TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- New: agent identity, one row per (connection, agent)
CREATE TABLE IF NOT EXISTS agent_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  mission TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  rulebook TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_identity_connection ON agent_identity(connection_id);
CREATE INDEX IF NOT EXISTS idx_agent_identity_agent ON agent_identity(connection_id, agent_id);

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company_profile" ON company_profile FOR ALL USING (true);
CREATE POLICY "own agent_identity" ON agent_identity FOR ALL USING (true);

CREATE TRIGGER company_profile_updated_at BEFORE UPDATE ON company_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_identity_updated_at BEFORE UPDATE ON agent_identity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Backfill company_profile from business_profiles + hub_config
INSERT INTO company_profile (connection_id, description, value_proposition, extra_context)
SELECT
  bp.connection_id,
  bp.business_description,
  bp.value_proposition,
  COALESCE(hc.global_context, '')
FROM business_profiles bp
LEFT JOIN hub_config hc ON hc.connection_id = bp.connection_id
ON CONFLICT (connection_id) DO NOTHING;

-- Backfill agent_identity for lead-qualification
INSERT INTO agent_identity (connection_id, agent_id, personality, rulebook, config)
SELECT
  bp.connection_id,
  'lead-qualification',
  bp.outreach_tone,
  COALESCE(ac.local_context, ''),
  jsonb_build_object(
    'icp_criteria', bp.icp_criteria,
    'followup_days', bp.followup_days
  )
FROM business_profiles bp
LEFT JOIN agent_config ac
  ON ac.connection_id = bp.connection_id AND ac.agent_id = 'lead-qualification'
ON CONFLICT (connection_id, agent_id) DO NOTHING;

-- Backfill agent_identity for deal-coach
INSERT INTO agent_identity (connection_id, agent_id, rulebook, config)
SELECT
  ac.connection_id,
  ac.agent_id,
  ac.local_context,
  '{}'::jsonb
FROM agent_config ac
WHERE ac.agent_id = 'deal-coach'
ON CONFLICT (connection_id, agent_id) DO NOTHING;

-- Drop the old tables
DROP TABLE IF EXISTS hub_config CASCADE;
DROP TABLE IF EXISTS agent_config CASCADE;
DROP TABLE IF EXISTS business_profiles CASCADE;

COMMIT;
