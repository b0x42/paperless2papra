/* eslint-disable no-console */
import type { PaperlessExport } from './paperless'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migrate, printSummary } from './papra'

// Mock dependencies
vi.mock('@papra/api-sdk', () => ({
  createClient: vi.fn(),
}))
vi.mock('ofetch', () => ({
  ofetch: vi.fn(),
}))
vi.mock('./paperless', () => ({
  downloadDocument: vi.fn(),
}))

const { createClient } = await import('@papra/api-sdk')
const { ofetch } = await import('ofetch')
const { downloadDocument } = await import('./paperless')

function makeExport(overrides: Partial<PaperlessExport> = {}): PaperlessExport {
  return {
    tags: [{ id: 1, name: 'important', color: '#ff0000' }],
    correspondents: [{ id: 5, name: 'ACME' }],
    documentTypes: [{ id: 3, name: 'Invoice' }],
    documents: [{
      id: 100,
      title: 'Test Doc',
      content: 'OCR text',
      tags: [1],
      correspondent: 5,
      document_type: 3,
      created_date: '2024-01-15',
      archive_serial_number: 42,
      original_file_name: 'test.pdf',
      mime_type: 'application/pdf',
    }],
    ...overrides,
  }
}

function setupMocks() {
  const addTagToDocument = vi.fn().mockResolvedValue({})
  const uploadDocument = vi.fn().mockResolvedValue({ document: { id: 'papra-doc-1' } })
  const createTag = vi.fn().mockImplementation(({ name }: { name: string }) =>
    Promise.resolve({ tag: { id: `papra-tag-${name}` } }),
  )
  const listTags = vi.fn().mockResolvedValue({ tags: [] })
  const orgClient = { listTags, createTag, uploadDocument, addTagToDocument }

  vi.mocked(createClient).mockReturnValue({
    forOrganization: () => orgClient,
  } as any)

  vi.mocked(downloadDocument).mockResolvedValue({
    buffer: new ArrayBuffer(8),
    fileName: 'test.pdf',
  })

  vi.mocked(ofetch).mockResolvedValue({}) // PATCH call

  return { orgClient, addTagToDocument, uploadDocument, createTag, listTags }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('migrate', () => {
  it('migrates a document end-to-end', async () => {
    const { uploadDocument, createTag, addTagToDocument } = setupMocks()
    const result = await migrate(makeExport(), 'http://pl', 'pl-token', 'http://papra', 'papra-token', 'org-1')

    expect(result).toEqual({ total: 1, migrated: 1, skipped: 0, failed: [] })
    expect(createTag).toHaveBeenCalledTimes(3) // 1 tag + 1 correspondent + 1 doctype
    expect(uploadDocument).toHaveBeenCalledTimes(1)
    expect(addTagToDocument).toHaveBeenCalledTimes(3)
  })

  it('patches document with encoded name and content', async () => {
    setupMocks()
    await migrate(makeExport(), 'http://pl', 'pl-token', 'http://papra', 'papra-token', 'org-1')

    expect(vi.mocked(ofetch)).toHaveBeenCalledWith(
      'http://papra/api/organizations/org-1/documents/papra-doc-1',
      expect.objectContaining({
        method: 'PATCH',
        body: { name: '[2024-01-15] [ASN:42] Test Doc', content: 'OCR text' },
      }),
    )
  })

  it('skips duplicate documents (409)', async () => {
    const { uploadDocument } = setupMocks()
    uploadDocument.mockRejectedValue({ statusCode: 409 })

    const result = await migrate(makeExport(), 'http://pl', 'pl-token', 'http://papra', 'papra-token', 'org-1')

    expect(result).toEqual({ total: 1, migrated: 0, skipped: 1, failed: [] })
  })

  it('records failed documents and continues', async () => {
    const { uploadDocument } = setupMocks()
    uploadDocument.mockRejectedValue(new Error('network error'))

    const data = makeExport({
      documents: [
        { id: 1, title: 'Fail', content: null, tags: [], correspondent: null, document_type: null, created_date: null, archive_serial_number: null, original_file_name: null, mime_type: null },
        { id: 2, title: 'Also Fail', content: null, tags: [], correspondent: null, document_type: null, created_date: null, archive_serial_number: null, original_file_name: null, mime_type: null },
      ],
    })

    const result = await migrate(data, 'http://pl', 'pl-token', 'http://papra', 'papra-token', 'org-1')

    expect(result.total).toBe(2)
    expect(result.failed).toHaveLength(2)
    expect(result.failed[0].title).toBe('Fail')
    expect(result.failed[1].title).toBe('Also Fail')
  })

  it('deduplicates tags against existing Papra tags', async () => {
    const mocks = setupMocks()
    mocks.listTags.mockResolvedValue({ tags: [{ id: 'existing-id', name: 'important' }] })

    await migrate(makeExport(), 'http://pl', 'pl-token', 'http://papra', 'papra-token', 'org-1')

    // Only 2 tags created (correspondent + doctype), "important" already exists
    expect(mocks.createTag).toHaveBeenCalledTimes(2)
  })

  it('skips tag association when document has no tags', async () => {
    const { addTagToDocument } = setupMocks()
    const data = makeExport({
      tags: [],
      correspondents: [],
      documentTypes: [],
      documents: [{ id: 1, title: 'No Tags', content: null, tags: [], correspondent: null, document_type: null, created_date: null, archive_serial_number: null, original_file_name: null, mime_type: null }],
    })

    await migrate(data, 'http://pl', 'pl-token', 'http://papra', 'papra-token', 'org-1')

    expect(addTagToDocument).not.toHaveBeenCalled()
  })

  it('omits content from PATCH when document has no OCR content', async () => {
    setupMocks()
    const data = makeExport({
      documents: [{ id: 1, title: 'No OCR', content: null, tags: [], correspondent: null, document_type: null, created_date: null, archive_serial_number: null, original_file_name: null, mime_type: null }],
    })

    await migrate(data, 'http://pl', 'pl-token', 'http://papra', 'papra-token', 'org-1')

    expect(vi.mocked(ofetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: { name: 'No OCR' } }),
    )
  })
})

describe('printSummary', () => {
  beforeEach(() => {
    vi.mocked(console.log).mockClear()
  })

  it('prints success summary', () => {
    printSummary({ total: 10, migrated: 10, skipped: 0, failed: [] })
    const output = vi.mocked(console.log).mock.calls.map(c => c[0]).join('\n')
    expect(output).toContain('10')
    expect(output).not.toContain('Skipped')
    expect(output).not.toContain('Failed')
  })

  it('prints skipped and failed counts', () => {
    printSummary({ total: 10, migrated: 7, skipped: 2, failed: [{ title: 'bad.pdf', error: 'oops' }] })
    const output = vi.mocked(console.log).mock.calls.map(c => c[0]).join('\n')
    expect(output).toContain('Skipped')
    expect(output).toContain('Failed')
    expect(output).toContain('bad.pdf')
  })
})
