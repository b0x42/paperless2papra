## ADDED Requirements

### Requirement: Map Paperless-ngx tags to Papra tags
The system SHALL map each Paperless-ngx tag to a Papra tag with the same name. If the Paperless-ngx tag has a color, it SHALL be preserved. If no color is available, the default color `#e74c3c` SHALL be used.

#### Scenario: Tag with color
- **WHEN** a Paperless-ngx tag has name "important" and color "#ff0000"
- **THEN** a Papra tag is created with name "important" and color "#ff0000"

#### Scenario: Tag without color
- **WHEN** a Paperless-ngx tag has name "tax" and no color
- **THEN** a Papra tag is created with name "tax" and color "#e74c3c"

### Requirement: Map correspondents to prefixed tags
The system SHALL convert each Paperless-ngx correspondent to a Papra tag with the format `correspondent:<name>` and color `#3498db`.

#### Scenario: Correspondent mapped to tag
- **WHEN** a Paperless-ngx correspondent has name "ACME Bank"
- **THEN** a Papra tag is created with name "correspondent:ACME Bank" and color "#3498db"

### Requirement: Map document types to prefixed tags
The system SHALL convert each Paperless-ngx document type to a Papra tag with the format `type:<name>` and color `#2ecc71`.

#### Scenario: Document type mapped to tag
- **WHEN** a Paperless-ngx document type has name "Invoice"
- **THEN** a Papra tag is created with name "type:Invoice" and color "#2ecc71"

### Requirement: Encode created date in document name
The system SHALL prepend the created date in `[YYYY-MM-DD]` format to the document name when a `created_date` is available.

#### Scenario: Document with created date
- **WHEN** a document has title "Invoice ACME.pdf" and created_date "2024-01-15"
- **THEN** the Papra document name SHALL be "[2024-01-15] Invoice ACME.pdf"

#### Scenario: Document without created date
- **WHEN** a document has title "Invoice ACME.pdf" and no created_date
- **THEN** the Papra document name SHALL be "Invoice ACME.pdf"

### Requirement: Encode archive serial number in document name
The system SHALL include the archive serial number in `[ASN:<number>]` format in the document name when available, placed after the date prefix (if present).

#### Scenario: Document with date and ASN
- **WHEN** a document has title "Invoice.pdf", created_date "2024-01-15", and archive_serial_number 1234
- **THEN** the Papra document name SHALL be "[2024-01-15] [ASN:1234] Invoice.pdf"

#### Scenario: Document with ASN but no date
- **WHEN** a document has title "Invoice.pdf", no created_date, and archive_serial_number 1234
- **THEN** the Papra document name SHALL be "[ASN:1234] Invoice.pdf"

#### Scenario: Document with neither date nor ASN
- **WHEN** a document has title "Invoice.pdf", no created_date, and no archive_serial_number
- **THEN** the Papra document name SHALL be "Invoice.pdf"

### Requirement: Collect all tag IDs for a document
The system SHALL resolve a document's tag associations by combining its original Paperless-ngx tag IDs, its correspondent (mapped to a prefixed tag), and its document type (mapped to a prefixed tag) into a single list of Papra tag IDs. This requires three separate ID mappings:
- `paperlessTagId → papraTagId` (for original tags)
- `paperlessCorrespondentId → papraTagId` (for correspondent prefixed tags)
- `paperlessDocTypeId → papraTagId` (for document type prefixed tags)

#### Scenario: Document with tags, correspondent, and document type
- **WHEN** a document has tags [1, 2], correspondent 5, and document_type 3
- **THEN** the resolved Papra tag list includes the mapped IDs for tags 1, 2, correspondent 5, and document type 3

#### Scenario: Document with no correspondent or document type
- **WHEN** a document has tags [1] but correspondent is null and document_type is null
- **THEN** the resolved Papra tag list includes only the mapped ID for tag 1
