import { BookOpen, Key, FileText, Shield, Bell, ArrowRight, Search } from "lucide-react";
import { Link } from "react-router-dom";

const docSections = [
  {
    icon: FileText,
    title: "Getting Started",
    description: "Quick start guide and basic concepts",
    color: "text-indigo-400"
  },
  {
    icon: Key,
    title: "Authentication (API Keys)",
    description: "Secure your API requests with bearer tokens",
    color: "text-purple-400"
  },
  {
    icon: Search,
    title: "Sending Logs",
    description: "REST API endpoints and request formats",
    color: "text-cyan-400"
  },
  {
    icon: BookOpen,
    title: "Log Format Specification",
    description: "Event schema and required fields",
    color: "text-pink-400"
  },
  {
    icon: Shield,
    title: "Detection Rules Overview",
    description: "Configure custom threat detection patterns",
    color: "text-violet-400"
  },
  {
    icon: Bell,
    title: "Alerts & Triage",
    description: "Alert lifecycle, investigations, and AI recommendations",
    color: "text-emerald-400"
  }
];

export function Documentation() {
  return (
    <section id="docs" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Developer Documentation</span>
          </div>

          <h2 className="text-4xl md:text-5xl mb-4">
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Complete Documentation
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Everything you need to integrate and customize your security monitoring
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {docSections.map((section, index) => (
            <div
              key={index}
              className="group p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex-shrink-0">
                  <section.icon className={`w-5 h-5 ${section.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1.5">{section.title}</h3>
                  <p className="text-sm text-gray-400">{section.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-purple-500/20 backdrop-blur-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl mb-4">Quick API Reference</h3>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  Ingest logs with an agent API key; use JWT access tokens for dashboard APIs. Base path: <code>/api</code>.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs">POST</div>
                    <code className="text-sm text-purple-300">/api/logs</code>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs">GET</div>
                    <code className="text-sm text-purple-300">/api/alerts</code>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 text-xs">GET</div>
                    <code className="text-sm text-purple-300">/api/dashboard/kpi</code>
                  </div>
                </div>
              </div>

              <div>
                <div className="rounded-xl bg-[#1a1a24] border border-white/10 overflow-hidden">
                  <div className="px-4 py-2 bg-white/5 border-b border-white/10">
                    <span className="text-xs text-gray-400">Request Example</span>
                  </div>
                  <pre className="p-4 text-xs overflow-x-auto">
                    <code className="text-gray-300">
                      <span className="text-purple-400">Authorization:</span> <span className="text-yellow-300">Bearer</span> <span className="text-emerald-400">YOUR_API_KEY</span>
                      {"\n\n"}
                      <span className="text-pink-400">POST</span> <span className="text-cyan-400">/api/logs</span>
                      {"\n\n"}
                      <span className="text-gray-500">{"{"}</span>
                      {"\n  "}
                      <span className="text-indigo-400">"event"</span>: <span className="text-emerald-400">"authentication"</span>,
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

            <div className="mt-8 flex justify-center">
              <Link
                to="/docs"
                className="group px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all duration-200 inline-flex items-center gap-2 shadow-lg shadow-indigo-500/30"
              >
                Read Full Documentation
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}