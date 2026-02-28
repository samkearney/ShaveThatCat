# Shave That Cat!

Upload a cat photo, get back a hairless Sphynx version. Built on Cloudflare Pages + Workers with the OpenAI gpt-image-1 API.

## Prerequisites

- Node.js 18+
- A Cloudflare account (free tier works)
- An OpenAI API key with image generation access

## Setup

```bash
npm install
npx wrangler login
```

Create `.dev.vars` in the project root with your OpenAI key:

```
OPENAI_API_KEY=sk-...
```

The KV namespace is already configured in `wrangler.toml`. If you need to recreate it:

```bash
npx wrangler kv namespace create SHAVE_KV
# Paste the returned ID into wrangler.toml
```

## Local development

Run the full stack locally (static files + API functions + local KV):

```bash
npx wrangler pages dev ./public
```

This builds the frontend automatically via the `[build]` config in `wrangler.toml`. Local KV is stored in `.wrangler/state/` (SQLite). The only external call is to the OpenAI API.

For frontend-only iteration with auto-rebuild on change:

```bash
npm run dev
```

Run this in a separate terminal alongside `wrangler pages dev`.

## Build

```bash
npm run build
```

Compiles `src/script.ts` into `public/script.js` via esbuild.

## Deploy

### CI/CD (GitHub Actions)

Pushes to `main` auto-deploy via `.github/workflows/deploy.yml`.

### Manual deploy

```bash
npx wrangler pages deploy ./public
```

## Rate limiting

The site has a global daily limit of 50 shaves, tracked via Cloudflare KV with a TTL of 24 hours. The counter resets automatically.
