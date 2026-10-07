export const SHAREPOINT_SITE_URL =
  "https://example.sharepoint.com/sites/supply-chain/";

export const CONNECTION_REFERENCE_ID = "00000000-0000-4000-8000-000000000209";

export const SHAREPOINT_LISTS = [
  {
    key: "unblockMaterial",
    displayName: "Unblock Material",
    suggestedRuntimeName: "unblock material",
    url: `${SHAREPOINT_SITE_URL}Lists/Unblock%20Material/AllItems.aspx`,
  },
  {
    key: "unblockMaterialTicket",
    displayName: "Unblock Material Ticket",
    suggestedRuntimeName: "unblock material ticket",
    url: `${SHAREPOINT_SITE_URL}Lists/Unblock%20Material%20Ticket/AllItems.aspx`,
  },
] as const;
