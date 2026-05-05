import { ArrowRight, BookOpen, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 opacity-90" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f12_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f12_1px,transparent_1px)] bg-[size:32px_32px]" />

            <div className="relative p-12 md:p-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-6">
                <Shield className="w-8 h-8 text-white" />
              </div>

              <h2 className="text-4xl md:text-5xl mb-6 text-white">
                Start Securing Your Systems Today
              </h2>

              <p className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl mx-auto">
                Join thousands of developers protecting their applications with real-time threat detection and automated response.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button className="group px-8 py-4 bg-white text-indigo-600 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-xl hover:shadow-2xl hover:scale-105">
                  Create Account
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <Link
                  to="/docs"
                  className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 backdrop-blur-sm transition-all duration-200 flex items-center gap-2"
                >
                  <BookOpen className="w-5 h-5" />
                  View Docs
                </Link>
              </div>

              <div className="mt-10 flex items-center justify-center gap-8 text-sm text-white/80">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  Free 30-day trial
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  Cancel anytime
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
