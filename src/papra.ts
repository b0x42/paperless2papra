/* eslint-disable no-console */
import type { MappedTag } from './mapping'
import type { PaperlessDocument, PaperlessExport } from './paperless'
import { createClient } from '@papra/api-sdk'
import { ofetch } from 'ofetch'
import pc from 'picocolors'
import { encodeDocumentName, mapCorrespondents, mapDocumentTypes, mapTags, resolveTagIds } from './mapping'
import { downloadDocument } from './paperless'

export interface MigrationResult {
  total: number
  migrated: number
  skipped: number
  failed: { title: string, error: string }[]
}

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/tiff': '.tiff',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/html': '.html',
  'application/msword': '.doc',
  'application/rtf': '.rtf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
}

async function createTagsInPapra(
  client: ReturnType<typeof createClient>,
  orgId: string,
  mappedTags: MappedTag[],
): Promise<{ tagMap: Map<number, string>, correspondentMap: Map<number, string>, docTypeMap: Map<number, string> }> {
  const orgClient = client.forOrganization(orgId)
  const { tags: existingTags } = await orgClient.listTags()
  const existingByName = new Map(existingTags.map(t => [t.name, t.id]))

  const tagMap = new Map<number, string>()
  const correspondentMap = new Map<number, string>()
  const docTypeMap = new Map<number, string>()

  for (const mapped of mappedTags) {
    let papraId = existingByName.get(mapped.name)
    if (!papraId) {
      try {
        const { tag } = await orgClient.createTag({ name: mapped.name, color: mapped.color })
        papraId = tag.id
      }
      catch (e: any) {
        const detail = e?.data ? JSON.stringify(e.data) : String(e)
        throw new Error(`Failed to create tag "${mapped.name}" (color: ${mapped.color}): ${detail}`)
      }
    }

    if (mapped.source === 'tag')
      tagMap.set(mapped.sourceId, papraId)
    else if (mapped.source === 'correspondent')
      correspondentMap.set(mapped.sourceId, papraId)
    else if (mapped.source === 'document_type')
      docTypeMap.set(mapped.sourceId, papraId)
  }

  return { tagMap, correspondentMap, docTypeMap }
}

async function patchDocument(papraUrl: string, papraToken: string, orgId: string, docId: string, body: { name?: string, content?: string }) {
  await ofetch(`${papraUrl}/api/organizations/${orgId}/documents/${docId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${papraToken}`, 'Content-Type': 'application/json' },
    body,
  })
}

async function migrateOneDocument(
  doc: PaperlessDocument,
  index: number,
  total: number,
  paperlessUrl: string,
  paperlessToken: string,
  papraUrl: string,
  papraToken: string,
  orgId: string,
  client: ReturnType<typeof createClient>,
  tagMap: Map<number, string>,
  correspondentMap: Map<number, string>,
  docTypeMap: Map<number, string>,
): Promise<'migrated' | 'skipped'> {
  const encodedName = encodeDocumentName(doc.title, doc.created_date, doc.archive_serial_number)
  console.log(`${pc.dim(`[${index + 1}/${total}]`)} Migrating "${pc.bold(encodedName)}"...`)

  // Download from Paperless
  const { buffer, fileName: responseFileName } = await downloadDocument(paperlessUrl, paperlessToken, doc.id)
  const ext = doc.mime_type ? (MIME_EXTENSIONS[doc.mime_type] ?? `.${doc.mime_type.split('/')[1]}`) : ''
  const fileName = doc.original_file_name ?? responseFileName ?? `${doc.title}${ext}`
  const file = new File([buffer], fileName)

  // Upload to Papra
  let documentId: string
  try {
    const { document } = await client.forOrganization(orgId).uploadDocument({ file })
    documentId = document.id
  }
  catch (err: any) {
    if (err?.statusCode === 409) {
      console.log(pc.yellow(`  ⚠ Skipped (duplicate)`))
      return 'skipped'
    }
    throw err
  }

  // PATCH name + content in one call
  try {
    const patchBody: { name?: string, content?: string } = { name: encodedName }
    if (doc.content)
      patchBody.content = doc.content
    await patchDocument(papraUrl, papraToken, orgId, documentId, patchBody)

    // Associate tags
    const papraTagIds = resolveTagIds(doc, tagMap, correspondentMap, docTypeMap)
    await Promise.all(papraTagIds.map(tagId =>
      client.forOrganization(orgId).addTagToDocument({ documentId, tagId }),
    ))
  }
  catch (err) {
    console.log(pc.yellow(`  ⚠ Document uploaded (id: ${documentId}) but post-processing failed — manual fix needed`))
    throw err
  }

  console.log(pc.green(`  ✓ Done`))
  return 'migrated'
}

export async function migrate(
  data: PaperlessExport,
  paperlessUrl: string,
  paperlessToken: string,
  papraUrl: string,
  papraToken: string,
  orgId: string,
): Promise<MigrationResult> {
  const client = createClient({ apiKey: papraToken, apiBaseUrl: papraUrl })

  // Create all tags
  console.log(pc.bold('\nCreating tags...'))
  const allMappedTags = [
    ...mapTags(data.tags),
    ...mapCorrespondents(data.correspondents),
    ...mapDocumentTypes(data.documentTypes),
  ]
  const { tagMap, correspondentMap, docTypeMap } = await createTagsInPapra(client, orgId, allMappedTags)
  console.log(pc.green(`  ✓ ${allMappedTags.length} tags ready\n`))

  // Migrate documents
  const result: MigrationResult = { total: data.documents.length, migrated: 0, skipped: 0, failed: [] }

  for (let i = 0; i < data.documents.length; i++) {
    const doc = data.documents[i]
    try {
      const status = await migrateOneDocument(
        doc,
        i,
        data.documents.length,
        paperlessUrl,
        paperlessToken,
        papraUrl,
        papraToken,
        orgId,
        client,
        tagMap,
        correspondentMap,
        docTypeMap,
      )
      if (status === 'migrated')
        result.migrated++
      else if (status === 'skipped')
        result.skipped++
    }
    catch (err: any) {
      const errorMsg = err?.message ?? String(err)
      console.log(pc.red(`  ✗ Failed: ${errorMsg}`))
      result.failed.push({ title: doc.title, error: errorMsg })
    }
  }

  return result
}

export function printSummary(result: MigrationResult) {
  console.log(pc.bold('\n── Migration Summary ──'))
  console.log(`  Total:    ${result.total}`)
  console.log(`  Migrated: ${pc.green(String(result.migrated))}`)
  if (result.skipped > 0)
    console.log(`  Skipped:  ${pc.yellow(String(result.skipped))} (duplicate)`)
  if (result.failed.length > 0) {
    console.log(`  Failed:   ${pc.red(String(result.failed.length))}`)
    for (const f of result.failed) {
      console.log(`    - ${f.title}: ${f.error}`)
    }
  }
}
