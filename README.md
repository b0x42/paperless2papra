# paperless2papra

CLI migration tool to export documents from [Paperless-ngx](https://docs.paperless-ngx.com) and import them into [Papra](https://papra.app).

## Features

- Exports all documents, tags, correspondents, and document types from Paperless-ngx
- Uploads documents to Papra with full metadata preservation
- Maps correspondents to `correspondent:` prefixed tags
- Maps document types to `type:` prefixed tags
- Encodes created dates and archive serial numbers into document names
- Transfers OCR content for full-text search in Papra
- Dry-run mode to preview changes before committing
- Export-only mode to dump Paperless-ngx data to JSON
- Safe to re-run (Papra deduplicates by SHA256)

## Installation

```bash
pnpm install -g paperless2papra
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
