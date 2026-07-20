#!/bin/sh
# Download the fonts compose.py needs into ./fonts (git-ignored).
#
# All four families are OFL-licensed and pulled from google/fonts. The two
# Noto families ship only as variable fonts, whose upstream filenames carry
# brackets; they are renamed to -VF.ttf so compose.py can name them plainly.
set -eu

cd "$(dirname "$0")"
mkdir -p fonts

base="https://raw.githubusercontent.com/google/fonts/main/ofl"

for weight in Bold Medium Regular; do
    curl -fsSL -o "fonts/IBMPlexSansJP-$weight.ttf" \
        "$base/ibmplexsansjp/IBMPlexSansJP-$weight.ttf"
    curl -fsSL -o "fonts/IBMPlexSansKR-$weight.ttf" \
        "$base/ibmplexsanskr/IBMPlexSansKR-$weight.ttf"
done

curl -fsSL -o "fonts/NotoSansSC-VF.ttf" "$base/notosanssc/NotoSansSC%5Bwght%5D.ttf"
curl -fsSL -o "fonts/NotoSansTC-VF.ttf" "$base/notosanstc/NotoSansTC%5Bwght%5D.ttf"

echo "Fonts downloaded:"
ls -1 fonts
