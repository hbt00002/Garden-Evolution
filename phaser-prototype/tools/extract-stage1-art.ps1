param(
  [Parameter(Mandatory = $true)][string]$Source
)

Add-Type -AssemblyName System.Drawing

$outputDir = Join-Path $PSScriptRoot "..\public\assets\stage1-v2"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Export-Sprite {
  param([string]$Name, [int]$X, [int]$Y, [int]$Width, [int]$Height, [bool]$ClearEdgeArtifacts = $false)

  $sourceBitmap = [System.Drawing.Bitmap]::FromFile($Source)
  $crop = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($crop)
  $graphics.DrawImage($sourceBitmap, 0, 0, [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height), [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose()
  $sourceBitmap.Dispose()

  $visited = New-Object 'bool[,]' $Width, $Height
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()
  for ($px = 0; $px -lt $Width; $px++) {
    $queue.Enqueue([System.Drawing.Point]::new($px, 0))
    $queue.Enqueue([System.Drawing.Point]::new($px, $Height - 1))
  }
  for ($py = 0; $py -lt $Height; $py++) {
    $queue.Enqueue([System.Drawing.Point]::new(0, $py))
    $queue.Enqueue([System.Drawing.Point]::new($Width - 1, $py))
  }

  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue()
    if ($point.X -lt 0 -or $point.Y -lt 0 -or $point.X -ge $Width -or $point.Y -ge $Height) { continue }
    if ($visited[$point.X, $point.Y]) { continue }
    $visited[$point.X, $point.Y] = $true
    $color = $crop.GetPixel($point.X, $point.Y)
    $spread = [Math]::Max($color.R, [Math]::Max($color.G, $color.B)) - [Math]::Min($color.R, [Math]::Min($color.G, $color.B))
    $isSheetBackground = $color.R -ge 232 -and $color.G -ge 232 -and $color.B -ge 232 -and $spread -le 7
    if (-not $isSheetBackground) { continue }
    $crop.SetPixel($point.X, $point.Y, [System.Drawing.Color]::Transparent)
    $queue.Enqueue([System.Drawing.Point]::new($point.X + 1, $point.Y))
    $queue.Enqueue([System.Drawing.Point]::new($point.X - 1, $point.Y))
    $queue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y + 1))
    $queue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y - 1))
  }

  if ($ClearEdgeArtifacts) {
    $edgeVisited = New-Object 'bool[,]' $Width, $Height
    $edgeQueue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()
    for ($px = 0; $px -lt $Width; $px++) {
      $edgeQueue.Enqueue([System.Drawing.Point]::new($px, 0))
      $edgeQueue.Enqueue([System.Drawing.Point]::new($px, $Height - 1))
    }
    for ($py = 0; $py -lt $Height; $py++) {
      $edgeQueue.Enqueue([System.Drawing.Point]::new(0, $py))
      $edgeQueue.Enqueue([System.Drawing.Point]::new($Width - 1, $py))
    }
    while ($edgeQueue.Count -gt 0) {
      $point = $edgeQueue.Dequeue()
      if ($point.X -lt 0 -or $point.Y -lt 0 -or $point.X -ge $Width -or $point.Y -ge $Height) { continue }
      if ($edgeVisited[$point.X, $point.Y]) { continue }
      $edgeVisited[$point.X, $point.Y] = $true
      if ($crop.GetPixel($point.X, $point.Y).A -eq 0) { continue }
      $crop.SetPixel($point.X, $point.Y, [System.Drawing.Color]::Transparent)
      $edgeQueue.Enqueue([System.Drawing.Point]::new($point.X + 1, $point.Y))
      $edgeQueue.Enqueue([System.Drawing.Point]::new($point.X - 1, $point.Y))
      $edgeQueue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y + 1))
      $edgeQueue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y - 1))
    }
  }

  $target = Join-Path $outputDir "$Name.png"
  $crop.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
  Write-Output $target
}

Export-Sprite "mountain-ridge" 8 5 1505 282
Export-Sprite "spruce-large" 5 545 280 470 $true
Export-Sprite "spruce-medium" 270 680 210 330 $true
Export-Sprite "spruce-small" 450 765 160 245 $true
Export-Sprite "shrub-a" 595 825 240 185 $true
Export-Sprite "shrub-b" 835 830 185 180 $true
Export-Sprite "rock-large" 995 825 240 185 $true
Export-Sprite "rock-medium" 1220 855 195 155 $true
