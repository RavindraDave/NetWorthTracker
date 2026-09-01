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
- **Attempt throttling (2026-09-01, shipped):** exponential backoff on the passphrase unlock
  screen (`appLockThrottle.ts`) — free for 2 attempts, then 10s→300s cap, resets on success.
  State lives in plaintext `preferences.appLock` (readable pre-unlock) via a `skipBackup` flag
  on `updatePreferences()` — routing it through the normal path would let a brute-force loop
  spam-evict the 90-cap auto-backup table. Recovery-slot removal now warns harder only when
  it's the LAST slot; enabling App Lock still never requires one (zero-knowledge passphrase-only
  is a deliberate, legitimate choice). Threat model: defends the shared-PC/nosy-family-member
  case, not a DevTools-capable attacker — stated explicitly in-app, not oversold.

## Tags — cross-category labels (2026-08-31, shipped)

A `Tag` lives on `Snapshot` (sibling of `categories`), **not** in `UserPreferences` — preferences
never sync, snapshots do (three-way merge), so a global tag registry would let two devices mint
different ids for the same tag name with no reconciliation path. Same tradeoff `SubCategory`
already made; tags are scoped per-snapshot by the same design (a tag made in August isn't
retroactively on July's snapshot). `LineItem.tagIds?: string[]` is many-to-many — an item can
carry several, and allocation totals across tags can legitimately exceed net worth (it's a
reporting lens, never a partition). `src/utils/tags.ts` mirrors `subCategories.ts`'s API but
`deleteTag` is snapshot-wide (a tag is cross-category, unlike a sub-group). Dashboard's "By Tag"
panel is a bar list, deliberately not a donut — a pie implies its slices sum to a whole, which
overlapping tag totals would misrepresent. The tag toggle on a line item shows a bounded "N tags"
label, never the raw tag name (a single-tag rendering bug once showed the raw name and overflowed
its fixed-width slot — fixed 2026-09-01, see `LineItemRow.tsx`'s `tag-btn` comment).

## Category ID reconciliation (2026-09-01, shipped)

Root cause fixed: `suggestedSubCategories()` used to look up suggestions strictly by
`category.id`, with no fallback to name+type — unlike `SnapshotEditor`'s category backfill and
`buildCategoryTrendData`, which already tolerate a category whose stored id predates (or
otherwise doesn't match) the current `default-*` template ids. A category unmistakably "Cash &
Bank Accounts" by name and type was silently getting zero suggestions because of that one
inconsistency. `categoryReconciliation.ts`'s `reconcileCategoryIds()` is the actual fix, not just
a patch to that one symptom: finds categories with a drifted id that unambiguously matches a
template, rewrites the id everywhere it appears across every snapshot, and keeps
`Goal.excludedCategoryIds` in sync in the same pass. Ambiguous cases (same-snapshot collisions,
inconsistent cross-snapshot mappings) are deliberately left unfixed and reported as conflicts —
never auto-resolved, since guessing wrong could silently merge two different categories. Runs
automatically on load (silent unless it finds something — one-shot toast) and via a manual
"Check category IDs" button in Settings → Categories. **If a category-identity bug surfaces
again, check here first** — this is now the second/third place this exact id-drift class of bug
has been found (suggestions, and theoretically `Goal.excludedCategoryIds` across multi-device
sync histories that predate stable ids — unconfirmed, not fixed, noted as a known residual risk).

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
  - **Sub-categories (2026-08-13, shipped):** one optional grouping level inside a
    category — Investments → Mutual Funds → individual funds; Cash & Bank →
    Savings/NRE/NRO. See `.claude/memory/decisions.md` for the full rationale.
    The load-bearing rule: **`Category.items` stays FLAT** — grouping is a
    reference (`LineItem.subCategoryId`) resolved at render, so every total,
    chart and the sync merge were untouched. Editor grouping + subtotals,
    rename/reorder/merge/delete on the group header, donut drill-down,
    Portfolio badge, CSV/Excel/print columns, and CSV/Excel import.
    Follow-up: all 12 categories now ship suggested groups, each with a stored,
    editable description (`SubCategory.description`), chosen through a checklist
    picker rather than an add-all button. Descriptions are deliberately kept out
    of CSV/Excel/print.
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
  - **Latest pass (2026-08-31 → 2026-09-01, Securo feature-parity audit + follow-on fixes):**
    an audit against Securo (a full transaction-ledger, multi-user, server-backed finance app)
    identified 5 features that fit WealthPulse's local-first identity — everything else
    (bank sync, transactions/budgets, multi-user/OIDC, AI chat) was rejected as scope creep
    against the "Do NOT build" list below. Shipped: **Tags** (see dedicated section above),
    **per-item FIRE growth projection** (`itemProjection.ts` — a second "Per-item" line beside
    the existing blended-rate projection; unrated items held flat at 0%, never backfilled with
    the blended rate), **jurisdiction tax presets** (`TAX_PRESETS` in `taxCalculator.ts` — India
    Budget-2024 + a labelled-approximate US model, seeds `GoalEditor`'s existing per-goal
    `TaxParams` fields, nothing new persisted; also fixed a pre-existing gap where `cess` had no
    input field), **balance-only OFX/QIF import** (`ofxParser.ts`/`qifParser.ts`, hand-rolled —
    structurally never read OFX's `<STMTTRN>` transaction tags; both emit the same
    `{headers,rows}` shape `useCsvParser.ts` already produces, so `CsvImportModal` needed no
    changes), and **App Lock attempt throttling** (see App Lock section above). Follow-on same
    session: fixed `CashflowChart`'s gap-blindness (`buildCashflowData` was filtering out
    zero-data months before windowing to "last 12," collapsing non-adjacent months into
    adjacent-looking bars — now windows first, renders gaps as explicit nulls); added
    downloadable sample CSV/Excel templates to the import card (`sampleImport.ts`, header
    derived from `CSV_FIELDS` so it can't drift); fixed the tags/sub-groups overlap confusion
    with a hint at the sub-group creation point pointing to tags for cross-category grouping;
    the category-ID reconciliation system (see dedicated section above); and **recurring
    monthly import** — `CsvImportModal` gained an explicit "Add as new snapshot" / "Update
    existing month" toggle (`importRowMerge.ts`'s `applyImportRows`, mode-agnostic — case-
    insensitive name match within a category updates amount/currency only, no match inserts,
    an unmatched existing item is never touched let alone deleted; preview shows an Update/New
    Action column per row before commit).
  - **Earlier pass (2026-06-29):** backup retention 30→90 (local + Drive); first-run UX —
    deferred the exchange-rate error wall until a foreign-currency item exists, explicit
    "+ Add item" button, stale-backup grace period, trend-chart pluralization, "Goals NW"
    tooltip, friendlier Live Rates error, offline-safe brand logo, softer Cloud Sync copy.
  - **Do NOT build:** budget-vs-actual/expense categories, real-time price feeds, social
    features, native wrappers, broker APIs, server accounts, AI categorisation.
  - **Scope guardrail (2026-09-01):** "Update existing month" import mode (above) refreshes
    existing item balances by name-match — it is still snapshot/balance semantics, not a
    transaction history. Do not extend it toward per-transaction tracking; that's the same
    "Do NOT build" line above, just reachable from a different feature this time.

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
- `src/utils/taxCalculator.ts` — E3 withdrawal-tax model (`calcWithdrawalTax`; India Budget-2024 defaults, all configurable via `TaxParams`). `TAX_PRESETS`/`TAX_PRESET_LABELS`/`matchTaxJurisdiction` (2026-09-01) seed `GoalEditor`'s fields from a jurisdiction picker — India or a labelled-approximate US model — transient UI convenience only, never persisted onto `Goal`
- `src/components/dashboard/CashflowChart.tsx` — E4 income/expenses bars + savings-rate strip (two stacked panels sharing the month axis — never dual-axis). `buildCashflowData` in `calculations.ts` windows the last 12 snapshots first, then renders no-data months as explicit gaps (fixed 2026-09-01 — used to filter zero-data months out before windowing, which collapsed non-adjacent months into adjacent-looking bars)
- `src/hooks/useCsvParser.ts` — shared CSV **and** Excel import parsing (`isExcelFile`); also branches to `ofxParser`/`qifParser` (`isOfxFile`/`isQifFile`, 2026-08-31) — all four formats feed the same `CsvImportModal` unchanged
- `src/utils/subCategories.ts` — sub-category pure core: `groupItemsBySubCategory` (the
  conservation invariants), `ensureSubCategory` (case-insensitive dedupe), rename/merge/
  delete/move, `pruneOrphanSubCategoryIds`, `buildSubCategoryAllocationData`. All immutable —
  `cloneLatestSnapshot` reuses category object references between months
- `src/utils/defaultSubCategories.ts` — suggested `{name, description}` per built-in
  category (all 12); applied only through the picker, never automatically
- `src/components/editor/SuggestGroupsModal.tsx` — the checklist picker (nothing ticked
  by default; already-present groups shown ticked + disabled)
- `src/components/editor/SubCategoryGroupHeader.tsx` — group header (subtotal, rename, ⋯ menu)
- `src/utils/tags.ts` — tag pure core, mirrors `subCategories.ts`; `deleteTag` is snapshot-wide
- `src/utils/tagAggregation.ts` — `buildTagAllocationData`/`buildTagTrendData` (overlap-aware, no partition)
- `src/components/editor/TagPickerPanel.tsx` / `TagManager.tsx` — per-item tag toggle panel; per-snapshot tag CRUD
- `src/components/dashboard/TagAllocationPanel.tsx` — bar-list "By Tag" panel (never a donut — see Tags section)
- `src/utils/itemProjection.ts` — `buildFireProjection` (blended vs per-item lines), `projectItemValue`
- `src/components/goals/FIREProjectionChart.tsx` — renders the two-line projection on the FIRE Dashboard
- `src/utils/ofxParser.ts` / `qifParser.ts` — hand-rolled balance-only parsers; QIF proxies balance via last transaction (documented heuristic, `ponytail:` comment)
- `src/utils/sampleImport.ts` — sample CSV/Excel generator for the import card; header derived from `CSV_FIELDS`
- `src/utils/importRowMerge.ts` — `applyImportRows`, shared by "new" and "update" import modes; case-insensitive name-match-within-category, never deletes
- `src/utils/categoryReconciliation.ts` — `reconcileCategoryIds` (see Category ID reconciliation section above)
- `src/utils/appLockThrottle.ts` — App Lock backoff curve (`backoffSeconds`, `isLockedOut`, `recordFailure`/`recordSuccess`)
