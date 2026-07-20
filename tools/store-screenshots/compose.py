"""Compose the Chrome Web Store screenshots, one per listed language.

Reads after_frame.png (a clean capture of an already-rotated post) and
writes shot_<lang>.png at the store's required 1280x800, plus a contact
sheet of all five for review. Run from this directory; see README.md for
the font download step.

Two invariants keep the picture honest, and both are easy to break by
hand:

- The "before" panel is the "after" image turned back a quarter turn, so
  the two panels are guaranteed to show the same artwork. Never capture
  them separately.
- The highlighted context menu item is the LEFT rotation, because turning
  left is what takes this particular before to this particular after. If
  the source capture changes, the highlight has to follow.

Everything is drawn at S times the final size and downsampled at the end,
which is what keeps the text and the rounded corners smooth.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 2
W, H = 1280 * S, 800 * S

after0 = Image.open("after_frame.png").convert("RGB")
before0 = after0.rotate(-90, expand=True)

GRAD = ((248, 250, 253), (232, 237, 245))
FG = (24, 36, 60); SUB = (92, 107, 137); BORDER = (222, 227, 235)
ACCENT = (43, 95, 216); ACCENT_BG = (232, 240, 254)
WGHT = {"bold": 700, "med": 500, "reg": 400}

JP = {"type": "static", "bold": "fonts/IBMPlexSansJP-Bold.ttf", "med": "fonts/IBMPlexSansJP-Medium.ttf", "reg": "fonts/IBMPlexSansJP-Regular.ttf"}
KR = {"type": "static", "bold": "fonts/IBMPlexSansKR-Bold.ttf", "med": "fonts/IBMPlexSansKR-Medium.ttf", "reg": "fonts/IBMPlexSansKR-Regular.ttf"}
SC = {"type": "vf", "path": "fonts/NotoSansSC-VF.ttf"}
TC = {"type": "vf", "path": "fonts/NotoSansTC-VF.ttf"}

LANGS = {
 "en": {"font": JP,
   "head": "Sideways art, set upright with a right-click",
   "sub": "On X and Bluesky, right-click an image and choose “Rotate image 90°”. Bigger, easier to see.",
   "pb": "Sideways", "pa": "Upright",
   "mL": "Rotate image 90° left", "mR": "Rotate image 90° right"},
 "ja": {"font": JP,
   "head": "横倒しのイラストも、右クリックですぐ正しい向きに",
   "sub": "X・Bluesky のタイムラインで、画像を右クリックして「90°回転」。大きく見やすく。",
   "pb": "横倒しのまま", "pa": "回転後",
   "mL": "画像を左に90°回転", "mR": "画像を右に90°回転"},
 "ko": {"font": KR,
   "head": "옆으로 누운 그림도, 우클릭으로 바로 똑바로",
   "sub": "X·Bluesky 타임라인에서 이미지를 우클릭해 “90° 회전”. 크고 보기 편하게.",
   "pb": "옆으로 누운 채", "pa": "회전 후",
   "mL": "이미지를 왼쪽으로 90° 회전", "mR": "이미지를 오른쪽으로 90° 회전"},
 "zh_CN": {"font": SC,
   "head": "横躺的插画，右键一下就摆正",
   "sub": "在 X・Bluesky 时间线右键图片，旋转 90°。更大、更好看。",
   "pb": "横躺着", "pa": "旋转后",
   "mL": "将图片向左旋转 90°", "mR": "将图片向右旋转 90°"},
 "zh_TW": {"font": TC,
   "head": "橫躺的插畫，右鍵一下就擺正",
   "sub": "在 X・Bluesky 時間軸右鍵圖片，旋轉 90°。更大、更好看。",
   "pb": "橫躺著", "pa": "旋轉後",
   "mL": "將圖片向左旋轉 90°", "mR": "將圖片向右旋轉 90°"},
}

def mkfont(cfg, role, size):
    if cfg["type"] == "static":
        return ImageFont.truetype(cfg[role], size * S)
    f = ImageFont.truetype(cfg["path"], size * S)
    try: f.set_variation_by_axes([WGHT[role]])
    except Exception: pass
    return f

def fit(cfg, role, target, text, max_w):
    size = target
    while size > 18:
        f = mkfont(cfg, role, size)
        if f.getlength(text) <= max_w: return f
        size -= 1
    return mkfont(cfg, role, size)

def rounded(im, rad):
    rad *= S
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.size[0], im.size[1]), rad, fill=255)
    im = im.convert("RGBA"); im.putalpha(m); return im

def render(lang):
    T = LANGS[lang]; cfg = T["font"]
    bg = Image.new("RGB", (W, H)); d = ImageDraw.Draw(bg)
    for y in range(H):
        r = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(GRAD[0][i]+(GRAD[1][i]-GRAD[0][i])*r) for i in range(3)))
    base = bg.convert("RGBA")

    def card(im, x, y, rad=18):
        c = rounded(im, rad)
        sh = Image.new("RGBA", base.size, (0,0,0,0)); sm = Image.new("L", im.size, 0)
        ImageDraw.Draw(sm).rounded_rectangle((0,0,im.size[0],im.size[1]), rad*S, fill=70)
        sh.paste((10,18,44,255), (x, y+9*S), sm)
        base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(13*S)))
        base.alpha_composite(c, (x, y))
        ImageDraw.Draw(base).rounded_rectangle((x,y,x+im.size[0]-1,y+im.size[1]-1), rad*S, outline=BORDER+(255,), width=max(1,S))

    bh = 448*S; bw = int(before0.width*bh/before0.height); before = before0.resize((bw, bh), Image.LANCZOS)
    aw = 486*S; ah = int(after0.height*aw/after0.width); after = after0.resize((aw, ah), Image.LANCZOS)
    mid = 476*S; bx = 150*S; by = mid-bh//2; ax = 656*S; ay = mid-ah//2
    card(before, bx, by); card(after, ax, ay)
    d = ImageDraw.Draw(base)

    fh = fit(cfg, "bold", 41, T["head"], 1160*S)
    fs = fit(cfg, "med", 22, T["sub"], 1170*S)
    d.text((W//2, 82*S), T["head"], font=fh, fill=FG, anchor="mm")
    d.text((W//2, 138*S), T["sub"], font=fs, fill=SUB, anchor="mm")

    fpill = mkfont(cfg, "bold", 20)
    def pill(cx, ty, text, tcol, dot):
        px=15*S; ph=34*S; tw=d.textlength(text, font=fpill); dr=6*S
        tot=tw+px*2+dr*2+8*S; x0=int(cx-tot/2)
        d.rounded_rectangle((x0,ty,x0+int(tot),ty+ph), ph//2, fill=(255,255,255), outline=BORDER+(255,), width=max(1,S))
        cy=ty+ph//2
        d.ellipse((x0+px,cy-dr,x0+px+dr*2,cy+dr), fill=dot)
        d.text((x0+px+dr*2+8*S,cy), text, font=fpill, fill=tcol, anchor="lm")
    pill(bx+bw//2, by-48*S, T["pb"], (176,46,34), (214,65,40))
    pill(ax+aw//2, ay-48*S, T["pa"], (15,120,90), (29,158,117))

    # context menu (highlight LEFT = 画像を左に90°回転, matches before->after)
    items = [T["mL"], T["mR"]]
    axc = (bx+bw+ax)//2
    mx = bx + 30*S
    limit = axc - 46*S            # keep menu left of the arrow
    msize = 16
    while msize > 11:
        fmenu = mkfont(cfg, "reg", msize)
        mw = int(max(fmenu.getlength(t) for t in items)) + 52*S
        if mx + mw <= limit: break
        msize -= 1
    row = 36*S; pad = 8*S; mh = row*2 + pad*2
    my = by + int(bh*0.60)
    sh = Image.new("RGBA", base.size, (0,0,0,0)); sm = Image.new("L", (mw, mh), 0)
    ImageDraw.Draw(sm).rounded_rectangle((0,0,mw,mh), 10*S, fill=90)
    sh.paste((10,18,44,255), (mx, my+6*S), sm)
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(11*S)))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle((mx,my,mx+mw,my+mh), 10*S, fill=(255,255,255), outline=(214,218,226,255), width=max(1,S))
    hy = my+pad
    d.rounded_rectangle((mx+4*S,hy,mx+mw-4*S,hy+row), 6*S, fill=ACCENT_BG)
    for i, t in enumerate(items):
        ry = my+pad+row*i
        d.text((mx+14*S, ry+row//2), t, font=fmenu, fill=(ACCENT if i==0 else (40,44,52)), anchor="lm")
    cxp, cyp = mx+mw-40*S, hy+row//2+2*S
    cur=[(cxp,cyp),(cxp,cyp+22*S),(cxp+5*S,cyp+17*S),(cxp+9*S,cyp+25*S),(cxp+13*S,cyp+23*S),(cxp+9*S,cyp+15*S),(cxp+16*S,cyp+15*S)]
    d.polygon(cur, fill=(255,255,255)); d.line(cur+[cur[0]], fill=(20,24,32), width=max(1,S))

    ayc=mid; head=30*S; xl=axc-40*S; xr=axc+40*S
    d.line([(xl,ayc),(xr-head+4*S,ayc)], fill=ACCENT, width=16*S)
    d.polygon([(xr,ayc),(xr-head,ayc-head),(xr-head,ayc+head)], fill=ACCENT)
    return base.convert("RGB").resize((1280,800), Image.LANCZOS)

outs={}
for lang in LANGS:
    im=render(lang); im.save(f"shot_{lang}.png"); outs[lang]=im
    print("rendered", lang)

# comparison sheet
labels={"en":"en","ja":"ja","ko":"ko","zh_CN":"zh_CN","zh_TW":"zh_TW"}
tw=640; th=int(tw*800/1280); lh=30; pad=16
order=list(LANGS)
cols=2; rows=(len(order)+1)//2
sheet=Image.new("RGB",(pad+(tw+pad)*cols, pad+(th+lh+pad)*rows),(245,246,248))
ds=ImageDraw.Draw(sheet); lf=ImageFont.truetype("fonts/IBMPlexSansJP-Bold.ttf",16)
for i,l in enumerate(order):
    cx=pad+(i%cols)*(tw+pad); cy=pad+(i//cols)*(th+lh+pad)
    ds.text((cx,cy),labels[l],font=lf,fill=(30,34,42))
    sheet.paste(outs[l].resize((tw,th),Image.LANCZOS),(cx,cy+lh))
    ds.rectangle((cx,cy+lh,cx+tw-1,cy+lh+th-1),outline=(210,214,220))
sheet.save("i18n_sheet.png")
print("sheet",sheet.size)
