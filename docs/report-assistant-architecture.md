# Asisten Laporan

Implementation is grouped under `src/features/report-assistant`:

- `components`: report selection/period, fact inputs, and draft preview.
- `hooks/useReportAssistant`: form state and user-action orchestration.
- `services/reportDraftStorage`: tab-local draft defaults and restoration.
- `constants/reportTypes`: report schemas and field definitions.
- `domain`: validation, report narrative construction, and privacy checks.
- `exporters`: Word construction, canvas chart rendering, and browser download fallback.

The page only composes the hook and presentation components. Existing data services
(`lib/reportRecap`, analytics, calculations, and table models) remain shared and
are reused without changing their query or calculation behavior.

`lib/reportAssistant` and `lib/docxExport` are compatibility entry points so existing
callers and tests keep working. New report UI imports feature modules directly.
The domain has no React, browser storage, or database dependency. Chart rendering
is independent of DOCX construction; browser download fallback is isolated from both.

Validation: `npm test`, `npm run build`, and targeted ESLint for changed modules.
