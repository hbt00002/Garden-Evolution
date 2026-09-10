param([Parameter(Mandatory = $true)][string]$Source)

Add-Type -AssemblyName System.Drawing
$outputDir = Join-Path $PSScriptRoot "..\public\assets\stage2-v1"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Color-Distance($a, $b) {
  return [Math]::Sqrt(
    [Math]::Pow([int]$a.R - [int]$b.R, 2) +
    [Math]::Pow([int]$a.G - [int]$b.G, 2) +
    [Math]::Pow([int]$a.B - [int]$b.B, 2)
  )
}

function Export-Sprite {
  param([string]$Name, [int]$X, [int]$Y, [int]$Width, [int]$Height, [string]$Seed = "all")
  $sourceBitmap = [System.Drawing.Bitmap]::FromFile($Source)
  $crop = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($crop)
  $graphics.DrawImage($sourceBitmap, 0, 0, [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height), [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose(); $sourceBitmap.Dispose()

  $visited = New-Object 'bool[,]' $Width, $Height
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()
  if ($Seed -eq "top") {
    for ($px = 0; $px -lt $Width; $px++) { $queue.Enqueue([System.Drawing.Point]::new($px, 0)) }
  } else {
    for ($px = 0; $px -lt $Width; $px++) {
      $queue.Enqueue([System.Drawing.Point]::new($px, 0)); $queue.Enqueue([System.Drawing.Point]::new($px, $Height - 1))
    }
    for ($py = 0; $py -lt $Height; $py++) {
      $queue.Enqueue([System.Drawing.Point]::new(0, $py)); $queue.Enqueue([System.Drawing.Point]::new($Width - 1, $py))
    }
  }

  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue()
    if ($point.X -lt 0 -or $point.Y -lt 0 -or $point.X -ge $Width -or $point.Y -ge $Height) { continue }
    if ($visited[$point.X, $point.Y]) { continue }
    $visited[$point.X, $point.Y] = $true
    $current = $crop.GetPixel($point.X, $point.Y)
    $crop.SetPixel($point.X, $point.Y, [System.Drawing.Color]::Transparent)
    foreach ($next in @(
      [System.Drawing.Point]::new($point.X + 1, $point.Y), [System.Drawing.Point]::new($point.X - 1, $point.Y),
      [System.Drawing.Point]::new($point.X, $point.Y + 1), [System.Drawing.Point]::new($point.X, $point.Y - 1)
    )) {
      if ($next.X -lt 0 -or $next.Y -lt 0 -or $next.X -ge $Width -or $next.Y -ge $Height) { continue }
      if ($visited[$next.X, $next.Y]) { continue }
      $candidate = $crop.GetPixel($next.X, $next.Y)
      if ((Color-Distance $current $candidate) -le 15) { $queue.Enqueue($next) }
    }
  }

  # Remove one-pixel chroma fringes left by the generated studio backdrop.
  for ($pass = 0; $pass -lt 2; $pass++) {
    $toClear = [System.Collections.Generic.List[System.Drawing.Point]]::new()
    for ($py = 1; $py -lt $Height - 1; $py++) {
      for ($px = 1; $px -lt $Width - 1; $px++) {
        $color = $crop.GetPixel($px, $py)
        if ($color.A -eq 0) { continue }
        $touchesAlpha = $crop.GetPixel($px - 1, $py).A -eq 0 -or $crop.GetPixel($px + 1, $py).A -eq 0 -or
          $crop.GetPixel($px, $py - 1).A -eq 0 -or $crop.GetPixel($px, $py + 1).A -eq 0
        if (-not $touchesAlpha) { continue }
        $neonGreen = $color.G -gt 220 -and ($color.G - $color.R) -gt 95 -and ($color.G - $color.B) -gt 70
        $neonRed = $color.R -gt 220 -and $color.G -lt 95 -and $color.B -lt 95
        $neonCyan = $color.G -gt 215 -and $color.B -gt 215 -and $color.R -lt 45
        $neonYellow = $color.R -gt 220 -and $color.G -gt 220 -and $color.B -lt 45
        if ($neonGreen -or $neonRed -or $neonCyan -or $neonYellow) { $toClear.Add([System.Drawing.Point]::new($px, $py)) }
      }
    }
    foreach ($point in $toClear) { $crop.SetPixel($point.X, $point.Y, [System.Drawing.Color]::Transparent) }
  }

  $target = Join-Path $outputDir "$Name.png"
  $crop.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose(); Write-Output $target
}

Export-Sprite "mountain-ridge" 5 0 1525 171 "top"
Export-Sprite "valley-ridge" 5 170 1525 180
Export-Sprite "stream-meadow" 8 338 1010 312
Export-Sprite "cottage" 1040 345 485 305
Export-Sprite "acacia-a" 10 620 325 255
Export-Sprite "acacia-b" 340 625 285 250
Export-Sprite "hornbeam-a" 625 630 195 245
Export-Sprite "hornbeam-b" 830 630 180 245
Export-Sprite "frog-a" 45 890 125 110
Export-Sprite "frog-b" 205 890 125 110
Export-Sprite "flowers-a" 380 875 180 135
Export-Sprite "flowers-b" 570 875 180 135
Export-Sprite "flowers-c" 765 875 185 135
Export-Sprite "rock-a" 985 870 260 145
Export-Sprite "rock-b" 1260 875 245 140
