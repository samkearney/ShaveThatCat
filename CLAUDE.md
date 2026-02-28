# CLAUDE.md

IMPORTANT: Please UPDATE this file and/or the README.md as necessary as changes are made to the architecture that might be relevant to future agents.

## Project overview

Joke website where users upload a cat photo and get back a "shaved" (hairless Sphynx) version. Hosted on Cloudflare Pages (free tier) with Pages Functions for the backend.

## Tech stack

- **Frontend**: Vanilla HTML/CSS/TypeScript, compiled with esbuild
- **Backend**: Cloudflare Pages Functions (TypeScript, runs on Workers runtime)
- **Image API**: OpenAI gpt-image-1 (`POST /v1/images/edits`)
- **Rate limiting**: Cloudflare Workers KV (50 shaves/day global cap)

## Project structure

```
src/script.ts          → Client-side logic (compiled to public/script.js)
public/index.html      → Single-page HTML
public/style.css       → Styles (Fredoka One font, pink/salmon palette)
functions/api/shave.ts → POST /api/shave — image transformation endpoint
functions/api/status.ts→ GET /api/status — remaining shaves counter
wrangler.toml          → Cloudflare Pages config + KV binding
.dev.vars              → Local dev secrets (gitignored)
```

## Key architecture details

**Frontend (`src/script.ts`)**:

- Drag-and-drop + file input for image upload
- Client-side image resize via Canvas API (max 1024px longest edge, outputs PNG) before uploading to reduce API costs
- `isShaving` flag prevents concurrent requests from double-clicks
- Rotating loading messages on a 3-second interval during processing

**Backend (`functions/api/shave.ts`)**:

- Accepts multipart/form-data with an `image` field
- Validates file type (PNG/JPEG/WebP) and size (10MB max)
- Rate limit via KV key `shave-count:YYYY-MM-DD` with 86400s TTL
- Forwards to OpenAI image edit API, returns base64 result
- Note: KV counter has a read-then-write race condition under concurrent requests; acceptable for a low-traffic joke site

**Environment bindings**:

- `OPENAI_API_KEY` — secret, set via `.dev.vars` locally or `wrangler pages secret put` for production
- `SHAVE_KV` — KV namespace binding for rate limiting

## CSS caveat

The `.section` class uses `display: flex`, which overrides the HTML `hidden` attribute. The rule `.section[hidden] { display: none }` is required to make section toggling work correctly.

## Build

`npm run build` runs esbuild to compile `src/script.ts` → `public/script.js`. The `[build]` section in `wrangler.toml` runs this automatically during `wrangler pages dev` and `wrangler pages deploy`. `public/script.js` is gitignored as a build artifact.
