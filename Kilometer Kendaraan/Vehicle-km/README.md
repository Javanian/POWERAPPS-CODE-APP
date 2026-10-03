# Vehicle Mileage

An operational vehicle mileage application with vehicle and driver selection, mileage entry and a report view.

The frontend uses React, TypeScript, React Router and Tailwind CSS. Typed Power Apps services connect the mileage, driver and vehicle lists.

## Source

- `src/pages/kilometer-form.tsx` contains the entry and reporting screens.
- `src/services/kilometer-service.ts` wraps list queries and record creation.
- `src/generated` contains connector models and services.

## Development

```powershell
npm ci
npm run dev
npm run build
npm run lint
```

Setup creates local configuration from examples. Data queries and submissions require compatible SharePoint lists and an authenticated Power Apps runtime. See [integration setup](../../docs/integration.md).
