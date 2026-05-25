import { Shield, ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import Radar from "./Radar";

export function Hero() {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 bg-black">
      <div className="absolute inset-0 z-0">
        <Radar
          speed={1}
          scale={0.5}
          ringCount={10}
          spokeCount={10}
          ringThickness={0.05}
          spokeThickness={0.01}
          sweepSpeed={1}
          sweepWidth={2}
          sweepLobes={1}
          color="#9f29ff"
          backgroundColor="#000000"
          falloff={2}
          brightness={1}
          enableMouseInteraction
          mouseInfluence={0.1}
        />
      </div>
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10 pointer-events-none">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-8 backdrop-blur-sm">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Smart Security Platform</span>
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl mb-6 bg-gradient-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent">
            Real-Time Security for Modern Applications
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto">
            Detect threats instantly with a scalable event-driven security platform. Stream logs, analyze patterns, and alert automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pointer-events-auto">
            <Link
              to="/login"
              className="group px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"
            >
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/docs"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 backdrop-blur-sm transition-all duration-200 flex items-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              View Documentation
            </Link>
          </div>

          {/* <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-2 text-indigo-400">99.9%</div>
              <div className="text-sm text-gray-400">Uptime Guarantee</div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-2 text-purple-400">&lt;5s</div>
              <div className="text-sm text-gray-400">Average Detection Time</div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-3xl mb-2 text-cyan-400">10+</div>
              <div className="text-sm text-gray-400">Events Per Second</div>
            </div>
          </div> */}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
    </section>
  );
}