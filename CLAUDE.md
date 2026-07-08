# WealthPulse — Claude Code Notes

## Persistence strategy

Three-phase data-loss protection (decided May 2026):

**Phase 1 — shipped**: `navigator.storage.persist()` called on boot; `StorageStatusCard` in Settings shows persistence state + quota; stale-backup banner in Dashboard; install-as-PWA card in Settings. Local auto-backup keeps the 90 most-recent recovery points in IndexedDB (`MAX_BACKUPS` in `autoBackup.ts`). The stale-backup banner is cadence-aware (`staleThresholdDays`) and suppressed for brand-new users (never backed up + <2 snapshots + <24h of use) so it doesn't nag right after the first save.

**Phase 2 — shipped**: Opt-in Google Drive sync to `appDataFolder` (hidden per-app folder). Scope: `drive.appdata` only — cannot access user files. Auto-syncs after every save (5s debounce). Canonical `wealthpulse-sync.json` updated in place; dated backups alongside, pruned to the 90 most-recent (`MAX_BACKUPS` in `drive.ts`). Restore from Drive button in Settings and on empty Dashboard. Hosted users (Vercel + `VITE_GOOGLE_CLIENT_ID`) get one-click connect; self-hosters enter their own Client ID.

**Phase 3 — shipped (implemented over Drive, not a new backend)**: End-to-end encryption for Drive backups — AES-GCM-256, PBKDF2 (100K, SHA-256) via `window.crypto.subtle`, zero new deps, session-only passphrase, versioned envelope (`encryption.ts`). Plus canonical sync + three-way merge with edit-wins-over-delete (`syncEngine.ts`), Merge/Override modes, and a conflict-resolution modal. Note: shipped over Google Drive `appDataFolder` — the Supabase/PocketBase design sketched in `.claude/memory/project_phase3_e2e_sync.md` was the original plan and is superseded by this Drive-based implementation.

## App Lock — local encryption-at-rest (Settings → Security)

**Shipped, opt-in, off by default.** Solves the shared-PC privacy gap: previously anyone using
the browser profile could read all data (it was plaintext in IndexedDB). Now an optional
passphrase lock encrypts the financial data **at rest** and gates the app on boot.

- **DEK envelope** (`keyVault.ts`): a random AES-256 Data Encryption Key encrypts snapshot/goal
  records (`secureStore.ts`) and auto-backup payloads (`autoBackup.ts`). The DEK is wrapped by one
  or more unlock "slots" — passphrase, recovery code, Google-escrow, passkey — any one unlocks; the
  data is never re-encrypted when a slot is added/removed. Wrapping **reuses `encryptJSON`** from
  `encryption.ts` (zero new crypto primitives). Stored in the `keyVault` Dexie store (DB v5).
- **Preferences stay plaintext** so `appLock` config is readable before unlock. Only snapshots,
  goals, and auto-backups are encrypted.
- **Boot gate**: `AppContext.load()` reads prefs first; if `appLock.enabled && !getSessionDEK()` it
  sets `isLocked` and loads nothing. `Layout.tsx` shows `AppLockScreen` instead of the app chrome.
  DEK is memory-only → closing the tab re-locks; idle auto-lock (configurable, default 15 min).
- **Recovery (both models, user picks)**: recovery code = zero-knowledge (code wraps the DEK, blob
  mirrored to Drive `wealthpulse-recovery.json`, exempt from pruning); Google-escrow = convenient but
  NOT zero-knowledge (recoverable DEK copy in Drive), forces `prompt:'consent'` re-auth so a live
  Google session can't silently bypass the lock on a shared PC.
- **Passkey/WebAuthn (PRF)**: optional hardware-bound unlock (Touch ID / Hello), feature-detected;
  passphrase always remains the fallback. `webauthn.ts`.
- Orchestration in `appLock.ts`; UI in `AppLockCard.tsx`/`AppLockSection.tsx`. Asymmetric keys were
  evaluated and rejected for the core (single user = no encrypt/decrypt separation benefit); the only
  asymmetric use is the passkey unlock factor.

## Notion documentation (permanent reference)

All project docs live under the **WealthPulse — Project Hub** page:
https://www.notion.so/37394476928181f9bdfbf3d90f86c155

- **Functional & Technical Specification** — architecture, data models, all feature specs, utility modules, DB schema:
  https://www.notion.so/37394476928181d1b1f2e58b7347c762

- **User Guide** — step-by-step usage, FIRE setup, Drive sync, backup strategy, glossary:
  https://www.notion.so/37394476928181adb4becd5a421fd157

- **Product Roadmap — Phased Enhancements** — 5-phase roadmap (A→E) derived from June 2026 codebase review. Priority matrix and "what not to build" included:
  https://www.notion.so/37394476928181e6b1d6c395dbbdc99b

  **Roadmap quick-ref (status as of 2026-07-07 — see Notion for full detail):**
  - **Phase 0 (stabilise), A, B, C, D, backlog BL-4/BL-5, E3, and E4 — all shipped.** This
    includes: cadence-aware stale-backup (A1), npm-pinned xlsx (A2), loan amortisation
    (A3), FIRE investable-scope tooltip (A4), YoY history compare (A5), hosted Drive OAuth
    via Vercel (B1), CSV column-mapper (B2), snapshot reminders (B3), cost basis +
    CAGR/`xirr.ts` (C1–C2), category trends (C3), FIRE "what if" modeller (C4), currency
    donut toggle (C5), AES-GCM encrypted Drive backups (D1), canonical sync + three-way
    merge (D2), tax-aware withdrawal planning (E3 — `taxCalculator.ts` + FIREDashboard tax
    panel), monthly cash-flow/savings-rate chart (E4 — `CashflowChart.tsx`).
  - **Phase E remainder:** next buildable is E1 tax-lot tracking. E2 broker
    integrations = "reconsider fit" (conflicts with local-first identity).
  - **Latest pass (2026-07-07, from the full functionality review):** Excel import unified
    with the CSV column-mapper (legacy path dropped rows and lost item names); chart
    abbreviations follow the number-format preference (K/M/B vs L/Cr); hero symbol for any
    base currency; trend badge relabelled "Growth p.a." and suppressed <6 points; Monthly
    Performance includes liabilities (debt paydown = positive bar); Snapshot Compare
    respects exclusion chips + id-first category matching; FIRE cash-flow averaging
    (`Goal.cashflowWindow` 1/3/6); `LedgerActivity` replaced by `CashflowChart` (E4);
    Excel history export keeps the most-recent 30 detail sheets; backup copy interpolates
    `MAX_BACKUPS`. Follow-up same day: the Playwright e2e suite (helpers + 8 specs) was
    rewritten against the current UI — 60 tests green; `screenshots.spec.ts` is docs
    tooling gated behind `SCREENSHOTS=1`. Page roots now carry `dashboard-page` /
    `history-page` / `portfolio-page` classes for stable test hooks.
  - **Earlier pass (2026-06-29):** backup retention 30→90 (local + Drive); first-run UX —
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
- `src/utils/cloudSync/keyVault.ts` — DEK-envelope crypto for app lock (wrap/unwrap, record enc/dec, verifier, recovery code, session DEK)
- `src/utils/secureStore.ts` — encryption-at-rest boundary for snapshots/goals
- `src/utils/appLock.ts` — app-lock orchestration (enable/disable/change, recovery code, Google-escrow, passkey)
- `src/utils/webauthn.ts` — WebAuthn PRF passkey register/unlock
- `src/components/common/AppLockScreen.tsx` — full-screen unlock gate (passphrase/passkey/recovery)
- `src/components/settings/AppLockCard.tsx` — App Lock UI in Settings → Security
- `src/utils/cloudSync/syncEngine.ts` — three-way merge (`mergeBackups`, `applyResolutions`)
- `src/components/settings/CloudSyncCard.tsx` — Drive sync UI in Settings
- `src/components/editor/ExchangeRateBar.tsx` — per-snapshot rates; error banners gated on `hasForeignItems`
- `src/components/editor/AddItemRow.tsx` — line-item add row (Enter/blur commit + explicit "+ Add item" button)
- `src/components/common/StaleBackupBanner.tsx` — cadence-aware nag with new-user grace period
- `src/hooks/useAutoBackup.ts` — local auto-backup tick (extended to call cloud sync)
- `src/utils/printReport.ts` — print report HTML generator (raw string, not React)
- `src/utils/taxCalculator.ts` — E3 withdrawal-tax model (`calcWithdrawalTax`; India Budget-2024 defaults, all configurable via `TaxParams`)
- `src/components/dashboard/CashflowChart.tsx` — E4 income/expenses bars + savings-rate strip (two stacked panels sharing the month axis — never dual-axis)
- `src/hooks/useCsvParser.ts` — shared CSV **and** Excel import parsing (`isExcelFile`); both formats feed `CsvImportModal`
