## ADDED Requirements

### Requirement: Fetch all tags from Paperless-ngx
The system SHALL fetch all tags from the Paperless-ngx API at `/api/tags/` with pagination support. Each tag SHALL include its `id`, `name`, and `color` (if available via API v2). API responses SHALL be validated using valibot schemas to ensure data integrity from the untyped external API.

#### Scenario: Fetch tags successfully
- **WHEN** the Paperless-ngx instance has tags
- **THEN** all tags are returned with their id, name, and color fields

#### Scenario: Tag has no color field (API v1)
- **WHEN** a tag does not have a `color` field
- **THEN** the color SHALL be set to `null`

### Requirement: Fetch all correspondents from Paperless-ngx
The system SHALL fetch all correspondents from the Paperless-ngx API at `/api/correspondents/` with pagination support. Each correspondent SHALL include its `id` and `name`.

#### Scenario: Fetch correspondents successfully
- **WHEN** the Paperless-ngx instance has correspondents
- **THEN** all correspondents are returned with their id and name

### Requirement: Fetch all document types from Paperless-ngx
The system SHALL fetch all document types from the Paperless-ngx API at `/api/document_types/` with pagination support. Each document type SHALL include its `id` and `name`.

#### Scenario: Fetch document types successfully
- **WHEN** the Paperless-ngx instance has document types
- **THEN** all document types are returned with their id and name

### Requirement: Fetch all documents from Paperless-ngx
The system SHALL fetch all documents from the Paperless-ngx API at `/api/documents/` with pagination support. Each document SHALL include `id`, `title`, `content`, `tags` (list of tag IDs), `correspondent` (ID or null), `document_type` (ID or null), `created_date`, `archive_serial_number`, and `original_file_name`.

#### Scenario: Fetch documents with pagination
- **WHEN** the Paperless-ngx instance has more documents than one page
- **THEN** the system follows the `next` URL from the Django REST Framework paginated response (`{ count, next, previous, results[] }`) to fetch all pages

#### Scenario: Document has no correspondent or document type
- **WHEN** a document has `correspondent: null` or `document_type: null`
- **THEN** those fields are preserved as null in the export

### Requirement: Download document file from Paperless-ngx
The system SHALL download the original document file from `/api/documents/<id>/download/` for each document.

#### Scenario: Download original file
- **WHEN** a document exists in Paperless-ngx
- **THEN** the original file binary is downloaded and available for upload to Papra

### Requirement: Authenticate with Paperless-ngx using token
The system SHALL authenticate all Paperless-ngx API requests using the `Authorization: Token <token>` header. All requests SHALL also include the `Accept: application/json; version=2` header to request API v2, which is required for tag colors.

#### Scenario: Valid token
- **WHEN** a valid API token is provided
- **THEN** all API requests succeed with authentication and return API v2 responses

#### Scenario: Invalid token
- **WHEN** an invalid API token is provided
- **THEN** the system SHALL report an authentication error and exit

#### Scenario: Paperless-ngx instance does not support API v2
- **WHEN** the instance is older than Paperless-ngx 1.3.0 and does not support API versioning
- **THEN** the system falls back gracefully — tag colors will be null and default colors are used

### Requirement: Validate API responses with valibot
The system SHALL define valibot schemas for all Paperless-ngx API responses (paginated lists of tags, correspondents, document types, documents) and validate each response against its schema. If validation fails, the system SHALL report a clear error indicating which endpoint returned unexpected data.

#### Scenario: Valid API response
- **WHEN** the Paperless-ngx API returns a well-formed paginated response
- **THEN** the response passes valibot validation and is parsed into typed objects

#### Scenario: Unexpected API response shape
- **WHEN** the Paperless-ngx API returns data that does not match the expected schema
- **THEN** the system reports a validation error with the endpoint URL and schema mismatch details
