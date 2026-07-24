---
description: テスト・デプロイ反映確認・IndexNow 送信をまとめて実行する
argument-hint: [送信する追加URL...]
---

以下を順に実行してください。

1. `npm test` を実行し、全テストが通ることを確認する。
2. 変更を main にコミット & push する（Cloudflare Pages が自動デプロイ）。
3. デプロイ反映を確認する。middleware が言語振り分けするため、確認 curl には
   `-H 'Accept-Language: ja'` を付けるか `-L` で追跡すること。
   ```bash
   curl -s -o /dev/null -w '%{http_code}' -H 'Accept-Language: ja' https://base64-app-2he.pages.dev/<path>
   ```
   200 かつ想定の内容（例: AdSense タグ、主要見出し）を含むまで待つ。
4. 反映後、変更・追加した URL を IndexNow へ送信する（キー: `public/8c01b6099b8dbc5c2bd9cc8fc284cf59.txt`）。
   ```bash
   curl -s -X POST https://api.indexnow.org/indexnow \
     -H 'Content-Type: application/json; charset=utf-8' \
     --data '{"host":"base64-app-2he.pages.dev","key":"8c01b6099b8dbc5c2bd9cc8fc284cf59","keyLocation":"https://base64-app-2he.pages.dev/8c01b6099b8dbc5c2bd9cc8fc284cf59.txt","urlList":["https://base64-app-2he.pages.dev/<path>"]}'
   ```
   Bing（`https://www.bing.com/indexnow`）と Yandex（`https://yandex.com/indexnow`）にも同じペイロードを送る。
   200/202 が成功。`$ARGUMENTS` があればそのURLも含める。
