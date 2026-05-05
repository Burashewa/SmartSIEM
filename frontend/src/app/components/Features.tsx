import { Database, Zap, Shield, Bell, Users, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Database,
    title: "Real-time Log Ingestion",
    description: "Collect and process logs from any source with sub-second latency. Support for all major logging formats and protocols.",
    color: "text-indigo-400"
  },
  {
    icon: Zap,
    title: "Stream-based Processing",
    description: "Built on Apache Kafka for horizontal scalability. Handle millions of events per second with guaranteed delivery.",
    color: "text-purple-400"
  },
  {
    icon: Shield,
    title: "Threat Detection Engine",
    description: "Advanced pattern matching and ML-based detection. Identify brute force attacks, suspicious IPs, and anomalies in real-time.",
    color: "text-cyan-400"
  },
  {
    icon: Bell,
    title: "Automated Incident Response",
    description: "Configure custom actions for detected threats. Automatically block IPs, trigger webhooks, or alert your security team.",
    color: "text-pink-400"
  },
  {
    icon: Users,
    title: "Multi-tenant System Monitoring",
    description: "Isolate and monitor multiple applications or teams. Role-based access control and dedicated security dashboards.",
    color: "text-violet-400"
  },
  {
    icon: BarChart3,
    title: "Security Alert Dashboard",
    description: "Beautiful real-time visualizations. Track security metrics, threat trends, and system health at a glance.",
    color: "text-emerald-400"
  }
];

export function Features() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl mb-4">
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Enterprise Security Features
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Everything you need to protect your applications and respond to threats in real-time
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
