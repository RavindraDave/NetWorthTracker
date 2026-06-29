# Architecture & Product Decisions

## Persistence strategy (decided May 2026)
- Phase 1 (shipped): `navigator.storage.persist()` + StorageStatusCard + stale-backup banner + install-as-PWA card.
- Phase 2 (shipped): Opt-in Google Drive sync to `appDataFolder` (hidden, `drive.appdata` scope only). Auto-syncs after every save (5s debounce). Restore from Drive button in Settings and on empty Dashboard.
- Phase 3 (shipped): E2E encryption for Drive backups — AES-GCM-256 + PBKDF2 (`encryption.ts`), session-only passphrase; plus canonical sync + three-way merge (`syncEngine.ts`). Implemented over Drive `appDataFolder`, NOT the Supabase/PocketBase backend in `.claude/memory/project_phase3_e2e_sync.md` (that doc is the superseded original design).
- Backup retention (decided June 2026): local IndexedDB ring and Drive prune both keep the 90 most-recent backups (`MAX_BACKUPS = 90` in `autoBackup.ts` and `drive.ts`). Count-based, not time-based; raised from 30 so a daily backer keeps ~3 months of history.

## Print report (decided June 2026)
- Generated as a raw HTML string in `src/utils/printReport.ts` — no React, no Tailwind.
- Opens in `window.open()` popup and immediately calls `window.print()`.
- Column layout: `table-layout:fixed`, colgroup widths 50/10/20/20% (Item/Currency/Amount/Value).
- All tables across categories must share the same column proportions to avoid zigzag alignment.

## Drive sync scope (decided May 2026)
- `drive.appdata` scope only — cannot read or write user's Drive files.
- B1 (resolved): hosted deploy on Vercel with `VITE_GOOGLE_CLIENT_ID` gives hosted users one-click Drive connect; self-hosters enter their own GCP Client ID. No OAuth proxy code was needed.

## FIRE calculation scope (decided prior)
- Investable assets only (excludes home equity). This is intentional.
- A4 (shipped): `InfoTooltip` in `FIREDashboard` lists the excluded categories dynamically.

## Stale-backup warning threshold (resolved — was roadmap A1)
- Resolved via `staleThresholdDays(cadence)` in `autoBackup.ts` — a single cadence-tuned threshold (daily 3 / weekly 10 / monthly 35 / off 30 days) used by both the banner and the scheduler, replacing the old 7-vs-30 mismatch. Snooze reuses the same value.
- New-user grace (2026-06-29): `StaleBackupBanner` is suppressed when the user has never backed up AND has <2 snapshots AND <24h of use, so it no longer fires seconds after the first save.
