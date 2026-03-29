interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">PipeAgent</h1>
        <p className="text-gray-400 max-w-md">
          An AI agent that qualifies your Pipedrive leads using company research,
          ICP scoring, and personalized outreach drafts.
        </p>
        <button
          onClick={onLogin}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-lg font-medium transition"
        >
          Connect Pipedrive
        </button>
      </div>
    </div>
  );
}
