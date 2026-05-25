import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Server,
  Shield,
  Terminal,
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';

type SectionProps = {
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
};

const STANDALONE_SCRIPT = `// scripts/send-to-siem.js — Type A: cron, CLI, or one-off test
const API_BASE = process.env.SMARTSIEM_API_BASE ?? 'http://localhost:5000/api';
const API_KEY = process.env.SMARTSIEM_API_KEY;

async function main() {
  const res = await fetch(\`\${API_BASE}/logs\`, {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      source: 'node-cron-job',
      event: 'authentication',
      action: 'login',
      status: 'failed',
      user: 'test-user',
      ip: '203.0.113.42',
    }),
  });

  if (!res.ok) throw new Error(\`\${res.status} \${await res.text()}\`);
  console.log('OK', await res.json());
}

main().catch(console.error);`;

const CLIENT_MODULE = `// lib/smartsiem-client.js — Type B: reusable client
export class SmartSiemClient {
  constructor({ baseUrl, apiKey }) {
    if (!apiKey?.startsWith('agent_')) {
      throw new Error('SMARTSIEM_API_KEY must be agent_<id>.<secret>');
    }
    this.baseUrl = (baseUrl ?? 'http://localhost:5000/api').replace(/\\/$/, '');
    this.apiKey = apiKey;
  }

  async ingest(payload) {
    const res = await fetch(\`\${this.baseUrl}/logs\`, {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${this.apiKey}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(\`SmartSIEM \${res.status}: \${await res.text()}\`);
    }
    return res.json();
  }

  /** Non-blocking: do not fail your app if SIEM is down */
  ingestSafe(payload) {
    void this.ingest(payload).catch((err) => {
      console.error('[SmartSIEM]', err.message);
    });
  }
}`;

const SIEM_SINGLETON = `// lib/siem.js — one instance for the whole app
import { SmartSiemClient } from './smartsiem-client.js';

export const siem = new SmartSiemClient({
  baseUrl: process.env.SMARTSIEM_API_BASE,
  apiKey: process.env.SMARTSIEM_API_KEY,
});`;

const EXPRESS_HOOK = `// routes/login.js — Type C: call on security events
import express from 'express';
import { siem } from '../lib/siem.js';

const app = express();
app.use(express.json());

app.post('/login', async (req, res) => {
  const user = await authenticate(req.body.username, req.body.password);

  if (!user) {
    siem.ingestSafe({
      timestamp: new Date().toISOString(),
      source: 'my-express-app',
      event: 'authentication',
      action: 'login',
      status: 'failed',
      user: req.body.username,
      ip: req.ip,
      payload: { reason: 'invalid_credentials' },
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ ok: true });
});`;

const BATCH_INGEST = `// worker/flush-siem.js — Type D: high volume
import { siem } from '../lib/siem.js';

const buffer = [];

export function recordSecurityEvent(event) {
  buffer.push({ timestamp: new Date().toISOString(), ...event });
}

export async function flush() {
  if (buffer.length === 0) return;
  const events = buffer.splice(0, buffer.length);
  await siem.ingest({ source: 'my-express-app', events });
}

setInterval(() => void flush().catch(console.error), 10_000);`;

const ENV_EXAMPLE = `# Your Node application .env (never commit to git)
SMARTSIEM_API_BASE=http://localhost:5000/api
SMARTSIEM_API_KEY=agent_xxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy`;

const MIN_PAYLOAD = `{
  "timestamp": "2026-05-25T12:00:00.000Z",
  "source": "my-node-service",
  "event": "authentication",
  "action": "login",
  "status": "failed",
  "user": "jdoe",
  "ip": "203.0.113.42"
}`;

export function NodeAgentIntegrationSection({ copyCode, copiedCode }: SectionProps) {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl mb-4">Node.js Agent Integration</h1>
        <p className="text-xl text-gray-400">
          Step-by-step guide to connect a Node.js application to SmartSIEM using an agent API key
        </p>
      </div>

      <div id="node-overview" className="space-y-4">
        <h2 className="text-3xl">Node Overview</h2>
        <p className="text-gray-300 leading-relaxed">
          An <strong>agent</strong> is a collector identity in SmartSIEM. You receive one API key per agent.
          Your Node app sends security events to <code className="px-1.5 py-0.5 rounded bg-white/10">POST /api/logs</code>{' '}
          with that key. You do <strong>not</strong> use analyst JWT login for log ingestion.
        </p>
        <div className="p-5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-sm text-gray-300">
          <p className="font-medium text-indigo-300 mb-2">After each successful ingest:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Events are normalized and stored in MongoDB</li>
            <li>Built-in detection rules run automatically</li>
            <li>Matching rules may create alerts in the dashboard</li>
          </ol>
        </div>
      </div>

      <div id="agent-setup-in-smartsiem" className="space-y-4">
        <h2 className="text-3xl flex items-center gap-2">
          <Server className="w-7 h-7 text-green-400" />
          Agent Setup in SmartSIEM
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">
              1
            </div>
            <div>
              <h4 className="font-medium mb-1">Run SmartSIEM</h4>
              <p className="text-sm text-gray-400">
                Start the backend (<code>npm start</code> in <code>Backend/</code>) and frontend (
                <code>npm run dev</code>). API base is <code>http://localhost:&lt;PORT&gt;/api</code> (check{' '}
                <code>PORT</code> in your backend <code>.env</code>, often 5000 or 5001).
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">
              2
            </div>
            <div>
              <h4 className="font-medium mb-1">Create an agent (security analyst)</h4>
              <p className="text-sm text-gray-400 mb-2">
                Log in as a <strong>security analyst</strong>, open Settings, and create an agent:
              </p>
              <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
                <li>
                  <strong>Name:</strong> e.g. <code>payment-api-prod</code>
                </li>
                <li>
                  <strong>One-time only:</strong> copy the key immediately; it cannot be shown again
                </li>
                <li>
                  <strong>Store encrypted:</strong> reveal or rotate later (server needs{' '}
                  <code>AGENT_API_KEY_ENCRYPTION_SECRET</code>)
                </li>
                <li>
                  <strong>Allowed IPs (optional):</strong> restrict ingest to your server egress IPs
                </li>
              </ul>
              <Link
                to="/settings?createAgent=true"
                className="inline-flex mt-3 px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-sm border border-indigo-500/30"
              >
                Open Settings → Create Agent
              </Link>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 font-bold">
              3
            </div>
            <div>
              <h4 className="font-medium mb-1">Copy the API key</h4>
              <p className="text-sm text-gray-400">
                Format: <code>agent_&lt;16-char-id&gt;.&lt;64-char-secret&gt;</code>. Store in your Node
                secrets — never commit to git or ship in browser bundles.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div id="environment-variables" className="space-y-4">
        <h2 className="text-3xl">Environment Variables</h2>
        <p className="text-gray-300 text-sm">
          Add these to <strong>your Node application</strong> (not SmartSIEM&apos;s server <code>.env</code>):
        </p>
        <CodeBlock
          code={ENV_EXAMPLE}
          language="env"
          id="node-env"
          copyCode={copyCode}
          copiedCode={copiedCode}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-3 text-gray-300">Variable</th>
                <th className="text-left p-3 text-gray-300">Purpose</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-t border-white/10">
                <td className="p-3 font-mono text-indigo-300">SMARTSIEM_API_BASE</td>
                <td className="p-3">
                  e.g. <code>http://localhost:5000/api</code> (dev) or <code>https://siem.example.com/api</code>{' '}
                  (prod)
                </td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="p-3 font-mono text-indigo-300">SMARTSIEM_API_KEY</td>
                <td className="p-3">Full agent key from Settings</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div id="choose-a-snippet-type" className="space-y-4">
        <h2 className="text-3xl">Choose a Snippet Type</h2>
        <p className="text-gray-300 text-sm mb-4">
          Pick the pattern that matches your Node architecture. Most teams use <strong>Type B + Type C</strong>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-3 text-gray-300">Your app</th>
                <th className="text-left p-3 text-gray-300">Snippet</th>
                <th className="text-left p-3 text-gray-300">Where it lives</th>
              </tr>
            </thead>
            <tbody className="text-gray-400">
              <tr className="border-t border-white/10">
                <td className="p-3">Cron / CLI / worker</td>
                <td className="p-3 text-emerald-300">Type A — Standalone</td>
                <td className="p-3 font-mono text-xs">scripts/send-to-siem.js</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="p-3">Any app (shared module)</td>
                <td className="p-3 text-emerald-300">Type B — Client</td>
                <td className="p-3 font-mono text-xs">lib/smartsiem-client.js</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="p-3">Express / Fastify / Nest HTTP</td>
                <td className="p-3 text-emerald-300">Type C — Event hook</td>
                <td className="p-3 font-mono text-xs">login route, auth middleware</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="p-3">High volume / queue</td>
                <td className="p-3 text-emerald-300">Type D — Batch</td>
                <td className="p-3 font-mono text-xs">interval flush worker</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400">
          <p className="font-medium text-white mb-2">Where to call ingest in HTTP apps</p>
          <ul className="space-y-1">
            <li>
              <ChevronRight className="w-4 h-4 inline text-indigo-400" /> Failed login →{' '}
              <code>event: authentication</code>, <code>action: login</code>, <code>status: failed</code>
            </li>
            <li>
              <ChevronRight className="w-4 h-4 inline text-indigo-400" /> Permission denied →{' '}
              <code>event: authorization</code>, <code>action: access_denied</code>
            </li>
            <li>
              <ChevronRight className="w-4 h-4 inline text-indigo-400" /> Suspicious API →{' '}
              <code>event: api</code>, <code>endpoint</code>, <code>method</code>
            </li>
          </ul>
        </div>
      </div>

      <div id="type-a-standalone-script" className="space-y-3">
        <h2 className="text-2xl">Type A — Standalone Script</h2>
        <p className="text-sm text-gray-400">Use for scheduled jobs or quick connectivity tests. Requires Node 18+ (native fetch).</p>
        <CodeBlock code={STANDALONE_SCRIPT} language="javascript" id="node-type-a" copyCode={copyCode} copiedCode={copiedCode} />
      </div>

      <div id="type-b-reusable-client" className="space-y-3">
        <h2 className="text-2xl">Type B — Reusable Client</h2>
        <p className="text-sm text-gray-400">Recommended core module; import from anywhere in your app.</p>
        <CodeBlock code={CLIENT_MODULE} language="javascript" id="node-type-b" copyCode={copyCode} copiedCode={copiedCode} />
        <CodeBlock code={SIEM_SINGLETON} language="javascript" id="node-type-b-singleton" copyCode={copyCode} copiedCode={copiedCode} />
      </div>

      <div id="type-c-express-hook" className="space-y-3">
        <h2 className="text-2xl">Type C — Express Hook</h2>
        <p className="text-sm text-gray-400">
          Use <code>ingestSafe</code> on request paths so SIEM latency never blocks users.
        </p>
        <CodeBlock code={EXPRESS_HOOK} language="javascript" id="node-type-c" copyCode={copyCode} copiedCode={copiedCode} />
      </div>

      <div id="type-d-batch-ingest" className="space-y-3">
        <h2 className="text-2xl">Type D — Batch Ingest</h2>
        <p className="text-sm text-gray-400">
          Send many events in one request with a top-level <code>events</code> array.
        </p>
        <CodeBlock code={BATCH_INGEST} language="javascript" id="node-type-d" copyCode={copyCode} copiedCode={copiedCode} />
      </div>

      <div id="minimum-payload" className="space-y-3">
        <h2 className="text-2xl">Minimum Payload</h2>
        <CodeBlock code={MIN_PAYLOAD} language="json" id="node-payload" copyCode={copyCode} copiedCode={copiedCode} />
        <p className="text-sm text-gray-400">
          Optional: <code>severity</code>, <code>endpoint</code>, <code>method</code>, <code>payload</code>,{' '}
          <code>tags</code>, <code>metadata</code>. Do not send <code>agentId</code> or <code>userId</code> — they
          are resolved from your API key server-side.
        </p>
      </div>

      <div id="verify-integration" className="space-y-4">
        <h2 className="text-3xl flex items-center gap-2">
          <Terminal className="w-7 h-7 text-purple-400" />
          Verify Integration
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
          <li>Send one test event (Type A script or trigger a Type C route).</li>
          <li>In SmartSIEM: open <strong>Logs</strong> — confirm your <code>source</code> appears.</li>
          <li>If a rule matches: check <strong>Alerts</strong>.</li>
        </ol>
        <div className="p-5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <h4 className="flex items-center gap-2 text-amber-300 mb-2">
            <AlertTriangle className="w-5 h-5" />
            Troubleshooting
          </h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>
              <strong>401</strong> — wrong or missing API key
            </li>
            <li>
              <strong>403</strong> — IP not on agent or global allowlist
            </li>
            <li>
              <strong>403 + HTTPS</strong> — <code>AGENT_INGEST_REQUIRE_HTTPS=true</code> but you used http://
            </li>
            <li>
              <strong>querySrv ECONNREFUSED</strong> (server) — use standard <code>mongodb://</code> Atlas URI, not{' '}
              <code>mongodb+srv</code> on Windows Node
            </li>
            <li>
              <strong>Connection refused</strong> — backend not running or wrong <code>PORT</code>
            </li>
          </ul>
        </div>
      </div>

      <div id="security-checklist" className="space-y-4">
        <h2 className="text-3xl flex items-center gap-2">
          <Shield className="w-7 h-7 text-emerald-400" />
          Security Checklist
        </h2>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            API key in env or secret manager, never in the repo
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            Use <code>ingestSafe</code> on user-facing code paths
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            Production: HTTPS URL + <code>AGENT_INGEST_REQUIRE_HTTPS=true</code> on the server
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            One agent per service/environment (e.g. <code>payment-api-prod</code> vs <code>payment-api-staging</code>)
          </li>
        </ul>
        <p className="text-sm text-gray-500">
          To <strong>read</strong> alerts from Node (automation), use JWT via <code>POST /api/auth/login</code> — see
          the Authentication section. Log ingestion always uses the agent key only.
        </p>
      </div>
    </div>
  );
}
