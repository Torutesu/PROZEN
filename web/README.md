# PROZEN Web

Frontend for PROZEN (Next.js App Router).

## Prerequisites

- Node.js 20+
- pnpm

## Setup

```bash
pnpm install
cp .env.local.example .env.local
```

## Run Dev Server

```bash
pnpm dev
```

Default URL: `http://localhost:3000`

## Test Commands

```bash
pnpm lint
pnpm test
pnpm test:e2e
```

## E2E Notes (Playwright)

- Playwright starts the frontend on `http://localhost:3100`.
- `CLERK_SESSION_TOKEN` is required for authenticated E2E flows.
- Optional:
  - `PLAYWRIGHT_API_URL` (default: `http://localhost:8787`)
  - `PLAYWRIGHT_BASE_URL` (default: `http://localhost:3100`)
  - `PLAYWRIGHT_WS_ID` and `PLAYWRIGHT_PRODUCT_ID` (must be set together)
- If required auth or backend prerequisites are missing, E2E tests are skipped intentionally.
