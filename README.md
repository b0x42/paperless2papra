# paperless2papra

CLI migration tool to export documents from [Paperless-ngx](https://docs.paperless-ngx.com) and import them into [Papra](https://papra.app).

> **Try Papra risk-free.** This tool copies your documents from Paperless-ngx to Papra without touching your Paperless data. Nothing gets modified, nothing gets deleted — it's read-only on the Paperless side. If you don't like Papra, your Paperless setup is exactly as you left it.

## Features

- 📦 **Full export** — documents, tags, correspondents, and document types from Paperless-ngx
- 🏷️ **Metadata preservation** — correspondents → `correspondent:` tags, document types → `type:` tags, colors preserved
- 📅 **Date & ASN encoding** — created dates and archive serial numbers embedded in document names
- 🔍 **OCR content transfer** — full-text search preserved in Papra
- 👀 **Dry-run mode** — preview what would be migrated without making changes
- 💾 **Export-only mode** — dump Paperless-ngx data to JSON
- 🔁 **Idempotent** — safe to re-run, duplicates are skipped via SHA256

## Installation

```bash
# From GitHub
pnpm install -g github:b0x42/paperless2papra

# Or run directly without installing
pnpx github:b0x42/paperless2papra migrate --help
```

## Usage

### Full migration

```bash
paperless2papra migrate \
  --paperless-url http://localhost:8000 \
  --paperless-token YOUR_PAPERLESS_TOKEN \
  --papra-url http://localhost:1221 \
  --papra-token YOUR_PAPRA_API_KEY \
  --papra-org-id YOUR_ORG_ID
```

### Dry run (preview without changes)

```bash
paperless2papra dry-run \
  --paperless-url http://localhost:8000 \
  --paperless-token YOUR_PAPERLESS_TOKEN
```

### Export only (dump to JSON)

```bash
paperless2papra export-only \
  --paperless-url http://localhost:8000 \
  --paperless-token YOUR_PAPERLESS_TOKEN \
  --output export.json
```

### Environment variables

All options can be provided via environment variables:

| Flag | Environment Variable |
|------|---------------------|
| `--paperless-url` | `PAPERLESS_URL` |
| `--paperless-token` | `PAPERLESS_TOKEN` |
| `--papra-url` | `PAPRA_URL` |
| `--papra-token` | `PAPRA_TOKEN` |
| `--papra-org-id` | `PAPRA_ORG_ID` |

CLI flags take precedence over environment variables.

## How data is mapped

See [docs/design-decisions.md](docs/design-decisions.md) for full details.

| Paperless-ngx | Papra |
|---|---|
| Document file | Document (uploaded) |
| Document title | Document name (with date/ASN prefix) |
| Tags | Tags (color preserved) |
| Correspondents | Tags with `correspondent:` prefix |
| Document types | Tags with `type:` prefix |
| Created date | Encoded in document name: `[YYYY-MM-DD]` |
| Archive serial number | Encoded in document name: `[ASN:n]` |
| OCR content | Document content field |

### Document name format

```
[YYYY-MM-DD] [ASN:n] Original Title.ext
```

Segments are omitted when not available.

## Required Papra API permissions

Your Papra API key needs these permissions:
- `organizations:read`
- `documents:create`, `documents:read`, `documents:update`
- `tags:create`, `tags:read`

## License

[AGPL-3.0-or-later](LICENSE)
