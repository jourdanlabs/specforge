# SpecForge

**Your idea is not a spec. Forge it into one** — reproducibly, or with two models checking each other.

SpecForge turns a raw paragraph into build-ready artifacts (Full Spec, Deck Outline, AI Build Prompt, PRD) using one of two engines:

- **Deterministic** — rule-based. No model, no network. The same idea produces the **same spec and the same `spec_hash`**, every time. Regenerate it and hand it to an auditor.
- **AI-assisted** — the two-model pattern: **one model drafts** the spec, then a **second, independent model reviews it**, names the gaps, and returns a revised version. You see all three: draft → validation → final.

Zero runtime dependencies. Runs fully local. Deterministic mode needs no network or API key at all.

---

## Quickstart

```bash
git clone <this-repo> specforge
cd specforge
node server.mjs
# → http://localhost:4173
```

Requires **Node 18+**. That's it — no `npm install`, no build step.

### Enable AI-assisted mode (optional)

```bash
cp .env.example .env
# edit .env — set MODEL_API_KEY and (optionally) MODEL_BASE_URL / model names
node server.mjs
```

`MODEL_BASE_URL` accepts **any OpenAI-compatible `/chat/completions` endpoint** — OpenAI, a compatible gateway in front of Azure OpenAI, a local server, or an internal corporate model gateway. Nothing is hard-coded to a vendor. For genuine independence, point `MODEL_DRAFT` and `MODEL_VALIDATE` at **two different models**.

---

## How it works

```
raw idea ──► [ENGINE]
                ├─ deterministic ─► parse → structure → template → sha256(spec) ─► artifacts
                └─ ai-assisted  ─► draft (model A) ─► independent review (model B) ─► revised spec
```

- **Deterministic engine** (`lib/deterministic.mjs`): extracts entities, requirements (modal-verb sentences), personas, and non-functional signals from the idea, fills a spec template, and hashes the canonical result. Same input → same output → same hash.
- **AI engine** (`lib/ai.mjs`): a drafting pass and an adversarial review pass. The reviewer returns structured issues plus a revised document; the UI shows what changed.
- **Outputs** (`lib/outputs.mjs`): Full Spec · Deck Outline · AI Build Prompt · PRD.

## Why two engines

Deterministic is auditable and free and offline — good for reproducible, defensible specs. AI-assisted is faster and richer for messy ideas, and the second model exists so a single model never grades its own paper. Use whichever the moment calls for.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `MODEL_BASE_URL` | OpenAI-compatible base URL | `https://api.openai.com/v1` |
| `MODEL_API_KEY` | API key (enables AI mode) | — |
| `MODEL_DRAFT` | model that drafts the spec | `gpt-4o-mini` |
| `MODEL_VALIDATE` | model that reviews the draft | = `MODEL_DRAFT` |
| `MODEL_NAME` | one default for both | — |
| `PORT` | web server port | `4173` |

## License

MIT © JourdanLabs
