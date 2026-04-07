## Context

Paperless-ngx is a document management system with a Django REST API exposing documents, tags, correspondents, and document types. Papra is a minimalistic document archiving platform with a TypeScript/Node.js stack (pnpm, vitest, tsdown, citty) exposing documents and tags via REST API with an official TypeScript SDK (`@papra/api-sdk`).

The migration tool is a new standalone project — no existing codebase. It must match Papra's tech stack conventions to be a good open-source citizen in the Papra ecosystem.

## Goals / Non-Goals

**Goals:**
- Fully automated migration of all documents and metadata from Paperless-ngx to Papra
- Preserve all metadata by mapping to Papra's model (prefixed tags, encoded names)
- Safe to re-run (idempotent via Papra's SHA256 deduplication)
- Dry-run mode for previewing changes before committing
- Export-only mode for inspecting Paperless-ngx data
- Match Papra's tech stack and open-source conventions (AGPL-3.0)

**Non-Goals:**
- Bidirectional sync or Papra-to-Paperless migration
- Migrating Paperless-ngx user accounts or permissions
- Migrating saved views, mail rules, or workflow automations
- Real-time or incremental sync — this is a one-shot migration tool
- Custom field migration (Paperless-ngx custom fields have no Papra equivalent)
- Storage path migration (Paperless-ngx storage paths have no Papra equivalent)

## Decisions

### 1. Use `ofetch` directly for Paperless-ngx API, `@papra/api-sdk` + `ofetch` for Papra

**Rationale**: The Papra SDK handles auth, upload, tag creation, and tag association. No SDK exists for Paperless-ngx, but its REST API is simple enough that `ofetch` with token auth covers it. However, the Papra SDK does not expose a `updateDocument` method — PATCH operations for document name and content require direct `ofetch` calls to the Papra API. Both the SDK and raw `ofetch` are used on the Papra side.

**Alternative considered**: Building a full Paperless-ngx SDK — rejected as over-engineering for a migration tool. Waiting for SDK update — rejected as it blocks the project on upstream.

### 2. Correspondents and document types become prefixed tags

**Rationale**: Papra has no correspondent or document type concept. Prefixed tags (`correspondent:X`, `type:Y`) with distinct colors preserve the information in a searchable, filterable way. Users can later set up Papra tagging rules based on these prefixes.

**Alternative considered**: Dropping correspondents/types silently — rejected because the user explicitly wants all metadata preserved.

### 3. Created date and ASN encoded in document name

**Rationale**: Papra's API does not support setting a document's creation date or arbitrary metadata fields. Encoding `[YYYY-MM-DD] [ASN:n]` in the document name is the only way to preserve this information without Papra API changes.

**Alternative considered**: Losing the data — rejected. Storing in a separate metadata file — rejected as it wouldn't be visible in Papra's UI.

### 4. Sequential document processing with progress logging

**Rationale**: 400 documents × (3 + N tag associations) API calls each. Sequential processing with a small delay avoids overwhelming a self-hosted Papra instance. Progress logging (`[42/400] Migrating "Invoice.pdf"...`) gives visibility.

**Alternative considered**: Parallel processing — rejected for self-hosted reliability. Could be added later as an option.

### 5. Project structure as a single flat `src/` directory

**Rationale**: The tool has 4 clear modules (paperless client, papra import, data mapping, CLI). A flat structure with one file per module keeps it simple and matches the SDK's structure.

## Risks / Trade-offs

- **[Papra tag creation format]** → Papra docs say "Create a tag" uses `Body (form-data)`, but the official SDK sends JSON. The SDK works, so the API likely accepts both. If tag creation fails, try form-data encoding as fallback.
- **[Rate limiting]** → Self-hosted Papra likely has no rate limits, but sequential processing with logging provides natural pacing. Cloud Papra users may need throttling added later.
- **[Partial failure]** → A document may upload but fail tag association. Mitigation: log failures, continue, print summary. Re-running is safe due to deduplication.
- **[Large files]** → Documents are downloaded to memory then re-uploaded. For very large files this could be problematic. Mitigation: acceptable for ~400 docs; streaming could be added later.
- **[Paperless API version]** → Tag colors require API v2. Mitigation: fall back to default colors if color field is missing.
- **[No creation date API]** → Name encoding is a workaround, not a proper solution. If Papra adds a creation date API in the future, the tool should be updated.

## Open Questions

All resolved — no outstanding questions.

### Resolved: Resume support
Deferred to a future version. For 400 documents, re-running from scratch is acceptable due to Papra's SHA256 deduplication. If the upload is a duplicate, the tool will log a warning and skip the document entirely.

### Resolved: Concurrency flag
Deferred to a future version. Sequential processing is sufficient for self-hosted instances with ~400 documents.

### Resolved: Deduplication behavior on re-run
When Papra rejects a duplicate upload (same SHA256), the tool SHALL treat this as a non-fatal skip (not a failure). The document is skipped entirely — no name/content/tag updates are attempted, since Papra has no API to look up a document by hash. This means re-running the migration is safe but won't update metadata on already-uploaded documents. The summary will report skipped documents separately from failures.
