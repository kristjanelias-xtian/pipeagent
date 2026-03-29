interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center space-y-8 max-w-sm px-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#368764] flex items-center justify-center text-white text-xl font-bold">
            P
          </div>
          <span className="text-[#1b1f23] text-2xl font-bold tracking-tight">
            Agent Hub
          </span>
        </div>

        {/* Tagline */}
        <p className="text-[#6a7178] text-sm leading-relaxed">
          AI-powered sales agents for your Pipedrive CRM
        </p>

        {/* CTA */}
        <button
          onClick={onLogin}
          className="w-full px-6 py-3 bg-[#368764] hover:bg-[#2b6b4f] text-white rounded-lg text-sm font-medium transition-colors"
        >
          Connect with Pipedrive
        </button>

        {/* Footer */}
        <p className="text-[#a8b1b8] text-xs">
          Securely connects via Pipedrive OAuth
        </p>
      </div>
    </div>
  );
}
