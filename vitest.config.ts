import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Scoped to the files this session actually changed (the sub-category
      // feature + its merge fixes) — diff/patch coverage, not whole-repo coverage.
      // The rest of the app (Google Drive OAuth, WebAuthn, page shells, Settings
      // cards, layout chrome) predates this work, was untouched by it, and is a
      // separate, much larger undertaking to bring to 90%.
      //
      // AppContext.tsx is deliberately excluded even though it appears in this
      // session's diff: the only change there is a comment (the two adjacent
      // functional lines are main's, brought in by the merge, not authored here).
      include: [
        'src/utils/subCategories.ts',
        'src/utils/defaultSubCategories.ts',
        'src/utils/calculations.ts',
        'src/utils/importExport.ts',
        'src/utils/printReport.ts',
        'src/utils/returns.ts',
        'src/hooks/useCsvParser.ts',
        'src/hooks/useDecimalInput.ts',
        'src/components/editor/CategorySection.tsx',
        'src/components/editor/SubCategoryGroupHeader.tsx',
        'src/components/editor/SuggestGroupsModal.tsx',
        'src/components/editor/AddItemRow.tsx',
        'src/components/editor/LineItemRow.tsx',
        'src/components/dashboard/DonutChart.tsx',
        'src/components/settings/CsvImportModal.tsx',
        'src/components/common/MissingSnapshotBanner.tsx',
        'src/pages/Portfolio.tsx',
        'src/pages/SnapshotEditor.tsx',
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
