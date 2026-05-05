import { Shield, Github, Mail, FileText } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 relative">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl">SecureStream SIEM</span>
            </div>
            <p className="text-gray-400 max-w-md mb-4">
              Real-time Security Information and Event Management platform. Detect threats instantly with our scalable event-driven architecture.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
              >
                <Mail className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
              >
                <FileText className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Features</a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Security</a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Status</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Documentation</a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">API Reference</a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">GitHub</a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            © 2026 SecureStream SIEM. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
