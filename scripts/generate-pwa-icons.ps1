# Export app icon sizes from the existing Edusyn brand asset.
Add-Type -AssemblyName System.Drawing
$brandDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../apps/web/public/brand'))
$sourceIcon = [Drawing.Image]::FromFile((Join-Path $brandDirectory 'favicon.png'))
try {
    foreach ($variant in @(
        @{ Name = 'pwa-192.png'; Size = 192; Padding = 0 },
        @{ Name = 'pwa-512.png'; Size = 512; Padding = 0 },
        @{ Name = 'pwa-maskable-512.png'; Size = 512; Padding = 0.22 },
        @{ Name = 'apple-touch-icon.png'; Size = 180; Padding = 0.05 }
    )) {
        $canvas = [Drawing.Bitmap]::new($variant.Size, $variant.Size)
        $graphics = [Drawing.Graphics]::FromImage($canvas)
        try {
            $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#eff4ff'))
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
            $slot = $variant.Size * (1 - 2 * $variant.Padding)
            $scale = $slot / [Math]::Max($sourceIcon.Width, $sourceIcon.Height)
            $width = [int]($sourceIcon.Width * $scale)
            $height = [int]($sourceIcon.Height * $scale)
            $graphics.DrawImage($sourceIcon, [int](($variant.Size - $width) / 2), [int](($variant.Size - $height) / 2), $width, $height)
            $canvas.Save((Join-Path $brandDirectory $variant.Name), [Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $canvas.Dispose()
        }
    }
} finally {
    $sourceIcon.Dispose()
}
