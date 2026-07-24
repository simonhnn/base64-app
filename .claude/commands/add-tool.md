---
description: 新しいクライアント完結型ツールのページを規約どおりに追加する
argument-hint: <ツール名（例: timestamp-converter）> <日本語タイトル>
---

`$ARGUMENTS` で指定されたツールを、本リポジトリの規約（CLAUDE.md）に従って追加してください。

手順:
1. `public/<slug>.html`（日本語）と `public/en/<slug>.html`（英語）を作成する。
   - 既存ツールページ（例: `public/url-encode.html`）の `<head>` を踏襲。
   - **URL は拡張子なし**。canonical / hreflang(ja,en,x-default) / og:* / JSON-LD(WebApplication) を設定。
   - `<head>` に AdSense タグ、本文に A-ADS の ad-slot を配置。
   - フッターに `/tools`・`/` などへの相互リンク。英語ページは日本語へ `?lang=ja`。
2. ロジックは `public/tools.js` に追加する（要素の有無で初期化を分岐、`initXxxTool()` パターン）。
   - 入力を記録する場合は `logInput("<direction>", value)` を呼び、`functions/api/log.js` の
     `ALLOWED_DIRECTIONS` に direction を追加する。**「サーバーに送信しない」等の虚偽表現は書かない。**
3. `functions/_middleware.js` の `JA_TO_EN` に `"/<slug>": "/en/<slug>"` を追加（対訳がある場合）。
4. `public/sitemap.xml` に日英2URLを追加。トップ/ハブ（`public/tools.html`, `public/en/tools.html`）に導線を追加。
5. 可能ならロジックのテストを `tests/` に追加し、`npm test` を通す。
6. コミット & push 後、デプロイ反映を確認して新URLを IndexNow へ送信する（`/deploy-check` 参照）。
