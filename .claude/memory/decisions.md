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

## Sub-categories — one grouping level inside a category (decided August 2026)

User feedback: "under Investments I want Mutual Funds holding individual funds; under
Cash & Bank, Savings / Cash / NRE-NRO". Shipped in five phases; all five are merged.

- **`Category.items` stays FLAT.** A sub-category is a reference
  (`LineItem.subCategoryId`) resolved at render time, never a nested container.
  This is the load-bearing decision: `calcCategoryTotal`, `calcNetWorth`,
  `getMissingRateCurrencies`, `buildCurrencyAllocationData`, `filterByViewMode` and
  the entire three-way sync merge needed **zero** changes. Do not "tidy this up"
  into real nesting — the flatness IS the design.
- **Definitions live on the snapshot** (`Category.subCategories`), not on
  `CategoryTemplate`. Three independent reasons: preferences never sync
  (`syncEngine.ts` always keeps the local copy, so templates-only storage would give
  device B dangling references); preferences are deliberately plaintext for app-lock
  boot, and group names are sensitive; and snapshot-resident defs travel with the
  items that reference them through the whole-snapshot merge, making cross-device
  orphans structurally near-impossible.
- **Items reference a group by id, never by typed name.** This is the answer to the
  user's own concern that typing would fragment "Mutual Funds" / "mutual funds" /
  "MFs". A rename touches one place. Inline creation is explicit and converges on a
  case-insensitive match (`ensureSubCategory` returns `created: false`).
- **No migration and no version bump.** Both fields are optional and
  absent-means-default, and read paths must tolerate `undefined` anyway because
  older builds push snapshots without them. Orphans are tolerated at render (routed
  to the ungrouped bucket) and healed at save (`pruneOrphanSubCategoryIds`, which
  returns the *same reference* when clean so it never manufactures a write).
  `BackupData.version` stays 1 — bumping it breaks mixed-version sync
  asymmetrically and silently (old builds error into `cloudSync.lastError` while
  new builds keep overwriting canonical).
- **Zero-change path in the editor.** A category with no groups renders exactly as
  before. Forcing group chrome onto the twelve defaults would regress every user.
  New snapshots are NOT pre-seeded for the same reason — the curated defaults
  (`defaultSubCategories.ts`, keyed by built-in template id, deliberately *not* on
  `CategoryTemplate` so re-add-on-load can't resurrect deleted groups) are one click
  away per category via "Suggest groups".
- **Management lives on the group header, not in Settings.** `CategoryManager` edits
  `preferences.categoryTemplates`; sub-groups are snapshot data. Rename collisions
  offer a merge rather than refusing the edit. Deleting a group moves its items to
  Ungrouped and never deletes an item — deliberately the opposite of the
  category-level block-when-in-use guard, because a sub-group is organisational and
  removing it changes no total.
- **Scope flags stay category-level.** `isLiquid`/`isInvestable` and
  `Goal.excludedCategoryIds` were deliberately NOT made sub-category-aware: it would
  force a per-item filter into `calcCategoryTotal` (5 call sites) and turn
  `filterByViewMode` into an item-level filter, changing what `categoryTotals`
  *means* in liquid/investable view. `LineItem.excludeFromGoals` (the Σ chips)
  already gives finer granularity.
- **Donut drill-down, not extra slices.** Adding sub-groups as top-level slices would
  blow the hard 9-slice cap instantly. Drill mode folds the tail into an explicit
  "Other (N)" rather than truncating; the top-level view's silent truncation is a
  pre-existing wart left alone.
- **`buildSubCategoryAllocationData` lives in `subCategories.ts`**, not
  `calculations.ts` — that module already imports `convertToBase` from calculations,
  so the reverse import would be circular. `AllocationItem` is imported as a type.
- **Import restraint** (the legacy-Excel sin): never skip a row for failing to match
  a group, and never invent an "Uncategorised" group. Auto-detect aliases are limited
  to unambiguous "sub-something" headers — `scheme`/`fund`/`instrument` are excluded
  because in broker statements those name the individual HOLDING, so claiming them
  would file every item name into the group column.

### Two pre-existing bugs found while verifying (both fixed here)
- **`AddItemRow` left the typed amount on screen after committing.** `amount` goes
  120000 → 0 within one batch, so `useDecimalInput`'s value-changed resync never
  fired: the row *displayed* a stale figure while the next commit would have used 0.
  Fixed with an explicit `reset(to)` on the hook. Grouping made it 4–6× more visible.
- **`e2e/helpers.addLineItem` resolved name/amount/button with three independent
  `.first()` lookups.** The amount label is a *prefix* match, so once a category
  renders several add rows those could land on different rows — filling the name in
  one and the amount in another, committing an item with amount 0. Now scoped to a
  single row container, with optional `{ group, within }`. **Lesson: when a helper
  mixes exact and prefix selectors, `.first()` is a latent cross-row bug.**

### e2e conventions for grouped UI
- Match a group by its **header** (`.subcat-header__name`), never `hasText` over the
  group: every row inside a group carries a `<select>` listing all sibling group
  names, so a text filter for "Stocks" also matches the Mutual Funds group.
- aria-labels suffix only *named* groups ("New item name in Mutual Funds"); the
  ungrouped bucket keeps the plain labels so pre-existing selectors still resolve.

### Suggested sub-groups + descriptions (August 2026)
- **All 12 built-in categories carry suggestions.** The original "a wrong default is
  worse than none" call for Personal Property / Business / Foreign Holdings / Tax /
  Other was reversed: suggestions are opt-in per category, so a mediocre one costs a
  glance rather than a cleanup.
- **Descriptions are stored per group** (`SubCategory.description`), not looked up from
  the catalogue at render. That survives renames and syncs, and keeps the text inside
  the encrypted snapshot instead of plaintext preferences. Still additive — no Dexie
  bump, no migration, `BackupData.version` stays 1.
- **`ensureSubCategory` applies a description only on create.** Reusing an existing
  group must never overwrite wording the user edited.
- **`updateSubCategory` edits name + description in one transform**, because the header
  edits them together and two `onChange` calls in a tick each read the same stale
  category prop. `renameSubCategory` is now a wrapper over it. Clearing the field
  deletes the key rather than storing `''`, so "has a description" stays a truthiness
  check.
- **The picker ticks nothing by default.** Pre-ticking would make the checklist behave
  like the add-all button it replaced and re-create the empty-group clutter it exists
  to prevent. Already-present groups render ticked+disabled, matched case-insensitively.
- **Descriptions are deliberately absent from CSV/Excel/print** — metadata about the
  grouping, not about money, and it would repeat on every item row. Also no auto-fill
  on import: the picker seeds a description with the user looking at it; a bulk import
  does not.
- **e2e gotcha:** `group()` matches a group via `.subcat-header__name`, but opening the
  header editor *replaces* that span with inputs — so a group-scoped locator resolves to
  nothing mid-edit. Use page-scoped locators for the edit fields.

### Merging main's full-app audit (August 2026)
Ten conflicts, nearly all "both sides added here". Worth remembering:
- `printReport.buildCategoryRows` had been lifted to module scope on this branch and
  was still a closure on main — keep the lifted one, carry main's wording across. With
  main's `cat.items.length > 0` filter, the empty branch means "all items excluded",
  so the old "No items in this category" copy was wrong.
- `DonutChart` legend must use the builder's own `percentage`, never one recomputed over
  the truncated array — recomputing is exactly what made a truncated legend still sum
  to 100%.
- Two e2e failures arrived with main and were fixed here (verified against a scratch
  worktree at origin/main, so neither was merge damage): the remove-item spec did not
  know about main's new destructive confirm, and `MissingSnapshotBanner` advertised the
  *current* month but called `cloneLatestSnapshot()`, which returns *latest + 1* — they
  agree only when the user is exactly one month behind.
