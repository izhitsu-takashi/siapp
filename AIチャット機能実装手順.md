# AIチャット機能実装手順

## 概要
従業員画面のナレッジページに、Firebase FunctionsからGemini APIを呼び出して会話できるAIチャット機能を実装しました。

## 実装内容

### 1. Firebase Functions側の実装

#### 1.1 パッケージの追加
`functions/package.json`に`@google/generative-ai`パッケージを追加しました。

#### 1.2 Geminiチャット関数の実装
`functions/src/index.ts`に`chatWithGemini`関数を追加しました。
- CORS設定を含むHTTPエンドポイント
- Gemini APIを使用したチャット応答生成
- 会話履歴のサポート
- エラーハンドリング

#### 1.3 環境変数の設定
Firebase Functionsに`GEMINI_API_KEY`環境変数を設定する必要があります。

**Firebase Consoleから設定（推奨）：**
1. Firebase Console → Functions → 設定 → 環境変数
2. 環境変数を追加：
   - 変数名: `GEMINI_API_KEY`
   - 値: `AIzaSyCUiMgoBgUJl8NSgzPdWz3i0ubuyMjx2Po`
3. 保存

詳細は`環境変数設定手順_Gemini.md`を参照してください。

### 2. フロントエンド側の実装

#### 2.1 チャットサービスの作成
`src/app/services/chat.service.ts`を作成しました。
- Firebase Functionsのエンドポイントを呼び出す
- 会話履歴の管理
- エラーハンドリング

#### 2.2 コンポーネントの更新
`src/app/dashboard/employee-dashboard/employee-dashboard.component.ts`を更新しました。
- ChatServiceのインポート
- チャットメッセージの管理
- メッセージ送信機能
- チャット履歴のクリア機能

#### 2.3 UIの実装
`src/app/dashboard/employee-dashboard/employee-dashboard.component.html`を更新しました。
- ナレッジページにチャットUIを追加
- メッセージ表示エリア
- 入力エリア
- 送信・クリアボタン

#### 2.4 スタイリング
`src/app/dashboard/employee-dashboard/employee-dashboard.component.css`にチャットUI用のスタイルを追加しました。
- モダンなデザイン
- レスポンシブ対応
- アニメーション効果

## セットアップ手順

### 1. Firebase Functionsのセットアップ

```bash
cd functions
npm install
```

### 2. Gemini APIキーの取得

1. [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセス
2. APIキーを生成
3. Firebase Functionsの環境変数に設定

### 3. 環境変数の設定

Firebase Consoleから設定する場合：
1. Firebase Console → Functions → 設定
2. 環境変数タブを開く
3. `GEMINI_API_KEY`を追加

または、CLIから設定：
```bash
firebase functions:config:set gemini.api_key="YOUR_API_KEY"
```

### 4. Firebase Functionsのデプロイ

```bash
cd functions
npm run build
firebase deploy --only functions:chatWithGemini
```

### 5. フロントエンドのビルドとデプロイ

```bash
npm run build:prod
firebase deploy --only hosting
```

## 使用方法

1. 従業員ダッシュボードにログイン
2. 「ナレッジ」タブをクリック
3. チャット入力欄に質問を入力
4. 「送信」ボタンをクリック（またはEnterキー）
5. AIアシスタントからの応答を確認

## 機能

- **会話履歴の保持**: 前の会話の文脈を理解して回答
- **リアルタイム応答**: メッセージ送信後、即座に応答を表示
- **ローディング表示**: 応答生成中はローディングアニメーションを表示
- **エラーハンドリング**: エラー発生時は適切なメッセージを表示
- **チャット履歴のクリア**: 「クリア」ボタンで会話履歴をリセット

## 注意事項

1. **APIキーの管理**: Gemini APIキーは環境変数で管理し、コードに直接記述しないでください
2. **コスト管理**: Gemini APIの使用量に応じてコストが発生します。必要に応じて使用制限を設定してください
3. **セキュリティ**: CORS設定は本番環境では適切に制限してください
4. **エラーハンドリング**: ネットワークエラーやAPIエラーに対する適切な処理を実装済みです

## トラブルシューティング

### エラー: "Gemini API key is not configured"
- 環境変数`GEMINI_API_KEY`が正しく設定されているか確認してください
- Firebase Functionsを再デプロイしてください

### エラー: "Failed to get response from Gemini"
- APIキーが有効か確認してください
- ネットワーク接続を確認してください
- Firebase Functionsのログを確認してください

### チャットが表示されない
- ブラウザのコンソールでエラーを確認してください
- Firebase FunctionsのエンドポイントURLが正しいか確認してください

## 今後の拡張案

- 会話履歴の永続化（Firestoreに保存）
- ファイルアップロード機能
- 音声入力機能
- 多言語対応
- 管理者による会話履歴の確認機能

