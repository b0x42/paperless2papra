# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

> Package manager is `pnpm`, but `npm run` works for all scripts.

```bash
npm run build          # compile src/ → dist/ via tsdown
npm run dev            # run CLI directly via tsx (no build needed)
npm test               # run tests once
npm run test:watch     # watch mode
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run lint:fix       # eslint --fix
```

Run a single test file:
```bash
npx vitest run src/mapping.test.ts
```

**Always run `npm run build` and commit `dist/` after changing source.** The built `dist/` is committed to the repo because `npm install -g github:...` on npm 11 doesn't run build steps reliably.

## Architecture

Single-purpose CLI tool: reads all documents from a Paperless-ngx instance and imports them into Papra.

**Data flow:**

```
cli.ts  →  paperless.ts (fetch/download)  →  mapping.ts (transform)  →  papra.ts (upload)
```

- **`paperless.ts`** — Paperless-ngx API client. Paginates all tags, correspondents, document types, and documents via `fetchAllPaginated`. Downloads original files via `downloadDocument`, which returns the file buffer, filename from `Content-Disposition`, and `Content-Type` header.
- **`mapping.ts`** — Transforms Paperless entities into Papra-compatible shapes. Correspondents and document types become Papra tags with fixed colors (`correspondent:NAME`, `type:NAME`). Tag names are truncated to 50 chars. `encodeDocumentName` prefixes the title with `[YYYY-MM-DD]` and `[ASN:N]` if present.
- **`papra.ts`** — Papra API client wrapper. `migrateOneDocument` downloads the file, builds a `File` object (using `doc.mime_type` → HTTP `Content-Type` → `application/octet-stream` as MIME fallback), uploads it, then PATCHes the name and OCR content in one call, and associates tags. Duplicate uploads (409) are silently skipped.
- **`cli.ts`** — Three subcommands: `migrate` (full run), `dry-run` (preview only, no writes), `export-only` (dump Paperless data to JSON). All credentials can be passed as CLI flags or env vars (`PAPERLESS_URL`, `PAPERLESS_TOKEN`, `PAPRA_URL`, `PAPRA_TOKEN`, `PAPRA_ORG_ID`).

**Papra API key** must have permissions: `organizations:read`, `documents:create`, `documents:read`, `documents:update`, `tags:create`, `tags:read` — validated on startup by `migrate`.

`dry-run` is read-only (hits Paperless only, no writes to Papra) — safe for testing credentials and previewing tag mappings.

**Key design decisions:**
- Migration is idempotent: re-running skips already-uploaded documents (Papra returns 409 on duplicates).
- Tags are created once up-front; existing tags with matching names are reused.
- `resolveNextUrl` validates that pagination URLs stay on the same hostname to prevent SSRF.
