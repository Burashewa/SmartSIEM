/**
 * Tiny URL-pattern router on top of Node's `http` module.
 *
 * Supports `GET /alerts`, `PATCH /alerts/:id`, etc., with params extracted into
 * `req.params`. Query strings are exposed via `req.query`. JSON request bodies
 * are parsed lazily (size-limited) and exposed via `req.bodyJson()`.
 *
 * Handlers may return a value (auto-serialized as JSON 200) or call
 * `res.json(status, payload)` themselves.
 */

const url = require('url');

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MiB safeguard for rule edits.

class Router {
  constructor() {
    /** @type {Array<{ method: string, regex: RegExp, keys: string[], handler: Function }>} */
    this.routes = [];
  }

  /**
   * @param {string} method
   * @param {string} pattern path pattern, e.g. /alerts/:id
   * @param {(req: import('http').IncomingMessage & { params: Record<string,string>, query: Record<string,string|string[]>, bodyJson: () => Promise<any> }, res: import('http').ServerResponse & { json: (status: number, payload: unknown) => void }) => any | Promise<any>} handler
   */
  add(method, pattern, handler) {
    const keys = [];
    const regexStr = pattern.replace(/:[A-Za-z0-9_]+/g, (m) => {
      keys.push(m.slice(1));
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}/?$`);
    this.routes.push({ method: method.toUpperCase(), regex, keys, handler });
  }

  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  patch(p, h) { this.add('PATCH', p, h); }
  put(p, h) { this.add('PUT', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }

  /**
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   * @returns {Promise<boolean>} true if a route matched and handled the request
   */
  async dispatch(req, res) {
    const parsed = url.parse(req.url || '/', true);
    const pathname = parsed.pathname || '/';
    const method = (req.method || 'GET').toUpperCase();

    // CORS preflight - permissive; UI is same-origin via Vite proxy in dev.
    setCorsHeaders(res);
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.regex.exec(pathname);
      if (!match) continue;

      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1]);
      });

      const reqExt = req;
      reqExt.params = params;
      reqExt.query = parsed.query || {};
      reqExt.bodyJson = () => readJsonBody(req);

      const resExt = res;
      resExt.json = (status, payload) => sendJson(res, status, payload);

      try {
        const result = await route.handler(reqExt, resExt);
        if (!res.writableEnded && result !== undefined) {
          sendJson(res, 200, result);
        } else if (!res.writableEnded) {
          sendJson(res, 204, null);
        }
      } catch (err) {
        if (!res.writableEnded) {
          if (err && err.statusCode) {
            sendJson(res, err.statusCode, { error: err.message });
          } else {
            console.error(`[api] ${method} ${pathname} handler error`, err);
            sendJson(res, 500, { error: 'Internal Server Error' });
          }
        }
      }
      return true;
    }

    return false;
  }
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  if (payload === null || payload === undefined) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        const err = new Error('Request body too large');
        err.statusCode = 413;
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      const text = Buffer.concat(chunks).toString('utf-8').trim();
      if (!text) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (err) {
        const e = new Error('Invalid JSON body');
        e.statusCode = 400;
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = {
  Router,
  HttpError,
  sendJson,
  setCorsHeaders,
};
