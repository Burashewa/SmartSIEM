import { Server, Cloud, Activity, AlertTriangle, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Server,
    title: "Client System Sends Logs",
    description: "Your applications send security events via REST API",
    color: "from-indigo-500 to-purple-500"
  },
  {
    icon: Cloud,
    title: "Logs Ingested via API",
    description: "Events are validated and queued for processing",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: Activity,
    title: "Kafka Streams Events",
    description: "Real-time stream processing with high throughput",
    color: "from-pink-500 to-cyan-500"
  },
  {
    icon: AlertTriangle,
    title: "Detection Engine Analyzes",
    description: "Pattern matching and threat detection algorithms run",
    color: "from-cyan-500 to-violet-500"
  },
  {
    icon: CheckCircle,
    title: "Alerts & Automated Actions",
    description: "Security team notified, malicious IPs blocked automatically",
    color: "from-violet-500 to-emerald-500"
  }
];

export function HowItWorks() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl mb-4">
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            From log ingestion to automated response in milliseconds
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            <div className="hidden md:block absolute top-20 left-0 right-0 h-px bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

            {steps.map((step, index) => (
              <div key={index} className="relative flex flex-col items-center text-center">
                <div className={`relative mb-4 w-16 h-16 rounded-full bg-gradient-to-br ${step.color} p-[2px] shadow-lg`}>
                  <div className="w-full h-full rounded-full bg-[#0f0f17] flex items-center justify-center">
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    {index + 1}
                  </div>
                </div>
                <h3 className="mb-2 px-2">{step.title}</h3>
                <p className="text-sm text-gray-400 px-2">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 p-8 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-purple-500/20 backdrop-blur-sm max-w-3xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h4 className="mb-2">Event-Driven Architecture</h4>
              <p className="text-gray-400 leading-relaxed">
                Built on Apache Kafka for guaranteed delivery and horizontal scalability. Process millions of security events per second with microsecond latency.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
