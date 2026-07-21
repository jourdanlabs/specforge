// SpecForge — zero-dependency Node server (Node 18+).
// Serves the UI and two spec engines: deterministic (offline) and AI-assisted.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

import { buildSpec } from './lib/deterministic.mjs';
import { renderOutputs } from './lib/outputs.mjs';
import { aiSpec, aiConfigured } from './lib/ai.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader — no dependency. Real env vars always win.
function loadEnv() {
  const p = join(__dir, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const PUBLIC = join(__dir, 'public');
const PORT = process.env.PORT || 4173;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(req, res) {
  let path = normalize(decodeURIComponent(req.url.split('?')[0]));
  if (path === '/' || path === '') path = '/index.html';
  if (path.includes('..')) return send(res, 400, 'bad path', 'text/plain');
  try {
    const file = await readFile(join(PUBLIC, path));
    return send(res, 200, file, MIME[extname(path)] || 'application/octet-stream');
  } catch {
    return send(res, 404, 'not found', 'text/plain');
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/config') {
      return send(res, 200, { ai_configured: aiConfigured() });
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
      const { mode = 'deterministic', idea = '', industry = '', type = '', outputs = ['full_spec'] } = await readBody(req);
      if (!String(idea).trim()) return send(res, 400, { error: 'idea is required' });

      if (mode === 'ai') {
        const result = await aiSpec({ idea, industry, type, outputs });
        return send(res, 200, { mode: 'ai', ...result });
      }

      const spec = buildSpec({ idea, industry, type });
      const artifacts = renderOutputs(spec, outputs);
      return send(res, 200, { mode: 'deterministic', spec_hash: spec.meta.spec_hash, artifacts });
    }

    if (req.url.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
    return serveStatic(req, res);
  } catch (e) {
    return send(res, 500, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`SpecForge → http://localhost:${PORT}  (AI ${aiConfigured() ? 'configured' : 'OFF — deterministic only'})`);
});
