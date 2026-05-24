param(
  [string]$ImageDir = "$HOME\Downloads\unspokenvideo\images",
  [string]$Output = "",
  [string]$CaptionFile = "",
  [string]$ArchiveRoot = (Get-Location).Path,
  [string]$RunName = (Get-Date -Format "yyyy-MM-dd"),
  [switch]$KeepSourceFiles,
  [int]$SecondsPerImage = 3,
  [int]$FontSize = 58,
  [int]$CaptionMarginTop = 260,
  [int]$CtaFontSize = 52,
  [int]$CtaMarginBottom = 250,
  [int]$CtaStartOffsetSeconds = 2
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw "ffmpeg is not installed or not available in PATH."
}

if (-not (Test-Path -LiteralPath $ImageDir)) {
  throw "Image directory does not exist: $ImageDir"
}

$images = Get-ChildItem -LiteralPath $ImageDir -File |
  Where-Object { $_.Extension -match "^\.(png|jpg|jpeg|webp)$" } |
  Sort-Object Name

if ($images.Count -eq 0) {
  throw "No image files found in: $ImageDir"
}

$outputRoot = Join-Path $ArchiveRoot "output"
$runDir = Join-Path $outputRoot $RunName
$archiveImageDir = Join-Path $runDir "images"
$archiveCaptionDir = Join-Path $runDir "captions"
$workDir = Join-Path $runDir "segments"
if (-not $Output) {
  $Output = Join-Path $runDir "unspokenvideo.mp4"
}

$captions = @()
if ($CaptionFile -and (Test-Path -LiteralPath $CaptionFile)) {
  $captions = Get-Content -LiteralPath $CaptionFile -Encoding UTF8
}

$outputDir = Split-Path -Parent $Output
if (-not $outputDir) {
  $outputDir = (Get-Location).Path
}
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path $archiveImageDir | Out-Null
New-Item -ItemType Directory -Force -Path $archiveCaptionDir | Out-Null
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

foreach ($image in $images) {
  Copy-Item -LiteralPath $image.FullName -Destination (Join-Path $archiveImageDir $image.Name) -Force
}

if ($CaptionFile -and (Test-Path -LiteralPath $CaptionFile)) {
  Copy-Item -LiteralPath $CaptionFile -Destination (Join-Path $archiveCaptionDir "captions.txt") -Force
}

function Convert-ToFfmpegFilterPath {
  param([string]$Path)

  return $Path.Replace("\", "/").Replace(":", "\:").Replace("'", "\\'")
}

function Convert-ToAssText {
  param([string]$Text)

  return $Text.Replace("\", "\\").Replace("{", "\{").Replace("}", "\}").Replace("`r`n", "\N").Replace("`n", "\N")
}

function Write-AssSubtitle {
  param(
    [string]$Path,
    [string]$Text,
    [int]$DurationSeconds,
    [int]$Size,
    [int]$Margin,
    [int]$Alignment = 8,
    [int]$StartSeconds = 0
  )

  $safeText = Convert-ToAssText $Text
  $startTime = "0:00:{0:D2}.00" -f $StartSeconds
  $endTime = "0:00:{0:D2}.00" -f $DurationSeconds
  $ass = @"
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,$Size,&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,1,0,0,0,100,100,0,0,3,18,0,$Alignment,80,80,$Margin,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,$startTime,$endTime,Default,,0,0,0,,$safeText
"@
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $ass, $utf8NoBom)
}

$ctaCaption = ""
if ($captions.Count -gt $images.Count) {
  $ctaCaption = (($captions | Select-Object -Skip $images.Count) | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join " "
}
$ctaStart = [Math]::Max(0, [Math]::Min($SecondsPerImage - 1, $CtaStartOffsetSeconds))

$segments = @()
for ($i = 0; $i -lt $images.Count; $i++) {
  $segment = Join-Path $workDir ("segment-{0:D2}.mp4" -f ($i + 1))
  $segments += $segment
  $caption = ""
  if ($i -lt $captions.Count) {
    $caption = $captions[$i].Trim()
  }
  $vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p"
  if ($caption) {
    $captionAssFile = Join-Path $workDir ("caption-{0:D2}.ass" -f ($i + 1))
    Write-AssSubtitle -Path $captionAssFile -Text $caption -DurationSeconds $SecondsPerImage -Size $FontSize -Margin $CaptionMarginTop -Alignment 8
    $captionAssFileForFilter = Convert-ToFfmpegFilterPath $captionAssFile
    $vf = "$vf,subtitles='$captionAssFileForFilter'"
  }
  if ($ctaCaption -and ($i -eq ($images.Count - 1))) {
    $ctaAssFile = Join-Path $workDir "cta.ass"
    Write-AssSubtitle -Path $ctaAssFile -Text $ctaCaption -DurationSeconds $SecondsPerImage -Size $CtaFontSize -Margin $CtaMarginBottom -Alignment 2 -StartSeconds $ctaStart
    $ctaAssFileForFilter = Convert-ToFfmpegFilterPath $ctaAssFile
    $vf = "$vf,subtitles='$ctaAssFileForFilter'"
  }
  & ffmpeg -y `
    -loop 1 `
    -t $SecondsPerImage `
    -i $images[$i].FullName `
    -vf $vf `
    -r 30 `
    -an `
    $segment
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed while creating segment $($i + 1)."
  }
}

$listFile = Join-Path $workDir "concat.txt"
$concatText = ($segments |
  ForEach-Object { "file '$($_.Replace("'", "''"))'" }) -join [Environment]::NewLine
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($listFile, $concatText, $utf8NoBom)

& ffmpeg -y -f concat -safe 0 -i $listFile -c copy $Output
if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg failed while concatenating segments."
}

if (-not $KeepSourceFiles) {
  foreach ($image in $images) {
    if (Test-Path -LiteralPath $image.FullName) {
      Remove-Item -LiteralPath $image.FullName -Force
    }
  }

  if ($CaptionFile -and (Test-Path -LiteralPath $CaptionFile)) {
    Remove-Item -LiteralPath $CaptionFile -Force
  }
}

Write-Host "Created $Output"
Write-Host "Archived package in $runDir"
if (-not $KeepSourceFiles) {
  Write-Host "Deleted source files from download directory."
}
