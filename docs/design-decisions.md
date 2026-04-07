# Design Decisions

This document explains how `paperless2papra` maps data between Paperless-ngx and Papra, and why.

## Data Model Differences

Paperless-ngx has a richer metadata model than Papra. Papra is intentionally minimalistic — it supports **documents** and **tags**. Paperless-ngx additionally has **correspondents**, **document types**, **archive serial numbers**, and **created dates** as first-class concepts.

This tool preserves all Paperless-ngx metadata by mapping it into Papra's simpler model.

## Tag Mapping

### Original Tags

Paperless-ngx tags are migrated directly to Papra tags. If the Paperless-ngx API provides a tag color (API v2+), it is preserved. Otherwise, a default color (`#e74c3c`) is assigned. The tool requests API v2 via the `Accept: application/json; version=2` header. Instances older than Paperless-ngx 1.3.0 will fall back to API v1 and all tags will receive the default color.

### Correspondents → Prefixed Tags

Paperless-ngx correspondents have no equivalent in Papra. They are converted to Papra tags with a `correspondent:` prefix and a blue color (`#3498db`).

| Paperless-ngx Correspondent | Papra Tag                    | Color     |
|-----------------------------|------------------------------|-----------|
| ACME Bank                   | `correspondent:ACME Bank`    | `#3498db` |
| Dr. Smith                   | `correspondent:Dr. Smith`    | `#3498db` |

### Document Types → Prefixed Tags

Paperless-ngx document types are converted to Papra tags with a `type:` prefix and a green color (`#2ecc71`).

| Paperless-ngx Document Type | Papra Tag            | Color     |
|-----------------------------|----------------------|-----------|
| Invoice                     | `type:Invoice`       | `#2ecc71` |
| Contract                    | `type:Contract`      | `#2ecc71` |

## Document Name Encoding

Papra's API does not support setting a document's creation date or archive serial number. To preserve this information, it is encoded into the document name.

### Format

```
[YYYY-MM-DD] [ASN:n] Original Title.ext
```

### Examples

| Created Date | ASN  | Title              | Papra Document Name                     |
|--------------|------|--------------------|------------------------------------------|
| 2024-01-15   | 1234 | Invoice ACME.pdf   | `[2024-01-15] [ASN:1234] Invoice ACME.pdf` |
| 2024-01-15   | —    | Invoice ACME.pdf   | `[2024-01-15] Invoice ACME.pdf`          |
| —            | 1234 | Invoice ACME.pdf   | `[ASN:1234] Invoice ACME.pdf`            |
| —            | —    | Invoice ACME.pdf   | `Invoice ACME.pdf`                       |

## OCR Content

Paperless-ngx extracts text content from documents via OCR. This content is transferred to Papra's `content` field to preserve full-text search capability.

## Migration Phases

### Phase 1: Export

All data is read from Paperless-ngx (tags, correspondents, document types, documents) and assembled into an in-memory manifest.

### Phase 2: Import

1. **Create tags** — All original tags, correspondent tags, and document type tags are created in Papra. An ID mapping is built (`paperless_id → papra_tag_id`).
2. **Migrate documents** — For each document:
   - Download the original file from Paperless-ngx
   - Upload to Papra
   - Set the encoded document name
   - Set the OCR content
   - Associate all relevant tags

## Idempotency

Papra deduplicates documents by SHA256 hash. Re-running the migration is safe — duplicate uploads will be rejected and the document will be skipped entirely (Papra has no API to look up existing documents by hash, so name/content/tag updates cannot be applied to already-uploaded documents). The migration summary distinguishes between successfully migrated, skipped (duplicate), and failed documents.

## Error Handling

- Documents that fail to migrate are logged and skipped.
- Migration continues with the remaining documents.
- A summary is printed at the end listing all failures.
- The tool can be re-run to retry failed documents.
