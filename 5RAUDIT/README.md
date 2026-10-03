# 5R Audit

A workplace audit application with area selection, 5R scoring, evidence photos and corrective action follow-up.

The main flow is setup, audit entry, then follow-up list and detail. Follow-up screens keep the original audit values visible while allowing action plans, after-action evidence and status updates.

## Source

- `src/auditFormConfig.ts` maps audit criteria to SharePoint fields.
- `src/auditSetupData.ts` loads the area master and audit setup data.
- `src/followUpData.ts` handles follow-up queries and updates.
- `src/imagePrep.ts` validates, compresses and creates previews of images.
- `src/evidenceImageColumn.ts` uploads evidence through a flow and writes image-column values through connector-backed HTTP operations.

## Development

```powershell
npm ci
npm run dev
npm run build
npm run lint
```

Setup runs before development and builds. The sample configuration compiles without connecting to a real tenant. Audit writes, image uploads and follow-up updates require the configured lists, flow and authenticated runtime described in [integration setup](../README.md#integration-setup).
