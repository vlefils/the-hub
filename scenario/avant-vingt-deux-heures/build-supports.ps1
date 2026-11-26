Add-Type -AssemblyName System.Drawing
$imageDir = Join-Path $PSScriptRoot 'images'
[void](New-Item -ItemType Directory -Force -Path $imageDir)

function Fill($canvas, $color, $x, $y, $width, $height) {
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($color))
    try { $canvas.FillRectangle($brush, [int]$x, [int]$y, [int]$width, [int]$height) }
    finally { $brush.Dispose() }
}

function Line($canvas, $color, $width, $x1, $y1, $x2, $y2) {
    $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($color), $width)
    try { $canvas.DrawLine($pen, [int]$x1, [int]$y1, [int]$x2, [int]$y2) }
    finally { $pen.Dispose() }
}

function Label($canvas, $message, $color, $size, $x, $y, $bold = $false) {
    $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $font = [System.Drawing.Font]::new('Segoe UI', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($color))
    try { $canvas.DrawString($message, $font, $brush, [single]$x, [single]$y) }
    finally {
        $brush.Dispose()
        $font.Dispose()
    }
}

function Render($filename, $width, $height, $format, $draw) {
    $bitmap = [System.Drawing.Bitmap]::new($width, $height)
    $canvas = [System.Drawing.Graphics]::FromImage($bitmap)
    $canvas.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    try {
        & $draw $canvas
        $bitmap.Save((Join-Path $imageDir $filename), $format)
    }
    finally {
        $canvas.Dispose()
        $bitmap.Dispose()
    }
}

function Render-Plan($filename, $title, $rooms, $openings, $furniture, $control) {
    Render $filename 1440 960 ([System.Drawing.Imaging.ImageFormat]::Png) {
        param($g)
        Fill $g '#151c23' 0 0 1440 960
        Label $g 'HÔTEL DES ARCADES · VELVET' '#b6c4cf' 21 63 29 $true
        Label $g $title '#f3efdf' 46 60 56 $true
        Label $g '1 case = 1,5 m' '#e3bd7a' 25 1190 73 $true
        $left = 156
        $top = 164
        $case = 94
        foreach ($room in $rooms) {
            $x = $left + $room.X * $case
            $y = $top + $room.Y * $case
            $w = $room.W * $case
            $h = $room.H * $case
            Fill $g $room.Color $x $y $w $h
            for ($i = 1; $i -lt $room.W; $i++) {
                $a = $x + $i * $case
                Line $g '#778393' 1 $a $y $a ($y + $h)
            }
            for ($i = 1; $i -lt $room.H; $i++) {
                $a = $y + $i * $case
                Line $g '#778393' 1 $x $a ($x + $w) $a
            }
            Line $g '#d6c8a9' 4 $x $y ($x + $w) $y
            Line $g '#d6c8a9' 4 $x ($y + $h) ($x + $w) ($y + $h)
            Line $g '#d6c8a9' 4 $x $y $x ($y + $h)
            Line $g '#d6c8a9' 4 ($x + $w) $y ($x + $w) ($y + $h)
        }

        foreach ($door in $openings) {
            $x = $left + $door.X * $case
            $y = $top + $door.Y * $case
            if ($door.Horizontal) {
                Fill $g '#dfbf84' ($x + 5) ($y - 4) ($case - 10) 8
            } else {
                Fill $g '#dfbf84' ($x - 4) ($y + 5) 8 ($case - 10)
            }
        }

        foreach ($cover in $furniture) {
            $x = $left + $cover.X * $case + 10
            $y = $top + $cover.Y * $case + 18
            Fill $g '#a68372' $x $y (2 * $case - 20) 54
        }

        if ($control) {
            $x = $left + $control.X * $case + 28
            $y = $top + $control.Y * $case + 24
            Fill $g '#82aa9b' $x $y 38 40
        }

        foreach ($room in $rooms) {
            Label $g $room.Label '#fff0d4' 27 ($left + $room.X * $case + 16) ($top + $room.Y * $case + 12) $true
        }
        for ($i = 0; $i -lt 12; $i++) {
            Label $g ([string][char](65 + $i)) '#c4ccd0' 23 ($left + $i * $case + 35) ($top - 32) $true
        }
        for ($i = 0; $i -lt 7; $i++) {
            Label $g ([string]($i + 1)) '#c4ccd0' 23 ($left - 40) ($top + $i * $case + 34) $true
        }
        Fill $g '#a68372' 159 875 34 17
        Label $g 'Mobilier et demi-couvert' '#ddded9' 23 208 866
        Fill $g '#dfbf84' 560 879 42 8
        Label $g 'Passage ou porte' '#ddded9' 23 614 866
        if ($control) {
            Fill $g '#82aa9b' 934 871 26 25
            Label $g 'Commande de la porte' '#ddded9' 23 976 866
        }
    }
}

Render-Plan 'etages-plan.png' 'Le couloir des étages' @(
    @{ X=0; Y=0; W=4; H=2; Color='#554756'; Label='Salon Cèdre' }
    @{ X=8; Y=0; W=4; H=2; Color='#354953'; Label='Lingerie' }
    @{ X=0; Y=2; W=12; H=3; Color='#3e4355'; Label='Couloir des étages' }
    @{ X=0; Y=5; W=4; H=2; Color='#344252'; Label='Hall public et escalier' }
    @{ X=8; Y=5; W=4; H=2; Color='#354953'; Label='Descente vers les cuisines' }
) @(
    @{ X=1; Y=2; Horizontal=$true }
    @{ X=10; Y=2; Horizontal=$true }
    @{ X=1; Y=5; Horizontal=$true }
    @{ X=10; Y=5; Horizontal=$true }
    @{ X=0; Y=6; Horizontal=$false }
) @(@{ X=5; Y=4 }) $null

Render-Plan 'cuisines-plan.png' 'Les cuisines et le passe' @(
    @{ X=0; Y=2; W=3; H=3; Color='#344252'; Label='Depuis les étages' }
    @{ X=3; Y=1; W=6; H=5; Color='#53515a'; Label='Cuisine et passe' }
    @{ X=9; Y=2; W=3; H=3; Color='#354953'; Label='Vers les livraisons' }
) @(
    @{ X=0; Y=3; Horizontal=$false }
    @{ X=3; Y=3; Horizontal=$false }
    @{ X=9; Y=3; Horizontal=$false }
    @{ X=12; Y=3; Horizontal=$false }
) @(@{ X=4; Y=2 }, @{ X=6; Y=4 }) $null

Render-Plan 'sortie-plan.png' 'Le vestibule des livraisons' @(
    @{ X=0; Y=1; W=9; H=5; Color='#554756'; Label='Vestibule' }
    @{ X=9; Y=1; W=3; H=5; Color='#344252'; Label='Rampe publique' }
) @(
    @{ X=0; Y=3; Horizontal=$false }
    @{ X=9; Y=3; Horizontal=$false }
    @{ X=12; Y=3; Horizontal=$false }
) @(@{ X=3; Y=3 }) @{ X=8; Y=2 }

Render 'avis.jpg' 1440 900 ([System.Drawing.Imaging.ImageFormat]::Jpeg) {
    param($g)
    Fill $g '#e9e6df' 0 0 1440 900
    Fill $g '#262d34' 0 0 1440 154
    Fill $g '#b28c58' 0 148 1440 6
    Label $g 'BASTION' '#fff4dd' 55 76 34 $true
    Label $g 'CELLULE DE PERMANENCE  /  COPIE DE TRAVAIL' '#d0ccd0' 21 79 103
    Label $g 'Avis de prise de commandement' '#262d34' 52 76 208 $true
    Line $g '#a6a397' 2 81 300 1355 300
    Label $g 'OFFICIER SORTANT' '#666461' 22 81 344 $true
    Label $g 'Général Idris Vaudan' '#272c30' 34 81 382
    Label $g 'OFFICIER PAR INTÉRIM' '#666461' 22 748 344 $true
    Label $g 'Colonel Maël Vasseur' '#272c30' 34 748 382
    Label $g "PRISE D’EFFET" '#666461' 22 81 486 $true
    Label $g '22 h 00 · Heure de Paradise' '#272c30' 34 81 523
    Label $g 'DIFFUSION PUBLIQUE PRÉVUE' '#666461' 22 748 486 $true
    Label $g 'Demain matin' '#272c30' 34 748 523
    Fill $g '#f3dbd2' 81 650 1274 110
    Label $g "MOTIF D’ACTIVATION" '#743c42' 20 109 667 $true
    Label $g 'Décès confirmé' '#672d34' 36 107 698 $true
    Label $g 'EXEMPLAIRE DE TRAVAIL · VALIDATION À VÉRIFIER' '#666461' 20 81 817
}

Render 'ordre.jpg' 1440 900 ([System.Drawing.Imaging.ImageFormat]::Jpeg) {
    param($g)
    Fill $g '#15232a' 0 0 1440 900
    Fill $g '#c8a773' 0 0 1440 8
    Label $g 'BASTION  /  PERMANENCE DES UNITÉS À PARADISE' '#c5d0d1' 24 84 59 $true
    Label $g 'Ordre du général Vaudan' '#fff1d6' 57 79 169 $true
    Line $g '#778487' 2 84 274 1356 274
    Label $g 'Ici le général Vaudan. Ana, je suis vivant.' '#e9eeee' 38 85 338
    Label $g "Diffusez l’ordre sous mon nom." '#e9eeee' 38 85 400
    Label $g 'Tout déploiement lié aux nouvelles' '#fff1d6' 43 83 543 $true
    Label $g "concessions est suspendu jusqu’à nouvel ordre." '#fff1d6' 43 83 611 $true
    Label $g 'CAPITAINE ANA DERVAL · DESTINATAIRE' '#c5d0d1' 24 84 803
}
