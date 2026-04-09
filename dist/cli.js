import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { createClient } from "@papra/api-sdk";
import { defineCommand, runMain } from "citty";
import pc from "picocolors";
import { ofetch } from "ofetch";
import * as v from "valibot";
const CORRESPONDENT_TAG_COLOR = "#3498db";
const DOCTYPE_TAG_COLOR = "#2ecc71";
const MAX_TAG_NAME_LENGTH = 50;
function truncate(name) {
	return name.length > MAX_TAG_NAME_LENGTH ? name.slice(0, MAX_TAG_NAME_LENGTH) : name;
}
function mapTags(tags) {
	return tags.map((t) => ({
		name: truncate(t.name),
		color: t.color ?? "#e74c3c",
		source: "tag",
		sourceId: t.id
	}));
}
function mapCorrespondents(correspondents) {
	return correspondents.map((c) => ({
		name: truncate(`correspondent:${c.name}`),
		color: CORRESPONDENT_TAG_COLOR,
		source: "correspondent",
		sourceId: c.id
	}));
}
function mapDocumentTypes(types) {
	return types.map((t) => ({
		name: truncate(`type:${t.name}`),
		color: DOCTYPE_TAG_COLOR,
		source: "document_type",
		sourceId: t.id
	}));
}
function encodeDocumentName(title, createdDate, asn) {
	const parts = [];
	if (createdDate) parts.push(`[${createdDate.slice(0, 10)}]`);
	if (asn != null) parts.push(`[ASN:${asn}]`);
	parts.push(title);
	return parts.join(" ");
}
function resolveTagIds(doc, tagMap, correspondentMap, docTypeMap) {
	const ids = [];
	for (const tagId of doc.tags) {
		const papraId = tagMap.get(tagId);
		if (papraId) ids.push(papraId);
	}
	if (doc.correspondent != null) {
		const papraId = correspondentMap.get(doc.correspondent);
		if (papraId) ids.push(papraId);
	}
	if (doc.document_type != null) {
		const papraId = docTypeMap.get(doc.document_type);
		if (papraId) ids.push(papraId);
	}
	return ids;
}
//#endregion
//#region src/paperless.ts
function paginatedSchema(itemSchema) {
	return v.object({
		count: v.number(),
		next: v.nullable(v.string()),
		previous: v.nullable(v.string()),
		results: v.array(itemSchema)
	});
}
const paperlessTagSchema = v.object({
	id: v.number(),
	name: v.string(),
	color: v.optional(v.nullable(v.string()))
});
const paperlessCorrespondentSchema = v.object({
	id: v.number(),
	name: v.string()
});
const paperlessDocumentTypeSchema = v.object({
	id: v.number(),
	name: v.string()
});
const paperlessDocumentSchema = v.object({
	id: v.number(),
	title: v.string(),
	content: v.nullable(v.string()),
	tags: v.array(v.number()),
	correspondent: v.nullable(v.number()),
	document_type: v.nullable(v.number()),
	created_date: v.nullable(v.string()),
	archive_serial_number: v.nullable(v.number()),
	original_file_name: v.nullable(v.string()),
	mime_type: v.nullable(v.string())
});
function createHeaders(token) {
	return {
		Authorization: `Token ${token}`,
		Accept: "application/json; version=2"
	};
}
async function fetchAllPaginated(baseUrl, path, token, itemSchema) {
	const schema = paginatedSchema(itemSchema);
	const results = [];
	let url = `${baseUrl}${path}`;
	while (url) {
		const raw = await ofetch(url, { headers: createHeaders(token) });
		try {
			const page = v.parse(schema, raw);
			results.push(...page.results);
			url = page.next ? `${baseUrl}${new URL(page.next).pathname}${new URL(page.next).search}` : null;
		} catch (e) {
			throw new Error(`Validation failed for ${url}: ${e instanceof Error ? e.message : e}`);
		}
	}
	return results;
}
async function fetchTags(baseUrl, token) {
	return fetchAllPaginated(baseUrl, "/api/tags/", token, paperlessTagSchema);
}
async function fetchCorrespondents(baseUrl, token) {
	return fetchAllPaginated(baseUrl, "/api/correspondents/", token, paperlessCorrespondentSchema);
}
async function fetchDocumentTypes(baseUrl, token) {
	return fetchAllPaginated(baseUrl, "/api/document_types/", token, paperlessDocumentTypeSchema);
}
async function fetchDocuments(baseUrl, token) {
	return fetchAllPaginated(baseUrl, "/api/documents/", token, paperlessDocumentSchema);
}
async function downloadDocument(baseUrl, token, id) {
	const response = await ofetch.raw(`${baseUrl}/api/documents/${id}/download/?original=true`, {
		headers: createHeaders(token),
		responseType: "arrayBuffer"
	});
	const disposition = response.headers.get("content-disposition");
	const utf8Match = disposition?.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
	const match = disposition?.match(/filename="?([^"]+)"?/);
	const rawName = utf8Match?.[1] ? decodeURIComponent(utf8Match[1]) : match?.[1] ?? null;
	const fileName = rawName ? rawName.split(/[/\\]/).pop() : null;
	return {
		buffer: response._data,
		fileName
	};
}
async function exportAll(baseUrl, token) {
	const [tags, correspondents, documentTypes, documents] = await Promise.all([
		fetchTags(baseUrl, token),
		fetchCorrespondents(baseUrl, token),
		fetchDocumentTypes(baseUrl, token),
		fetchDocuments(baseUrl, token)
	]);
	return {
		tags,
		correspondents,
		documentTypes,
		documents
	};
}
//#endregion
//#region src/papra.ts
const MIME_EXTENSIONS = {
	"application/pdf": ".pdf",
	"image/png": ".png",
	"image/jpeg": ".jpg",
	"image/tiff": ".tiff",
	"image/gif": ".gif",
	"image/webp": ".webp",
	"text/plain": ".txt",
	"text/csv": ".csv",
	"text/html": ".html",
	"application/msword": ".doc",
	"application/rtf": ".rtf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx"
};
async function createTagsInPapra(client, orgId, mappedTags) {
	const orgClient = client.forOrganization(orgId);
	const { tags: existingTags } = await orgClient.listTags();
	const existingByName = new Map(existingTags.map((t) => [t.name, t.id]));
	const tagMap = /* @__PURE__ */ new Map();
	const correspondentMap = /* @__PURE__ */ new Map();
	const docTypeMap = /* @__PURE__ */ new Map();
	for (const mapped of mappedTags) {
		let papraId = existingByName.get(mapped.name);
		if (!papraId) try {
			const { tag } = await orgClient.createTag({
				name: mapped.name,
				color: mapped.color
			});
			papraId = tag.id;
		} catch (e) {
			const detail = e?.data ? JSON.stringify(e.data) : String(e);
			throw new Error(`Failed to create tag "${mapped.name}" (color: ${mapped.color}): ${detail}`);
		}
		if (mapped.source === "tag") tagMap.set(mapped.sourceId, papraId);
		else if (mapped.source === "correspondent") correspondentMap.set(mapped.sourceId, papraId);
		else if (mapped.source === "document_type") docTypeMap.set(mapped.sourceId, papraId);
	}
	return {
		tagMap,
		correspondentMap,
		docTypeMap
	};
}
async function patchDocument(papraUrl, papraToken, orgId, docId, body) {
	await ofetch(`${papraUrl}/api/organizations/${orgId}/documents/${docId}`, {
		method: "PATCH",
		headers: {
			"Authorization": `Bearer ${papraToken}`,
			"Content-Type": "application/json"
		},
		body
	});
}
async function migrateOneDocument(doc, index, total, paperlessUrl, paperlessToken, papraUrl, papraToken, orgId, client, tagMap, correspondentMap, docTypeMap) {
	const encodedName = encodeDocumentName(doc.title, doc.created_date, doc.archive_serial_number);
	console.log(`${pc.dim(`[${index + 1}/${total}]`)} Migrating "${pc.bold(encodedName)}"...`);
	const { buffer, fileName: responseFileName } = await downloadDocument(paperlessUrl, paperlessToken, doc.id);
	const ext = doc.mime_type ? MIME_EXTENSIONS[doc.mime_type] ?? `.${doc.mime_type.split("/")[1]}` : "";
	const fileName = doc.original_file_name ?? responseFileName ?? `${doc.title}${ext}`;
	const file = new File([buffer], fileName);
	let documentId;
	try {
		const { document } = await client.forOrganization(orgId).uploadDocument({ file });
		documentId = document.id;
	} catch (err) {
		if (err?.statusCode === 409) {
			console.log(pc.yellow(`  ⚠ Skipped (duplicate)`));
			return "skipped";
		}
		if (err?.statusCode === 413) throw new Error(`File too large for Papra (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
		throw err;
	}
	try {
		const patchBody = { name: encodedName };
		if (doc.content) patchBody.content = doc.content;
		await patchDocument(papraUrl, papraToken, orgId, documentId, patchBody);
		const papraTagIds = resolveTagIds(doc, tagMap, correspondentMap, docTypeMap);
		await Promise.all(papraTagIds.map((tagId) => client.forOrganization(orgId).addTagToDocument({
			documentId,
			tagId
		})));
	} catch (err) {
		console.log(pc.yellow(`  ⚠ Document uploaded (id: ${documentId}) but post-processing failed — manual fix needed`));
		throw err;
	}
	console.log(pc.green(`  ✓ Done`));
	return "migrated";
}
async function migrate(data, paperlessUrl, paperlessToken, papraUrl, papraToken, orgId) {
	const client = createClient({
		apiKey: papraToken,
		apiBaseUrl: papraUrl
	});
	console.log(pc.bold("\nCreating tags..."));
	const allMappedTags = [
		...mapTags(data.tags),
		...mapCorrespondents(data.correspondents),
		...mapDocumentTypes(data.documentTypes)
	];
	const { tagMap, correspondentMap, docTypeMap } = await createTagsInPapra(client, orgId, allMappedTags);
	console.log(pc.green(`  ✓ ${allMappedTags.length} tags ready\n`));
	const result = {
		total: data.documents.length,
		migrated: 0,
		skipped: 0,
		failed: []
	};
	for (let i = 0; i < data.documents.length; i++) {
		const doc = data.documents[i];
		try {
			const status = await migrateOneDocument(doc, i, data.documents.length, paperlessUrl, paperlessToken, papraUrl, papraToken, orgId, client, tagMap, correspondentMap, docTypeMap);
			if (status === "migrated") result.migrated++;
			else if (status === "skipped") result.skipped++;
		} catch (err) {
			const errorMsg = err?.message ?? String(err);
			console.log(pc.red(`  ✗ Failed: ${errorMsg}`));
			result.failed.push({
				title: doc.title,
				error: errorMsg
			});
		}
	}
	return result;
}
function printSummary(result) {
	console.log(pc.bold("\n── Migration Summary ──"));
	console.log(`  Total:    ${result.total}`);
	console.log(`  Migrated: ${pc.green(String(result.migrated))}`);
	if (result.skipped > 0) console.log(`  Skipped:  ${pc.yellow(String(result.skipped))} (duplicate)`);
	if (result.failed.length > 0) {
		console.log(`  Failed:   ${pc.red(String(result.failed.length))}`);
		for (const f of result.failed) console.log(`    - ${f.title}: ${f.error}`);
		if (result.failed.some((f) => f.error.includes("File too large"))) {
			console.log(pc.green(`\n  Hint: Some documents exceeded Papra's upload size limit.`));
			console.log(pc.green(`  Set DOCUMENT_STORAGE_MAX_UPLOAD_SIZE=0 to disable the limit.`));
			console.log(pc.green(`  See: https://docs.papra.app/self-hosting/configuration/#complete-env`));
			console.log(pc.green(`  Re-run this script afterwards — already migrated documents will be skipped.`));
		}
	}
}
//#endregion
//#region src/cli.ts
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
const REQUIRED_PERMISSIONS = [
	"organizations:read",
	"documents:create",
	"documents:read",
	"documents:update",
	"tags:create",
	"tags:read"
];
const paperlessArgs = {
	"paperless-url": {
		type: "string",
		description: "Paperless-ngx URL",
		default: process.env.PAPERLESS_URL
	},
	"paperless-token": {
		type: "string",
		description: "Paperless-ngx API token",
		default: process.env.PAPERLESS_TOKEN
	}
};
const papraArgs = {
	"papra-url": {
		type: "string",
		description: "Papra instance URL",
		default: process.env.PAPRA_URL
	},
	"papra-token": {
		type: "string",
		description: "Papra API key",
		default: process.env.PAPRA_TOKEN
	},
	"papra-org-id": {
		type: "string",
		description: "Papra organization ID",
		default: process.env.PAPRA_ORG_ID
	}
};
function requireArgs(args, keys) {
	for (const key of keys) if (!args[key]) {
		console.error(pc.red(`Missing required option: --${key}`));
		process.exit(1);
	}
}
async function preflightPaperless(url, token) {
	try {
		await fetchTags(url, token);
	} catch (err) {
		console.error(pc.red(`Paperless-ngx preflight failed: ${err?.message ?? err}`));
		process.exit(1);
	}
}
async function preflightPapra(url, token, orgId) {
	try {
		const client = createClient({
			apiKey: token,
			apiBaseUrl: url
		});
		const { apiKey } = await client.getCurrentApiKey();
		const missing = REQUIRED_PERMISSIONS.filter((p) => !apiKey.permissions.includes(p));
		if (missing.length > 0) {
			console.error(pc.red(`Papra API key missing permissions: ${missing.join(", ")}`));
			process.exit(1);
		}
		const { organizations } = await client.listOrganizations();
		if (!organizations.some((o) => o.id === orgId)) {
			console.error(pc.red(`Papra organization "${orgId}" not found`));
			process.exit(1);
		}
	} catch (err) {
		console.error(pc.red(`Papra preflight failed: ${err?.message ?? err}`));
		process.exit(1);
	}
}
const migrateCommand = defineCommand({
	meta: {
		name: "migrate",
		description: "Full migration from Paperless-ngx to Papra"
	},
	args: {
		...paperlessArgs,
		...papraArgs
	},
	async run({ args }) {
		requireArgs(args, [
			"paperless-url",
			"paperless-token",
			"papra-url",
			"papra-token",
			"papra-org-id"
		]);
		console.log(pc.bold("Preflight checks..."));
		await preflightPaperless(args["paperless-url"], args["paperless-token"]);
		console.log(pc.green("  ✓ Paperless-ngx connected"));
		await preflightPapra(args["papra-url"], args["papra-token"], args["papra-org-id"]);
		console.log(pc.green("  ✓ Papra connected\n"));
		console.log(pc.bold("Exporting from Paperless-ngx..."));
		const data = await exportAll(args["paperless-url"], args["paperless-token"]);
		console.log(`  ${data.documents.length} documents, ${data.tags.length} tags, ${data.correspondents.length} correspondents, ${data.documentTypes.length} document types\n`);
		const result = await migrate(data, args["paperless-url"], args["paperless-token"], args["papra-url"], args["papra-token"], args["papra-org-id"]);
		printSummary(result);
		if (result.failed.length > 0) process.exit(1);
	}
});
const dryRunCommand = defineCommand({
	meta: {
		name: "dry-run",
		description: "Preview migration without making changes"
	},
	args: { ...paperlessArgs },
	async run({ args }) {
		requireArgs(args, ["paperless-url", "paperless-token"]);
		console.log(pc.bold("Exporting from Paperless-ngx..."));
		const data = await exportAll(args["paperless-url"], args["paperless-token"]);
		const allTags = [
			...mapTags(data.tags),
			...mapCorrespondents(data.correspondents),
			...mapDocumentTypes(data.documentTypes)
		];
		console.log(pc.bold(`\n── Dry Run Summary ──\n`));
		console.log(`Documents: ${data.documents.length}`);
		console.log(`Tags to create: ${allTags.length}`);
		const tagsBySource = {
			tag: allTags.filter((t) => t.source === "tag"),
			correspondent: allTags.filter((t) => t.source === "correspondent"),
			document_type: allTags.filter((t) => t.source === "document_type")
		};
		for (const [source, tags] of Object.entries(tagsBySource)) {
			if (tags.length === 0) continue;
			console.log(`\n  ${pc.bold(source)} (${tags.length}):`);
			for (const t of tags) console.log(`    ${t.color} ${t.name}`);
		}
		console.log(pc.bold(`\nDocument name mappings (first 10):`));
		for (const doc of data.documents.slice(0, 10)) {
			const encoded = encodeDocumentName(doc.title, doc.created_date, doc.archive_serial_number);
			if (encoded !== doc.title) console.log(`  ${doc.title} → ${pc.green(encoded)}`);
			else console.log(`  ${doc.title} ${pc.dim("(unchanged)")}`);
		}
		if (data.documents.length > 10) console.log(pc.dim(`  ... and ${data.documents.length - 10} more`));
	}
});
const exportOnlyCommand = defineCommand({
	meta: {
		name: "export-only",
		description: "Export Paperless-ngx data to JSON"
	},
	args: {
		...paperlessArgs,
		output: {
			type: "string",
			description: "Output file path",
			default: "paperless-export.json"
		}
	},
	async run({ args }) {
		requireArgs(args, ["paperless-url", "paperless-token"]);
		console.log(pc.bold("Exporting from Paperless-ngx..."));
		const data = await exportAll(args["paperless-url"], args["paperless-token"]);
		const outPath = resolve(args.output);
		writeFileSync(outPath, JSON.stringify(data, null, 2));
		console.log(pc.green(`Exported to ${outPath}`));
		console.log(`  ${data.documents.length} documents, ${data.tags.length} tags, ${data.correspondents.length} correspondents, ${data.documentTypes.length} document types`);
	}
});
runMain(defineCommand({
	meta: {
		name: "paperless2papra",
		version,
		description: "Migrate documents from Paperless-ngx to Papra"
	},
	subCommands: {
		"migrate": migrateCommand,
		"dry-run": dryRunCommand,
		"export-only": exportOnlyCommand
	}
}));
//#endregion
export {};
