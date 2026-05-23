import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Search,
  Key,
  Send,
  FileText,
  Shield,
  Bell,
  Settings,
  Code2,
  Terminal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Menu,
  X,
  Home,
  ChevronRight,
  Copy,
  ExternalLink
} from "lucide-react";

const sections = [
  {
    id: "introduction",
    title: "Introduction",
    icon: Home,
    subsections: ["Overview", "Architecture", "Key Features"]
  },
  {
    id: "getting-started",
    title: "Getting Started",
    icon: BookOpen,
    subsections: ["Quick Start", "Installation", "First Steps"]
  },
  {
    id: "authentication",
    title: "Authentication",
    icon: Key,
    subsections: ["API Keys", "Token Management", "Security Best Practices"]
  },
  {
    id: "sending-logs",
    title: "Sending Logs",
    icon: Send,
    subsections: ["REST API", "Batch Upload", "Rate Limits"]
  },
  {
    id: "log-format",
    title: "Log Format",
    icon: FileText,
    subsections: ["Schema", "Required Fields", "Optional Fields", "Examples"]
  },
  {
    id: "detection-rules",
    title: "Detection Rules",
    icon: Shield,
    subsections: ["Built-in Rules", "Custom Rules", "Rule Configuration"]
  },
  {
    id: "alerts",
    title: "Alerts & Responses",
    icon: Bell,
    subsections: ["Alert Types", "Webhooks", "Automated Actions"]
  },
  {
    id: "configuration",
    title: "Configuration",
    icon: Settings,
    subsections: ["System Settings", "Thresholds", "Integrations"]
  }
];

export function DocumentationPage() {
  const [activeSection, setActiveSection] = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0f0f17] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f0f17]/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg">SecureStream SIEM</h1>
                  <p className="text-xs text-gray-400">Documentation</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                />
              </div>
              <Link
                to="/"
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside
            className={`${
              sidebarOpen ? "block" : "hidden"
            } lg:block w-64 flex-shrink-0 fixed lg:sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto bg-[#0f0f17] lg:bg-transparent z-40`}
          >
            <nav className="space-y-1">
              {sections.map((section) => (
                <div key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "hover:bg-white/5 text-gray-400"
                    }`}
                  >
                    <section.icon className="w-4 h-4" />
                    <span className="text-sm">{section.title}</span>
                  </button>
                  {activeSection === section.id && (
                    <div className="ml-11 mt-1 space-y-1">
                      {section.subsections.map((sub) => (
                        <a
                          key={sub}
                          href={`#${sub.toLowerCase().replace(/\s+/g, "-")}`}
                          className="block px-4 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {sub}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 max-w-4xl">
            <DocumentationContent
              activeSection={activeSection}
              copyCode={copyCode}
              copiedCode={copiedCode}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

function DocumentationContent({
  activeSection,
  copyCode,
  copiedCode
}: {
  activeSection: string;
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  const renderContent = () => {
    switch (activeSection) {
      case "introduction":
        return <IntroductionSection />;
      case "getting-started":
        return <GettingStartedSection copyCode={copyCode} copiedCode={copiedCode} />;
      case "authentication":
        return <AuthenticationSection copyCode={copyCode} copiedCode={copiedCode} />;
      case "sending-logs":
        return <SendingLogsSection copyCode={copyCode} copiedCode={copiedCode} />;
      case "log-format":
        return <LogFormatSection copyCode={copyCode} copiedCode={copiedCode} />;
      case "detection-rules":
        return <DetectionRulesSection />;
      case "alerts":
        return <AlertsSection copyCode={copyCode} copiedCode={copiedCode} />;
      case "configuration":
        return <ConfigurationSection />;
      default:
        return <IntroductionSection />;
    }
  };

  return <div className="prose prose-invert max-w-none">{renderContent()}</div>;
}

function IntroductionSection() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Introduction to SecureStream SIEM</h1>
        <p className="text-xl text-gray-400">
          A comprehensive guide to securing your applications with real-time threat detection
        </p>
      </div>

      <div id="overview" className="space-y-4">
        <h2 className="text-3xl">Overview</h2>
        <p className="text-gray-300 leading-relaxed">
          SecureStream SIEM is a production-ready Security Information and Event Management platform designed for
          modern cloud-native applications. It provides real-time log ingestion, stream processing, and automated
          threat detection with sub-second latency.
        </p>
        <div className="p-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <h4 className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-indigo-400" />
            What is SIEM?
          </h4>
          <p className="text-gray-300 text-sm leading-relaxed">
            Security Information and Event Management (SIEM) combines security information management (SIM) and
            security event management (SEM) to provide real-time analysis of security alerts generated by
            applications and network hardware.
          </p>
        </div>
      </div>

      <div id="architecture" className="space-y-4">
        <h2 className="text-3xl">Architecture</h2>
        <p className="text-gray-300 leading-relaxed">
          Our platform is built on a modern event-driven architecture using Apache Kafka for stream processing:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-indigo-400">Ingestion Layer</h4>
            <p className="text-sm text-gray-400">REST API endpoints with authentication and rate limiting</p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-purple-400">Stream Processing</h4>
            <p className="text-sm text-gray-400">Apache Kafka for real-time event streaming</p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-cyan-400">Detection Engine</h4>
            <p className="text-sm text-gray-400">Pattern matching and ML-based threat detection</p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-pink-400">Response System</h4>
            <p className="text-sm text-gray-400">Automated actions and webhook integrations</p>
          </div>
        </div>
      </div>

      <div id="key-features" className="space-y-4">
        <h2 className="text-3xl">Key Features</h2>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Real-time Processing:</strong> Sub-50ms detection latency for critical security events
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Scalable Architecture:</strong> Handle 10M+ events per second with horizontal scaling
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Custom Detection Rules:</strong> Define your own threat patterns and automated responses
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Multi-tenant Support:</strong> Isolated environments for different teams or applications
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

function GettingStartedSection({
  copyCode,
  copiedCode
}: {
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  const quickStartCode = `# Install the SecureStream SDK
npm install @securestream/sdk

# Or using pip for Python
pip install securestream-sdk`;

  const firstRequestCode = `import { SecureStream } from '@securestream/sdk';

const client = new SecureStream({
  apiKey: 'your_api_key_here'
});

// Send your first security event
await client.log({
  event: 'login_attempt',
  ip: '192.168.1.100',
  timestamp: new Date().toISOString(),
  metadata: {
    username: 'user@example.com',
    success: true
  }
});`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Getting Started</h1>
        <p className="text-xl text-gray-400">
          Get up and running with SecureStream in under 5 minutes
        </p>
      </div>

      <div id="quick-start" className="space-y-4">
        <h2 className="text-3xl">Quick Start</h2>
        <p className="text-gray-300 leading-relaxed">
          Follow these steps to start monitoring your application security events:
        </p>

        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              1
            </div>
            <div className="flex-1">
              <h4 className="mb-2">Create an Account</h4>
              <p className="text-gray-400 text-sm mb-3">
                Sign up at{" "}
                <a href="#" className="text-indigo-400 hover:underline">
                  app.securestream.io
                </a>{" "}
                and create your first project.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              2
            </div>
            <div className="flex-1">
              <h4 className="mb-2">Generate API Key</h4>
              <p className="text-gray-400 text-sm mb-3">
                Navigate to Settings → API Keys and generate a new key with appropriate permissions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <h4 className="mb-2">Install SDK (Optional)</h4>
              <CodeBlock code={quickStartCode} language="bash" id="quick-start-1" copyCode={copyCode} copiedCode={copiedCode} />
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              4
            </div>
            <div className="flex-1">
              <h4 className="mb-2">Send Your First Event</h4>
              <CodeBlock code={firstRequestCode} language="typescript" id="quick-start-2" copyCode={copyCode} copiedCode={copiedCode} />
            </div>
          </div>
        </div>
      </div>

      <div id="installation" className="space-y-4">
        <h2 className="text-3xl">Installation</h2>
        <p className="text-gray-300 leading-relaxed">
          SecureStream provides official SDKs for popular languages and frameworks:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              Node.js / TypeScript
            </h4>
            <code className="text-sm text-gray-400">npm install @securestream/sdk</code>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              Python
            </h4>
            <code className="text-sm text-gray-400">pip install securestream-sdk</code>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              Go
            </h4>
            <code className="text-sm text-gray-400">go get github.com/securestream/sdk-go</code>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-pink-400" />
              Java
            </h4>
            <code className="text-sm text-gray-400">com.securestream:sdk:1.0.0</code>
          </div>
        </div>
      </div>

      <div id="first-steps" className="space-y-4">
        <h2 className="text-3xl">First Steps</h2>
        <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <h4 className="flex items-center gap-2 mb-3">
            <Terminal className="w-5 h-5 text-purple-400" />
            Recommended Next Steps
          </h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-purple-400" />
              Configure authentication and secure your API keys
            </li>
            <li className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-purple-400" />
              Review the log format specification
            </li>
            <li className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-purple-400" />
              Set up custom detection rules for your use case
            </li>
            <li className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-purple-400" />
              Configure alert webhooks for your team
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function AuthenticationSection({
  copyCode,
  copiedCode
}: {
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  const curlExample = `curl -X POST https://api.securestream.io/v1/logs \\
  -H "Authorization: Bearer sk_live_abc123..." \\
  -H "Content-Type: application/json" \\
  -d '{"event": "login_attempt", "ip": "192.168.1.1"}'`;

  const envExample = `# .env file
SECURESTREAM_API_KEY=sk_live_abc123...

# Never commit this file to version control!`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Authentication</h1>
        <p className="text-xl text-gray-400">Secure your API requests with bearer token authentication</p>
      </div>

      <div id="api-keys" className="space-y-4">
        <h2 className="text-3xl">API Keys</h2>
        <p className="text-gray-300 leading-relaxed">
          SecureStream uses API keys to authenticate requests. Your API keys carry many privileges, so be sure to
          keep them secure!
        </p>

        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
          <h4 className="flex items-center gap-2 mb-3 text-red-400">
            <XCircle className="w-5 h-5" />
            Security Warning
          </h4>
          <p className="text-sm text-gray-300">
            Never expose your API keys in client-side code, public repositories, or logs. Always use environment
            variables and keep your keys confidential.
          </p>
        </div>

        <h3 className="text-2xl mt-6">Authentication Header</h3>
        <p className="text-gray-300">
          Include your API key in the <code className="px-2 py-1 rounded bg-white/10">Authorization</code> header
          with the Bearer scheme:
        </p>
        <CodeBlock code={curlExample} language="bash" id="auth-1" copyCode={copyCode} copiedCode={copiedCode} />
      </div>

      <div id="token-management" className="space-y-4">
        <h2 className="text-3xl">Token Management</h2>
        <p className="text-gray-300 leading-relaxed">Best practices for managing your API keys:</p>

        <div className="space-y-3">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">Key Types</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400">•</span>
                <div>
                  <strong className="text-gray-300">Live keys (sk_live_...):</strong> Use in production environments
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">•</span>
                <div>
                  <strong className="text-gray-300">Test keys (sk_test_...):</strong> Use for development and testing
                </div>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">Rotation Policy</h4>
            <p className="text-sm text-gray-400">
              Rotate your API keys every 90 days or immediately if you suspect they've been compromised. You can
              create multiple keys and rotate them without downtime.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">Scoped Permissions</h4>
            <p className="text-sm text-gray-400">
              Create keys with limited permissions for different use cases. For example, create a read-only key for
              monitoring dashboards.
            </p>
          </div>
        </div>
      </div>

      <div id="security-best-practices" className="space-y-4">
        <h2 className="text-3xl">Security Best Practices</h2>
        <h3 className="text-2xl">Environment Variables</h3>
        <p className="text-gray-300">Store API keys in environment variables, never hardcode them:</p>
        <CodeBlock code={envExample} language="bash" id="auth-2" copyCode={copyCode} copiedCode={copiedCode} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="p-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <h4 className="flex items-center gap-2 mb-3 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              Do
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Use environment variables</li>
              <li>• Rotate keys regularly</li>
              <li>• Use test keys in development</li>
              <li>• Monitor key usage</li>
            </ul>
          </div>
          <div className="p-5 rounded-lg bg-red-500/10 border border-red-500/20">
            <h4 className="flex items-center gap-2 mb-3 text-red-400">
              <XCircle className="w-5 h-5" />
              Don't
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Commit keys to git</li>
              <li>• Use live keys in client code</li>
              <li>• Share keys between projects</li>
              <li>• Log API keys</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SendingLogsSection({
  copyCode,
  copiedCode
}: {
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  const restApiExample = `POST https://collector.smartsiem.local/ingest
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-05-10T15:30:00.000Z",
  "source": "smartsiem-agent",
  "severity": "high",
  "event": "authentication",
  "action": "login",
  "status": "failed",
  "user": "jdoe",
  "role": "analyst",
  "ip": "203.0.113.42",
  "deviceId": "device-abc-001",
  "sessionId": "sess-7f3c9a2b",
  "endpoint": "/api/v1/auth/login",
  "method": "POST",
  "resource": "/accounts/self",
  "payload": {
    "reason": "invalid_credentials",
    "attempt": 3,
    "mfa": false
  },
  "metadata": {
    "tenant": "acme",
    "region": "us-east-1"
  },
  "message": "Primary human-readable log line for storage and UI."
}`;

  const authNote = `agentId and userId are resolved from Authorization: Bearer <agent-api-key>
by upstream auth middleware and injected server-side.
Do not include agentId/userId in request body payloads.`;

  const batchExample = `POST https://collector.smartsiem.local/ingest
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

[
  {
    "event_id": "550e8400-e29b-41d4-a716-446655440001",
    "timestamp": "2026-05-10T15:31:00.000Z",
    "source": "smartsiem-agent",
    "event": "authentication",
    "action": "login",
    "status": "failed",
    "user": "jdoe",
    "ip": "203.0.113.42",
    "deviceId": "device-abc-001"
  },
  {
    "event_id": "550e8400-e29b-41d4-a716-446655440002",
    "timestamp": "2026-05-10T15:32:00.000Z",
    "source": "smartsiem-agent",
    "event": "authentication",
    "action": "login",
    "status": "success",
    "user": "jdoe",
    "ip": "203.0.113.42",
    "deviceId": "device-abc-001"
  }
]`;

  const sdkExample = `import { SecureStream } from '@securestream/sdk';

const client = new SecureStream({
  apiKey: process.env.SECURESTREAM_API_KEY
});

// Single event
await client.log({
  event: 'api_access',
  ip: req.ip,
  timestamp: new Date().toISOString(),
  metadata: {
    endpoint: '/api/users',
    method: 'GET'
  }
});

// Batch upload
await client.logBatch([
  { event: 'login_attempt', ip: '192.168.1.1' },
  { event: 'data_export', ip: '192.168.1.2' }
]);`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Sending Logs</h1>
        <p className="text-xl text-gray-400">Learn how to send security events to SecureStream</p>
      </div>

      <div id="rest-api" className="space-y-4">
        <h2 className="text-3xl">REST API</h2>
        <p className="text-gray-300 leading-relaxed">
          The primary method for sending logs is via our REST API endpoint:
        </p>

        <div className="p-5 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs">POST</div>
            <code className="text-sm">/ingest</code>
          </div>
          <p className="text-sm text-gray-400">Send one event object or an array of event objects</p>
        </div>

        <h3 className="text-2xl">Example Request</h3>
        <CodeBlock code={restApiExample} language="http" id="logs-1" copyCode={copyCode} copiedCode={copiedCode} />
        <CodeBlock code={authNote} language="text" id="logs-auth-note" copyCode={copyCode} copiedCode={copiedCode} />

        <div className="p-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <h4 className="mb-3">Response (202 Accepted)</h4>
          <pre className="text-sm text-gray-300">
            <code>
              {`{
  "status": "accepted",
  "timestamp": "2026-05-04T10:30:00.123Z"
}`}
            </code>
          </pre>
        </div>
      </div>

      <div id="batch-upload" className="space-y-4">
        <h2 className="text-3xl">Batch Upload</h2>
        <p className="text-gray-300 leading-relaxed">
          For high-volume scenarios, send a JSON array to the same endpoint:
        </p>

        <div className="p-5 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs">POST</div>
            <code className="text-sm">/ingest</code>
          </div>
          <p className="text-sm text-gray-400">Send up to 1,000 event objects in one array</p>
        </div>

        <CodeBlock code={batchExample} language="json" id="logs-2" copyCode={copyCode} copiedCode={copiedCode} />

        <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <h4 className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-purple-400" />
            Batch Limits
          </h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• Maximum 1,000 events per batch request</li>
            <li>• Maximum 5MB request payload size</li>
            <li>• Events must be chronologically ordered</li>
          </ul>
        </div>
      </div>

      <div id="rate-limits" className="space-y-4">
        <h2 className="text-3xl">Rate Limits</h2>
        <p className="text-gray-300 leading-relaxed">
          SecureStream enforces rate limits to ensure fair usage and system stability:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-indigo-400">Free Tier</h4>
            <div className="text-2xl mb-1">1,000</div>
            <p className="text-sm text-gray-400">events/minute</p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-purple-400">Pro Tier</h4>
            <div className="text-2xl mb-1">10,000</div>
            <p className="text-sm text-gray-400">events/minute</p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-cyan-400">Enterprise</h4>
            <div className="text-2xl mb-1">Custom</div>
            <p className="text-sm text-gray-400">unlimited capacity</p>
          </div>
        </div>

        <h3 className="text-2xl mt-6">SDK Usage</h3>
        <p className="text-gray-300">Using our official SDKs automatically handles rate limiting and retries:</p>
        <CodeBlock code={sdkExample} language="typescript" id="logs-3" copyCode={copyCode} copiedCode={copiedCode} />
      </div>
    </div>
  );
}

function LogFormatSection({
  copyCode,
  copiedCode
}: {
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  const schemaExample = `{
  "event_id": "string (uuid)",
  "timestamp": "string (ISO-8601)",
  "source": "string",
  "severity": "low|medium|high|critical",
  "event": "string",
  "action": "string",
  "status": "failed|success|...",
  "user": "string",
  "role": "string",
  "ip": "string",
  "deviceId": "string",
  "sessionId": "string",
  "endpoint": "string",
  "method": "string",
  "resource": "string",
  "payload": {},
  "userAgent": "string",
  "latitude": 0.0,
  "longitude": 0.0,
  "lat": "string",
  "lon": "string",
  "tags": ["string"],
  "metadata": {},
  "raw": {},
  "message": "string",
  "log": "string",
  "line": "string",
  "rawLine": "string"
}`;

  const examplesCode = `// Login failure
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-05-10T15:30:00.000Z",
  "source": "smartsiem-agent",
  "event": "authentication",
  "action": "login",
  "status": "failed",
  "user": "jdoe",
  "ip": "203.0.113.42",
  "deviceId": "device-abc-001",
  "metadata": {
    "tenant": "acme"
  }
}

// Brute force indicator
{
  "event_id": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2026-05-10T15:31:00.000Z",
  "source": "smartsiem-agent",
  "event": "authentication",
  "action": "login",
  "status": "failed",
  "user": "jdoe",
  "ip": "203.0.113.42",
  "deviceId": "device-abc-001",
  "severity": "critical",
  "payload": {
    "reason": "invalid_credentials",
    "attempt": 5
  }
}

// Successful login
{
  "event_id": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2026-05-10T15:32:00.000Z",
  "source": "smartsiem-agent",
  "event": "authentication",
  "action": "login",
  "status": "success",
  "user": "jdoe",
  "ip": "203.0.113.42",
  "deviceId": "device-abc-001"
}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Log Format Specification</h1>
        <p className="text-xl text-gray-400">Understand the event schema and required fields</p>
      </div>

      <div id="schema" className="space-y-4">
        <h2 className="text-3xl">Schema</h2>
        <p className="text-gray-300 leading-relaxed">
          All security events must follow this JSON schema:
        </p>
        <CodeBlock code={schemaExample} language="json" id="format-1" copyCode={copyCode} copiedCode={copiedCode} />
      </div>

      <div id="required-fields" className="space-y-4">
        <h2 className="text-3xl">Required Fields</h2>
        <div className="space-y-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">
              <code className="text-indigo-400">event</code> (string)
            </h4>
            <p className="text-sm text-gray-400 mb-3">
              A descriptive identifier for the event type. Use snake_case naming convention.
            </p>
            <div className="text-xs text-gray-500">
              Examples: <code>login_failed</code>, <code>api_rate_limit_exceeded</code>, <code>unauthorized_access</code>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">
              <code className="text-purple-400">ip</code> (string)
            </h4>
            <p className="text-sm text-gray-400 mb-3">
              The source IP address of the event. Supports both IPv4 and IPv6 formats.
            </p>
            <div className="text-xs text-gray-500">
              Examples: <code>192.168.1.1</code>, <code>2001:0db8:85a3:0000:0000:8a2e:0370:7334</code>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">
              <code className="text-cyan-400">timestamp</code> (string)
            </h4>
            <p className="text-sm text-gray-400 mb-3">
              ISO-8601 formatted timestamp indicating when the event occurred.
            </p>
            <div className="text-xs text-gray-500">
              Format: <code>YYYY-MM-DDTHH:mm:ss.sssZ</code>
            </div>
          </div>
        </div>
      </div>

      <div id="optional-fields" className="space-y-4">
        <h2 className="text-3xl">Optional Fields</h2>
        <div className="space-y-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">
              <code className="text-pink-400">severity</code> (string)
            </h4>
            <p className="text-sm text-gray-400 mb-3">Event severity level for prioritization.</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs">low</span>
              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs">medium</span>
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">high</span>
              <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">critical</span>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">
              <code className="text-violet-400">metadata</code> (object)
            </h4>
            <p className="text-sm text-gray-400">
              Additional context-specific data. Accepts any valid JSON object with string keys.
            </p>
          </div>
        </div>
      </div>

      <div id="examples" className="space-y-4">
        <h2 className="text-3xl">Examples</h2>
        <p className="text-gray-300 leading-relaxed">Common security event examples:</p>
        <CodeBlock code={examplesCode} language="json" id="format-2" copyCode={copyCode} copiedCode={copiedCode} />
      </div>
    </div>
  );
}

function DetectionRulesSection() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Detection Rules</h1>
        <p className="text-xl text-gray-400">Configure automated threat detection patterns</p>
      </div>

      <div id="built-in-rules" className="space-y-4">
        <h2 className="text-3xl">Built-in Rules</h2>
        <p className="text-gray-300 leading-relaxed">
          SecureStream includes pre-configured detection rules for common security threats:
        </p>

        <div className="space-y-3">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-indigo-400">Brute Force Detection</h4>
              <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">Critical</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Detects multiple failed login attempts from the same IP address within a short time window.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500">Threshold:</span> <span className="text-gray-300">5 failures / 5 minutes</span>
              </div>
              <div>
                <span className="text-gray-500">Action:</span> <span className="text-gray-300">Block IP + Alert</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-purple-400">Impossible Travel</h4>
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">High</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Identifies user logins from geographically distant locations within an impossible timeframe.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500">Threshold:</span> <span className="text-gray-300">&gt;500km / 1 hour</span>
              </div>
              <div>
                <span className="text-gray-500">Action:</span> <span className="text-gray-300">Alert + Require MFA</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-cyan-400">Suspicious IP Activity</h4>
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">High</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Monitors for traffic from known malicious IP addresses using threat intelligence feeds.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500">Source:</span> <span className="text-gray-300">Threat Intel Feeds</span>
              </div>
              <div>
                <span className="text-gray-500">Action:</span> <span className="text-gray-300">Block + Alert</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-pink-400">Data Exfiltration</h4>
              <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">Critical</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Detects unusual data transfer volumes that may indicate data theft.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500">Threshold:</span> <span className="text-gray-300">&gt;1GB / hour</span>
              </div>
              <div>
                <span className="text-gray-500">Action:</span> <span className="text-gray-300">Alert + Session Review</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="custom-rules" className="space-y-4">
        <h2 className="text-3xl">Custom Rules</h2>
        <p className="text-gray-300 leading-relaxed">
          Create custom detection rules tailored to your application's specific security requirements:
        </p>

        <div className="p-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <h4 className="mb-4">Rule Configuration Options</h4>
          <div className="space-y-4">
            <div>
              <h5 className="text-sm mb-2 text-indigo-400">Pattern Matching</h5>
              <p className="text-sm text-gray-400">
                Define event patterns using SQL-like queries or regular expressions
              </p>
            </div>
            <div>
              <h5 className="text-sm mb-2 text-purple-400">Time Windows</h5>
              <p className="text-sm text-gray-400">
                Set sliding time windows (e.g., 5 minutes, 1 hour, 24 hours)
              </p>
            </div>
            <div>
              <h5 className="text-sm mb-2 text-cyan-400">Aggregation Rules</h5>
              <p className="text-sm text-gray-400">
                Count, sum, or average events based on specific fields
              </p>
            </div>
            <div>
              <h5 className="text-sm mb-2 text-pink-400">Condition Logic</h5>
              <p className="text-sm text-gray-400">
                Combine multiple conditions with AND/OR operators
              </p>
            </div>
          </div>
        </div>
      </div>

      <div id="rule-configuration" className="space-y-4">
        <h2 className="text-3xl">Rule Configuration</h2>
        <p className="text-gray-300 leading-relaxed">
          Access the Rules Dashboard to enable, disable, or customize detection rules:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <CheckCircle className="w-6 h-6 text-emerald-400 mb-3" />
            <h4 className="mb-2">Enable/Disable Rules</h4>
            <p className="text-sm text-gray-400">
              Toggle rules on or off based on your security needs
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <Settings className="w-6 h-6 text-purple-400 mb-3" />
            <h4 className="mb-2">Adjust Thresholds</h4>
            <p className="text-sm text-gray-400">
              Fine-tune detection sensitivity to reduce false positives
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <Bell className="w-6 h-6 text-cyan-400 mb-3" />
            <h4 className="mb-2">Configure Actions</h4>
            <p className="text-sm text-gray-400">
              Define what happens when a rule is triggered
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <Code2 className="w-6 h-6 text-pink-400 mb-3" />
            <h4 className="mb-2">Test Rules</h4>
            <p className="text-sm text-gray-400">
              Validate rules with historical data before deploying
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertsSection({
  copyCode,
  copiedCode
}: {
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  const webhookExample = `POST https://your-server.com/webhook
Content-Type: application/json

{
  "alert_id": "alt_abc123",
  "rule_name": "Brute Force Detection",
  "severity": "critical",
  "triggered_at": "2026-05-04T10:30:00Z",
  "event": {
    "ip": "203.0.113.0",
    "failed_attempts": 10,
    "time_window": "5m"
  },
  "recommended_action": "block_ip"
}`;

  const webhookSetup = `// Express.js webhook endpoint
app.post('/securestream-webhook', (req, res) => {
  const alert = req.body;

  console.log(\`Alert: \${alert.rule_name}\`);
  console.log(\`Severity: \${alert.severity}\`);

  // Send to Slack, PagerDuty, etc.
  if (alert.severity === 'critical') {
    notifySecurityTeam(alert);
  }

  res.status(200).send('OK');
});`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Alerts & Response System</h1>
        <p className="text-xl text-gray-400">Configure automated responses and notifications</p>
      </div>

      <div id="alert-types" className="space-y-4">
        <h2 className="text-3xl">Alert Types</h2>
        <p className="text-gray-300 leading-relaxed">
          SecureStream supports multiple alert delivery methods:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-400" />
              Email Alerts
            </h4>
            <p className="text-sm text-gray-400">
              Receive notifications via email with detailed event information
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-purple-400" />
              Webhook Integration
            </h4>
            <p className="text-sm text-gray-400">
              Send alerts to custom endpoints for integration with your systems
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-400" />
              Slack/Teams
            </h4>
            <p className="text-sm text-gray-400">
              Post alerts directly to your team collaboration tools
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-pink-400" />
              PagerDuty
            </h4>
            <p className="text-sm text-gray-400">
              Trigger incidents in your on-call management system
            </p>
          </div>
        </div>
      </div>

      <div id="webhooks" className="space-y-4">
        <h2 className="text-3xl">Webhooks</h2>
        <p className="text-gray-300 leading-relaxed">
          Configure webhook endpoints to receive real-time alerts:
        </p>

        <h3 className="text-2xl mt-6">Webhook Payload</h3>
        <CodeBlock code={webhookExample} language="json" id="alerts-1" copyCode={copyCode} copiedCode={copiedCode} />

        <h3 className="text-2xl mt-6">Webhook Endpoint Example</h3>
        <CodeBlock code={webhookSetup} language="javascript" id="alerts-2" copyCode={copyCode} copiedCode={copiedCode} />

        <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <h4 className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-purple-400" />
            Webhook Security
          </h4>
          <p className="text-sm text-gray-300 mb-3">
            All webhook requests include an <code className="px-2 py-1 rounded bg-white/10">X-SecureStream-Signature</code> header
            for request verification. Always validate this signature to ensure requests are authentic.
          </p>
        </div>
      </div>

      <div id="automated-actions" className="space-y-4">
        <h2 className="text-3xl">Automated Actions</h2>
        <p className="text-gray-300 leading-relaxed">
          Configure automatic responses when threats are detected:
        </p>

        <div className="space-y-3">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-red-400">Block IP Address</h4>
              <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">High Impact</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Automatically add malicious IPs to your firewall block list
            </p>
            <div className="text-xs text-gray-500">
              Use case: Brute force attacks, known malicious actors
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-orange-400">Require MFA</h4>
              <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">Medium Impact</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Force multi-factor authentication for suspicious login attempts
            </p>
            <div className="text-xs text-gray-500">
              Use case: Impossible travel, unusual location
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-yellow-400">Rate Limit</h4>
              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs">Low Impact</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Throttle requests from suspicious sources
            </p>
            <div className="text-xs text-gray-500">
              Use case: API abuse, scraping attempts
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-emerald-400">Alert Only</h4>
              <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs">No Impact</span>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Notify security team without blocking access
            </p>
            <div className="text-xs text-gray-500">
              Use case: Low severity events, monitoring
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigurationSection() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Configuration</h1>
        <p className="text-xl text-gray-400">Customize SecureStream for your environment</p>
      </div>

      <div id="system-settings" className="space-y-4">
        <h2 className="text-3xl">System Settings</h2>
        <p className="text-gray-300 leading-relaxed">
          Configure global system settings from the Settings dashboard:
        </p>

        <div className="space-y-3">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-3">Data Retention</h4>
            <p className="text-sm text-gray-400 mb-3">
              Control how long security logs and alerts are stored
            </p>
            <div className="flex gap-3 flex-wrap text-xs">
              <span className="px-3 py-1.5 rounded bg-indigo-500/20 text-indigo-400">30 days (Free)</span>
              <span className="px-3 py-1.5 rounded bg-purple-500/20 text-purple-400">90 days (Pro)</span>
              <span className="px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-400">1 year+ (Enterprise)</span>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-3">Time Zone</h4>
            <p className="text-sm text-gray-400">
              Set your organization's time zone for timestamp display and reporting
            </p>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-3">IP Allowlist/Blocklist</h4>
            <p className="text-sm text-gray-400">
              Manage permanent allow and block lists for IP addresses
            </p>
          </div>
        </div>
      </div>

      <div id="thresholds" className="space-y-4">
        <h2 className="text-3xl">Thresholds</h2>
        <p className="text-gray-300 leading-relaxed">
          Fine-tune detection sensitivity by adjusting rule thresholds:
        </p>

        <div className="p-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <h4 className="mb-4">Common Threshold Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm mb-1">Failed Login Attempts</h5>
                <p className="text-xs text-gray-400">Number of failures before alert</p>
              </div>
              <div className="px-3 py-1.5 rounded bg-white/10 text-sm">5 attempts</div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm mb-1">Time Window</h5>
                <p className="text-xs text-gray-400">Rolling window for event aggregation</p>
              </div>
              <div className="px-3 py-1.5 rounded bg-white/10 text-sm">5 minutes</div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm mb-1">API Rate Limit</h5>
                <p className="text-xs text-gray-400">Requests per minute per IP</p>
              </div>
              <div className="px-3 py-1.5 rounded bg-white/10 text-sm">1000/min</div>
            </div>
          </div>
        </div>
      </div>

      <div id="integrations" className="space-y-4">
        <h2 className="text-3xl">Integrations</h2>
        <p className="text-gray-300 leading-relaxed">
          Connect SecureStream with your existing security and operations tools:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors">
            <h4 className="mb-2">Slack</h4>
            <p className="text-sm text-gray-400 mb-3">
              Send alerts to Slack channels
            </p>
            <button className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm transition-colors">
              Connect Slack
            </button>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10 hover:border-purple-500/30 transition-colors">
            <h4 className="mb-2">PagerDuty</h4>
            <p className="text-sm text-gray-400 mb-3">
              Create incidents for critical alerts
            </p>
            <button className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-sm transition-colors">
              Connect PagerDuty
            </button>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-colors">
            <h4 className="mb-2">Splunk</h4>
            <p className="text-sm text-gray-400 mb-3">
              Export logs to Splunk for analysis
            </p>
            <button className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm transition-colors">
              Connect Splunk
            </button>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10 hover:border-pink-500/30 transition-colors">
            <h4 className="mb-2">Custom Webhook</h4>
            <p className="text-sm text-gray-400 mb-3">
              Configure custom HTTP endpoints
            </p>
            <button className="px-4 py-2 rounded bg-pink-600 hover:bg-pink-500 text-sm transition-colors">
              Add Webhook
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mt-8">
        <h4 className="flex items-center gap-2 mb-3 text-emerald-400">
          <CheckCircle className="w-5 h-5" />
          Need Help?
        </h4>
        <p className="text-sm text-gray-300 mb-4">
          Our support team is available 24/7 to help with configuration and integration questions.
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm transition-colors">
            Contact Support
          </button>
          <button className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm transition-colors">
            Join Community
          </button>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({
  code,
  language,
  id,
  copyCode,
  copiedCode
}: {
  code: string;
  language: string;
  id: string;
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  return (
    <div className="relative rounded-xl bg-[#1a1a24] border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          onClick={() => copyCode(code, id)}
          className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 text-xs"
        >
          {copiedCode === id ? (
            <>
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code className="text-gray-300">{code}</code>
      </pre>
    </div>
  );
}