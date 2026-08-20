Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\AlCe\Desktop\Cotecchio\cotecchio-traversone\client\public\cards\logo.jpg"
$img = [System.Drawing.Image]::FromFile($srcPath)

$sizes = @(
  @{ dir = "mipmap-mdpi"; px = 48; fgPx = 108 },
  @{ dir = "mipmap-hdpi"; px = 72; fgPx = 162 },
  @{ dir = "mipmap-xhdpi"; px = 96; fgPx = 216 },
  @{ dir = "mipmap-xxhdpi"; px = 144; fgPx = 324 },
  @{ dir = "mipmap-xxxhdpi"; px = 192; fgPx = 432 }
)

foreach ($s in $sizes) {
  $targetDir = Join-Path "c:\Users\AlCe\Desktop\Cotecchio\cotecchio-traversone\android\app\src\main\res" $s.dir
  if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }
  
  # Standard launcher
  $bmp = New-Object System.Drawing.Bitmap($s.px, $s.px)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $s.px, $s.px)
  $g.Dispose()

  $outPath = Join-Path $targetDir "ic_launcher.png"
  $outRoundPath = Join-Path $targetDir "ic_launcher_round.png"
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Save($outRoundPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()

  # Foreground for adaptive launcher
  $bmpFg = New-Object System.Drawing.Bitmap($s.fgPx, $s.fgPx)
  $gFg = [System.Drawing.Graphics]::FromImage($bmpFg)
  $gFg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  # Draw logo centered in foreground with padding for adaptive mask
  $pad = [int]($s.fgPx * 0.15)
  $drawPx = $s.fgPx - ($pad * 2)
  $gFg.DrawImage($img, $pad, $pad, $drawPx, $drawPx)
  $gFg.Dispose()

  $outFgPath = Join-Path $targetDir "ic_launcher_foreground.png"
  $bmpFg.Save($outFgPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmpFg.Dispose()

  Write-Host "Generated launcher and adaptive foreground icons in $($s.dir)"
}

$img.Dispose()
