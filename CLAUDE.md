# WealthPulse — Claude Code Notes

## Persistence strategy

Three-phase data-loss protection (decided May 2026):

**Phase 1 — shipped**: `navigator.storage.persist()` called on boot; `StorageStatusCard` in Settings shows persistence state + quota; stale-backup banner in Dashboard; install-as-PWA card in Settings. Local auto-backup keeps the 90 most-recent recovery points in IndexedDB (`MAX_BACKUPS` in `autoBackup.ts`). The stale-backup banner is cadence-aware (`staleThresholdDays`) and suppressed for brand-new users (never backed up + <2 snapshots + <24h of use) so it doesn't nag right after the first save.

**Phase 2 — shipped**: Opt-in Google Drive sync to `appDataFolder` (hidden per-app folder). Scope: `drive.appdata` only — cannot access user files. Auto-syncs after every save (5s debounce). Canonical `wealthpulse-sync.json` updated in place; dated backups alongside, pruned to the 90 most-recent (`MAX_BACKUPS` in `drive.ts`). Restore from Drive button in Settings and on empty Dashboard. Hosted users (Vercel + `VITE_GOOGLE_CLIENT_ID`) get one-click connect; self-hosters enter their own Client ID.

**Phase 3 — shipped (implemented over Drive, not a new backend)**: End-to-end encryption for Drive backups — AES-GCM-256, PBKDF2 (100K, SHA-256) via `window.crypto.subtle`, zero new deps, session-only passphrase, versioned envelope (`encryption.ts`). Plus canonical sync + three-way merge with edit-wins-over-delete (`syncEngine.ts`), Merge/Override modes, and a conflict-resolution modal. Note: shipped over Google Drive `appDataFolder` — the Supabase/PocketBase design sketched in `.claude/memory/project_phase3_e2e_sync.md` was the original plan and is superseded by this Drive-based implementation.

## Notion documentation (permanent reference)

All project docs live under the **WealthPulse — Project Hub** page:
https://www.notion.so/37394476928181f9bdfbf3d90f86c155

- **Functional & Technical Specification** — architecture, data models, all feature specs, utility modules, DB schema:
  https://www.notion.so/37394476928181d1b1f2e58b7347c762

- **User Guide** — step-by-step usage, FIRE setup, Drive sync, backup strategy, glossary:
  https://www.notion.so/37394476928181adb4becd5a421fd157

- **Product Roadmap — Phased Enhancements** — 5-phase roadmap (A→E) derived from June 2026 codebase review. Priority matrix and "what not to build" included:
  https://www.notion.so/37394476928181e6b1d6c395dbbdc99b

  **Roadmap quick-ref (status as of 2026-06-29 — see Notion for full detail):**
  - **Phase 0 (stabilise), A, B, C, D, and backlog BL-4/BL-5 — all shipped.** This
    includes: cadence-aware stale-backup (A1), npm-pinned xlsx (A2), loan amortisation
    (A3), FIRE investable-scope tooltip (A4), YoY history compare (A5), hosted Drive OAuth
    via Vercel (B1), CSV column-mapper (B2), snapshot reminders (B3), cost basis +
    CAGR/`xirr.ts` (C1–C2), category trends (C3), FIRE "what if" modeller (C4), currency
    donut toggle (C5), AES-GCM encrypted Drive backups (D1), canonical sync + three-way
    merge (D2).
  - **Phase E — not started (next buildable):** E3 tax-aware withdrawal planning, then
    E4 monthly summary/savings-rate chart (scope-limited), then E1 tax-lot tracking.
    E2 broker integrations = "reconsider fit" (conflicts with local-first identity).
  - **Latest pass (2026-06-29):** backup retention 30→90 (local + Drive); first-run UX —
    deferred the exchange-rate error wall until a foreign-currency item exists, explicit
    "+ Add item" button, stale-backup grace period, trend-chart pluralization, "Goals NW"
    tooltip, friendlier Live Rates error, offline-safe brand logo, softer Cloud Sync copy.
  - **Do NOT build:** budget-vs-actual/expense categories, real-time price feeds, social
    features, native wrappers, broker APIs, server accounts, AI categorisation.

## Session memory (available to all sessions)

Persistent knowledge lives in `.claude/memory/` — always read these at session start:

- `.claude/memory/decisions.md` — architecture and product decisions log
- `.claude/memory/project_phase3_e2e_sync.md` — full E2E sync design (Phase 3)
- `.claude/memory/ux-review-lessons.md` — UX/CX review lessons and process gaps

## Key files

- `src/utils/storagePersist.ts` — `requestPersist`, `estimateStorage`, `formatBytes`
- `src/utils/autoBackup.ts` — `recordAutoBackup` (90-cap), `staleThresholdDays`, `daysSinceISO`
- `src/utils/cloudSync/google/gis.ts` — GIS OAuth wrapper
- `src/utils/cloudSync/google/drive.ts` — Drive `appDataFolder` REST helpers; `MAX_BACKUPS = 90`
- `src/utils/cloudSync/encryption.ts` — AES-GCM-256 + PBKDF2 envelope (Phase 3)
- `src/utils/cloudSync/syncEngine.ts` — three-way merge (`mergeBackups`, `applyResolutions`)
- `src/components/settings/CloudSyncCard.tsx` — Drive sync UI in Settings
- `src/components/editor/ExchangeRateBar.tsx` — per-snapshot rates; error banners gated on `hasForeignItems`
- `src/components/editor/AddItemRow.tsx` — line-item add row (Enter/blur commit + explicit "+ Add item" button)
- `src/components/common/StaleBackupBanner.tsx` — cadence-aware nag with new-user grace period
- `src/hooks/useAutoBackup.ts` — local auto-backup tick (extended to call cloud sync)
- `src/utils/printReport.ts` — print report HTML generator (raw string, not React)
