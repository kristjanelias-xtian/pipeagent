interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div className="min-h-screen bg-[var(--color-page)] flex items-center justify-center p-4">
      <div className="bg-[var(--color-card)] border border-[var(--color-border-default)] rounded-xl p-8 max-w-md w-full shadow-sm text-center space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-primary-bright)] to-[var(--color-primary-dark)] flex items-center justify-center text-white text-xl font-bold">
            P
          </div>
          <span className="text-[var(--color-text-primary)] text-2xl font-bold tracking-tight">
            Agent Hub
          </span>
        </div>

        {/* Tagline */}
        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
          Sign in with Pipedrive to continue
        </p>

        {/* CTA */}
        <button
          onClick={onLogin}
          className="w-full py-3 rounded-md bg-[var(--color-primary-dark)] text-white font-semibold hover:bg-[var(--color-primary-bright)] transition-colors"
        >
          Connect Pipedrive
        </button>

        {/* Footer */}
        <p className="text-[var(--color-text-tertiary)] text-xs">
          Securely connects via Pipedrive OAuth
        </p>
      </div>
    </div>
  );
}
