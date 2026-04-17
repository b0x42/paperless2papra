import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@papra/api-sdk'
import { defineCommand, runMain } from 'citty'
import pc from 'picocolors'
import { encodeDocumentName, mapCorrespondents, mapDocumentTypes, mapTags } from './mapping'
import { exportAll, fetchTags } from './paperless'
import { migrate, printSummary } from './papra'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

const paperlessArgs = {
  'paperless-url': { type: 'string' as const, description: 'Paperless-ngx URL', default: process.env.PAPERLESS_URL },
  'paperless-token': { type: 'string' as const, description: 'Paperless-ngx API token', default: process.env.PAPERLESS_TOKEN },
}

const papraArgs = {
  'papra-url': { type: 'string' as const, description: 'Papra instance URL', default: process.env.PAPRA_URL },
  'papra-token': { type: 'string' as const, description: 'Papra API key', default: process.env.PAPRA_TOKEN },
  'papra-org-id': { type: 'string' as const, description: 'Papra organization ID', default: process.env.PAPRA_ORG_ID },
}

function requireArgs(args: Record<string, unknown>, keys: string[]): void {
  const missing = keys.filter(key => !args[key])
  if (missing.length > 0) {
    throw new Error(`Missing required option(s): ${missing.map(k => `--${k}`).join(', ')}`)
  }
}

async function preflightPaperless(url: string, token: string): Promise<void> {
  await fetchTags(url, token)
}

async function preflightPapra(url: string, token: string, orgId: string): Promise<void> {
  const requiredPermissions = ['organizations:read', 'documents:create', 'documents:read', 'documents:update', 'tags:create', 'tags:read']
  const client = createClient({ apiKey: token, apiBaseUrl: url })
  const { apiKey } = await client.getCurrentApiKey()
  const missing = requiredPermissions.filter(p => !apiKey.permissions.includes(p))
  if (missing.length > 0) {
    throw new Error(`Papra API key missing permissions: ${missing.join(', ')}`)
  }
  const { organizations } = await client.listOrganizations()
  if (!organizations.some(o => o.id === orgId)) {
    throw new Error(`Papra organization "${orgId}" not found`)
  }
}

const migrateCommand = defineCommand({
  meta: { name: 'migrate', description: 'Full migration from Paperless-ngx to Papra' },
  args: { ...paperlessArgs, ...papraArgs },
  async run({ args }) {
    try {
      requireArgs(args, ['paperless-url', 'paperless-token', 'papra-url', 'papra-token', 'papra-org-id'])

      console.log(pc.bold('Preflight checks...'))
      await preflightPaperless(args['paperless-url']!, args['paperless-token']!)
      console.log(pc.green('  ✓ Paperless-ngx connected'))
      await preflightPapra(args['papra-url']!, args['papra-token']!, args['papra-org-id']!)
      console.log(pc.green('  ✓ Papra connected\n'))

      console.log(pc.bold('Exporting from Paperless-ngx...'))
      const data = await exportAll(args['paperless-url']!, args['paperless-token']!)
      console.log(`  ${data.documents.length} documents, ${data.tags.length} tags, ${data.correspondents.length} correspondents, ${data.documentTypes.length} document types\n`)

      const result = await migrate(
        data,
        args['paperless-url']!,
        args['paperless-token']!,
        args['papra-url']!,
        args['papra-token']!,
        args['papra-org-id']!,
      )
      printSummary(result)
      if (result.failed.length > 0)
        process.exit(1)
    }
    catch (err: any) {
      console.error(pc.red(err?.message ?? String(err)))
      process.exit(1)
    }
  },
})

const dryRunCommand = defineCommand({
  meta: { name: 'dry-run', description: 'Preview migration without making changes' },
  args: { ...paperlessArgs },
  async run({ args }) {
    try {
      requireArgs(args, ['paperless-url', 'paperless-token'])

      console.log(pc.bold('Exporting from Paperless-ngx...'))
      const data = await exportAll(args['paperless-url']!, args['paperless-token']!)

      const allTags = [
        ...mapTags(data.tags),
        ...mapCorrespondents(data.correspondents),
        ...mapDocumentTypes(data.documentTypes),
      ]

      console.log(pc.bold(`\n── Dry Run Summary ──\n`))
      console.log(`Documents: ${data.documents.length}`)
      console.log(`Tags to create: ${allTags.length}`)

      const tagsBySource = { tag: allTags.filter(t => t.source === 'tag'), correspondent: allTags.filter(t => t.source === 'correspondent'), document_type: allTags.filter(t => t.source === 'document_type') }
      for (const [source, tags] of Object.entries(tagsBySource)) {
        if (tags.length === 0)
          continue
        console.log(`\n  ${pc.bold(source)} (${tags.length}):`)
        for (const t of tags) console.log(`    ${t.color} ${t.name}`)
      }

      console.log(pc.bold(`\nDocument name mappings (first 10):`))
      for (const doc of data.documents.slice(0, 10)) {
        const encoded = encodeDocumentName(doc.title, doc.created_date, doc.archive_serial_number)
        if (encoded !== doc.title) {
          console.log(`  ${doc.title} → ${pc.green(encoded)}`)
        }
        else {
          console.log(`  ${doc.title} ${pc.dim('(unchanged)')}`)
        }
      }
      if (data.documents.length > 10)
        console.log(pc.dim(`  ... and ${data.documents.length - 10} more`))
    }
    catch (err: any) {
      console.error(pc.red(err?.message ?? String(err)))
      process.exit(1)
    }
  },
})

const exportOnlyCommand = defineCommand({
  meta: { name: 'export-only', description: 'Export Paperless-ngx data to JSON' },
  args: { ...paperlessArgs, output: { type: 'string' as const, description: 'Output file path', default: 'paperless-export.json' } },
  async run({ args }) {
    try {
      requireArgs(args, ['paperless-url', 'paperless-token'])

      console.log(pc.bold('Exporting from Paperless-ngx...'))
      const data = await exportAll(args['paperless-url']!, args['paperless-token']!)

      const outPath = resolve(args.output!)
      writeFileSync(outPath, JSON.stringify(data, null, 2))
      console.log(pc.green(`Exported to ${outPath}`))
      console.log(`  ${data.documents.length} documents, ${data.tags.length} tags, ${data.correspondents.length} correspondents, ${data.documentTypes.length} document types`)
    }
    catch (err: any) {
      console.error(pc.red(err?.message ?? String(err)))
      process.exit(1)
    }
  },
})

const main = defineCommand({
  meta: { name: 'paperless2papra', version, description: 'Migrate documents from Paperless-ngx to Papra' },
  subCommands: { 'migrate': migrateCommand, 'dry-run': dryRunCommand, 'export-only': exportOnlyCommand },
})

runMain(main)
