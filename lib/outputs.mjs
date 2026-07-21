// Render a spec object into the four output artifacts. Pure, deterministic.

const bullet = (arr) => arr.map((x) => `- ${x}`).join('\n');
const num = (arr) => arr.map((x, i) => `${i + 1}. ${x}`).join('\n');

export function fullSpec(s) {
  return `# ${s.meta.title}

> Engine: **${s.meta.engine}** · Industry: ${s.meta.industry} · Type: ${s.meta.type}${s.meta.spec_hash ? ` · \`spec_hash ${s.meta.spec_hash.slice(0, 16)}…\`` : ''}

## 1. Overview
${s.overview}

## 2. Goals
${bullet(s.goals)}

## 3. Non-Goals
${bullet(s.non_goals)}

## 4. Users / Personas
${bullet(s.personas)}

## 5. Domain Entities
${bullet(s.entities)}

## 6. Functional Requirements
${num(s.functional_requirements)}

## 7. Non-Functional Requirements
${bullet(s.non_functional_requirements)}

## 8. Acceptance Criteria
${bullet(s.acceptance_criteria)}

## 9. Milestones
${bullet(s.milestones)}

## 10. Open Questions & Assumptions
${bullet(s.open_questions)}
`;
}

export function deckOutline(s) {
  const slides = [
    ['Title', `${s.meta.title}\n\n${s.goals[0]}`],
    ['The Problem', `Who it is for: ${s.personas.join(', ')}.\nWhat is broken today, in one line.`],
    ['What We Are Building', s.overview],
    ['How It Works', `Core entities: ${s.entities.join(', ')}.\nThe primary flow, end to end.`],
    ['Requirements', s.functional_requirements.slice(0, 5).map((r) => `• ${r}`).join('\n')],
    ['Non-Functional Bar', s.non_functional_requirements.slice(0, 3).map((r) => `• ${r}`).join('\n')],
    ['Plan', s.milestones.map((m) => `• ${m}`).join('\n')],
    ['Open Questions', s.open_questions.map((q) => `• ${q}`).join('\n')],
  ];
  return `# Deck Outline — ${s.meta.title}\n\n${slides
    .map(([t, body], i) => `## Slide ${i + 1} · ${t}\n${body}`)
    .join('\n\n')}\n`;
}

export function buildPrompt(s) {
  return `# AI Build Prompt — ${s.meta.title}

You are a senior engineer. Build the following from a clean repo. Do not ask
clarifying questions for anything already specified; for anything marked an
assumption, choose the sensible default and note it.

## What to build
${s.overview}

## Users
${bullet(s.personas)}

## Requirements (implement all)
${num(s.functional_requirements)}

## Quality bar (non-functional)
${bullet(s.non_functional_requirements)}

## Done means (acceptance criteria)
${bullet(s.acceptance_criteria)}

## Suggested milestones
${bullet(s.milestones)}

## Assumptions to resolve with defaults
${bullet(s.open_questions)}

Deliver: a runnable repo, a README with setup + run steps, and a short note on
every assumption you resolved.
`;
}

// An engineered, reusable prompt to accomplish the core capability with an LLM —
// role, objective, context, explicit instructions, constraints, output contract,
// a self-check, and a few-shot scaffold. This is the prompt-engineering artifact.
export function engineeredPrompt(s) {
  const role =
    s.meta.industry && s.meta.industry !== 'general'
      ? `You are a senior ${s.meta.industry} specialist producing a ${s.meta.type}.`
      : `You are a senior specialist producing a ${s.meta.type}.`;
  const constraints = [
    ...s.non_functional_requirements,
    ...s.non_goals.map((g) => `Out of scope — do not do: ${g}`),
  ];
  return `# Engineered Prompt — ${s.meta.title}

<!-- A reusable prompt. Fill the {{PLACEHOLDERS}} with each run's specifics. -->

## Role
${role} You are precise, you state assumptions explicitly, and you never invent facts.

## Objective
${s.goals[0]}

## Context
${s.overview}

- Audience / users: ${s.personas.join(', ')}
- Key entities: ${s.entities.join(', ')}
- This run's input: {{INPUT}}

## Instructions
${num(s.functional_requirements)}

## Constraints
${bullet(constraints)}

## Output format
Return **{{FORMAT — e.g. Markdown with the sections above}}**. Nothing else — no preamble, no sign-off.

## Self-check before you answer
${bullet(s.acceptance_criteria.map((a) => a.replace(/^AC-\d+:\s*/, '')))}

## Few-shot examples (fill in 1–2 to sharpen behavior)
- Example input: {{EXAMPLE_INPUT}}
- Example output: {{EXAMPLE_OUTPUT}}

## If anything is ambiguous
State the assumption you are making, choose the sensible default, and proceed. Do not stop to ask.
`;
}

export function prd(s) {
  return `# PRD — ${s.meta.title}

**Status:** Draft · **Type:** ${s.meta.type} · **Industry:** ${s.meta.industry}

## Problem
${s.overview}

## Objectives
${bullet(s.goals)}

## Non-Objectives
${bullet(s.non_goals)}

## Target Users
${bullet(s.personas)}

## Requirements
${num(s.functional_requirements)}

## Non-Functional Requirements
${bullet(s.non_functional_requirements)}

## Success Metrics
- Every acceptance criterion below is demonstrable in a review.
${s.acceptance_criteria.map((a) => `- ${a}`).join('\n')}

## Milestones
${bullet(s.milestones)}

## Open Questions
${bullet(s.open_questions)}
`;
}

export const RENDERERS = {
  full_spec: { label: 'Full Spec', render: fullSpec },
  deck_outline: { label: 'Deck Outline', render: deckOutline },
  build_prompt: { label: 'AI Build Prompt', render: buildPrompt },
  engineered_prompt: { label: 'Engineered Prompt', render: engineeredPrompt },
  prd: { label: 'PRD', render: prd },
};

export function renderOutputs(spec, outputs) {
  const keys = outputs && outputs.length ? outputs : ['full_spec'];
  return keys
    .filter((k) => RENDERERS[k])
    .map((k) => ({ key: k, label: RENDERERS[k].label, markdown: RENDERERS[k].render(spec) }));
}
