# Base64変換ウェブアプリ

テキストと Base64 を相互変換するシンプルなウェブアプリです。  
変換処理はすべてブラウザ内で完結し、サーバーにはログ収集のみを送信します。

## 特徴

- 最後に編集した欄から変換方向（エンコード / デコード）を自動判定
- UTF-8対応（日本語を含む文字列を正しく変換）
- 入力上限 10,000 文字
- 「変換」ボタンで相互変換
- 各欄の右下のアイコンでワンクリックコピー / 「クリア」で一括消去
- ログは「Base64ではない側（平文側）」のみ保存

## ディレクトリ構成

```text
.
├── public/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── how-to-use.html
│   └── privacy.html
├── functions/
│   └── api/
│       └── log.js
├── tests/
│   ├── frontend.test.mjs
│   └── api-log.test.mjs
├── schema.sql
├── wrangler.toml
├── package.json
└── base64-app-spec.md
```

## ローカル確認（静的ファイル）

任意の静的サーバーで `public` を配信してください。例:

```powershell
cd c:\base64-app\public
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

## テスト環境

- テストランナー: Mocha
- アサーション: Chai
- DOMテスト: jsdom
- APIテスト用ポリフィル: node-fetch

## テスト実行

```powershell
cd c:\base64-app
npm install
npm test
```

## Cloudflare Pages + Functions + D1 セットアップ

1. D1 データベースを作成
2. `schema.sql` を適用してテーブルを作成
3. `wrangler.toml` の `database_id` を実値に更新
4. Cloudflare Pages プロジェクトを作成し、このリポジトリを接続
5. ビルド出力ディレクトリを `public` に設定
6. D1 バインディング名を `DB` で設定

## API仕様

- エンドポイント: `POST /api/log`
- リクエスト例:

```json
{
  "direction": "encode",
  "plaintext": "こんにちは"
}
```

- `direction`: `encode` または `decode`
- `plaintext`: 1〜10000文字

## プライバシー

- 変換処理はクライアント側で完結
- 保存対象は平文側（Base64ではない側）のみ
- 第三者提供なし（フェーズ1想定）

詳細は `public/privacy.html` を参照してください。

## 開発フェーズ

- フェーズ1: 無料・無広告で公開（`*.pages.dev`）
- フェーズ2: 独自ドメイン、広告導入

## 備考

- 現在の実装はフェーズ1要件に基づいています。
- セキュリティ強化として、本番運用時はレート制限ポリシーや監視を継続的に見直してください。
