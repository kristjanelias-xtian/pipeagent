import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

interface HubShellProps {
  user: { api_domain?: string; pipedrive_user_id?: number } | null;
}

export function HubShell({ user }: HubShellProps) {
  const location = useLocation();
  const collapsed = location.pathname.startsWith('/agent/');

  return (
    <div className="h-screen flex flex-col bg-[var(--color-page)] text-[var(--color-text-primary)]">
      <TopBar user={user} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
