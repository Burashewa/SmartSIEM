import { Database, Zap, Shield, Bell, Users, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Database,
    title: "Central Security Dashboard",
    description: "Monitor logs, active alerts, threat KPIs, and system health from a unified SIEM dashboard.",
    color: "text-indigo-400"
  },
  {
    icon: Zap,
    title: "Log Ingestion & Collector Support",
    description: "Collect logs from registered agents and ingest them into SmartSIEM for centralized analysis.",
    color: "text-purple-400"
  },
  {
    icon: Shield,
    title: "Detection Rules Management",
    description: "Enable, disable, and tune detection rules to match your environment and reduce false positives.",
    color: "text-cyan-400"
  },
  {
    icon: Bell,
    title: "Alerts & Threat Triage",
    description: "Track alert status, investigate incidents, and prioritize threats with built-in triage workflows.",
    color: "text-pink-400"
  },
  {
    icon: Users,
    title: "Threat Intelligence Enrichment",
    description: "Enrich events and alerts with contextual data, IP details, and geographic analysis.",
    color: "text-violet-400"
  },
  {
    icon: BarChart3,
    title: "AI Reports & Recommendations",
    description: "Generate daily security reports and AI-assisted recommendations based on alert history.",
    color: "text-emerald-400"
  }
];

export function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl mb-4">
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              SmartSIEM Security Platform
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Visibility across logs, alerts, detection rules, investigations, and AI-powered reports.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300"
            >
              <div className="mb-4 inline-flex p-3 rounded-xl bg-white/5 border border-white/10">
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-xl mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}