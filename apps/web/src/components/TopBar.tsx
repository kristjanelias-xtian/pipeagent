interface TopBarProps {
  user: { api_domain?: string; pipedrive_user_id?: number } | null;
}

export function TopBar({ user }: TopBarProps) {
  const initials = user?.api_domain
    ? user.api_domain.replace('.pipedrive.com', '').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-[#1a2233] border-b border-[#2a3444] flex-shrink-0">
      {/* Left: Logo + brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-[#368764] flex items-center justify-center text-white text-sm font-bold">
          P
        </div>
        <span className="text-white text-sm font-semibold tracking-tight">
          Agent Hub
        </span>
      </div>

      {/* Right: Domain + avatar */}
      <div className="flex items-center gap-3">
        {user?.api_domain && (
          <span className="text-[#6a7178] text-xs hidden sm:inline">
            {user.api_domain}
          </span>
        )}
        <div className="w-7 h-7 rounded-full bg-[#2a3444] flex items-center justify-center text-[#a8b1b8] text-xs font-medium">
          {initials}
        </div>
      </div>
    </header>
  );
}
