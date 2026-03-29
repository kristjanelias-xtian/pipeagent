import { NavLink } from 'react-router-dom';
import { agents } from '../agents/registry';

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const width = collapsed ? 'w-[56px]' : 'w-[220px]';

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 text-sm transition-colors rounded-r-md ${
      isActive
        ? 'bg-[#1a2233] text-white border-l-2 border-[#368764]'
        : 'text-[#a8b1b8] hover:text-white hover:bg-[#1a2233]/50 border-l-2 border-transparent'
    }`;

  return (
    <aside
      className={`${width} bg-[#161d2b] border-r border-[#2a3444] flex flex-col flex-shrink-0 transition-all duration-200 overflow-hidden`}
    >
      {/* Home link */}
      <div className="pt-3 pb-1 px-2">
        <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
            />
          </svg>
          {!collapsed && <span>Home</span>}
        </NavLink>
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-[#2a3444]" />

      {/* Agent list */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6a7178]">
          {!collapsed ? 'Agents' : ''}
        </div>
        {agents.map((agent) => (
          <NavLink
            key={agent.id}
            to={`/agent/${agent.id}`}
            className={({ isActive }) => linkClass(isActive)}
            title={collapsed ? agent.name : undefined}
          >
            <span className="text-base flex-shrink-0 w-5 text-center leading-none">
              {agent.icon}
            </span>
            {!collapsed && (
              <span className="truncate">{agent.name}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-[#2a3444]" />

      {/* Build Your Own teaser */}
      <div className="px-2 pb-1">
        <NavLink
          to="/build"
          className={({ isActive }) => linkClass(isActive)}
          title={collapsed ? 'Build Your Own' : undefined}
        >
          <span className="w-5 h-5 flex-shrink-0 rounded border border-dashed border-[#6a7178] flex items-center justify-center text-[#6a7178] text-xs leading-none">
            +
          </span>
          {!collapsed && (
            <span className="text-[#6a7178]">Build Your Own</span>
          )}
        </NavLink>
      </div>

      {/* Settings */}
      <div className="px-2 pb-3">
        <NavLink
          to="/settings"
          className={({ isActive }) => linkClass(isActive)}
          title={collapsed ? 'Settings' : undefined}
        >
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
