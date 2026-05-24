import { Code2, Copy, CheckCircle } from "lucide-react";

import { useState } from "react";

export function DeveloperIntegration() {
  const [copied, setCopied] = useState(false);

  const codeSnippet = `POST /api/logs
Authorization: Bearer YOUR_AGENT_API_KEY
Content-Type: application/json

{
  "timestamp": "2026-05-10T15:30:00.000Z",
  "source": "my-app",
  "event": "authentication",
  "action": "login",
  "status": "failed",
  "user": "jdoe",
  "ip": "203.0.113.42",
  "payload": { "reason": "invalid_credentials" }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="developer-integration" className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-indigo-300">Developer Experience</span>
              </div>

              <h2 className="text-4xl md:text-5xl mb-6">
                <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Simple API-First Integration
                </span>
              </h2>

              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Send security events to SmartSIEM with a simple REST API and agent API keys — any language or platform.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  </div>
                  <div>
                    <h4 className="mb-1">Agent API Keys</h4>
                    <p className="text-sm text-gray-400">Register collectors in Settings; authenticate with Bearer tokens.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                  </div>
                  <div>
                    <h4 className="mb-1">Language Agnostic</h4>
                    <p className="text-sm text-gray-400">Works with Python, Node.js, Java, Go, and more.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                  <div>
                    <h4 className="mb-1">Built-in Detection</h4>
                    <p className="text-sm text-gray-400">16 rules run automatically after each ingest.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl bg-[#1a1a24] border border-white/10 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 text-sm"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-6 text-sm overflow-x-auto">
                  <code className="text-gray-300">
                    <span className="text-pink-400">POST</span> <span className="text-cyan-400">/api/logs</span>
                    {"\n"}
                    <span className="text-purple-400">Authorization:</span> <span className="text-yellow-300">Bearer</span> <span className="text-emerald-400">API_KEY</span>
                    {"\n"}
                    <span className="text-purple-400">Content-Type:</span> <span className="text-emerald-400">application/json</span>
                    {"\n\n"}
                    <span className="text-gray-500">{"{"}</span>
                    {"\n  "}
                    <span className="text-indigo-400">"event_id"</span>: <span className="text-emerald-400">"550e8400-e29b-41d4-a716-446655440000"</span>,
                    {"\n  "}
                    <span className="text-indigo-400">"event"</span>: <span className="text-emerald-400">"authentication"</span>,
                    {"\n  "}
                    <span className="text-indigo-400">"action"</span>: <span className="text-emerald-400">"login"</span>,
                    {"\n  "}
                    <span className="text-indigo-400">"status"</span>: <span className="text-emerald-400">"failed"</span>,
                    {"\n  "}
                    <span className="text-indigo-400">"ip"</span>: <span className="text-emerald-400">"203.0.113.42"</span>
                    {"\n"}
                    <span className="text-gray-500">{"}"}</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}