## Why

Users migrating from Paperless-ngx to Papra have no automated way to transfer their documents and metadata. With ~400+ documents, tags, correspondents, and document types, manual migration is impractical. A CLI tool that exports everything from Paperless-ngx and imports it into Papra — using Papra's own tech stack — fills this gap and can be open-sourced as a community tool.

## What Changes

- New standalone CLI tool `paperless-to-papra` built with the Papra tech stack (pnpm, TypeScript, citty, ofetch, @papra/api-sdk, vitest, tsdown)
- Exports documents, tags, correspondents, and document types from Paperless-ngx REST API
- Maps Paperless-ngx data model to Papra's simpler model (documents + tags)
- Correspondents and document types are converted to prefixed Papra tags (`correspondent:X`, `type:Y`)
- Created dates and archive serial numbers are encoded into document names (`[YYYY-MM-DD] [ASN:n] Title`)
- OCR content is transferred to preserve full-text search
- Imports everything into a Papra organization via the Papra API SDK
- CLI commands: `migrate` (full migration), `dry-run` (preview), `export-only` (dump to JSON)
- Licensed AGPL-3.0-or-later to match Papra

## Capabilities

### New Capabilities
- `paperless-export`: Export documents, tags, correspondents, and document types from Paperless-ngx via its REST API with pagination
- `papra-import`: Upload documents to Papra, set names/content, create tags, and associate tags to documents via @papra/api-sdk
- `data-mapping`: Map Paperless-ngx data model to Papra model (prefixed tags, encoded document names, OCR content)
- `migration-cli`: CLI interface with migrate, dry-run, and export-only commands using citty

### Modified Capabilities

(none — this is a new standalone project)

## Impact

- No changes to Paperless-ngx or Papra themselves
- New standalone npm package / repository
- Dependencies: @papra/api-sdk, citty, ofetch, picocolors, valibot
- Dev dependencies: tsdown, tsx, typescript, vitest, @antfu/eslint-config, eslint, @types/node
- Requires API access to both Paperless-ngx (token auth) and Papra (API key)
- Network-bound: 3 + N API calls per document during import (download, upload, PATCH, N tag associations)
