# WealthPulse — Final Implementation Plan

> [!NOTE]
> This plan consolidates the research, architecture decisions, and Google Stitch designs from the previous session. The project is ready for implementation.

---

## Stitch Design References

The UI is based on 3 design mockups generated via [Google Stitch](https://stitch.withgoogle.com/projects/16058194455037315257), saved in `NetWorthTracker/design/`:

| Screen | File | Key Design Elements |
|---|---|---|
| **All Screens Overview** | `stitch_all_screens.png` | 6 screens: Portfolio Allocation, Dashboard, Market Overview, Transaction History, FIRE Goals, Snapshot Editor |
| **Dashboard Detail** | `stitch_dashboard_detail.png` | Net worth hero ($2,842,091), trend chart, Total Assets/Liabilities/Net Change cards, Portfolio Performance bar chart, Ledger Activity feed |
| **Goals & Editor** | `stitch_goals_editor.png` | FIRE Goals Dashboard with progress indicators, Monthly Snapshot Editor with transaction ledger, category-based entry |

### Design System Extracted from Stitch

| Element | Specification |
|---|---|
| **Background** | Deep charcoal/navy gradient (`#0d1117` → `#161b22`) |
| **Cards** | Dark glassmorphic panels with `rgba(255,255,255,0.05)` background, subtle borders `rgba(255,255,255,0.08)` |
| **Accent Color** | Muted sage green (`#4ade80` / `#22c55e`) for positive values, charts, and CTAs |
| **Negative Values** | Coral/salmon red (`#ef4444` / `#f87171`) |
| **Neutral Badges** | Muted blue-gray for categories like "INVESTMENT", "TRANSFER" |
| **Typography** | Inter font family — large display numbers (36-48px) for hero, clean 14px body |
| **Sidebar** | Dark vertical nav with icon + label items: Dashboard, Portfolio, Markets, Transactions, Settings |
| **Charts** | Green-toned bar charts and area charts on dark backgrounds |
| **Cards Layout** | 3-column grid for metric cards (Total Assets, Total Liabilities, Net Change) |
| **Activity Feed** | Row-based ledger with icon, entity name, category badge, date, and amount |
| **Mobile** | Bottom tab navigation, single-column layout, touch-optimized |

---

## Architecture

### Tech Stack

| Technology | Purpose |
|---|---|
| **Vite + React + TypeScript** | SPA framework with type safety, fast HMR |
| **vite-plugin-pwa** | Service worker, manifest, offline caching |
| **IndexedDB** (via Dexie.js) | Structured local database |
| **Recharts** | Charts (area, bar, donut) |
| **Vanilla CSS** | Custom design system with CSS variables |
| **date-fns** | Date formatting |
| **xlsx** (SheetJS) | Excel file import |

### Data Model

```typescript
interface Snapshot {
  id: string;
  month: string;                        // "2026-02" (YYYY-MM)
  createdAt: string;
  updatedAt: string;
  exchangeRates: Record<string, number>; // { "SGD": 72, "USD": 83 }
  categories: Category[];
  monthlyIncome?: number;               // Optional, for FIRE
  monthlyExpenses?: number;             // Optional, for FIRE
}

interface Category {
  id: string;
  name: string;
  type: 'asset' | 'liability';
  icon: string;
  items: LineItem[];
  isLiquid: boolean;
  isInvestable: boolean;
}

interface LineItem {
  id: string;
  name: string;
  amount: number;
  currency: string;                     // ISO code ("INR", "SGD")
  notes?: string;
  excludeFromNetWorth?: boolean;
}

interface Goal {
  id: string;
  type: 'net_worth_target' | 'fire' | 'savings' | 'debt_freedom' | 'custom';
  name: string;
  targetAmount: number;
  targetDate?: string;
  // FIRE-specific
  annualExpenses?: number;
  withdrawalRate?: number;              // Default 4%
  multiplier?: number;                  // Default 25x
  milestones: Milestone[];
}

interface UserPreferences {
  baseCurrency: string;
  enabledCurrencies: string[];
  theme: 'dark';                        // Dark only for v1
  profileName: string;
}
```

### File Structure

```
NetWorthTracker/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                       # Design system + global styles
│   ├── types/index.ts                  # TypeScript interfaces
│   ├── db/database.ts                  # Dexie.js setup
│   ├── context/
│   │   ├── SnapshotContext.tsx
│   │   ├── GoalContext.tsx
│   │   ├── CurrencyContext.tsx
│   │   └── PreferencesContext.tsx
│   ├── utils/
│   │   ├── calculations.ts
│   │   ├── fireCalculator.ts
│   │   ├── currencies.ts
│   │   ├── excelImporter.ts
│   │   └── defaultCategories.ts
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Portfolio.tsx               # Asset Allocation detail
│   │   ├── Goals.tsx                   # Goals & FIRE dashboard
│   │   ├── SnapshotEditor.tsx
│   │   ├── HistoryBrowser.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── dashboard/
│   │   │   ├── NetWorthHero.tsx
│   │   │   ├── MetricCards.tsx         # Total Assets, Liabilities, Net Change
│   │   │   ├── TrendChart.tsx
│   │   │   ├── PerformanceChart.tsx    # Bar chart
│   │   │   ├── DonutChart.tsx
│   │   │   └── LedgerActivity.tsx
│   │   ├── portfolio/
│   │   │   ├── AllocationChart.tsx
│   │   │   └── HoldingsTable.tsx
│   │   ├── goals/
│   │   │   ├── GoalCard.tsx
│   │   │   ├── FIREDashboard.tsx
│   │   │   ├── ProgressRing.tsx
│   │   │   ├── MilestoneTimeline.tsx
│   │   │   └── GoalEditor.tsx
│   │   ├── editor/
│   │   │   ├── CategorySection.tsx
│   │   │   ├── LineItemRow.tsx
│   │   │   └── ExchangeRateBar.tsx
│   │   ├── history/
│   │   │   ├── MonthPicker.tsx
│   │   │   └── CompareView.tsx
│   │   └── common/
│   │       ├── Card.tsx
│   │       ├── Button.tsx
│   │       ├── Badge.tsx
│   │       ├── Toggle.tsx
│   │       └── CurrencyDisplay.tsx
│   └── hooks/
│       ├── useSnapshots.ts
│       ├── useGoals.ts
│       └── useCalculations.ts
├── public/
│   └── icons/                          # PWA icons
├── design/                             # Stitch mockups (reference only)
└── sample/
    └── Feb_2026_NW copy.xlsx           # Sample data for import testing
```

---

## Data Persistence (3 Layers)

| Layer | Technology | Purpose | Survives Cache Clear? |
|---|---|---|---|
| **Layer 1: Runtime DB** | IndexedDB + `navigator.storage.persist()` | Primary fast storage | No (but persist() helps) |
| **Layer 2: Local File Sync** | File System Access API | Auto-save JSON to user-chosen folder | ✅ Yes |
| **Layer 3: Manual Backup** | JSON export/import | Download/upload full database | ✅ Yes |

---

## Key Features

### Multi-Currency (30+ currencies)
- Base currency selection (e.g., INR)
- Per-item currency with exchange rate conversion
- Manual rates + optional auto-fetch from free API
- Locale-aware formatting (₹, $, S$, etc.)

### Categories (India/NRI-friendly defaults)
- **Assets**: Cash, Investments, Real Estate, Retirement (EPF/PPF/NPS/CPF), Insurance, Precious Metals, Personal Property, Business, Foreign Holdings
- **Liabilities**: Secured Debt, Unsecured Debt, Tax, Other
- Customizable: add/rename/hide any sub-category
- "Liquid" and "Investable" net worth view toggles

### FIRE Calculator
- FI Number = Annual Expenses × Multiplier (default 25×)
- Progress ring, savings rate gauge, time-to-FI countdown
- Safe Withdrawal Rate income display
- Lean / Regular / Fat FIRE classification
- Milestone timeline with celebrations

---

## Execution Phases

### Phase 1: Foundation & Design System
- [x] ~~Project research & planning~~ (completed in previous session)
- [ ] Initialize Vite + React + TypeScript project with PWA plugin
- [ ] Implement design system in `index.css` (CSS variables, glassmorphic cards, typography)
- [ ] Set up IndexedDB with Dexie.js (`database.ts`)
- [ ] Create TypeScript interfaces (`types/index.ts`)
- [ ] Define currencies (`currencies.ts`) and default categories (`defaultCategories.ts`)
- [ ] Build app shell: Sidebar navigation + Header + routing
- [ ] Mobile bottom navigation

### Phase 2: Dashboard & Core Visualization
- [ ] Net Worth Hero component with animated count-up
- [ ] Metric cards (Total Assets, Total Liabilities, Net Change 24H) — matching Stitch layout
- [ ] Trend area chart (12 months)
- [ ] Portfolio Performance bar chart
- [ ] Asset composition donut chart
- [ ] Ledger Activity feed component
- [ ] View toggles (Overall / Liquid / Investable)

### Phase 3: Snapshot Editor
- [ ] Collapsible category sections with line items
- [ ] Dynamic add/remove line items with per-item currency selector
- [ ] Exchange rate input bar
- [ ] Auto-calculation with currency conversion
- [ ] Save to IndexedDB + "clone previous month" feature
- [ ] Optional Monthly Cash Flow section (for FIRE users)

### Phase 4: Goals & FIRE Tracking
- [ ] Goal creation modal (Net Worth Target, FIRE, Savings, Debt Freedom, Custom)
- [ ] FIRE Calculator engine (`fireCalculator.ts`)
- [ ] FIRE Dashboard with progress ring, savings rate, time-to-FI
- [ ] Milestone timeline with celebration animations
- [ ] Goal cards on main dashboard

### Phase 5: Portfolio & History
- [ ] Portfolio/Asset Allocation page with donut chart + holdings table
- [ ] History Browser with month picker / calendar grid
- [ ] Full snapshot detail view for past months
- [ ] Side-by-side month comparison with change indicators

### Phase 6: Import, Export & Polish
- [ ] Excel file import (parse sample XLSX)
- [ ] JSON/CSV export
- [ ] File System Access API for auto-save (Layer 2)
- [ ] PWA manifest + icons + installability
- [ ] Responsive design polish (mobile breakpoints)
- [ ] Micro-animations, onboarding flow, error handling
- [ ] Lighthouse PWA audit

---

## Verification Plan

### Automated
- `npm run build` — zero errors
- Lighthouse PWA audit — installable, offline-ready
- `npm run dev` — visual verification

### Browser Testing
- Navigate all pages and capture screenshots
- Test responsive design at mobile breakpoints (375px, 768px)
- Verify chart rendering and data accuracy
- Test data persistence (create snapshot → refresh → verify data survives)

### Manual Verification
- Import sample Excel file → verify parsed values
- Create monthly snapshot → verify IndexedDB persistence
- Toggle Overall / Liquid / Investable views → verify calculations
- Set FIRE goal → verify calculator outputs
- Export data → verify format
- Install as PWA → verify app-like experience
