param(
  [Parameter(Mandatory = $true)]
  [string]$ExtensionId
)

$ErrorActionPreference = "Stop"

$hostName = "com.unspokenvideo.pipeline"
$nativeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostCmd = Join-Path $nativeDir "video_host.cmd"
$manifestPath = Join-Path $nativeDir "$hostName.json"

if (-not (Test-Path -LiteralPath $hostCmd)) {
  throw "Native host command not found: $hostCmd"
}

$manifest = @{
  name = $hostName
  description = "Unspoken Video Pipeline native video builder"
  path = $hostCmd
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifestJson = $manifest | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8NoBom)

$chromeKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
New-Item -Path $chromeKey -Force | Out-Null
Set-Item -Path $chromeKey -Value $manifestPath

$edgeKey = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
New-Item -Path $edgeKey -Force | Out-Null
Set-Item -Path $edgeKey -Value $manifestPath

Write-Host "Installed native host: $hostName"
Write-Host "Manifest: $manifestPath"
