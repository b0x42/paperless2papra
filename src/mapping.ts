import type { PaperlessCorrespondent, PaperlessDocument, PaperlessDocumentType, PaperlessTag } from './paperless'

export const DEFAULT_TAG_COLOR = '#e74c3c'
export const CORRESPONDENT_TAG_COLOR = '#3498db'
export const DOCTYPE_TAG_COLOR = '#2ecc71'

export interface MappedTag {
  name: string
  color: string
  source: 'tag' | 'correspondent' | 'document_type'
  sourceId: number
}

const MAX_TAG_NAME_LENGTH = 50

function truncate(name: string): string {
  if (name.length > MAX_TAG_NAME_LENGTH) {
    console.warn(`Tag name truncated: "${name}" → "${name.slice(0, MAX_TAG_NAME_LENGTH)}"`)
    return name.slice(0, MAX_TAG_NAME_LENGTH)
  }
  return name
}

export function mapTags(tags: PaperlessTag[]): MappedTag[] {
  return tags.map(t => ({
    name: truncate(t.name),
    color: t.color ?? DEFAULT_TAG_COLOR,
    source: 'tag' as const,
    sourceId: t.id,
  }))
}

export function mapCorrespondents(correspondents: PaperlessCorrespondent[]): MappedTag[] {
  return correspondents.map(c => ({
    name: truncate(`correspondent:${c.name}`),
    color: CORRESPONDENT_TAG_COLOR,
    source: 'correspondent' as const,
    sourceId: c.id,
  }))
}

export function mapDocumentTypes(types: PaperlessDocumentType[]): MappedTag[] {
  return types.map(t => ({
    name: truncate(`type:${t.name}`),
    color: DOCTYPE_TAG_COLOR,
    source: 'document_type' as const,
    sourceId: t.id,
  }))
}

export function encodeDocumentName(title: string, createdDate: string | null, asn: number | null): string {
  const parts: string[] = []
  if (createdDate)
    parts.push(`[${createdDate.slice(0, 10)}]`)
  if (asn != null)
    parts.push(`[ASN:${asn}]`)
  parts.push(title)
  return parts.join(' ')
}

export function resolveTagIds(
  doc: PaperlessDocument,
  tagMap: Map<number, string>,
  correspondentMap: Map<number, string>,
  docTypeMap: Map<number, string>,
): string[] {
  const ids: string[] = []
  for (const tagId of doc.tags) {
    const papraId = tagMap.get(tagId)
    if (papraId)
      ids.push(papraId)
  }
  if (doc.correspondent != null) {
    const papraId = correspondentMap.get(doc.correspondent)
    if (papraId)
      ids.push(papraId)
  }
  if (doc.document_type != null) {
    const papraId = docTypeMap.get(doc.document_type)
    if (papraId)
      ids.push(papraId)
  }
  return ids
}
