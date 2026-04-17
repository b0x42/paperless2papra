# Contributing to paperless2papra

Thanks for your interest in contributing!

## Getting started

```bash
git clone https://github.com/b0x42/paperless2papra.git
cd paperless2papra
pnpm install
```

## Development

```bash
pnpm dev -- migrate --help   # Run from source
pnpm build                    # Build dist/
pnpm test                     # Run tests
pnpm lint                     # Lint
pnpm lint:fix                 # Lint + auto-fix
pnpm typecheck                # Type check
```

## Submitting changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` to verify everything passes
4. Commit both `src/` and `dist/` (the compiled output is committed so the package works directly from GitHub)
5. Open a pull request against `main`

## Reporting bugs

Open an issue using the bug report template. Include:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

## Suggesting features

Open an issue using the feature request template. Describe the use case and why it would be useful.
