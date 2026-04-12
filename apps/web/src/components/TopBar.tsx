interface TopBarProps {
  user: { api_domain?: string; pipedrive_user_id?: number } | null;
}

export function TopBar({ user }: TopBarProps) {
  const initials = user?.api_domain
    ? user.api_domain.replace('.pipedrive.com', '').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="flex items-center justify-between h-12 px-4 bg-[var(--color-card)] border-b border-[var(--color-border-default)] flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary-bright)] to-[var(--color-primary-dark)] flex items-center justify-center text-white font-bold text-sm">
          P
        </div>
        <span className="font-semibold text-[var(--color-text-primary)]">Agent Hub</span>
      </div>
      <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
        {user?.api_domain && (
          <span className="text-xs hidden sm:inline">{user.api_domain}</span>
        )}
        <div className="w-7 h-7 rounded-full bg-[var(--color-border-default)] flex items-center justify-center text-[var(--color-text-secondary)] text-xs font-medium">
          {initials}
        </div>
      </div>
    </header>
  );
}
