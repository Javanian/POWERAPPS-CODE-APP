# TCCD

A training and certification request application with participant entry, request tracking, approval routing and an administration portal.

## Source

- `src/TccdRequestForm.tsx` collects request and participant data.
- `src/TccdList.tsx` displays requests and approval progress.
- `src/AdminPortal.tsx` handles request administration, routing and participant updates.
- `src/adminAccess.ts` checks the current Power Apps user against membership roles.
- `src/employeeLookup.ts` indexes the local employee data for personnel-number lookup.
- `src/generated` contains list and flow service contracts.

## Development

```powershell
npm ci
npm run dev
npm run build
npm run lint
```

Setup supplies two synthetic employee records and example connector configuration. Real employee files are ignored by Git, but the lookup JSON is bundled into the app. Only use data suitable for the app's audience. See [integration setup](../../README.md#integration-setup) for connector requirements and workbook conversion.

Admin visibility is a client-side check. SharePoint and flow permissions must also enforce access. Approval and notification flows require separate configuration and validation in the target environment.
