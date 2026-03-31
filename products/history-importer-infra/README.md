# History Importer Infra (Provider-Agnostic)

A local-first scaffold for importing chat history from multiple providers.

## Goals

- One canonical conversation schema across providers
- Pluggable provider adapters
- File-based ingestion first (safe + reliable)
- OpenAI adapter implemented and tested first

## Current Status

- ✅ Core provider interface
- ✅ Canonical schema + normalization helpers
- ✅ Import orchestrator
- ✅ OpenAI file adapter (MVP)
- ✅ Claude adapter stub (for later)
- ✅ JSON file importer CLI
- ✅ OpenAI sample test script

## Structure

```
products/history-importer-infra/
  src/
    core/
      types.js
      normalize.js
      importer.js
    providers/
      openai-file.adapter.js
      claude-file.adapter.js
      index.js
    cli/
      import-file.js
  samples/
    openai-conversations.sample.json
  tests/
    openai-import.test.js
  package.json
```

## Quick Start

```powershell
cd products/history-importer-infra
npm run test:openai
```

Run importer manually:

```powershell
node src/cli/import-file.js --provider openai --input samples/openai-conversations.sample.json --output out/openai-normalized.json
```

## Next Steps

1. Add persistent storage (SQLite)
2. Add import job tracking (status/errors)
3. Expand OpenAI parser coverage (more export variants)
4. Implement Claude parser based on real export sample
5. Add dedup + checksum strategy
