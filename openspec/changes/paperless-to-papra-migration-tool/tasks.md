## 1. Project Scaffolding

- [x] 1.1 Create package.json with dependencies (citty, ofetch, @papra/api-sdk, picocolors, valibot) and devDependencies (tsdown, tsx, typescript, vitest, @antfu/eslint-config, eslint, @types/node), matching Papra conventions (type: module, AGPL-3.0-or-later)
- [x] 1.2 Create tsconfig.json, tsdown.config.ts, eslint.config.js (using @antfu/eslint-config), and bin/cli.mjs entry point
- [x] 1.3 Create .gitignore, LICENSE (AGPL-3.0), and README.md with usage documentation

## 2. Paperless-ngx API Client

- [x] 2.1 Create `src/paperless.ts` — ofetch-based client with token auth that fetches all tags, correspondents, document types, and documents with pagination. Define valibot schemas for all Paperless-ngx API responses and validate each response.
- [x] 2.2 Add document file download function (`/api/documents/<id>/download/`)

## 3. Data Mapping

- [x] 3.1 Create `src/mapping.ts` — functions to map Paperless tags to Papra tags (preserve color or default `#e74c3c`), correspondents to `correspondent:` prefixed tags (`#3498db`), document types to `type:` prefixed tags (`#2ecc71`)
- [x] 3.2 Add document name encoding function: `[YYYY-MM-DD] [ASN:n] title` format with optional segments
- [x] 3.3 Add function to resolve all Papra tag IDs for a document (original tags + correspondent tag + document type tag)

## 4. Papra Import

- [x] 4.1 Create `src/papra.ts` — import logic using @papra/api-sdk for upload/tags and a single direct ofetch PATCH call for name+content (SDK lacks updateDocument): create tags (with dedup against existing), upload documents, PATCH name and content in one call, associate tags, handle duplicate SHA256 gracefully, skip tag association for documents with no tags
- [x] 4.2 Add progress logging (`[n/total]`) and per-document error handling with skip-and-continue behavior
- [x] 4.3 Add migration summary output (success count, skipped/duplicate count, failure list)

## 5. CLI Commands

- [x] 5.1 Create `src/cli.ts` — citty main command with `--version` flag (read from package.json) and subcommands: `migrate`, `dry-run`, `export-only`
- [x] 5.2 Implement shared CLI options (--paperless-url, --paperless-token, --papra-url, --papra-token, --papra-org-id) with env var fallbacks (PAPERLESS_URL, PAPERLESS_TOKEN, PAPRA_URL, PAPRA_TOKEN, PAPRA_ORG_ID). Note: dry-run and export-only only require Paperless options.
- [x] 5.3 Implement preflight validation: verify Paperless-ngx connectivity (fetch first page of tags with API v2 Accept header) and Papra connectivity (getCurrentApiKey + verify required permissions + verify org ID exists) before starting migration
- [x] 5.4 Implement `migrate` command — preflight checks + full export + mapping + import pipeline
- [x] 5.5 Implement `dry-run` command — export + mapping + print summary (document count, all tag names with colors grouped by type, first 10 document name mappings)
- [x] 5.6 Implement `export-only` command — export Paperless data to JSON file (--output flag, default: `paperless-export.json`)

## 6. Repository & Open Source

- [x] 6.1 Initialize git repo, create initial commit
- [x] 6.2 Create public GitHub repository `paperless-to-papra` with description "CLI migration tool to export documents from Paperless-ngx and import them into Papra", topics: paperless-ngx, papra, migration, document-management, cli. Push.
- [x] 6.3 Include `docs/design-decisions.md` in repo and reference it from README
