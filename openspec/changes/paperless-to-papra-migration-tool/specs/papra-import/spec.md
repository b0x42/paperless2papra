## ADDED Requirements

### Requirement: Create tags in Papra
The system SHALL create all mapped tags (original tags, correspondent tags, document type tags) in the target Papra organization. It SHALL build an ID mapping from Paperless-ngx IDs to Papra tag IDs.

#### Scenario: Create a new tag
- **WHEN** a mapped tag "correspondent:ACME Bank" with color "#3498db" does not exist in Papra
- **THEN** the tag is created in Papra and its new ID is stored in the mapping

#### Scenario: Tag already exists in Papra
- **WHEN** a tag with the same name already exists in the Papra organization
- **THEN** the existing tag's ID is used in the mapping and no duplicate is created

### Requirement: Upload document file to Papra
The system SHALL upload each document's original file to the target Papra organization using the `@papra/api-sdk` `uploadDocument` method. The uploaded `File` object SHALL use the Paperless-ngx `original_file_name` as its filename.

#### Scenario: Successful upload
- **WHEN** a document file is uploaded
- **THEN** the Papra document ID is returned for subsequent operations

#### Scenario: Duplicate document (SHA256 match)
- **WHEN** a document with the same SHA256 hash already exists in Papra and the upload is rejected
- **THEN** the system logs a warning and skips this document entirely (upload, name, content, tags). The document is counted as skipped (not failed) in the summary. On a subsequent re-run, already-uploaded documents will be skipped this way, making the migration resumable.

### Requirement: Set document name and content in Papra
The system SHALL update the uploaded document's name and OCR content in a single `PATCH /api/organizations/:orgId/documents/:docId` call using direct `ofetch` with Bearer token auth. This is not available in the `@papra/api-sdk`. The body SHALL include the encoded name (with date and ASN prefixes) and, if available, the OCR content from Paperless-ngx.

#### Scenario: Update document name and content
- **WHEN** a document is uploaded with encoded name "[2024-01-15] Invoice.pdf" and has OCR content
- **THEN** a single PATCH sets both name and content on the Papra document

#### Scenario: Update document name only (no OCR content)
- **WHEN** a Paperless-ngx document has empty content
- **THEN** the PATCH only includes the name field

### Requirement: Associate tags with document in Papra
The system SHALL associate all resolved tags (original + correspondent + document type) with the uploaded document using the Papra API.

#### Scenario: Associate multiple tags
- **WHEN** a document has 3 resolved Papra tag IDs
- **THEN** each tag is associated with the document via `POST /api/organizations/:orgId/documents/:docId/tags`

#### Scenario: Document has no tags
- **WHEN** a document has no original tags, no correspondent, and no document type
- **THEN** the tag association step is skipped entirely for this document

### Requirement: Log progress during import
The system SHALL log progress for each document in the format `[n/total] Migrating "document name"...`.

#### Scenario: Progress logging
- **WHEN** document 42 of 400 is being migrated
- **THEN** the log shows `[42/400] Migrating "Invoice ACME.pdf"...`

### Requirement: Handle and report failures
The system SHALL catch errors for individual documents, log the failure, skip the document, and continue with the remaining documents. A summary of all failures SHALL be printed at the end.

#### Scenario: Document upload fails
- **WHEN** uploading a document fails with an error
- **THEN** the error is logged, the document is skipped, and migration continues

#### Scenario: Migration summary with failures
- **WHEN** migration completes with 2 failed documents and 3 skipped duplicates out of 400
- **THEN** a summary shows "395/400 documents migrated, 3 skipped (duplicate), 2 failed" and lists the failures
