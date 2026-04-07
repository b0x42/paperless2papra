import { ofetch } from 'ofetch';
import * as v from 'valibot';

const paginatedSchema = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(itemSchema: T) =>
  v.object({
    count: v.number(),
    next: v.nullable(v.string()),
    previous: v.nullable(v.string()),
    results: v.array(itemSchema),
  });

const paperlessTagSchema = v.object({
  id: v.number(),
  name: v.string(),
  color: v.optional(v.nullable(v.string())),
});

const paperlessCorrespondentSchema = v.object({
  id: v.number(),
  name: v.string(),
});

const paperlessDocumentTypeSchema = v.object({
  id: v.number(),
  name: v.string(),
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
  mime_type: v.nullable(v.string()),
});

export type PaperlessTag = v.InferOutput<typeof paperlessTagSchema>;
export type PaperlessCorrespondent = v.InferOutput<typeof paperlessCorrespondentSchema>;
export type PaperlessDocumentType = v.InferOutput<typeof paperlessDocumentTypeSchema>;
export type PaperlessDocument = v.InferOutput<typeof paperlessDocumentSchema>;

export interface PaperlessExport {
  tags: PaperlessTag[];
  correspondents: PaperlessCorrespondent[];
  documentTypes: PaperlessDocumentType[];
  documents: PaperlessDocument[];
}

function createHeaders(token: string) {
  return {
    'Authorization': `Token ${token}`,
    'Accept': 'application/json; version=2',
  };
}

async function fetchAllPaginated<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  baseUrl: string,
  path: string,
  token: string,
  itemSchema: T,
): Promise<v.InferOutput<T>[]> {
  const schema = paginatedSchema(itemSchema);
  const results: v.InferOutput<T>[] = [];
  let url: string | null = `${baseUrl}${path}`;

  while (url) {
    const raw: unknown = await ofetch(url, { headers: createHeaders(token) });
    try {
      const page = v.parse(schema, raw);
      results.push(...(page.results as v.InferOutput<T>[]));
      url = page.next;
    }
    catch (e) {
      throw new Error(`Validation failed for ${url}: ${e instanceof Error ? e.message : e}`);
    }
  }

  return results;
}

export async function fetchTags(baseUrl: string, token: string): Promise<PaperlessTag[]> {
  return fetchAllPaginated(baseUrl, '/api/tags/', token, paperlessTagSchema);
}

export async function fetchCorrespondents(baseUrl: string, token: string): Promise<PaperlessCorrespondent[]> {
  return fetchAllPaginated(baseUrl, '/api/correspondents/', token, paperlessCorrespondentSchema);
}

export async function fetchDocumentTypes(baseUrl: string, token: string): Promise<PaperlessDocumentType[]> {
  return fetchAllPaginated(baseUrl, '/api/document_types/', token, paperlessDocumentTypeSchema);
}

export async function fetchDocuments(baseUrl: string, token: string): Promise<PaperlessDocument[]> {
  return fetchAllPaginated(baseUrl, '/api/documents/', token, paperlessDocumentSchema);
}

export async function downloadDocument(baseUrl: string, token: string, id: number): Promise<ArrayBuffer> {
  return ofetch(`${baseUrl}/api/documents/${id}/download/`, {
    headers: createHeaders(token),
    responseType: 'arrayBuffer',
  });
}

export async function exportAll(baseUrl: string, token: string): Promise<PaperlessExport> {
  const [tags, correspondents, documentTypes, documents] = await Promise.all([
    fetchTags(baseUrl, token),
    fetchCorrespondents(baseUrl, token),
    fetchDocumentTypes(baseUrl, token),
    fetchDocuments(baseUrl, token),
  ]);
  return { tags, correspondents, documentTypes, documents };
}
