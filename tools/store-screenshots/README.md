# ストア用スクリーンショットの生成

Chrome ウェブストアの掲載画像（1280×800）を、掲載している 5 言語ぶんまとめて作る。掲載言語ごとに専用の画像を入れないと既定言語の画像へフォールバックするため、5 枚とも必要になる。

## 使い方

```sh
pip install pillow
./fetch-fonts.sh
python compose.py
```

`shot_en.png` `shot_ja.png` `shot_ko.png` `shot_zh_CN.png` `shot_zh_TW.png` と、5 枚を並べた確認用の `i18n_sheet.png` が出る。生成物とフォントは git 管理外。

## 素材

`after_frame.png` が唯一の入力で、回転済みの投稿を実機で撮ってトリミングしたもの。作例のイラストは作者自身のもので、MIT License の対象には含まない。

**「回転前」の画像は用意しない。** `compose.py` が `after_frame.png` を 90° 戻して作る。別々に撮ると 2 枚が微妙にずれ、比較画像として成立しなくなるため。

## フォント

| 言語 | フォント |
|---|---|
| en / ja | IBM Plex Sans JP |
| ko | IBM Plex Sans KR |
| zh_CN | Noto Sans SC |
| zh_TW | Noto Sans TC |

いずれも OFL。`fetch-fonts.sh` が google/fonts から取得する。中国語に IBM Plex を使っていないのは、Plex の SC / TC が google/fonts に無いため。

## 触るときの注意

- **右クリックメニューのハイライトは「左に回転」**。この作例は左回転で before から after になるので、実際の操作と一致させている。素材を差し替えるなら回転方向を確認してハイライトも合わせる。
- 文言は `compose.py` の `LANGS` にある。メニュー項目は各ロケールの `_locales/<lang>/messages.json` の正規の訳と一致させること（見出しとサブは掲載用の手訳）。
- 見出しが長い言語では自動で字を詰める（`fit`）ので、多少長くてもレイアウトは崩れない。
