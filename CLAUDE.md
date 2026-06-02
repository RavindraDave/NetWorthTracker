# WealthPulse — Claude Code Notes

## Persistence strategy

Three-phase data-loss protection (decided May 2026):

**Phase 1 — shipped**: `navigator.storage.persist()` called on boot; `StorageStatusCard` in Settings shows persistence state + quota; stale-backup banner in Dashboard; install-as-PWA card in Settings.

**Phase 2 — shipped**: Opt-in Google Drive sync to `appDataFolder` (hidden per-app folder). Scope: `drive.appdata` only — cannot access user files. Auto-syncs after every save (5s debounce). Restore from Drive button in Settings and on empty Dashboard.

**Phase 3 — deferred**: E2E-encrypted cloud sync (Actual Budget / Bitwarden pattern). Full design in `~/.claude/projects/-Users-ravindradave-Documents-Github-NetWorthTracker/memory/project_phase3_e2e_sync.md`. Build when multi-device zero-knowledge sync is required. Uses `window.crypto.subtle` (no deps), Supabase or PocketBase as backend, passphrase → PBKDF2 → AES-GCM-256.

## Notion documentation (permanent reference)

All project docs live under the **WealthPulse — Project Hub** page:
https://www.notion.so/37394476928181f9bdfbf3d90f86c155

- **Functional & Technical Specification** — architecture, data models, all feature specs, utility modules, DB schema:
  https://www.notion.so/37394476928181d1b1f2e58b7347c762

- **User Guide** — step-by-step usage, FIRE setup, Drive sync, backup strategy, glossary:
  https://www.notion.so/37394476928181adb4becd5a421fd157

- **Product Roadmap — Phased Enhancements** — 5-phase roadmap (A→E) derived from June 2026 codebase review. Priority matrix and "what not to build" included:
  https://www.notion.so/37394476928181e6b1d6c395dbbdc99b

  **Roadmap quick-ref (highest priority items):**
  - **A1** Fix stale-backup warning threshold mismatch (7 days in banner vs 30 days in hook)
  - **A2** Replace SheetJS CDN tarball with npm-pinned package (supply chain hygiene)
  - **A3** Loan amortisation helper on liability line items (principal + rate + tenure → auto outstanding)
  - **A4** Clarify investable-only FIRE scope in `FIREDashboard` UI (tooltip on why home equity excluded)
  - **A5** Year-over-year comparison mode in History page
  - **B1 (Critical)** Hosted OAuth proxy so Drive sync works without user GCP setup
  - **B2** Flexible CSV column-mapper for bank/broker statement import
  - **C1–C2** Cost basis per line item + XIRR calculation (`src/utils/xirr.ts` — new file)
  - **C4** FIRE scenario modeller ("what if" panel in `FIREDashboard`)
  - **D** E2E encrypted sync (Phase 3 deferred — prerequisite: B1 shipped first)

## Key files

- `src/utils/storagePersist.ts` — `requestPersist`, `estimateStorage`, `formatBytes`
- `src/utils/cloudSync/google/gis.ts` — GIS OAuth wrapper
- `src/utils/cloudSync/google/drive.ts` — Drive `appDataFolder` REST helpers
- `src/components/settings/CloudSyncCard.tsx` — Drive sync UI in Settings
- `src/hooks/useAutoBackup.ts` — local auto-backup tick (extended to call cloud sync)
