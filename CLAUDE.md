# CLAUDE.md

Claude Code 用のプロジェクトガイド。AI 駆動開発の前提・規約・手順をまとめる。

## 概要

Base64 変換を起点に拡張した**クライアント完結型のオンラインツール／早見表サイト**。
Cloudflare Pages（静的配信 + Functions）でホストし、広告（Google AdSense / A-ADS）で収益化する。

- 本番: https://base64-app-2he.pages.dev
- ホスティング: Cloudflare Pages（`pages_build_output_dir = "public"`、ビルド工程なし）
- 動的処理: `functions/`（Pages Functions）。データベースは D1（binding `DB`）
- 収益: 全ページに Google AdSense（`ca-pub-5206748133579380`）と A-ADS ユニット `2448808`

## 絶対制約

- **追加コスト禁止**。無料 or Cloudflare 無料枠のみ（独自ドメイン・有料プランも不可）。
- **ビルド工程を増やさない**。`public/` の静的ファイルをそのまま配信する。生成物はコミットする。
- 変換・計算処理は**すべてブラウザ内**で行う（サーバー処理はログ記録のみ）。

## ディレクトリ構成

- `public/` … 配信されるすべての静的ファイル（HTML/CSS/JS/画像/sitemap 等）
  - `public/en/` … 英語版ページ（日本語版と1対1対応）
  - `public/app.js` … Base64 トップページ専用ロジック（WebMCP ツール登録含む）
  - `public/tools.js` … URL/JSON/ハッシュ各ツール共通ロジック（要素の有無で初期化を分岐）
  - `public/style.css` … 全ページ共通スタイル（CSS 変数でライト/ダーク両対応）
- `functions/_middleware.js` … 全リクエスト前処理。日本語以外を `/en/` へ振り分け
- `functions/api/log.js` … 入力ログを D1 に記録する API（`POST /api/log`）
- `tests/` … mocha テスト（`npm test`）
- `schema.sql` … D1 テーブル定義（`conversion_logs`）

## URL 規約（重要）

- Cloudflare Pages は `/foo.html` を **308 で `/foo`（拡張子なし）へ正規化**する。
- そのため **canonical・hreflang・og:url・sitemap・内部リンク・JSON-LD・middleware のパスはすべて拡張子なし**に統一すること。`.html` を書かない。

## 多言語（i18n）

- 日本語＝ルート（`/`, `/tools` …）、英語＝`/en/` 配下。各ページに実テキストを直接記述する。
- 表示言語は `<html lang>` で確定。ブラウザ判定はしない。
- `functions/_middleware.js` の `JA_TO_EN` に日本語ページ→英語ページの対応を**拡張子なしで**登録すると、日本語以外の訪問者が 302 で英語版へ振り分けられる（クローラー除外・`?lang=ja` で明示切替・`lang` cookie で一度きり）。
- 日本語専用コンテンツ（例: 年齢早見表）は `JA_TO_EN` に登録せず、hreflang も付けない。

## SEO 規約（各ページ必須）

- 固有の `<title>` / `meta description` / `canonical`（自ページ・拡張子なし）
- 対訳がある場合は `hreflang` ja/en/x-default を相互に
- 適切な構造化データ（WebApplication / ItemList / FAQPage / BreadcrumbList）
- `og:*`（`og:image` は `/og-image.jpg`）
- `sitemap.xml` に追加し、`robots.txt` は全許可＋sitemap 参照
- 全ページ相互リンク（フッターにツール一覧等）

## 広告

- `<head>` に AdSense タグ（`ca-pub-5206748133579380`）。
- 本文中に A-ADS の ad-slot（ユニット `2448808`）。新ページにも同じブロックを置く。
- `public/ads.txt` は AdSense のパブリッシャー承認。**削除しない**。

## 入力ログとプライバシー（重要）

- 各ツールは入力内容を `POST /api/log`（`{direction, plaintext}`）で D1 に記録する。
  `direction` は `functions/api/log.js` の `ALLOWED_DIRECTIONS` にある値のみ。
- **記録する場合、ページ上に「サーバーに送信しない」等の虚偽表現を書かないこと。**
  入力ログを追加・変更したら、必ず該当ページの文言と `privacy`（日英）を更新する。
- 記録内容は第三者提供しない（プライバシーポリシーに明記済み）。

## 検索エンジン通知（IndexNow）

- 認証キー: `public/8c01b6099b8dbc5c2bd9cc8fc284cf59.txt`（**削除禁止**）。
- ページ追加・更新後、デプロイ反映を確認してから `POST https://api.indexnow.org/indexnow`
  （+ `www.bing.com/indexnow`, `yandex.com/indexnow`）に `{host,key,keyLocation,urlList}` を送る。
- Google は IndexNow 非対応（Search Console 側で対応）。

## 開発フロー

1. `public/` を編集（新ページは既存ページの `<head>` テンプレートを踏襲、拡張子なしURLで）。
2. `npm test` を通す。JSON-LD/HTML の妥当性も確認。
3. main へコミット & push → Cloudflare Pages が自動デプロイ。
4. デプロイ反映を確認（`curl -H 'Accept-Language: ja' <URL>`。middleware があるため `-L` か `Accept-Language: ja` を付ける）。
5. 新URLを IndexNow へ送信。

## よく使うコマンド

```bash
npm test                                   # テスト
npx wrangler pages dev public              # ローカルで Functions 込み起動
node -c public/tools.js                    # 構文チェック
```

## やってはいけないこと

- 有料要素の導入、ビルド工程の追加、`.html` 付き URL の使用。
- 入力を記録しているのに「送信しない」と表示すること。
- IndexNow キーや `ads.txt` の削除。
