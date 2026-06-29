# UX/CX Review Lessons Learned

## Print report column misalignment (June 2026)

**What happened:** The print report rendered each category as a separate `<table>` using
`table-layout: auto`. The browser independently auto-sized each table's columns based on
content, causing columns to be different widths across categories — a zigzag appearance.

**Why it slipped through UX reviews:**
1. `window.print()` fires immediately, so reviewers saw the OS print dialog, not the HTML.
   The misalignment is only visible in the *print preview* pane, which most people skip.
2. With one category, a single auto-sized table looks fine. The bug requires 2+ categories
   with different content widths to appear.
3. All prior UX reviews focused on the React/Tailwind live app. `printReport.ts` generates
   a raw HTML string outside the React component tree — it was never part of a design pass.

**Fix:** `table-layout: fixed` + `<colgroup>` with shared column widths (50/10/20/20%) on
every category table. Long item names get `text-overflow: ellipsis`; number cells get
`white-space: nowrap`.

**Process gap to fix:** Add "print preview check with 3+ categories and multi-currency
items" to the UX review checklist. Print output must be verified separately from the
screen UI — it is a different rendering context.

## Browser-driven review: separate real bugs from test artifacts (June 2026)

**What happened:** A Playwright-driven new-user walkthrough flagged two apparent bugs —
line-item data "not saving" and a net-worth-vs-total-assets mismatch. Both were wrong:
1. The "data loss" was stale `.nth()` locators. After the first item committed, the DOM
   gained inputs, so later indices pointed at the wrong rows. Re-locating elements fresh
   per category (`page.locator('.category-section', { hasText }).first()`) showed all
   items saved correctly.
2. The "mismatch" (₹14,99,742 vs ₹15,00,000) was the net-worth **count-up animation**
   caught mid-frame. Sampling the value over ~2s showed it settling to the exact total.

**Process gap to fix:** When a browser-driven review surfaces a *correctness* bug (data
loss, wrong totals), verify it before reporting:
- Re-query the DOM fresh instead of reusing index-based locators across mutations.
- Read committed values from input `value` (not `innerText`, which skips form fields).
- For any headline number, sample it over time — animated counters lie in a single frame.
Reserve "bug" for what reproduces; report artifacts as artifacts. (Two retractions in one
review erode trust more than finding fewer issues.)
