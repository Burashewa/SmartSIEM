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
  Copy, Server, ShieldCheck, Cpu, AlertCircle, CheckCircle2, Bot, Activity, Users
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
    subsections: ["REST API", "Batch Events", "Agent Setup"]
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
    subsections: ["Alert Lifecycle", "Triage Workflow", "AI Assistant"]
  },
  {
    id: "configuration",
    title: "Configuration",
    icon: Settings,
    subsections: ["Environment Variables", "Roles", "AI Reports"]
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
                  <h1 className="text-lg">SmartSIEM</h1>
                  <p className="text-xs text-gray-400">Documentation</p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="relative">
                
              
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
        <h1 className="text-4xl mb-4">Introduction to SmartSIEM</h1>
        <p className="text-xl text-gray-400">
          A full-stack SIEM for log ingestion, detection rules, alert triage, and AI-assisted reporting
        </p>
      </div>

      <div id="overview" className="space-y-4">
        <h2 className="text-3xl">Overview</h2>
        <p className="text-gray-300 leading-relaxed">
          SmartSIEM is a Security Information and Event Management platform built with NestJS, MongoDB, and React.
          Collectors send security events over HTTP, the backend normalizes and stores them, runs built-in detection
          rules, and surfaces alerts in the dashboard for investigation.
        </p>
        <div className="p-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <h4 className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-indigo-400" />
            What is SIEM?
          </h4>
          <p className="text-gray-300 text-sm leading-relaxed">
            Security Information and Event Management (SIEM) combines log collection, correlation, and alerting so
            analysts can detect and respond to threats from applications and infrastructure.
          </p>
        </div>
      </div>

      <div id="architecture" className="space-y-4">
        <h2 className="text-3xl">Architecture</h2>
        <p className="text-gray-300 leading-relaxed">
          SmartSIEM runs as a self-hosted stack: a NestJS API on port 5001, a React (Vite) frontend on port 3001,
          and MongoDB for persistence. All API routes are prefixed with <code className="px-1.5 py-0.5 rounded bg-white/10">/api</code>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-indigo-400">Log Ingestion</h4>
            <p className="text-sm text-gray-400">
              <code>POST /api/logs</code> with an agent API key; events are normalized and stored per user
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-purple-400">Detection Engine</h4>
            <p className="text-sm text-gray-400">
              16 built-in rules (auth abuse, web attacks, recon, network) evaluated after each ingest
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-cyan-400">Dashboard & Triage</h4>
            <p className="text-sm text-gray-400">
              React UI for logs, alerts, rules, investigations, threat intel, and daily reports
            </p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2 text-pink-400">AI Enrichment</h4>
            <p className="text-sm text-gray-400">
              Optional Google Gemini for daily report summaries and the report chat assistant
            </p>
          </div>
        </div>
      </div>

      <div id="key-features" className="space-y-4">
        <h2 className="text-3xl">Key Features</h2>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Central dashboard:</strong> KPIs, recent alerts, and log visibility for security analysts
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Agent-based ingestion:</strong> Register collectors and send events with per-agent API keys
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Built-in detection rules:</strong> Enable or disable rules and tune thresholds from the UI
            </div>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Per-user data isolation:</strong> Logs and alerts are scoped to the owning analyst account
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
  
  // 1. Raw Curl Request
  const curlRequestCode = `curl -X POST https://api.smartsiem.yourdomain.com/v1/logs \\
  -H "Authorization: Bearer YOUR_AGENT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "timestamp": "2026-05-10T15:30:00.000Z",
    "source": "payment-service",
    "event": "authentication",
    "action": "login",
    "status": "failed",
    "user": "jdoe",
    "ip": "203.0.113.42"
  }'`;

  // 2. Node.js (Axios / Native Fetch)
  const nodeIntegrationCode = `// Example using standard Fetch API (Node.js 18+)
async function sendSiemLog(eventData) {
  const url = 'https://api.smartsiem.yourdomain.com/v1/logs';
  
  const payload = {
    timestamp: new Date().toISOString(),
    source: "node-backend",
    event: eventData.type,        // e.g., "database", "auth"
    action: eventData.action,      // e.g., "query", "password_reset"
    status: eventData.status,      // "success" | "failed"
    user: eventData.userId || "anonymous",
    ip: eventData.ipAddress
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.SMARTSIEM_API_KEY}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) console.error('SmartSIEM ingestion failed:', response.statusText);
  } catch (error) {
    console.error('Failed sending telemetry to SmartSIEM:', error);
  }
}`;

  // 3. Python (Requests / FastAPI Middleware)
  const pythonIntegrationCode = `import requests
import datetime
import os

SMARTSIEM_URL = "https://api.smartsiem.yourdomain.com/v1/logs"
API_KEY = os.getenv("SMARTSIEM_API_KEY")

def send_security_event(event_type: str, action: str, status: str, user: str, ip_address: str):
    payload = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "source": "fastapi-user-service",
        "event": event_type,
        "action": action,
        "status": status,
        "user": user,
        "ip": ip_address
    }
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(SMARTSIEM_URL, json=payload, headers=headers, timeout=2.0)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        # Silently log/handle ingestion errors to prevent breaking production apps
        print(f"SmartSIEM Ingestion Alert: {e}")`;

  // 4. Go (net/http Client)
  const goIntegrationCode = `package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

type SiemLog struct {
	Timestamp string \`json:"timestamp"\`
	Source    string \`json:"source"\`
	Event     string \`json:"event"\`
	Action    string \`json:"action"\`
	Status    string \`json:"status"\`
	User      string \`json:"user"\`
	IP        string \`json:"ip"\`
}

func SendSiemLog(eventType, action, status, user, ip string) {
	logPayload := SiemLog{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Source:    "go-auth-microservice",
		Event:     eventType,
		Action:    action,
		Status:    status,
		User:      user,
		IP:        ip,
	}

	jsonData, _ := json.Marshal(logPayload)
	req, _ := http.NewRequest("POST", "https://api.smartsiem.yourdomain.com/v1/logs", bytes.NewBuffer(jsonData))
	
	req.Header.Set("Authorization", "Bearer " + os.Getenv("SMARTSIEM_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err == nil {
		defer resp.Body.Close()
	}
}`;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl mb-4 font-bold">Getting Started &amp; Integration</h1>
        <p className="text-xl text-gray-400">
          Connect your ecosystem to SmartSIEM. Learn how to authenticate, format telemetry, and ship events natively from your application runtime.
        </p>
      </div>

      {/* Quick Start Guide */}
      <div id="quick-start" className="space-y-4">
        <h2 className="text-3xl font-semibold">Quick Start</h2>
        <p className="text-gray-300 leading-relaxed">
          Follow these simple steps to start streaming security logs into SmartSIEM:
        </p>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">
              1
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-medium mb-1">Log In to the Console</h4>
              <p className="text-gray-400 text-sm">
                Open your browser and navigate to your organization's designated SmartSIEM portal (e.g.,{" "}
                <code>https://siem.yourdomain.com</code>) and authenticate.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">
              2
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-medium mb-1">Generate a Collector Agent API Key</h4>
              <p className="text-gray-400 text-sm">
                Go to <strong>Settings</strong> &gt; <strong>Data Collectors</strong>. Click{" "}
                <strong>Create New Agent</strong>, choose a descriptive name (e.g., <code>prod-billing-service</code>), and copy the secure token generated.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">
              3
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-medium mb-1">Verify with a Test Event</h4>
              <p className="text-gray-400 text-sm mb-3">
                Execute a quick HTTP POST command to verify endpoint routing. Replace <code>YOUR_AGENT_API_KEY</code> with your real token:
              </p>
              <CodeBlock 
                code={curlRequestCode} 
                language="bash" 
                id="quick-start-curl" 
                copyCode={copyCode} 
                copiedCode={copiedCode} 
              />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-white/10" />

      {/* Language / Framework Integrations */}
      <div id="framework-integration" className="space-y-6">
        <h2 className="text-3xl font-semibold">Multi-Language Integration Guides</h2>
        <p className="text-gray-300 leading-relaxed">
          SmartSIEM is language-agnostic and relies entirely on stateless HTTPS payload submission. There are no heavy background binaries or agents to configure on your app servers. Simply bundle telemetry into your native logging or network layers.
        </p>

        {/* Integration Architecture Best Practices Callout */}
        <div className="p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-sm text-gray-400 space-y-1">
          <p className="font-semibold text-indigo-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Production Best Practices:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li><strong>Asynchronous execution:</strong> Avoid blocking thread execution when calling the SIEM API by firing events fire-and-forget or utilizing a worker pool.</li>
            <li><strong>Timeout limits:</strong> Always apply a strict connection timeout limit (recommended: 2000ms max) so that downstream latency does not degrade your main user loop.</li>
          </ul>
        </div>

        {/* Tabs / Subsections for Code */}
        <div className="space-y-8 mt-6">
          
          {/* Node.js Component */}
          <div className="space-y-2">
            <h3 className="text-xl font-medium text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-green-400" /> Node.js / JavaScript Ecosystem
            </h3>
            <p className="text-gray-400 text-sm">
              Implement structured ingestion in Node backends using the native global <code>fetch</code> API or libraries like <code>axios</code>.
            </p>
            <CodeBlock 
              code={nodeIntegrationCode} 
              language="javascript" 
              id="integrate-node" 
              copyCode={copyCode} 
              copiedCode={copiedCode} 
            />
          </div>

          {/* Python Component */}
          <div className="space-y-2">
            <h3 className="text-xl font-medium text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" /> Python (FastAPI / Django / Flask)
            </h3>
            <p className="text-gray-400 text-sm">
              Use the robust <code>requests</code> framework wrapped around exceptions to prevent transient network disruptions from interrupting API request lifecycles.
            </p>
            <CodeBlock 
              code={pythonIntegrationCode} 
              language="python" 
              id="integrate-python" 
              copyCode={copyCode} 
              copiedCode={copiedCode} 
            />
          </div>

          {/* Go Component */}
          <div className="space-y-2">
            <h3 className="text-xl font-medium text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-cyan-400" /> Go (Golang Microservices)
            </h3>
            <p className="text-gray-400 text-sm">
              Leverage highly performant goroutines along with Go’s native <code>net/http</code> package to safely build concurrent loggers.
            </p>
            <CodeBlock 
              code={goIntegrationCode} 
              language="go" 
              id="integrate-go" 
              copyCode={copyCode} 
              copiedCode={copiedCode} 
            />
          </div>

        </div>
      </div>

      <hr className="border-white/10" />

      {/* Recommended Next Steps */}
      <div id="first-steps" className="space-y-4">
        <h2 className="text-3xl font-semibold">First Steps in the Dashboard</h2>
        <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <h4 className="flex items-center gap-2 mb-3 font-medium text-white">
            <Terminal className="w-5 h-5 text-purple-400" />
            Post-Integration Workflow
          </h4>
          <ul className="space-y-3 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <span>Review our comprehensive <strong>Schema Mapping Guide</strong> to properly standardise custom backend events using mandatory <code>event</code>, <code>action</code>, and <code>status</code> parameters.</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <span>Activate your pre-built cross-correlation rules in the <strong>Detection Rules</strong> control room to flag suspicious operations (such as multiple rapid login failures across distinct instances).</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <span>Investigate runtime event flows live within the real-time stream via the <strong>Alerts &amp; Threats</strong> module.</span>
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
  const agentCurl = `curl -X POST http://localhost:5001/api/logs \\
  -H "Authorization: Bearer YOUR_AGENT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"event": "login_failed", "ip": "203.0.113.1", "timestamp": "2026-05-10T12:00:00.000Z"}'`;

  const jwtExample = `curl http://localhost:5001/api/alerts \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`;

  const authEndpoints = `# Public (no token)
POST /api/auth/register   { username, password, role }
POST /api/auth/login      { username, password }
POST /api/auth/google     { credential }
POST /api/auth/refresh    { refreshToken }

# Protected (JWT access token)
GET  /api/auth/me
POST /api/auth/logout     { refreshToken }
POST /api/agents          { name }
GET  /api/agents/:agentId/api-key`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Authentication</h1>
        <p className="text-xl text-gray-400">
          Two credential types: JWT for the dashboard API, agent API keys for log ingestion
        </p>
      </div>

      <div id="api-keys" className="space-y-4">
        <h2 className="text-3xl">Agent API Keys</h2>
        <p className="text-gray-300 leading-relaxed">
          Log ingestion (<code>POST /api/logs</code>) is public at the route level but requires a valid agent API
          key in the <code>Authorization: Bearer</code> header. Create agents from Settings after signing in; keys
          can be revealed once or regenerated via <code>POST /api/agents/:agentId/regenerate</code>.
        </p>

        <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
          <h4 className="flex items-center gap-2 mb-3 text-red-400">
            <XCircle className="w-5 h-5" />
            Security Warning
          </h4>
          <p className="text-sm text-gray-300">
            Agent keys grant write access to your tenant&apos;s logs. Store them server-side only — never embed in
            frontend bundles or commit to version control.
          </p>
        </div>

        <CodeBlock code={agentCurl} language="bash" id="auth-1" copyCode={copyCode} copiedCode={copiedCode} />
      </div>

      <div id="token-management" className="space-y-4">
        <h2 className="text-3xl">JWT Sessions</h2>
        <p className="text-gray-300 leading-relaxed">
          Dashboard routes (alerts, logs list, rules, reports, etc.) require a JWT access token issued by{" "}
          <code>/api/auth/login</code> or <code>/api/auth/google</code>. Refresh tokens extend the session via{" "}
          <code>/api/auth/refresh</code>. Default access TTL is 900 seconds (configurable with{" "}
          <code>JWT_ACCESS_TTL_SEC</code>).
        </p>

        <CodeBlock code={jwtExample} language="bash" id="auth-jwt" copyCode={copyCode} copiedCode={copiedCode} />

        <div className="space-y-3">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">Roles</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <strong className="text-gray-300">security_analyst</strong> — dashboard, logs, alerts, rules, reports
              </li>
              <li>
                <strong className="text-gray-300">admin</strong> — same as analyst plus block/unblock users
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <h4 className="mb-2">Auth API</h4>
            <CodeBlock code={authEndpoints} language="text" id="auth-endpoints" copyCode={copyCode} copiedCode={copiedCode} />
          </div>
        </div>
      </div>

      <div id="security-best-practices" className="space-y-4">
        <h2 className="text-3xl">Security Best Practices</h2>
        <p className="text-gray-300">
          Set strong <code>JWT_ACCESS_SECRET</code> and <code>JWT_REFRESH_SECRET</code> in production. Optional{" "}
          <code>GOOGLE_CLIENT_ID</code> / <code>VITE_GOOGLE_CLIENT_ID</code> enable Google sign-in.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="p-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <h4 className="flex items-center gap-2 mb-3 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              Do
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Keep agent keys on servers and CI secrets</li>
              <li>• Regenerate compromised agent keys</li>
              <li>• Use HTTPS in production</li>
              <li>• Rotate JWT secrets when deploying</li>
            </ul>
          </div>
          <div className="p-5 rounded-lg bg-red-500/10 border border-red-500/20">
            <h4 className="flex items-center gap-2 mb-3 text-red-400">
              <XCircle className="w-5 h-5" />
              Don&apos;t
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Expose agent keys in browser code</li>
              <li>• Commit <code>.env</code> to git</li>
              <li>• Share one agent across unrelated apps</li>
              <li>• Log bearer tokens</li>
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
  const restApiExample = `POST http://localhost:5001/api/logs
Authorization: Bearer YOUR_AGENT_API_KEY
Content-Type: application/json

{
  "timestamp": "2026-05-10T15:30:00.000Z",
  "source": "my-app",
  "severity": "high",
  "event": "authentication",
  "action": "login",
  "status": "failed",
  "user": "jdoe",
  "ip": "203.0.113.42",
  "deviceId": "device-abc-001",
  "endpoint": "/api/v1/auth/login",
  "method": "POST",
  "payload": {
    "reason": "invalid_credentials",
    "attempt": 3
  },
  "metadata": {
    "region": "us-east-1"
  }
}`;

  const authNote = `agentId and userId are resolved from the agent API key and attached server-side.
Do not send agentId or userId in the request body.`;

  const batchExample = `POST http://localhost:5001/api/logs
Authorization: Bearer YOUR_AGENT_API_KEY
Content-Type: application/json

{
  "source": "my-app",
  "events": [
    {
      "timestamp": "2026-05-10T15:31:00.000Z",
      "event": "authentication",
      "action": "login",
      "status": "failed",
      "user": "jdoe",
      "ip": "203.0.113.42"
    },
    {
      "timestamp": "2026-05-10T15:32:00.000Z",
      "event": "authentication",
      "action": "login",
      "status": "success",
      "user": "jdoe",
      "ip": "203.0.113.42"
    }
  ]
}`;

  const agentSetup = `# After login (JWT), create a collector:
POST /api/agents
Authorization: Bearer <access_token>
{ "name": "production-app", "storeApiKey": true }

# Reveal key (once) or regenerate:
GET  /api/agents/:agentId/api-key
POST /api/agents/:agentId/regenerate`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Sending Logs</h1>
        <p className="text-xl text-gray-400">Ingest security events with POST /api/logs and an agent API key</p>
      </div>

      <div id="rest-api" className="space-y-4">
        <h2 className="text-3xl">REST API</h2>
        <p className="text-gray-300 leading-relaxed">
          Send a single normalized event object. The backend parses, stores, and runs detection rules immediately.
          Through the Vite dev server, use the same path (<code>/api/logs</code>) — it proxies to the backend.
        </p>

        <div className="p-5 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs">POST</div>
            <code className="text-sm">/api/logs</code>
          </div>
          <p className="text-sm text-gray-400">Public route; requires valid agent Bearer token</p>
        </div>

        <h3 className="text-2xl">Example Request</h3>
        <CodeBlock code={restApiExample} language="http" id="logs-1" copyCode={copyCode} copiedCode={copiedCode} />
        <CodeBlock code={authNote} language="text" id="logs-auth-note" copyCode={copyCode} copiedCode={copiedCode} />

        <div className="p-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <h4 className="mb-3">Response</h4>
          <p className="text-sm text-gray-300 mb-2">
            Returns the created MongoDB log document (or an array when batching via <code>events</code>).
          </p>
        </div>
      </div>

      <div id="batch-upload" className="space-y-4">
        <h2 className="text-3xl">Batch Events</h2>
        <p className="text-gray-300 leading-relaxed">
          Include multiple sub-events in one request using a top-level <code>events</code> array (or{" "}
          <code>raw.events</code>). Each entry is normalized and evaluated separately.
        </p>

        <CodeBlock code={batchExample} language="json" id="logs-2" copyCode={copyCode} copiedCode={copiedCode} />

        <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <h4 className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-purple-400" />
            Event naming for rules
          </h4>
          <p className="text-sm text-gray-300">
            Many rules match on derived event names (e.g. <code>login_failed</code> from{" "}
            <code>event: authentication</code> + <code>status: failed</code>). Use consistent{" "}
            <code>event</code>, <code>action</code>, and <code>status</code> fields for reliable detection.
          </p>
        </div>
      </div>

      <div id="rate-limits" className="space-y-4">
        <h2 className="text-3xl">Agent Setup</h2>
        <p className="text-gray-300 leading-relaxed">
          Agents belong to your user account. Create them from Settings in the UI or via the API:
        </p>
        <CodeBlock code={agentSetup} language="bash" id="logs-3" copyCode={copyCode} copiedCode={copiedCode} />
        <p className="text-sm text-gray-400">
          Self-hosted SmartSIEM does not enforce cloud-style ingest rate tiers; capacity depends on your MongoDB and
          host resources.
        </p>
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

const BUILTIN_RULES = [
  { name: "Failed-login brute force", id: "failed-logins-5-in-5m", severity: "high", detail: "5+ failures in 15m, 3+ in 2m, or 10+ in 60m from same IP (escalates to critical at 10+ in burst window)" },
  { name: "Impossible traveler", id: "impossible-traveler", severity: "critical", detail: "Successful login geo jump: ≥500 km and implied speed ≥900 km/h within 24h lookback" },
  { name: "Impossible travel (country by IP)", id: "impossible-travel-country-ip", severity: "high", detail: "Same user, different country from IP geolocation within 120 minutes" },
  { name: "Login after failures", id: "login-after-failures", severity: "high", detail: "Success after ≥3 failed logins in prior 10 minutes" },
  { name: "Credential stuffing", id: "credential-stuffing", severity: "critical", detail: "≥10 unique users with failures from one IP in 10 minutes" },
  { name: "Distributed brute force", id: "distributed-brute-force", severity: "high", detail: "≥8 unique IPs failing logins for same user in 15 minutes" },
  { name: "SQL injection", id: "sql-injection-attempt", severity: "critical", detail: "Payload / body pattern scan for SQLi" },
  { name: "XSS", id: "xss-attempt", severity: "high", detail: "Cross-site scripting patterns in request body" },
  { name: "Path traversal / LFI", id: "path-traversal-lfi-attempt", severity: "critical", detail: "Directory traversal and local file inclusion probes" },
  { name: "Command injection", id: "command-injection-attempt", severity: "critical", detail: "Shell / command injection patterns" },
  { name: "API rate limit exceeded", id: "api-rate-limit", severity: "medium", detail: "Events such as api_rate_limit or rate_limit_exceeded" },
  { name: "Unauthorized endpoint", id: "unauthorized-endpoint", severity: "high", detail: "Access denied to protected API paths" },
  { name: "Directory scan", id: "directory-scan", severity: "medium", detail: "Reconnaissance-style path probing" },
  { name: "Sensitive file access", id: "sensitive-file-access", severity: "high", detail: "Attempts to reach restricted files (.env, backups, etc.)" },
  { name: "Known malicious IP", id: "known-malicious-ip", severity: "critical", detail: "Source IP in MALICIOUS_IPS / blocklist configuration" },
  { name: "Suspected DoS / flood", id: "dos-high-volume-ip", severity: "high", detail: "≥400 events from one IP in 5 minutes" },
  { name: "Error burst from IP", id: "error-burst-ip", severity: "high", detail: "≥80 high-severity events from one IP in 15 minutes" },
];

function DetectionRulesSection() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl mb-4">Detection Rules</h1>
        <p className="text-xl text-gray-400">16 built-in rules evaluated after each log ingest</p>
      </div>

      <div id="built-in-rules" className="space-y-4">
        <h2 className="text-3xl">Built-in Rules</h2>
        <p className="text-gray-300 leading-relaxed">
          Rules are defined in the backend registry and run automatically when logs are stored. Alerts are
          deduplicated per user, rule, IP, and time bucket.
        </p>

        <div className="space-y-3">
          {BUILTIN_RULES.map((rule) => (
            <div key={rule.id} className="p-5 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-start justify-between mb-2 gap-2">
                <h4 className="text-indigo-400">{rule.name}</h4>
                <span className="px-2 py-1 rounded bg-white/10 text-gray-300 text-xs shrink-0">{rule.severity}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                <code>{rule.id}</code>
              </p>
              <p className="text-sm text-gray-400">{rule.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div id="custom-rules" className="space-y-4">
        <h2 className="text-3xl">Custom Rules</h2>
        <p className="text-gray-300 leading-relaxed">
          Custom rule authoring in the UI is not available yet. New detectors are added as TypeScript rule modules
          under <code>Backend/src/rules/definitions/</code> and registered in{" "}
          <code>rule.registry.ts</code>.
        </p>
      </div>

      <div id="rule-configuration" className="space-y-4">
        <h2 className="text-3xl">Rule Configuration</h2>
        <p className="text-gray-300 leading-relaxed">
          Use the Detection Rules page or API to enable or disable rules per deployment:
        </p>
        <div className="p-5 rounded-lg bg-white/5 border border-white/10 mb-4">
          <code className="text-sm text-purple-300">GET /api/rules</code>
          <p className="text-sm text-gray-400 mt-2">List rules with trigger stats (JWT required)</p>
          <code className="text-sm text-purple-300 block mt-3">PUT /api/rules/:id/toggle</code>
          <p className="text-sm text-gray-400 mt-2">Body: <code>{`{ "enabled": true }`}</code></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <CheckCircle className="w-6 h-6 text-emerald-400 mb-3" />
            <h4 className="mb-2">Enable / disable</h4>
            <p className="text-sm text-gray-400">Turn rules off in dev or noisy environments</p>
          </div>
          <div className="p-5 rounded-lg bg-white/5 border border-white/10">
            <Code2 className="w-6 h-6 text-pink-400 mb-3" />
            <h4 className="mb-2">Simulator</h4>
            <p className="text-sm text-gray-400">
              Backend <code>public/</code> UI can fire preset events for testing multi-log rules
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
  // A clean data schema sample so analysts know what metadata is available to them
  const alertPayloadExample = `{
  "rule_name": "Brute-Force Login Attempt",
  "severity": "high",
  "status": "open",
  "source_ip": "203.0.113.42",
  "triggered_at": "2026-05-10T15:30:00.000Z",
  "occurrence_count": 14,
  "description": "Brute-force pattern detected: 5+ failed login attempts within 5 minutes from a single IP address."
}`;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl mb-4 font-bold">Alerts &amp; Incident Triage</h1>
        <p className="text-xl text-gray-400">
          Learn how to monitor, investigate, and manage the lifecycle of security events detected across your infrastructure.
        </p>
      </div>

      {/* Alert Aggregation & Lifecycle */}
      <div id="alert-lifecycle" className="space-y-4">
        <h2 className="text-3xl font-semibold">Intelligent Alert Lifecycle</h2>
        <p className="text-gray-300 leading-relaxed">
          When an active detection rule matches suspicious log traffic, SmartSIEM raises an alert. To prevent dashboard fatigue and notification floods, our engine automatically groups identical alerts matching the same rule, user, and IP address into a single incident card by incrementing the <strong>Occurrence Count</strong>.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          <div className="lg:col-span-2">
            <CodeBlock 
              code={alertPayloadExample} 
              language="json" 
              id="user-alert-spec" 
              copyCode={copyCode} 
              copiedCode={copiedCode} 
            />
          </div>
          
          {/* Severity Classifications */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h4 className="font-semibold mb-2 text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" /> Severity Levels
              </h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Alert priorities are mapped dynamically based on rule configurations:
              </p>
              <div className="flex flex-wrap gap-2 mt-3 text-xs font-mono">
                <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-300">Low</span>
                <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300">Medium</span>
                <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-300">High</span>
                <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 font-bold">Critical</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h4 className="font-semibold mb-2 text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" /> UI Control Panel
              </h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Analysts can view full alert histories, query indices, and download forensic data tables natively from the <strong>Alerts Dashboard</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-white/10" />

      {/* Analyst Triage Workflow */}
      <div id="triage-workflow" className="space-y-4">
        <h2 className="text-3xl font-semibold">Incident Triage Workflow</h2>
        <p className="text-gray-300 leading-relaxed">
          As an analyst or security operator, you are responsible for updating incident statuses directly inside the console to advance them through your team's lifecycle workflow.
        </p>

        {/* Analyst Status Status Table */}
        <div className="overflow-x-auto border border-white/10 rounded-xl bg-white/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-gray-200 text-sm font-medium">
                <th className="p-4 w-1/4">Alert Status</th>
                <th className="p-4">Operational Context</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-300 divide-y divide-white/5">
              <tr>
                <td className="p-4 font-semibold text-yellow-400 font-mono">Open</td>
                <td className="p-4 text-gray-400">The default state. Assigned automatically by SmartSIEM when an event is first flagged.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-blue-400 font-mono">Investigating</td>
                <td className="p-4">Assigned by an analyst when actively tracking root cause or assembling data trails.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-red-400 font-mono">Threat Verified</td>
                <td className="p-4">Confirmed malicious payload or credential compromise requiring active containment loops.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-green-400 font-mono">Resolved</td>
                <td className="p-4">Mitigation actions have closed the incident or patched vulnerabilities successfully.</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-gray-400 font-mono">False Positive</td>
                <td className="p-4">Legitimate operational background noise. Flags the event out of primary threat analysis queues.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <hr className="border-white/10" />

      {/* AI Intelligence and Response Playbooks */}
      <div id="ai-assistant" className="space-y-4">
        <h2 className="text-3xl font-semibold">AI Assistant &amp; Response Playbooks</h2>
        <p className="text-gray-300 leading-relaxed">
          Clicking into any incident open modal fires up the interactive <strong>AI Recommendations Engine</strong>. This surfaces diagnostic hints directly alongside raw forensic payloads, enabling accelerated discovery times.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* AI Feature Block */}
          <div className="p-6 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-3">
            <h4 className="text-lg font-medium text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" /> Conversational Threat Assistance
            </h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Need clarity on a specific signature or string? Open the built-in <strong>Security Chat Assistant</strong> within the alert drawer to query payloads, generate query terms, or request targeted response recommendations using intuitive natural language.
            </p>
          </div>

          {/* Defense Responsibility Guardrail */}
          <div className="p-6 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-3">
            <h4 className="text-lg font-medium text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" /> Incident Response Boundaries
            </h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              SmartSIEM functions purely as a centralized monitoring platform and **does not automatically initiate firewall blocks or lock user profiles**. 
            </p>
            <p className="text-xs text-purple-300/80 italic bg-purple-500/5 p-2 rounded border border-purple-500/10">
              Note: To act on AI incident playbooks, operators must execute quarantine loops or MFA adjustments manually inside your internal firewalls, WAF rules, or Identity Providers (IdP).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



function ConfigurationSection()  {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl mb-4 font-bold">System Configuration</h1>
        <p className="text-xl text-gray-400">Manage global workspace settings, system roles, and advanced AI features.</p>
      </div>

      {/* Profile & Security Options (Translated from .env variables) */}
      <div id="workspace-settings" className="space-y-4">
        <h2 className="text-3xl font-semibold">Workspace Configuration</h2>
        <p className="text-gray-300 leading-relaxed">
          While infrastructure parameters are managed by your operations team, platform administrators can adjust behavioral rules and security integrations directly from the <strong>Admin Settings Dashboard</strong>:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <h4 className="text-lg font-medium text-indigo-400 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Global Blocklists
            </h4>
            <p className="text-gray-400 leading-relaxed">
              Define known malicious threat vectors. You can supply a comma-separated list of prohibited IP addresses inside the network policy portal to automatically tag matching ingestion telemetry with a critical priority label.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <h4 className="text-lg font-medium text-purple-400 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Notification &amp; Reset Integrations
            </h4>
            <p className="text-gray-400 leading-relaxed">
              Configure SMTP outbounds to establish standardized corporate password verification emails and set global session timeout rules (JWT tokens) to automatically sign out inactive security operators.
            </p>
          </div>
        </div>

        {/* Health Check -> System Status Dashboard component */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
          <div className="space-y-1">
            <h4 className="font-medium text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Platform Health Monitor
            </h4>
            <p className="text-sm text-gray-400">
              Check the structural processing connection status between the event streaming gateways, background rule microservices, and log datastores.
            </p>
          </div>
          <span className="self-start sm:self-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 whitespace-nowrap">
            System Online
          </span>
        </div>
      </div>

      <hr className="border-white/10" />

      {/* System Access Management (Roles) */}
      <div id="access-control" className="space-y-4">
        <h2 className="text-3xl font-semibold">Access Control &amp; Roles</h2>
        <p className="text-gray-300 leading-relaxed">
          SmartSIEM enforces strict Role-Based Access Control (RBAC). When registering or updating team profiles, accounts must be categorized under one of two operational tiers:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <h4 className="text-lg font-medium text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Security Analyst
            </h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Standard analyst view. Users can monitor active data telemetry streams, generate collector endpoints, investigate alerts assigned to them, and review tactical daily reports.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <h4 className="text-lg font-medium text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" /> System Administrator
            </h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Full enterprise configuration privileges. In addition to regular analyst tasks, Administrators can modify workspace rules, configure global blocklists, and revoke keys or suspend accounts if unauthorized activity is suspected.
            </p>
          </div>
        </div>
      </div>

      <hr className="border-white/10" />

      {/* Automated AI Reports Section */}
      <div id="ai-intelligence" className="space-y-4">
        <h2 className="text-3xl font-semibold">Automated AI Threat Summaries</h2>
        <p className="text-gray-300 leading-relaxed">
          SmartSIEM compiles continuous telemetry data over a rolling 24-hour window to construct comprehensive daily summaries. These files can be read, filtered by calendar date, and printed right out of the <strong>Executive Reports Hub</strong>.
        </p>
        
        <div className="p-6 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col md:flex-row items-start gap-4 mt-4">
          <Bot className="w-8 h-8 text-indigo-400 mt-1 flex-shrink-0" />
          <div className="space-y-2">
            <h4 className="text-lg font-medium text-white">Generative Intelligence Summaries</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              If your corporate license has the optional AI processing cluster active, your summaries automatically include automated security deep-dives. This relies on the <strong>Gemini 2.5 Flash</strong> engine to identify multi-vector attacks and draft complete incident retrospectives instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Main Dashboard Widget Wrap-up */}
      <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mt-8">
        <h4 className="flex items-center gap-2 mb-2 font-medium text-emerald-400">
          <CheckCircle className="w-5 h-5" />
          Real-Time Key Performance Indicators (KPIs)
        </h4>
        <p className="text-sm text-gray-300 leading-relaxed">
          The main monitoring landing dashboard runs an active aggregation feed to continuously refresh status cards, ingestion line graphs, and alert metrics. This panel stays synced as long as you maintain an active session.
        </p>
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