# SpecForge

**Your idea is not a spec. Forge it into one** — reproducibly, or with two models checking each other.

SpecForge turns an idea into build-ready artifacts (Full Spec, Deck Outline, AI Build Prompt, PRD).

**Two input modes** (toggle at the top, works with either engine):
- **Raw idea** — dump a paragraph; the engine infers the structure.
- **Guided** — a short questionnaire (what, problem, users, features, entities, constraints, non-goals, success). Blanks become explicit assumptions. Best for the deterministic engine, which turns your answers straight into spec sections instead of guessing from prose.

**Two engines:**

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

AI mode is off until you give it an endpoint. Three steps, all inside the `specforge` folder:

**1. Create the config file**

```bash
cp .env.example .env
```

**2. Edit `.env`** (with `nano .env`, VS Code, or any editor) and fill in:

```bash
MODEL_BASE_URL=https://your-gateway/v1   # your approved endpoint
MODEL_API_KEY=your-key-here              # the key/token for it
MODEL_DRAFT=gpt-4o-mini                  # model that writes the draft
MODEL_VALIDATE=gpt-4o-mini               # model that reviews it (use a DIFFERENT one for real independence)
```

Only `MODEL_BASE_URL` and `MODEL_API_KEY` are required to turn it on — everything else has defaults.

**3. Restart the server** — press `Ctrl+C`, then `node server.mjs` again.

You'll know it worked when the terminal prints `AI configured` (instead of `AI OFF`) and the pill in the top-right of the page reads **AI · configured**. Click the **✦ AI-assisted** toggle, then **Forge spec** — you'll get the Draft → Validation → Final panels.

Your key lives only in `.env`, which is `.gitignore`d — it is never committed or pushed.

#### Which endpoint?

`MODEL_BASE_URL` accepts **any OpenAI-compatible `/chat/completions` endpoint**, called with a `Authorization: Bearer <key>` header. That covers OpenAI directly, most internal/corporate model gateways, and local servers (Ollama, LM Studio, vLLM). Point `MODEL_DRAFT` and `MODEL_VALIDATE` at **two different models** for genuine independence.

- **OpenAI-compatible gateway** → works as-is; just set the base URL + key.
- **Raw Azure OpenAI** (uses an `api-key` header, deployment names, and `?api-version=`) → not OpenAI-shaped; needs a small adapter. Open an issue / ask and it's a ~10-line add.
- **AWS Bedrock** (SigV4-signed) → same — needs an adapter, not the Bearer shape.

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
