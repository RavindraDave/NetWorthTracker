# WealthPulse — User Guide

WealthPulse is a privacy-first, offline net worth tracker that runs entirely in your browser. No accounts, no servers — your data stays on your device.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Creating & Editing Snapshots](#2-creating--editing-snapshots)
3. [Dashboard](#3-dashboard)
4. [History](#4-history)
5. [Goals & FIRE Planning](#5-goals--fire-planning)
6. [Portfolio View](#6-portfolio-view)
7. [Settings](#7-settings)
8. [Automated Backup](#8-automated-backup)
9. [Mobile Experience](#9-mobile-experience)
10. [Light Mode](#10-light-mode)
11. [Keyboard Shortcuts & Tips](#11-keyboard-shortcuts--tips)
12. [Frequently Asked Questions](#12-frequently-asked-questions)

---

## 1. Getting Started

When you open WealthPulse for the first time you'll see the welcome screen. No login required.

Click **+ Create First Snapshot** to create your first monthly net worth snapshot. WealthPulse organises your finances by month — one snapshot = one month's picture of your wealth.

---

## 2. Creating & Editing Snapshots

The snapshot editor opens when you click **New Month** from the dashboard or **Snapshot Editor** in the sidebar.

### Editor layout

The editor has four main areas:

- **Header** — shows the snapshot month (click to edit) and a live net worth preview that updates as you type.
- **Note area** — a collapsible text field for any notes about the month. Click "Add a note…" to expand it.
- **Two columns** — **Assets** on the left and **Liabilities** on the right.
- **Sticky summary bar** — pinned to the bottom of the viewport, always visible as you scroll. Shows four live figures: Net Worth · Goals NW · Total Assets · Total Liabilities.

### Adding line items

Click the **+** button inside any category to add a row. Type a name and an amount.

| Action | How |
|---|---|
| Add item | Click **+** in the category header |
| Remove item | Click the trash icon on the right of the row |
| Edit amount | Click the amount field and type |
| Change month | Click the month in the editor header and type a new `YYYY-MM` value |

### Inclusion chips (Σ✓ / Σ / ⊘)

Every line item has a three-state chip on the right:

| Chip | Label | Effect |
|---|---|---|
| **Σ✓** | Full inclusion | Item is counted in net worth and in goal calculations |
| **Σ** | NW only | Item is counted in net worth but excluded from goal calculations |
| **⊘** | Excluded | Item is excluded from everything (shown faded with strikethrough) |

Use **Σ** to keep, say, your primary home in your net worth figure without inflating your FIRE readiness number. Use **⊘** to temporarily park an item without deleting it.

### Saving

Click **Save Snapshot** to persist your data. The editor warns you if you try to navigate away with unsaved changes.

### Creating the next month

From the dashboard, click **New Month**. WealthPulse pre-fills the next calendar month and copies your previous asset/liability structure — you only need to update the amounts.

> **Tip:** You can change the month date to any value to create historical snapshots — useful for backfilling past data.

---

## 3. Dashboard

The dashboard is your central view. It updates automatically every time you save a snapshot.

### Net Worth Hero

The large figure at the top shows your **current net worth** with a month-over-month change indicator (teal = up, rose = down). A row of metadata below shows your savings rate, time-to-FI estimate, and MoM change in absolute terms.

The **Overall / Liquid / Investable** toggle changes what figure the hero and trend chart display:

| Mode | What's included |
|---|---|
| **Overall** | All assets and liabilities |
| **Liquid** | Only categories flagged "Is Liquid" (cash, bank accounts, money market) |
| **Investable** | Only categories flagged "Is Investable" (stocks, ETFs, mutual funds, bonds, crypto) |

### Metric Cards

Four summary cards below the hero:

| Card | Meaning |
|---|---|
| Total Assets | Sum of all asset line items for the current month |
| Total Liabilities | Sum of all liability line items |
| Asset/Liability Ratio | Assets ÷ Liabilities — higher is better |
| Monthly Change | Net worth difference vs. the previous month |

### Trend Chart

The area chart shows your net worth over time. The scope toggle in the hero controls which view (Overall / Liquid / Investable) the chart displays. A CAGR badge appears in the top-right corner.

### Donut Chart

The donut breaks down your assets by category. Hover a segment for the exact value.

### Performance Chart

Horizontal bars show month-over-month percentage change for recent months — a quick way to spot your best and worst periods.

### Recent Activity

A ledger below the charts shows your latest snapshot changes with category-level tags.

---

## 4. History

The History page shows every snapshot you have ever saved.

### Timeline chart

At the top of the page, an area chart plots your net worth across all snapshots. If you have a FIRE goal defined, a dashed amber reference line shows your FIRE target — so you can see at a glance how close you are.

### Search and filter

Use the search bar to filter snapshots by month (e.g. `2025-06`) or by text in your notes. A count badge shows how many snapshots match.

### Snapshot rows

Each row shows the month, net worth, and month-over-month change pill (teal for positive, rose for negative). Click anywhere on a row to expand it and see a **category breakdown** with proportional bars for each asset and liability category.

Action buttons on each row let you **Edit** or **Delete** the snapshot. Deletion requires a confirmation step.

### Comparing two snapshots

Use the two **select dropdowns** at the top of the chart to pick any two months for a side-by-side comparison. The chart highlights the selected range.

---

## 5. Goals & FIRE Planning

WealthPulse has a dedicated Goals engine with two goal types.

Click **Add Goal** to open the goal creation modal.

### Goal types

| Type | When to use |
|---|---|
| **FIRE** | You want to retire early. The engine calculates your FIRE number from annual expenses and tracks your progress. |
| **Net Worth Target** | You have a specific number in mind (e.g. ₹1 Crore). |

### Creating a FIRE goal

1. Click **Add Goal**
2. Enter a name (e.g. "Early Retirement")
3. Enter your **annual expenses** — WealthPulse multiplies by 25 (the 4% rule) to calculate your FIRE number
4. Optionally configure per-goal category exclusions (e.g. exclude your primary home so it doesn't inflate your FIRE readiness)
5. Optionally add milestones (e.g. 25%, 50%, 75%)
6. Click **Save Goal**

### FIRE Dashboard

Once saved, the FIRE goal card shows:

- **Progress bar** — how far you are toward your FIRE number as a percentage
- **Projected date** — based on your average monthly savings rate
- **Safe withdrawal rate** — dynamically calculated from your current net worth
- **Milestones** — custom checkpoints marked on the progress bar

### Per-goal category exclusions

Goals support excluding specific categories (e.g. primary home, personal vehicle). An excluded category's value is removed from the net worth figure used to calculate goal progress. Configure exclusions in **Goals → Edit → Exclude from net worth calculation**. The excluded items still count toward your overall net worth — only your goal's progress calculation ignores them.

### Editing & deleting goals

Click the **edit** (pencil) icon to modify a goal. Click the **delete** (trash) icon — a destructive confirm dialog prevents accidents.

---

## 6. Portfolio View

The Portfolio page lists all your individual assets in a sortable table.

You can sort by name, amount, category, or percentage of total assets. Use this view to quickly identify your largest holdings.

---

## 7. Settings

Settings is split into five focused sections, accessible via the left sidebar navigation (or a horizontal tab row on mobile):

### Preferences

| Setting | Description |
|---|---|
| **Base Currency** | The currency used for all totals and calculations |
| **Theme** | Light, Dark, or System |
| **Enabled Currencies** | Search and toggle which currencies appear in the editor and rate bar |

### Currencies

Manage which currencies are available in the snapshot editor and exchange rate bar. Search by code or name, then click a chip to enable or disable it. Your base currency is always shown but cannot be disabled.

### Categories

By default WealthPulse ships with standard asset and liability categories. You can:
- **Add** a custom category by typing a name and clicking **Add**
- **Rename** a category by clicking the pencil icon inline
- **Delete** a category with the trash icon (only custom categories without data can be deleted)

### Data & Backup

| Action | Description |
|---|---|
| **Download JSON** | Exports your full database as a portable JSON file |
| **Import JSON** | Restores data from a previously exported file |
| **Import from CSV / Excel** | Load line items from any bank, broker, or WealthPulse export (`.csv` or `.xlsx`). A column mapper opens: columns are auto-detected (including WealthPulse's own export headers), you pick the snapshot month, and unknown categories are created rather than skipped. Mappings can be saved and reused. |
| **Auto-Backup** | Toggle rolling in-browser backups; view and restore from backup history |

> **Important:** Restoring a JSON backup replaces all current data — WealthPulse automatically downloads a safety backup first. CSV/Excel imports are additive: they create a new snapshot for the month you choose and never touch existing months.

### Cloud Sync

Connect your Google account to sync your data to a hidden, app-only folder in Google Drive. Once connected, WealthPulse auto-syncs after every save (5-second debounce). You can also sync manually or restore a previous backup from Drive.

The Drive folder uses the `appDataFolder` scope — it is invisible in your Google Drive UI and inaccessible to any other app.

---

## 8. Automated Backup

WealthPulse has three independent backup layers to protect your data.

### Layer 1 — In-app rolling backups

Every time you save a snapshot, update a goal, or change preferences, WealthPulse automatically stores a full backup in your browser's IndexedDB. Up to **30 backups** are kept in a ring buffer (oldest is dropped after 30).

In **Settings → Data & Backup** you can:
- Toggle backups **Enabled / Disabled**
- Click **Save Now** for an immediate manual backup
- Click **Show History** to see all stored backups with timestamps
- **Restore** any backup (a safety download fires first)
- **Download** any backup as a JSON file
- **Delete** individual backup entries

### Layer 2 — Cloud backup (Google Drive)

Enable Google Drive sync in **Settings → Cloud Sync**. WealthPulse stores a full JSON backup in a hidden, app-only Drive folder after every save. Restore from Drive at any time — useful after clearing browser data or switching devices.

### Layer 3 — Manual export

Use **Download JSON** for a one-off portable backup. Store the file in an encrypted location (password-protected zip, Cryptomator, etc.) since it is plaintext.

---

## 9. Mobile Experience

WealthPulse is fully responsive and works on phones and tablets.

### Mobile navigation

A bottom navigation bar provides one-tap access to all five sections:

| Tab | Page |
|---|---|
| Home | Dashboard |
| Portfolio | Portfolio |
| History | History |
| Goals | Goals |
| Settings | Settings |

### Installing as a PWA

On iOS Safari, tap **Share → Add to Home Screen**. On Chrome or Edge, tap the **Install** icon in the address bar. Once installed, WealthPulse runs entirely offline from your home screen.

---

## 10. Light Mode

Switch to Light mode in **Settings → Preferences → Theme**. The theme preference is saved locally and persists across sessions.

WealthPulse supports Light, Dark, and System (follows your OS preference).

---

## 11. Keyboard Shortcuts & Tips

| Shortcut / Tip | Effect |
|---|---|
| **Escape** | Close any open modal |
| **Enter** (in rename input) | Confirm category rename |
| **Tab** | Move between line item fields in the editor |
| Month input | Click the month header in the editor to edit; supports `YYYY-MM` format |
| Duplicate month guard | If you try to save a snapshot for a month that already exists, an error toast prevents overwriting |
| Note area | Click "Add a note…" to expand; collapses back when empty and you close it |
| Sticky summary | The four-block bar at the bottom of the editor stays visible as you scroll |

---

## 12. Frequently Asked Questions

**Does WealthPulse send my data anywhere?**
No. All data is stored in your browser's IndexedDB. The only external requests are the optional live exchange rate fetch (open.er-api.com / frankfurter.app) and Google Drive sync if you choose to enable it.

**Can I use it offline?**
Yes. WealthPulse is a Progressive Web App (PWA). After the first load, it works fully offline. Install it from your browser's address bar for a native-app-like experience.

**How do I install it as an app?**
In Chrome/Edge, look for the **install** icon in the address bar. On Safari/iOS, tap **Share → Add to Home Screen**.

**What happens if I clear my browser data?**
Your data will be lost unless you have an export, auto-backup, or Google Drive sync enabled. Use **Download JSON** regularly or set up Cloud Sync for automatic protection.

**Can I move data between devices?**
Yes — export on one device (**Download JSON**), then import on the other (**Import JSON** in Settings). Or use Google Drive sync, which makes all your data available on any device where you sign in.

**How is my FIRE number calculated?**
FIRE number = Annual expenses × 25 (the standard 4% safe withdrawal rule). You can adjust the multiplier in the goal editor.

**What is the difference between Overall, Liquid, and Investable?**
Overall includes everything. Liquid includes only categories you've marked as liquid (quickly accessible without loss of value — cash, bank accounts). Investable includes only actively compounding categories (stocks, ETFs, mutual funds, bonds, crypto). Flag categories in the snapshot editor.

**What do the Σ✓ / Σ / ⊘ chips mean?**
Σ✓ (full inclusion) counts the item in both net worth and goal calculations. Σ (NW only) counts it in net worth but not goals. ⊘ (excluded) hides it from all calculations while keeping the data intact.

**I accidentally deleted a snapshot. Can I recover it?**
If auto-backup was enabled, go to **Settings → Data & Backup → Show History** and restore the most recent backup taken before the deletion.

---

*WealthPulse — built for privacy, designed for clarity.*
