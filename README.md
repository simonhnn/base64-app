# オンライン変換ツール集（base64-app）

Base64 変換を起点に拡張した、**クライアント完結型のオンラインツール／早見表サイト**です。
変換・計算はすべてブラウザ内で行い、Cloudflare Pages（静的配信 + Functions）でホストします。

- 本番: https://base64-app-2he.pages.dev
- 収益化: Google AdSense + A-ADS（広告）

開発の詳細な規約は [CLAUDE.md](CLAUDE.md) を参照してください。

## 提供コンテンツ

| ページ | 内容 |
|---|---|
| `/` | Base64 エンコード / デコード（UTF-8 対応、WebMCP 対応） |
| `/url-encode` | URL（パーセント）エンコード / デコード |
| `/json-format` | JSON 整形 / 圧縮 / 文法チェック |
| `/hash` | ハッシュ生成（SHA-1 / 256 / 384 / 512） |
| `/nenrei-hayami` | 年齢早見表（西暦・和暦・干支、閲覧年で自動更新） |
| `/tools` | ツール一覧ハブ |
| `/faq` `/how-to-use` `/privacy` | 解説・使い方・プライバシーポリシー |

各ページに日本語（ルート）と英語（`/en/` 配下）があります（一部の日本語専用コンテンツを除く）。

## 主な特徴

- 変換・計算はすべてブラウザ内で完結（サーバー処理は入力ログの記録のみ）
- 日本語以外のアクセスを `/en/` へ自動振り分け（`functions/_middleware.js`）
- クリーン URL（拡張子なし）で統一、SEO（canonical / hreflang / 構造化データ / sitemap）対応
- IndexNow で Bing / Yandex 等へクロール通知
- ライト / ダークテーマ対応

## ディレクトリ構成

```text
.
├── public/                     # 配信される静的ファイル一式
│   ├── index.html / style.css / app.js
│   ├── tools.js                # URL/JSON/ハッシュ各ツール共通ロジック
│   ├── url-encode.html / json-format.html / hash.html / tools.html
│   ├── nenrei-hayami.html
│   ├── faq.html / how-to-use.html / privacy.html
│   ├── en/                     # 英語版（日本語版と1対1対応）
│   ├── sitemap.xml / robots.txt / ads.txt
│   └── <indexnow-key>.txt      # IndexNow 認証キー（削除禁止）
├── functions/
│   ├── _middleware.js          # 言語振り分け
│   └── api/log.js              # 入力ログ API（D1 へ記録）
├── tests/                      # mocha テスト
├── schema.sql / wrangler.toml / package.json
├── CLAUDE.md                   # AI 駆動開発ガイド
└── .claude/                    # Claude Code 設定・スラッシュコマンド
```

## ローカル確認

```bash
# 静的ファイルのみ
cd public && python3 -m http.server 8000

# Functions（言語振り分け・API）込み
npx wrangler pages dev public
```

## テスト

```bash
npm install
npm test        # mocha + chai + jsdom
```

## Cloudflare Pages + Functions + D1

1. D1 データベースを作成し、`schema.sql` を適用
2. `wrangler.toml` の `database_id` を実値に設定
3. Pages プロジェクトを作成しリポジトリを接続、出力ディレクトリを `public` に
4. D1 バインディングを `DB` で設定
5. main への push で自動デプロイ

## API 仕様（`POST /api/log`）

```json
{ "direction": "encode", "plaintext": "こんにちは" }
```

- `direction`: `encode` / `decode` / `url-encode` / `url-decode` / `json-format` / `json-minify` / `hash`
- `plaintext`: 1〜100000 文字
- レート制限: 同一 IP あたり 30 リクエスト / 分

## プライバシー

- 変換・計算はクライアント側で完結
- サービス改善のため、操作種別と入力内容を D1 に保存（**第三者提供なし**）
- 広告（AdSense / A-ADS）の Cookie・データ送信について `public/privacy.html` に明記

詳細は [`public/privacy.html`](public/privacy.html) を参照してください。
