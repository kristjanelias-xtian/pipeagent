import { NavLink } from 'react-router-dom';
import { agents } from '../agents/registry';
import { AgentIcon, type LucideIconName } from './AgentIcon';

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const width = collapsed ? 'w-[56px]' : 'w-[220px]';

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 text-sm transition-colors rounded-r-md ${
      isActive
        ? 'bg-[#f0faf5] text-[var(--color-primary-dark)] border-l-2 border-[var(--color-primary-dark)]'
        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] border-l-2 border-transparent'
    }`;

  return (
    <aside
      className={`${width} bg-[var(--color-card)] border-r border-[var(--color-border-default)] flex flex-col flex-shrink-0 transition-all duration-200 overflow-hidden`}
    >
      {/* Home link */}
      <div className="pt-3 pb-1 px-2">
        <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
          <AgentIcon name="Home" size={18} className="flex-shrink-0" />
          {!collapsed && <span>Home</span>}
        </NavLink>
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-[var(--color-border-default)]" />

      {/* Agent list */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {!collapsed ? 'Agents' : ''}
        </div>
        {agents.map((agent) => (
          <NavLink
            key={agent.id}
            to={`/agent/${agent.id}`}
            className={({ isActive }) => linkClass(isActive)}
            title={collapsed ? agent.name : undefined}
          >
            <AgentIcon name={agent.icon as LucideIconName} size={18} className="flex-shrink-0" />
            {!collapsed && (
              <span className="truncate">{agent.name}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-[var(--color-border-default)]" />

      {/* Build Your Own teaser */}
      <div className="px-2 pb-1">
        <NavLink
          to="/build"
          className={({ isActive }) => linkClass(isActive)}
          title={collapsed ? 'Build Your Own' : undefined}
        >
          <span className="w-[18px] h-[18px] flex-shrink-0 rounded border border-dashed border-[var(--color-text-tertiary)] flex items-center justify-center text-[var(--color-text-tertiary)] text-xs leading-none">
            +
          </span>
          {!collapsed && (
            <span className="text-[var(--color-text-tertiary)]">Build Your Own</span>
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
          <AgentIcon name="Settings" size={18} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
