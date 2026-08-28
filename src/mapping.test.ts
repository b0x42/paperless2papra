import type { PaperlessDocument } from './paperless'
import { describe, expect, it } from 'vitest'
import { CORRESPONDENT_TAG_COLOR, DEFAULT_TAG_COLOR, DOCTYPE_TAG_COLOR, encodeDocumentName, mapCorrespondents, mapDocumentTypes, mapTags, resolveTagIds } from './mapping'

describe('mapTags', () => {
  it('preserves tag color', () => {
    const result = mapTags([{ id: 1, name: 'important', color: '#ff0000' }])
    expect(result).toEqual([{ name: 'important', color: '#ff0000', source: 'tag', sourceId: 1 }])
  })

  it('uses default color when color is null', () => {
    const result = mapTags([{ id: 2, name: 'tax', color: null }])
    expect(result[0].color).toBe(DEFAULT_TAG_COLOR)
  })

  it('uses default color when color is undefined', () => {
    const result = mapTags([{ id: 3, name: 'misc' }])
    expect(result[0].color).toBe(DEFAULT_TAG_COLOR)
  })
})

describe('mapCorrespondents', () => {
  it('prefixes name with correspondent:', () => {
    const result = mapCorrespondents([{ id: 5, name: 'ACME Bank' }])
    expect(result).toEqual([{ name: 'correspondent:ACME Bank', color: CORRESPONDENT_TAG_COLOR, source: 'correspondent', sourceId: 5 }])
  })
})

describe('mapDocumentTypes', () => {
  it('prefixes name with type:', () => {
    const result = mapDocumentTypes([{ id: 3, name: 'Invoice' }])
    expect(result).toEqual([{ name: 'type:Invoice', color: DOCTYPE_TAG_COLOR, source: 'document_type', sourceId: 3 }])
  })
})

describe('encodeDocumentName', () => {
  it('encodes ASN', () => {
    expect(encodeDocumentName('Invoice.pdf', 1234)).toBe('[ASN:1234] Invoice.pdf')
  })

  it('returns title unchanged when no ASN', () => {
    expect(encodeDocumentName('Invoice.pdf', null)).toBe('Invoice.pdf')
  })
})

describe('resolveTagIds', () => {
  const doc = (overrides: Partial<PaperlessDocument> = {}): PaperlessDocument => ({
    id: 1,
    title: 'test',
    content: null,
    tags: [],
    correspondent: null,
    document_type: null,
    created_date: null,
    archive_serial_number: null,
    original_file_name: null,
    mime_type: null,
    ...overrides,
  })

  const tagMap = new Map([[1, 'papra-t1'], [2, 'papra-t2']])
  const correspondentMap = new Map([[5, 'papra-c5']])
  const docTypeMap = new Map([[3, 'papra-d3']])

  it('resolves tags, correspondent, and document type', () => {
    const result = resolveTagIds(doc({ tags: [1, 2], correspondent: 5, document_type: 3 }), tagMap, correspondentMap, docTypeMap)
    expect(result).toEqual(['papra-t1', 'papra-t2', 'papra-c5', 'papra-d3'])
  })

  it('resolves tags only when no correspondent or doc type', () => {
    const result = resolveTagIds(doc({ tags: [1] }), tagMap, correspondentMap, docTypeMap)
    expect(result).toEqual(['papra-t1'])
  })

  it('returns empty array when document has no metadata', () => {
    const result = resolveTagIds(doc(), tagMap, correspondentMap, docTypeMap)
    expect(result).toEqual([])
  })

  it('skips unmapped tag IDs', () => {
    const result = resolveTagIds(doc({ tags: [999] }), tagMap, correspondentMap, docTypeMap)
    expect(result).toEqual([])
  })
})
