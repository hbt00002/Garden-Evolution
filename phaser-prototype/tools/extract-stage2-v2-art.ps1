param([Parameter(Mandatory = $true)][string]$Source)

Add-Type -AssemblyName System.Drawing
$outputDir = Join-Path $PSScriptRoot "..\public\assets\stage2-v2"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Export-Sprite {
  param([string]$Name, [int]$X, [int]$Y, [int]$Width, [int]$Height, [bool]$RemoveAllWhite = $false)
  $sourceBitmap = [System.Drawing.Bitmap]::FromFile($Source)
  $crop = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($crop)
  $graphics.DrawImage($sourceBitmap, 0, 0, [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height), [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose(); $sourceBitmap.Dispose()

  $visited = New-Object 'bool[,]' $Width, $Height
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()
  for ($px = 0; $px -lt $Width; $px++) {
    $queue.Enqueue([System.Drawing.Point]::new($px, 0)); $queue.Enqueue([System.Drawing.Point]::new($px, $Height - 1))
  }
  for ($py = 0; $py -lt $Height; $py++) {
    $queue.Enqueue([System.Drawing.Point]::new(0, $py)); $queue.Enqueue([System.Drawing.Point]::new($Width - 1, $py))
  }
  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue()
    if ($point.X -lt 0 -or $point.Y -lt 0 -or $point.X -ge $Width -or $point.Y -ge $Height) { continue }
    if ($visited[$point.X, $point.Y]) { continue }
    $visited[$point.X, $point.Y] = $true
    $color = $crop.GetPixel($point.X, $point.Y)
    $spread = [Math]::Max($color.R, [Math]::Max($color.G, $color.B)) - [Math]::Min($color.R, [Math]::Min($color.G, $color.B))
    if ($color.R -lt 238 -or $color.G -lt 238 -or $color.B -lt 238 -or $spread -gt 10) { continue }
    $crop.SetPixel($point.X, $point.Y, [System.Drawing.Color]::Transparent)
    $queue.Enqueue([System.Drawing.Point]::new($point.X + 1, $point.Y)); $queue.Enqueue([System.Drawing.Point]::new($point.X - 1, $point.Y))
    $queue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y + 1)); $queue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y - 1))
  }
  for ($pass = 0; $pass -lt 2; $pass++) {
    $toClear = [System.Collections.Generic.List[System.Drawing.Point]]::new()
    for ($py = 1; $py -lt $Height - 1; $py++) {
      for ($px = 1; $px -lt $Width - 1; $px++) {
        $color = $crop.GetPixel($px, $py)
        if ($color.A -eq 0) { continue }
        $touchesAlpha = $crop.GetPixel($px - 1, $py).A -eq 0 -or $crop.GetPixel($px + 1, $py).A -eq 0 -or
          $crop.GetPixel($px, $py - 1).A -eq 0 -or $crop.GetPixel($px, $py + 1).A -eq 0
        $spread = [Math]::Max($color.R, [Math]::Max($color.G, $color.B)) - [Math]::Min($color.R, [Math]::Min($color.G, $color.B))
        if ($touchesAlpha -and $color.R -gt 205 -and $color.G -gt 205 -and $color.B -gt 205 -and $spread -lt 28) {
          $toClear.Add([System.Drawing.Point]::new($px, $py))
        }
      }
    }
    foreach ($point in $toClear) { $crop.SetPixel($point.X, $point.Y, [System.Drawing.Color]::Transparent) }
  }
  if ($RemoveAllWhite) {
    for ($py = 0; $py -lt $Height; $py++) {
      for ($px = 0; $px -lt $Width; $px++) {
        $color = $crop.GetPixel($px, $py)
        $spread = [Math]::Max($color.R, [Math]::Max($color.G, $color.B)) - [Math]::Min($color.R, [Math]::Min($color.G, $color.B))
        if ($color.R -gt 224 -and $color.G -gt 224 -and $color.B -gt 224 -and $spread -lt 24) {
          $crop.SetPixel($px, $py, [System.Drawing.Color]::Transparent)
        }
      }
    }
  }
  $target = Join-Path $outputDir "$Name.png"
  $crop.Save($target, [System.Drawing.Imaging.ImageFormat]::Png); $crop.Dispose(); Write-Output $target
}

Export-Sprite "mountain-ridge" 12 48 1268 214
Export-Sprite "valley-ridge" 12 268 1268 174
Export-Sprite "stream-meadow" 14 438 902 244 $true
Export-Sprite "cottage" 918 420 362 232
Export-Sprite "acacia-a" 15 642 235 260 $true
Export-Sprite "acacia-b" 248 670 205 232 $true
Export-Sprite "hornbeam-a" 438 642 180 264 $true
Export-Sprite "hornbeam-b" 620 665 150 238 $true
Export-Sprite "frog-a" 838 655 130 112
Export-Sprite "frog-b" 995 655 130 112
Export-Sprite "flowers-a" 754 768 125 140
Export-Sprite "flowers-b" 870 765 125 143
Export-Sprite "flowers-c" 982 765 125 143
Export-Sprite "rock-a" 1080 765 125 143
Export-Sprite "rock-b" 1185 765 100 143
