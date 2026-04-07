## ADDED Requirements

### Requirement: CLI migrate command
The system SHALL provide a `migrate` command that performs a full migration from Paperless-ngx to Papra. It SHALL require the following options: `--paperless-url`, `--paperless-token`, `--papra-url`, `--papra-token`, `--papra-org-id`.

Before starting the export, the `migrate` command SHALL validate connectivity and credentials for both Paperless-ngx (by fetching `/api/tags/`) and Papra (by calling the `getCurrentApiKey` SDK method, verifying the org ID exists via `GET /api/organizations/:orgId`, and checking that the API key has the required permissions: `organizations:read`, `documents:create`, `documents:read`, `documents:update`, `tags:create`, `tags:read`). If either check fails, the command SHALL exit with a clear error message.

#### Scenario: Full migration
- **WHEN** the user runs `paperless-to-papra migrate --paperless-url http://localhost:8000 --paperless-token abc --papra-url http://localhost:1221 --papra-token ppapi_xyz --papra-org-id org_123`
- **THEN** all documents, tags, correspondents, and document types are exported from Paperless-ngx and imported into the specified Papra organization

#### Scenario: Missing required option
- **WHEN** the user omits a required option
- **THEN** the CLI shows an error message indicating the missing option

#### Scenario: Paperless-ngx unreachable
- **WHEN** the Paperless-ngx URL is unreachable or returns a network error
- **THEN** the CLI exits with an error message before any export begins

#### Scenario: Papra API key or org ID invalid
- **WHEN** the Papra API key is invalid or the org ID does not exist
- **THEN** the CLI exits with an error message before any export begins

### Requirement: CLI dry-run command
The system SHALL provide a `dry-run` command that exports all data from Paperless-ngx, performs the data mapping, and prints a summary of what would be imported without making any changes to Papra. It only requires Paperless-ngx options (`--paperless-url`, `--paperless-token`).

#### Scenario: Dry run output
- **WHEN** the user runs `paperless-to-papra dry-run --paperless-url ... --paperless-token ...`
- **THEN** the output shows: total document count, list of tags to create (original tags, `correspondent:` prefixed tags, `type:` prefixed tags with their colors), and a preview of the first 10 document name mappings (original title → encoded name)

### Requirement: CLI export-only command
The system SHALL provide an `export-only` command that exports all data from Paperless-ngx and writes it to a JSON file. It only requires Paperless-ngx options. If `--output` is omitted, it SHALL default to `paperless-export.json` in the current directory.

#### Scenario: Export to JSON
- **WHEN** the user runs `paperless-to-papra export-only --paperless-url ... --paperless-token ... --output export.json`
- **THEN** a JSON file is written containing all documents (metadata only, no file content), tags, correspondents, and document types

#### Scenario: Export with default output path
- **WHEN** the user runs `paperless-to-papra export-only --paperless-url ... --paperless-token ...` without `--output`
- **THEN** the JSON file is written to `paperless-export.json` in the current directory

### Requirement: Environment variable support
The system SHALL support providing credentials via environment variables as an alternative to CLI flags: `PAPERLESS_URL`, `PAPERLESS_TOKEN`, `PAPRA_URL`, `PAPRA_TOKEN`, `PAPRA_ORG_ID`.

#### Scenario: Credentials from environment
- **WHEN** `PAPERLESS_URL` and `PAPERLESS_TOKEN` are set as environment variables
- **THEN** the CLI uses those values without requiring the corresponding flags

#### Scenario: CLI flags override environment variables
- **WHEN** both `PAPERLESS_URL` env var and `--paperless-url` flag are provided
- **THEN** the CLI flag value takes precedence
