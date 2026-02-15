# Aura

Unified developer workspace — Tauri v2 + React + TypeScript.

## Quick Start

```bash
pnpm install
pnpm tauri dev
```

## Project Structure

- `src/` — React frontend (TypeScript, Tailwind CSS v4)
- `src-tauri/` — Rust backend (Tauri v2)
- `docs/` — Requirements and plans

## Testing

```bash
pnpm test              # Frontend (vitest)
cd src-tauri && cargo test  # Backend (cargo)
```

## Architecture

Aura is an orchestration layer over existing dev tools:
- **GitHub CLI (`gh`)** — primary auth for GitHub
- **Graft web API** — repo discovery, worktrees, stacked branches (Phase 2)
- **Azure CLI (`az`)** — primary auth for Azure DevOps (Phase 2)

See `docs/requirements.md` for full PRD.
