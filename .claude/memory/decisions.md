# Architecture & Product Decisions

## Persistence strategy (decided May 2026)
- Phase 1 (shipped): `navigator.storage.persist()` + StorageStatusCard + stale-backup banner + install-as-PWA card.
- Phase 2 (shipped): Opt-in Google Drive sync to `appDataFolder` (hidden, `drive.appdata` scope only). Auto-syncs after every save (5s debounce). Restore from Drive button in Settings and on empty Dashboard.
- Phase 3 (deferred): E2E encrypted sync. See `.claude/memory/project_phase3_e2e_sync.md`.

## Print report (decided June 2026)
- Generated as a raw HTML string in `src/utils/printReport.ts` — no React, no Tailwind.
- Opens in `window.open()` popup and immediately calls `window.print()`.
- Column layout: `table-layout:fixed`, colgroup widths 50/10/20/20% (Item/Currency/Amount/Value).
- All tables across categories must share the same column proportions to avoid zigzag alignment.

## Drive sync scope (decided May 2026)
- `drive.appdata` scope only — cannot read or write user's Drive files.
- Hosted OAuth proxy (B1) required before Drive sync works without manual GCP setup by user.
- Until B1 ships, users must configure their own GCP credentials.

## FIRE calculation scope (decided prior)
- Investable assets only (excludes home equity). This is intentional.
- Tooltip in `FIREDashboard` should clarify why home equity is excluded (roadmap A4).

## Stale-backup warning threshold (known bug — roadmap A1)
- `StaleBackupBanner` warns after 7 days but `useAutoBackup` hook threshold is 30 days.
- These must be reconciled. Correct value TBD by user.
