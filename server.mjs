// SpecForge — zero-dependency Node server (Node 18+).
// Serves the UI and two spec engines: deterministic (offline) and AI-assisted.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

import { buildSpec, buildSpecFromAnswers } from './lib/deterministic.mjs';
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
      const { mode = 'deterministic', input_mode = 'raw', idea = '', answers = {}, industry = '', type = '', outputs = ['full_spec'] } = await readBody(req);
      const guided = input_mode === 'guided';
      const hasAnswers = answers && Object.values(answers).some((v) => String(v || '').trim());

      // Require some input: an idea (raw) or at least one filled answer (guided).
      if (guided ? !hasAnswers : !String(idea).trim()) {
        return send(res, 400, { error: guided ? 'fill in at least one field' : 'idea is required' });
      }

      if (mode === 'ai') {
        const result = await aiSpec({ idea, answers: guided ? answers : null, industry, type, outputs });
        return send(res, 200, { mode: 'ai', ...result });
      }

      const spec = guided
        ? buildSpecFromAnswers({ ...answers, industry, type })
        : buildSpec({ idea, industry, type });
      const artifacts = renderOutputs(spec, outputs);
      return send(res, 200, { mode: 'deterministic', spec_hash: spec.meta.spec_hash, artifacts });
    }

    // Verify a receipt: re-derive the hash from the receipt's own input and check
    // it against the claimed hash. Proves the spec is bound to its input — change
    // one character and it no longer verifies. Deterministic only.
    if (req.method === 'POST' && req.url === '/api/verify') {
      let { receipt } = await readBody(req);
      if (typeof receipt === 'string') {
        try { receipt = JSON.parse(receipt); } catch { return send(res, 400, { error: 'receipt is not valid JSON' }); }
      }
      if (!receipt || typeof receipt !== 'object') return send(res, 400, { error: 'paste a receipt object' });
      if (receipt.engine && receipt.engine !== 'deterministic') {
        return send(res, 400, { error: 'only deterministic specs carry a verifiable receipt (AI output is not reproducible)' });
      }
      const claimed = String(receipt.spec_hash || '');
      if (!claimed) return send(res, 400, { error: 'receipt has no spec_hash to verify against' });
      const spec = receipt.input_mode === 'guided'
        ? buildSpecFromAnswers({ ...(receipt.answers || {}), industry: receipt.industry, type: receipt.type })
        : buildSpec({ idea: receipt.idea || '', industry: receipt.industry, type: receipt.type });
      const recomputed = spec.meta.spec_hash;
      return send(res, 200, { verified: recomputed === claimed, claimed_hash: claimed, recomputed_hash: recomputed });
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
