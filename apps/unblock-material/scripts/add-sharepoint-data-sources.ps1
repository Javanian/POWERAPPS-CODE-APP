param(
  [Parameter(Mandatory = $true)]
  [string] $SiteUrl,

  [Parameter(Mandatory = $true)]
  [string] $ConnectionId,

  [Parameter(Mandatory = $true)]
  [string] $UnblockMaterialResourceName,

  [Parameter(Mandatory = $true)]
  [string] $UnblockMaterialTicketResourceName
)

$ErrorActionPreference = "Stop"

$apiId = "shared_sharepointonline"

npx power-apps add-data-source `
  --api-id $apiId `
  --connection-id $ConnectionId `
  --dataset $SiteUrl `
  --resource-name $UnblockMaterialResourceName `
  --non-interactive

if ($LASTEXITCODE -ne 0) { throw "Failed to register the material list." }

npx power-apps add-data-source `
  --api-id $apiId `
  --connection-id $ConnectionId `
  --dataset $SiteUrl `
  --resource-name $UnblockMaterialTicketResourceName `
  --non-interactive

if ($LASTEXITCODE -ne 0) { throw "Failed to register the ticket list." }
