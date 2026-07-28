import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, Send, Loader2 } from "lucide-react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResponse("");
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
      });
      setResponse(typeof result === "string" ? result : JSON.stringify(result));
    } catch (err) {
      setResponse("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal top bar */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
            <span className="font-heading font-semibold tracking-tight">Blank Canvas</span>
          </div>
        </div>
      </header>

      {/* LLM playground */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="font-heading text-4xl sm:text-5xl font-semibold tracking-tight mb-3">
              Ready to build.
            </h1>
            <p className="text-muted-foreground text-lg">
              A clean slate with LLM access wired up. Ask it anything to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask the LLM anything…"
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-14 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
              />
              <button
                type="submit"
                disabled={!prompt.trim() || loading}
                className="absolute bottom-3 right-3 w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {response && (
            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}