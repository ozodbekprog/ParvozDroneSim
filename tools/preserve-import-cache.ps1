param([Parameter(Mandatory=$true)][string]$RelativePath)
$ErrorActionPreference='Stop'
$workspace=(Resolve-Path 'C:/DroneLiftoffUz').Path
$source=(Resolve-Path (Join-Path $workspace $RelativePath)).Path
if(-not $source.StartsWith($workspace+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Source outside workspace'}
if((Get-Item -LiteralPath $source).LinkType){throw 'Already linked'}
$destination=Join-Path 'D:/DroneLiftoffUz-import-temp/preserved-cache' ($RelativePath -replace '[\\/]','-')
if(Test-Path -LiteralPath $destination){throw 'Destination already exists'}
$manifest=@(Get-ChildItem -LiteralPath $source -File -Recurse | ForEach-Object {
  [pscustomobject]@{path=$_.FullName.Substring($source.Length+1);hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
})
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath ($destination+'-checksums.json') -Encoding utf8
Copy-Item -LiteralPath $source -Destination $destination -Recurse
foreach($entry in $manifest){if((Get-FileHash -LiteralPath (Join-Path $destination $entry.path) -Algorithm SHA256).Hash -ne $entry.hash){throw ('Copy mismatch: '+$entry.path)}}
if((Resolve-Path -LiteralPath $source).Path -ne $source){throw 'Source changed during copy'}
Remove-Item -LiteralPath $source -Recurse -Force
New-Item -ItemType Junction -Path $source -Target $destination | Out-Null
foreach($entry in $manifest){if((Get-FileHash -LiteralPath (Join-Path $source $entry.path) -Algorithm SHA256).Hash -ne $entry.hash){throw ('Junction mismatch: '+$entry.path)}}
Write-Output ('Preserved '+$manifest.Count+' files: '+$source+' -> '+$destination)
