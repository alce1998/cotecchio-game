Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\AlCe\Desktop\Cotecchio\cotecchio-traversone\client\public\cards\logo.jpg"
$img = [System.Drawing.Image]::FromFile($srcPath)

$sizes = @(
  @{ dir = "mipmap-mdpi"; px = 48 },
  @{ dir = "mipmap-hdpi"; px = 72 },
  @{ dir = "mipmap-xhdpi"; px = 96 },
  @{ dir = "mipmap-xxhdpi"; px = 144 },
  @{ dir = "mipmap-xxxhdpi"; px = 192 }
)

foreach ($s in $sizes) {
  $targetDir = Join-Path "c:\Users\AlCe\Desktop\Cotecchio\cotecchio-traversone\android\app\src\main\res" $s.dir
  if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
  }
  
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
  Write-Host "Created icons in $($s.dir) size $($s.px)"
}

$img.Dispose()
