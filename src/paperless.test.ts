import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { paginatedSchema, paperlessCorrespondentSchema, paperlessDocumentSchema, paperlessDocumentTypeSchema, paperlessTagSchema } from './paperless'

describe('paperlessTagSchema', () => {
  it('parses tag with color', () => {
    expect(v.parse(paperlessTagSchema, { id: 1, name: 'important', color: '#ff0000' }))
      .toEqual({ id: 1, name: 'important', color: '#ff0000' })
  })

  it('parses tag with null color', () => {
    expect(v.parse(paperlessTagSchema, { id: 1, name: 'tax', color: null }).color).toBeNull()
  })

  it('parses tag without color field (API v1)', () => {
    expect(v.parse(paperlessTagSchema, { id: 1, name: 'old' }).color).toBeUndefined()
  })

  it('rejects tag without name', () => {
    expect(() => v.parse(paperlessTagSchema, { id: 1 })).toThrow()
  })

  it('rejects tag without id', () => {
    expect(() => v.parse(paperlessTagSchema, { name: 'test' })).toThrow()
  })
})

describe('paperlessCorrespondentSchema', () => {
  it('parses valid correspondent', () => {
    expect(v.parse(paperlessCorrespondentSchema, { id: 5, name: 'ACME' }))
      .toEqual({ id: 5, name: 'ACME' })
  })

  it('rejects missing name', () => {
    expect(() => v.parse(paperlessCorrespondentSchema, { id: 5 })).toThrow()
  })
})

describe('paperlessDocumentTypeSchema', () => {
  it('parses valid document type', () => {
    expect(v.parse(paperlessDocumentTypeSchema, { id: 3, name: 'Invoice' }))
      .toEqual({ id: 3, name: 'Invoice' })
  })
})

describe('paperlessDocumentSchema', () => {
  const validDoc = {
    id: 1,
    title: 'Test',
    content: 'OCR text',
    tags: [1, 2],
    correspondent: 5,
    document_type: 3,
    created_date: '2024-01-15',
    archive_serial_number: 1234,
    original_file_name: 'test.pdf',
    mime_type: 'application/pdf',
  }

  it('parses full document', () => {
    expect(v.parse(paperlessDocumentSchema, validDoc)).toEqual(validDoc)
  })

  it('parses document with all nullable fields as null', () => {
    const doc = v.parse(paperlessDocumentSchema, {
      id: 2,
      title: 'Minimal',
      content: null,
      tags: [],
      correspondent: null,
      document_type: null,
      created_date: null,
      archive_serial_number: null,
      original_file_name: null,
      mime_type: null,
    })
    expect(doc.correspondent).toBeNull()
    expect(doc.document_type).toBeNull()
    expect(doc.content).toBeNull()
    expect(doc.tags).toEqual([])
  })

  it('rejects document without title', () => {
    expect(() => v.parse(paperlessDocumentSchema, { ...validDoc, title: undefined })).toThrow()
  })

  it('rejects non-numeric tags', () => {
    expect(() => v.parse(paperlessDocumentSchema, { ...validDoc, tags: ['a'] })).toThrow()
  })
})

describe('paginatedSchema', () => {
  const schema = paginatedSchema(paperlessTagSchema)

  it('parses valid paginated response', () => {
    const result = v.parse(schema, {
      count: 2,
      next: 'http://localhost/api/tags/?page=2',
      previous: null,
      results: [{ id: 1, name: 'a' }, { id: 2, name: 'b', color: '#000' }],
    })
    expect(result.count).toBe(2)
    expect(result.next).toBe('http://localhost/api/tags/?page=2')
    expect(result.results).toHaveLength(2)
  })

  it('parses last page with next=null', () => {
    const result = v.parse(schema, { count: 1, next: null, previous: null, results: [{ id: 1, name: 'a' }] })
    expect(result.next).toBeNull()
  })

  it('rejects missing results field', () => {
    expect(() => v.parse(schema, { count: 0, next: null, previous: null })).toThrow()
  })

  it('rejects invalid item in results', () => {
    expect(() => v.parse(schema, { count: 1, next: null, previous: null, results: [{ bad: true }] })).toThrow()
  })
})
