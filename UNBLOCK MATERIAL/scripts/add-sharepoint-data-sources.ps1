param(
  [Parameter(Mandatory = $true)]
  [string] $UnblockMaterialResourceName,

  [Parameter(Mandatory = $true)]
  [string] $UnblockMaterialTicketResourceName
)

$ErrorActionPreference = "Stop"

$siteUrl = "https://example.sharepoint.com/sites/supply-chain/"
$apiId = "shared_sharepointonline"
$connectionId = "00000000-0000-4000-8000-000000000209"

npx power-apps add-data-source `
  --api-id $apiId `
  --connection-id $connectionId `
  --dataset $siteUrl `
  --resource-name $UnblockMaterialResourceName `
  --non-interactive

npx power-apps add-data-source `
  --api-id $apiId `
  --connection-id $connectionId `
  --dataset $siteUrl `
  --resource-name $UnblockMaterialTicketResourceName `
  --non-interactive
