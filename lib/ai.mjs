// AI-assisted spec engine — the two-model pattern:
//   1. DRAFT   — one model writes the spec from the raw idea.
//   2. VALIDATE — a second, independent model reviews it, names the gaps, and
//                 returns a revised version.
// Provider-agnostic: any OpenAI-compatible /chat/completions endpoint. Configure
// with env vars (see .env.example). Nothing is hard-coded to a vendor.

import { RENDERERS } from './outputs.mjs';

function cfg() {
  const base = (process.env.MODEL_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const key = process.env.MODEL_API_KEY || '';
  const draft = process.env.MODEL_DRAFT || process.env.MODEL_NAME || 'gpt-4o-mini';
  const validate = process.env.MODEL_VALIDATE || process.env.MODEL_NAME || draft;
  return { base, key, draft, validate };
}

export function aiConfigured() {
  return Boolean(process.env.MODEL_API_KEY);
}

async function chat(messages, model) {
  const { base, key } = cfg();
  if (!key) throw new Error('AI mode needs MODEL_API_KEY — copy .env.example to .env and set it (see README).');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`model endpoint ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('model returned no content');
  return content.trim();
}

// Turn a guided questionnaire into a labeled brief the drafter can use.
function answersToBrief(a = {}) {
  const field = (label, v) => {
    const t = String(v || '').trim();
    return t ? `${label}:\n${t}\n` : '';
  };
  return [
    field('What we are building', a.building),
    field('Problem / why now', a.problem),
    field('Users', a.users),
    field('Core features / must-haves', a.features),
    field('Key data / entities', a.entities),
    field('Constraints (non-functional)', a.constraints),
    field('Out of scope', a.nongoals),
    field('Success looks like', a.success),
  ].filter(Boolean).join('\n');
}

function draftMessages({ idea, answers, industry, type, outputs }) {
  const wanted = (outputs && outputs.length ? outputs : ['full_spec'])
    .filter((k) => RENDERERS[k])
    .map((k) => RENDERERS[k].label);
  const guided = answers && Object.values(answers).some((v) => String(v || '').trim());
  const input = guided
    ? `Structured brief (from a guided questionnaire):\n"""\n${answersToBrief(answers)}"""`
    : `Raw idea:\n"""\n${idea}\n"""`;
  return [
    {
      role: 'system',
      content:
        'You are a principal engineer who turns product ideas into precise, build-ready specifications. ' +
        'Write in crisp Markdown. Requirements must be testable. Mark every inference as an explicit **Assumption**. ' +
        'Do not invent metrics or facts. No preamble, no sign-off — just the document.',
    },
    {
      role: 'user',
      content:
        `${input}\n\n` +
        `Industry: ${industry || 'unspecified'} · Project type: ${type || 'unspecified'}\n\n` +
        `Produce these artifacts, each under a "## <NAME>" heading, in this order: ${wanted.join(', ')}.\n` +
        `For the spec/PRD include: overview, goals, non-goals, users, functional requirements, ` +
        `non-functional requirements, acceptance criteria, milestones, and an Assumptions section.`,
    },
  ];
}

function validateMessages(draft) {
  return [
    {
      role: 'system',
      content:
        'You are a second, INDEPENDENT principal engineer. Another model drafted the spec below. ' +
        'Review it adversarially: find missing requirements, untestable/ambiguous items, absent non-functional ' +
        'requirements, scope creep, and unstated assumptions. Then rewrite it to fix what you found. ' +
        'Respond with STRICT JSON only, no code fence, matching: ' +
        '{"issues":[{"severity":"high|med|low","where":"section","note":"..."}],"revised_markdown":"...","changed":true|false}. ' +
        'If the draft is already sound, set changed=false and return it unchanged in revised_markdown.',
    },
    { role: 'user', content: `Draft to review:\n"""\n${draft}\n"""` },
  ];
}

function extractJson(text) {
  // Tolerate a stray code fence or prose around the JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('validator did not return JSON');
  return JSON.parse(raw.slice(start, end + 1));
}

export async function aiSpec({ idea, answers, industry, type, outputs }) {
  const { draft: draftModel, validate: validateModel } = cfg();

  const draft = await chat(draftMessages({ idea, answers, industry, type, outputs }), draftModel);

  let issues = [];
  let final = draft;
  let changed = false;
  let validatorError = null;
  try {
    const raw = await chat(validateMessages(draft), validateModel);
    const parsed = extractJson(raw);
    issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    if (typeof parsed.revised_markdown === 'string' && parsed.revised_markdown.trim()) {
      final = parsed.revised_markdown.trim();
    }
    changed = Boolean(parsed.changed) || final !== draft;
  } catch (e) {
    validatorError = String(e.message || e);
  }

  return {
    engine: 'ai-assisted',
    models: { draft: draftModel, validate: validateModel },
    draft,
    issues,
    changed,
    final,
    validator_error: validatorError,
  };
}
