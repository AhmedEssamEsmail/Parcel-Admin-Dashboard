# Parcel Admin Dashboard — Enhancements v10 Tasks

## Sprint 1 — Settings sub-tab UX cleanup
### V10-1.1 Remove embedded mini panel + open button
- [x] Replace iframe-based tab rendering in Settings for Upload, Schedule, Data Quality, and Ingest Health.
- [x] Render each of these tabs inline inside Settings.
Done when:
- [x] No iframe mini panel is shown for these sub-tabs.
- [x] No “Open Full Page” button is shown in these sub-tabs.

---

## Sprint 2 — Upload auto-detection UX and behavior
### V10-2.1 Remove manual selectors
- [x] Remove default warehouse selector from Upload tab/page.
- [x] Remove default dataset type selector from Upload tab/page.
- [x] Remove per-file warehouse selector from ready-for-upload table.
- [x] Remove per-file dataset selector from ready-for-upload table.
Done when:
- [x] Upload flow has no manual country/warehouse or file-type dropdowns.

### V10-2.2 Auto-detect from filename and CSV rows
- [x] Keep dataset detection from file name hints.
- [x] Detect warehouse/country from CSV row content.
- [x] Show comma-separated countries included per sheet.
Done when:
- [x] Each selected file displays its detected countries as comma-separated text.

### V10-2.3 Detection enforcement and multi-country behavior
- [x] Block upload when detection is not confident.
- [x] Split multi-country sheets by detected warehouse during ingestion.
- [x] Process all selected files in a single run.
- [x] Keep a preview step before final upload.
Done when:
- [x] Upload can process all selected files after preview.
- [x] Unknown detection prevents upload with actionable error.

---

## Sprint 3 — Inline render support for tab pages
### V10-3.1 Upload page content extraction
- [x] Make upload content reusable in embedded (Settings tab) and standalone modes.

### V10-3.2 Schedule page content extraction
- [x] Make schedule content reusable in embedded and standalone modes.

### V10-3.3 Data Quality page content extraction
- [x] Make data quality content reusable in embedded and standalone modes.

### V10-3.4 Ingest Health page content extraction
- [x] Make ingest health content reusable in embedded and standalone modes.

---

## Sprint 4 — Mobile-only UX improvements
### V10-4.1 Weekly/Monthly button sizing
- [x] Reduce weekly/monthly toggle button size in mobile view.

### V10-4.2 Mobile navigation visual redesign
- [x] Replace awkward/broken mobile nav toggle glyphs with clean icon treatment.
- [x] Improve mobile nav button/link visual hierarchy.

### V10-4.3 Card readability and spacing on mobile
- [x] Increase card typography/readability and spacing for mobile.

### V10-4.4 Sticky top navigation header on mobile
- [x] Make top app navigation header sticky while scrolling.

---

## Verification gate (required)
Run in order:
- [x] npm run build
- [x] npm run validate
- [x] npm run test:run
- [x] npm run test:integration
- [x] npm run type-check
- [x] npm run lint

Expected:
- [x] All commands pass.

Notes:
- [x] Add completion notes with touched files and verification timestamp after all checks pass.
Notes (2026-03-05):
- Completed inline Settings sub-tabs for Upload/Schedule/Data Quality/Ingest Health (removed iframe/open-full-page flow).
- Completed Upload auto-detection flow: removed manual selectors, added row-based country detection, blocked uncertain detection, added multi-country warehouse split, and multi-file preview/upload.
- Completed mobile UX updates: compact weekly/monthly toggles, redesigned mobile nav controls/buttons, improved mobile card readability, and sticky top navigation on mobile.
- Modified files:
  - C:/Users/lenovo/OneDrive/Documents/Operations/app/settings/page.tsx
  - C:/Users/lenovo/OneDrive/Documents/Operations/app/settings/upload/page.tsx
  - C:/Users/lenovo/OneDrive/Documents/Operations/app/settings/schedule/page.tsx
  - C:/Users/lenovo/OneDrive/Documents/Operations/app/data-quality/page.tsx
  - C:/Users/lenovo/OneDrive/Documents/Operations/app/ingest-health/page.tsx
  - C:/Users/lenovo/OneDrive/Documents/Operations/components/layout/mobile-nav.tsx
  - C:/Users/lenovo/OneDrive/Documents/Operations/app/globals.css
  - C:/Users/lenovo/OneDrive/Documents/Operations/Specs/Enhancements-v10/Tasks.md
- Verification passed in required order:
  1) npm run build
  2) npm run validate
  3) npm run test:run
  4) npm run test:integration
  5) npm run type-check
  6) npm run lint

Notes (2026-03-06):
- Dashboard polish update completed:
  - Fixed Average Delivery Time trend text spacing (down 261m vs last week).
  - Removed dashboard refresh section and manual Refresh Now button.
- Modified files:
  - C:/Users/lenovo/OneDrive/Documents/Operations/app/dashboard/page.tsx
  - C:/Users/lenovo/OneDrive/Documents/Operations/components/tables/wow-mom-table.tsx
- Verification passed in required order:
  1) npm run build
  2) npm run validate
  3) npm run test:run
  4) npm run test:integration
  5) npm run type-check
  6) npm run lint