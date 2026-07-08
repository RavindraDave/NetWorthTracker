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

## Functionality-review pass (decided July 2026)
- **Excel import goes through the CSV column-mapper** — one import path for `.csv`/`.xlsx` (`isExcelFile` in `useCsvParser.ts`). The legacy `parseExcelToSnapshotItems` path was removed: it expected 'Asset Name' columns (exports write 'Item Name'), silently dropped rows whose category didn't name-match a default template, and always targeted the current month.
- **Trend badge is "Growth p.a.", not "CAGR"** — net-worth growth includes savings contributions, so CAGR framing overstated investment return. Suppressed below 6 data points (annualising 2 months extrapolates wildly).
- **Compact abbreviations are locale-keyed** — `formatCompactNumber(value, locale)`: `en-IN` → L/Cr, anything else → K/M/B. Callers pass the locale from `resolveNumberLocale`; bare calls default to `en-IN` for back-compat.
- **Monthly Performance includes liabilities with inverted sign** — debt paydown renders as a positive bar (previously liabilities were filtered out entirely).
- **Snapshot Compare uses `calcCategoryTotal` + id-first-then-name matching** — compared totals now respect exclusion chips and agree with History-row net worth; renames no longer show as remove+add.
- **FIRE cash-flow basis is per-goal** — `Goal.cashflowWindow` (1/3/6, default 1). `avgMonthlyCashflow` skips snapshots without cash-flow data rather than averaging in zeros. `calcFIREMetrics` gained an optional `snapshots` param; only FIREDashboard and NetWorthHero pass it (GoalCard/MilestoneTimeline use cash-flow-independent metrics).
- **`LedgerActivity` replaced by `CashflowChart` (E4)** — the ledger was category balances duplicating the donut/Portfolio, with brittle English-keyword accent colours. The cash-flow chart is two stacked panels sharing the month axis (currency bars, % line) because a % and a currency scale must never share one plot (no dual axes). Palette (emerald income / rose expenses / purple rate) validated for CVD + contrast on both light and dark surfaces.
- **e2e suite rewritten (same day)** — helpers + all 8 specs rewritten against the current DOM (60 tests green). Conventions: page roots carry `*-page` classes (`dashboard-page`/`history-page`/`portfolio-page` added for this); helpers `addLineItem`/`openSnapshotEditor`/`setSnapshotMonth` encapsulate the AddItemRow and sidebar month-picker flows; `clearAppData` also clears localStorage (banner snoozes / chips intro / last settings section leak between tests otherwise). `screenshots.spec.ts` is docs tooling, skipped unless `SCREENSHOTS=1` (its output filenames don't match the older committed docs/screenshots set — regenerating those is a separate deliberate task). Container note: this remote env ships chromium-1194 while Playwright 1.59 wants 1217 — bridged with symlinks under /opt/pw-browsers (`chromium-1217`→`1194`, `chromium_headless_shell-1217`→`1194` + inner `chrome-headless-shell-linux64/chrome-headless-shell`→`chrome-linux/headless_shell`); do not change the repo's Playwright pin for this.
