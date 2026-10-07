// Example connector descriptor so the app compiles without a tenant.
// Register the two SharePoint lists with the Power Apps CLI to generate the real one.
export const dataSourcesInfo = {
  "overtime request": { tableId: "00000000-0000-4000-8000-000000000701", version: "", primaryKey: "ID", dataSourceType: "Connector", apis: {} },
  "overtime employee": { tableId: "00000000-0000-4000-8000-000000000702", version: "", primaryKey: "ID", dataSourceType: "Connector", apis: {} },
}
