# Génère les icônes et le logo de l'application à partir de logo.jpg (logo du club).
# Usage (depuis le dossier du projet) : powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1
param(
  [string]$Source = 'logo.jpg',
  [string]$OutDir = 'public'
)

Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source).Path)
# Fond = couleur du coin du logo, pour qu'aucun cadre ne se voie autour de l'image.
$background = ([System.Drawing.Bitmap]$src).GetPixel(2, 2)
# Évite le liseré gris que le redimensionnement crée sur les bords de l'image.
$attrs = New-Object System.Drawing.Imaging.ImageAttributes
$attrs.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)

# Zone du monogramme « US » + balle (sans le texte), pour les très petites tailles.
$monogram = New-Object System.Drawing.Rectangle 170, 150, 930, 575
$full = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height

function New-Canvas([int]$width, [int]$height) {
  $bmp = New-Object System.Drawing.Bitmap $width, $height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($background)
  return @($bmp, $g)
}

# Icône carrée : l'image (ou la zone $crop) occupe $scale de la largeur, centrée sur fond blanc.
function Save-Icon([int]$size, [double]$scale, [System.Drawing.Rectangle]$crop, [string]$name) {
  $bmp, $g = New-Canvas $size $size
  $box = $size * $scale
  $ratio = $crop.Width / $crop.Height
  if ($ratio -ge 1) { $w = $box; $h = $box / $ratio } else { $h = $box; $w = $box * $ratio }
  $dest = New-Object System.Drawing.Rectangle ([int](($size - $w) / 2)), ([int](($size - $h) / 2)), ([int]$w), ([int]$h)
  $g.DrawImage($src, $dest, $crop.X, $crop.Y, $crop.Width, $crop.Height, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
  $path = Join-Path $OutDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output $path
}

New-Item -ItemType Directory -Force $OutDir | Out-Null

Save-Icon 192 0.92 $full 'icon-192.png'
Save-Icon 512 0.92 $full 'icon-512.png'
# Icône « masquable » d'Android : le logo doit tenir dans le cercle central (80 %).
Save-Icon 512 0.66 $full 'icon-maskable-512.png'
Save-Icon 180 0.88 $full 'apple-touch-icon.png'
# Favicon : le monogramme seul, le texte serait illisible.
Save-Icon 64 0.96 $monogram 'favicon.png'

# Logo affiché dans l'application (format d'origine, 480 px de large).
$w = 480
$h = [int]($src.Height * $w / $src.Width)
$bmp, $g = New-Canvas $w $h
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel, $attrs)
$path = Join-Path $OutDir 'logo.png'
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output $path

$src.Dispose()
