export function BuildYourOwn() {
  return (
    <div className="flex items-center justify-center min-h-full p-6">
      <div className="max-w-xl w-full space-y-6 text-center">
        <div className="space-y-2">
          <div className="text-4xl mb-4">⚗️</div>
          <h1 className="text-2xl font-semibold text-[#1b1f23]">Build Your Own Agent</h1>
          <p className="text-sm text-[#6a7178] leading-relaxed">
            Describe what your agent should do in natural language
          </p>
        </div>

        <div className="text-left space-y-3">
          <textarea
            className="w-full border border-[#d5d8dc] rounded-md p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#368764]/25 resize-none"
            rows={6}
            placeholder="I want an agent that monitors my pipeline for deals that haven't been updated in 2 weeks and sends me a daily summary..."
            disabled
          />

          <button
            disabled
            className="w-full bg-[#368764] text-white font-semibold rounded-md px-4 py-2.5 text-[13px] opacity-50 cursor-not-allowed"
          >
            Create Agent — Coming Soon
          </button>
        </div>

        <p className="text-xs text-[#6a7178] leading-relaxed">
          Soon you'll be able to create custom agents using natural language. Define triggers, data sources, and actions — and let AI handle the rest.
        </p>
      </div>
    </div>
  );
}
