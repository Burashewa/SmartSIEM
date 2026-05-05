import { Shield, ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f12_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f12_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8 backdrop-blur-sm">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Enterprise-Grade Security Platform</span>
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl mb-6 bg-gradient-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent">
            Real-Time SIEM for Modern Applications
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto">
            Detect threats instantly with a scalable event-driven security platform. Stream logs, analyze patterns, and respond automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button className="group px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50">
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <Link
              to="/docs"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 backdrop-blur-sm transition-all duration-200 flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              View Documentation
            </Link>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-2 text-indigo-400">99.9%</div>
              <div className="text-sm text-gray-400">Uptime Guarantee</div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-2 text-purple-400">&lt;50ms</div>
              <div className="text-sm text-gray-400">Average Detection Time</div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-2 text-cyan-400">10M+</div>
              <div className="text-sm text-gray-400">Events Per Second</div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
    </section>
  );
}
