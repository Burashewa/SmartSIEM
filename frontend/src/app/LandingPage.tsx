import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Hero } from './components/Hero';
import { ROUTES } from './routes';
import { Features } from './components/Features';
import { HowItWorks } from './components/HowitWorks';
import { DeveloperIntegration } from './components/DeveloperIntegration';
import { Documentation } from './components/Documentation';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to={ROUTES.landing} className="flex items-center gap-2 text-white font-semibold">
            <Shield className="w-6 h-6 text-indigo-400" />
            SmartSIEM
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to={ROUTES.docs} className="text-gray-400 hover:text-white transition-colors">
              Documentation
            </Link>
            <Link
              to={ROUTES.login}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <Hero />
      <Features />
      <HowItWorks />
      <DeveloperIntegration />
      <Documentation />
      <CTA />
      <Footer />
    </div>
  );
}
