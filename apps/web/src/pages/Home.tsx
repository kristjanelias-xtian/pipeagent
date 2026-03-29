import { Link } from 'react-router-dom';
import { useConnection } from '../hooks/useConnection';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { agents } from '../agents/registry';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

const eventColors: Record<string, string> = {
  research: 'bg-blue-400',
  scoring: 'bg-amber-400',
  outreach: 'bg-purple-400',
  writeback: 'bg-green-400',
  error: 'bg-red-400',
};

function dotColor(eventType: string): string {
  for (const [key, color] of Object.entries(eventColors)) {
    if (eventType.toLowerCase().includes(key)) return color;
  }
  return 'bg-[#a8b1b8]';
}

export function Home() {
  const { connectionId, user } = useConnection();
  const activities = useRecentActivity(connectionId);

  const domain = user?.api_domain
    ?.replace('https://', '')
    ?.replace('http://', '')
    ?.replace('.pipedrive.com', '')
    ?? '';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-[#1b1f23]">
          {getGreeting()}{domain ? `, ${domain}` : ''}
        </h1>
        <p className="text-sm text-[#6a7178] mt-1">
          Your AI sales agents at a glance
        </p>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            to={`/agent/${agent.id}`}
            className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 hover:border-[#368764] transition-colors group"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl">{agent.icon}</span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  agent.status === 'active'
                    ? 'bg-green-50 text-[#368764]'
                    : 'bg-blue-50 text-blue-600'
                }`}
              >
                {agent.status === 'active' ? 'Active' : 'Simulated'}
              </span>
            </div>
            <h3 className="text-sm font-medium text-[#1b1f23] group-hover:text-[#368764] transition-colors">
              {agent.name}
            </h3>
            <p className="text-xs text-[#6a7178] mt-1 leading-relaxed">
              {agent.description}
            </p>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-[#e0e4e8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="px-4 py-3 border-b border-[#e0e4e8]">
          <h2 className="text-sm font-medium text-[#1b1f23]">
            Recent Activity
          </h2>
        </div>
        <div className="divide-y divide-[#e0e4e8]">
          {activities.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#a8b1b8]">
              No activity yet. Run an agent to see results here.
            </div>
          ) : (
            activities.slice(0, 10).map((a) => (
              <div
                key={a.id}
                className="px-4 py-2.5 flex items-center gap-3 text-sm"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(a.event_type)}`}
                />
                <span className="text-[#1b1f23] flex-1 truncate">
                  <span className="font-medium">{a.node_name}</span>
                  <span className="text-[#6a7178]">
                    {' '}&mdash; {a.event_type}
                  </span>
                </span>
                <span className="text-[#a8b1b8] text-xs flex-shrink-0">
                  {formatTime(a.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
