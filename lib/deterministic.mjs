// Deterministic spec engine — no model, no network, no randomness.
// Same input → same spec → same hash. This is the point: a build spec you can
// regenerate byte-for-byte and hand to an auditor.

import { createHash } from 'node:crypto';

const MODALS = ['must', 'should', 'shall', 'need', 'needs', 'want', 'wants', 'will', 'can', 'allow', 'allows', 'enable', 'enables', 'let', 'lets', 'support', 'supports', 'provide', 'provides', 'generate', 'generates', 'create', 'creates', 'handle', 'handles'];
const ACTORS = ['user', 'users', 'admin', 'admins', 'founder', 'founders', 'customer', 'customers', 'team', 'teams', 'developer', 'developers', 'analyst', 'analysts', 'operator', 'operators', 'manager', 'managers', 'client', 'clients', 'agent', 'agents', 'reviewer', 'reviewers', 'owner', 'owners', 'visitor', 'visitors'];
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'without', 'that', 'this', 'it', 'is', 'are', 'be', 'as', 'at', 'by', 'from', 'into', 'want', 'like', 'make', 'get', 'so', 'i', 'you', 'we', 'they', 'my', 'our', 'their', 'them', 'no', 'not']);

// Signal keywords → non-functional requirements (deterministic mapping).
const NFR_SIGNALS = [
  { re: /\b(local[-\s]?first|offline|on[-\s]?device)\b/i, nfr: 'Works offline / local-first: core flows function without a network connection; data is stored locally and syncs opportunistically.' },
  { re: /\b(real[-\s]?time|live|instant|streaming)\b/i, nfr: 'Low latency: interactive actions respond in under 200ms p95; live views update within 1s.' },
  { re: /\b(secure|security|auth|encrypt|private|privacy|compliance|audit)\b/i, nfr: 'Security & auditability: authenticated access, least-privilege, and an append-only audit trail for every state change.' },
  { re: /\b(scale|scalable|millions|high[-\s]?volume|throughput)\b/i, nfr: 'Scales horizontally: stateless request path; no single-node bottleneck on the hot path.' },
  { re: /\b(deterministic|reproducible|receipt|verifiable)\b/i, nfr: 'Deterministic outputs: identical inputs produce identical outputs and a re-computable content hash.' },
  { re: /\b(export|download|pdf|csv|xlsx|report)\b/i, nfr: 'Export-ready: primary artifacts export to a portable format (Markdown/PDF/CSV) without loss.' },
  { re: /\b(mobile|responsive|phone|tablet)\b/i, nfr: 'Responsive: usable from 360px to desktop widths; touch targets ≥ 44px.' },
  { re: /\b(accessible|a11y|wcag|screen[-\s]?reader)\b/i, nfr: 'Accessible: keyboard-operable, visible focus, and WCAG AA contrast.' },
];

const MILESTONES = [
  'M1 · Scaffold — repo, CI, data model, and a walking skeleton of the primary flow.',
  'M2 · Core — implement every functional requirement to acceptance-criteria.',
  'M3 · Harden — non-functional requirements, error states, and export/output.',
  'M4 · Polish — empty/loading/error UX, docs, and a demo path.',
];

// Split a field on newlines, commas, or semicolons into clean items.
function splitItems(s) {
  return String(s || '')
    .split(/\r?\n|,|;/)
    .map((x) => x.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean);
}

function sentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Candidate domain entities: multi-word capitalized phrases + salient repeated nouns.
function entities(text) {
  const found = new Map();
  // Capitalized phrases (proper nouns / feature names), excluding sentence starts we can't be sure of.
  const caps = text.match(/\b([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*)\b/g) || [];
  for (const c of caps) {
    if (c.split(' ').length >= 1 && !STOP.has(c.toLowerCase())) {
      found.set(c.toLowerCase(), c);
    }
  }
  // Salient lowercase nouns that repeat (frequency ≥ 2).
  const freq = new Map();
  for (const w of (text.toLowerCase().match(/\b[a-z][a-z-]{3,}\b/g) || [])) {
    if (STOP.has(w) || MODALS.includes(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  for (const [w, n] of freq) {
    if (n >= 2 && !found.has(w)) found.set(w, titleCase(w));
  }
  return [...found.values()].slice(0, 8);
}

function functionalRequirements(sents) {
  const reqs = [];
  for (const s of sents) {
    const low = s.toLowerCase();
    if (MODALS.some((m) => new RegExp(`\\b${m}\\b`).test(low))) {
      // Normalize into a requirement line.
      let r = s.replace(/^(i|we|they|the (?:app|system|tool|product|user))\s+(want to|would like to|need to|wants to|needs to)\s+/i, '');
      r = r.charAt(0).toUpperCase() + r.slice(1);
      reqs.push(r.replace(/[.!?]+$/, ''));
    }
  }
  // De-dupe, stable order.
  return [...new Set(reqs)];
}

function personas(text) {
  const low = text.toLowerCase();
  const hits = ACTORS.filter((a) => new RegExp(`\\b${a}\\b`).test(low)).map((a) => a.replace(/s$/, ''));
  const uniq = [...new Set(hits)];
  return uniq.length ? uniq.map(titleCase) : ['User'];
}

function nfrs(text) {
  const out = [];
  for (const { re, nfr } of NFR_SIGNALS) if (re.test(text)) out.push(nfr);
  if (!out.length) out.push('No non-functional signals detected in the idea — confirm performance, security, and platform targets before build.');
  return out;
}

export function buildSpec({ idea, industry = '', type = '' }) {
  const text = String(idea || '').trim();
  const sents = sentences(text);
  const ents = entities(text);
  const reqs = functionalRequirements(sents);
  const who = personas(text);
  const nf = nfrs(text);

  const assumptions = [];
  if (!industry) assumptions.push('Industry not specified — assumed general-purpose.');
  if (!type) assumptions.push('Project type not specified — assumed a web application.');
  if (!reqs.length) assumptions.push('No explicit "must/should" requirements found — requirements below were inferred from the idea and need confirmation.');
  if (!ents.length) assumptions.push('No distinct domain entities detected — data model is a placeholder.');

  const goals = sents.length
    ? [sents[0].replace(/[.!?]+$/, '')]
    : ['Deliver the capability described in the idea.'];

  const spec = {
    meta: {
      title: ents[0] ? `${ents[0]} — Build Specification` : 'Build Specification',
      industry: industry || 'general',
      type: type || 'web app',
      engine: 'deterministic',
      generated_from: text,
    },
    overview: text || 'No idea provided.',
    goals,
    non_goals: ['Anything not listed under Requirements is explicitly out of scope for v1.'],
    personas: who,
    entities: ents.length ? ents : ['(none detected)'],
    functional_requirements: reqs.length ? reqs : ['Implement the primary capability described in the overview.'],
    non_functional_requirements: nf,
    acceptance_criteria: (reqs.length ? reqs : ['the primary capability works']).map(
      (r, i) => `AC-${String(i + 1).padStart(2, '0')}: Given a prepared environment, when the user exercises "${r.replace(/^./, (c) => c.toLowerCase())}", then the system completes it without error and the result is observable.`,
    ),
    milestones: MILESTONES,
    open_questions: assumptions.length ? assumptions : ['None — the idea was specific enough to spec directly.'],
  };

  spec.meta.spec_hash = sha256(canonical(spec));
  return spec;
}

// Guided mode: the user answers a structured questionnaire, so we map their
// fields straight into the spec instead of extracting from prose. Richer, and
// still fully deterministic — same answers → same spec → same hash.
export function buildSpecFromAnswers(a = {}) {
  const building = String(a.building || '').trim();
  const problem = String(a.problem || '').trim();
  const industry = String(a.industry || '').trim();
  const type = String(a.type || '').trim();

  const feats = splitItems(a.features);
  const ents = splitItems(a.entities);
  const who = splitItems(a.users);
  const ngoals = splitItems(a.nongoals);
  const cons = splitItems(a.constraints);
  const succ = splitItems(a.success);

  const overview = [building, problem].filter(Boolean).join(' ') || 'No description provided.';
  const detected = nfrs([building, problem, String(a.features || ''), String(a.constraints || '')].join(' '))
    .filter((x) => !/^No non-functional signals/.test(x));
  const nf = [...new Set([...cons, ...detected])];

  const assumptions = [];
  if (!building) assumptions.push('"What are you building" was left blank.');
  if (!feats.length) assumptions.push('No core features listed — requirements need to be filled in before build.');
  if (!who.length) assumptions.push('No users specified — assumed a single generic user.');
  if (!ents.length) assumptions.push('No key entities listed — data model is a placeholder.');
  if (!industry) assumptions.push('Industry not specified.');
  if (!type) assumptions.push('Project type not specified.');

  const acRows = succ.length ? succ : feats;
  const acceptance = acRows.length
    ? acRows.map((r, i) =>
        succ.length
          ? `AC-${String(i + 1).padStart(2, '0')}: ${r}`
          : `AC-${String(i + 1).padStart(2, '0')}: Given a prepared environment, when the user exercises "${r.replace(/^./, (c) => c.toLowerCase())}", then the system completes it without error and the result is observable.`,
      )
    : ['AC-01: The primary capability works end to end.'];

  const spec = {
    meta: {
      title: `${ents[0] || building.split(/\s+/).slice(0, 4).join(' ') || 'Build'} — Build Specification`,
      industry: industry || 'general',
      type: type || 'web app',
      engine: 'deterministic',
      generated_from: overview,
    },
    overview,
    goals: building ? [building] : ['Deliver the described capability.'],
    non_goals: ngoals.length ? ngoals : ['Anything not listed under Requirements is out of scope for v1.'],
    personas: who.length ? who.map(titleCase) : ['User'],
    entities: ents.length ? ents : ['(none provided)'],
    functional_requirements: feats.length ? feats : ['Implement the primary capability described in the overview.'],
    non_functional_requirements: nf.length ? nf : ['Confirm performance, security, and platform targets before build.'],
    acceptance_criteria: acceptance,
    milestones: MILESTONES,
    open_questions: assumptions.length ? assumptions : ['None — the questionnaire was complete.'],
  };

  spec.meta.spec_hash = sha256(canonical(spec));
  return spec;
}

function canonical(spec) {
  // Stable stringify (sorted keys) so the hash is order-invariant.
  const seen = new WeakSet();
  const sort = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (seen.has(v)) return null;
      seen.add(v);
      return Object.keys(v).sort().reduce((o, k) => ((o[k] = sort(v[k])), o), {});
    }
    if (Array.isArray(v)) return v.map(sort);
    return v;
  };
  // exclude the hash field itself
  const { meta, ...rest } = spec;
  const { spec_hash, ...metaRest } = meta;
  return JSON.stringify(sort({ meta: metaRest, ...rest }));
}

export function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}
