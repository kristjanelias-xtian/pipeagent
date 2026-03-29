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
    <div className="h-screen flex flex-col bg-[#f5f6f7]">
      <TopBar user={user} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <main className={`flex-1 overflow-auto ${collapsed ? 'bg-[#0f1420] text-gray-100' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
