# Unblock Material

A material release ticket browser with search, status filters, pagination and linked material details.

The frontend reads ticket and material records through typed SharePoint services. Material details load when a ticket is opened, rather than loading every child record in the initial view.

## Source

- `src/App.tsx` contains ticket browsing and detail views.
- `src/sharepointConfig.ts` defines the example site and list links.
- `src/generated` contains ticket and material service contracts.
- `scripts/add-sharepoint-data-sources.ps1` registers the two lists with supplied configuration.

## Development

```powershell
npm ci
npm run dev
npm run build
npm run lint
```

The sample descriptor permits compilation but has no connector operations. Generate real descriptors before testing queries against a tenant. This source implements browsing and status visibility; it does not include the backend release workflow. See [integration setup](../README.md#integration-setup).
