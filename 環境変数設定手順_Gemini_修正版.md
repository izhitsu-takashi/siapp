# Gemini APIキーの環境変数設定手順（修正版）

## 問題
Firebase Functions v2では、Firebase Consoleの「設定」タブから環境変数を設定することができません。

## 解決方法

Firebase Functions v2では、環境変数を設定する方法がいくつかあります。最も簡単な方法は、**Firebase CLIを使用して環境変数を設定する方法**です。

### 方法1: Firebase CLIで環境変数を設定（推奨）

Firebase Functions v2では、環境変数は関数の設定として設定する必要があります。以下のコマンドを使用します：

```bash
# プロジェクトルートで実行
firebase functions:secrets:set GEMINI_API_KEY
```

このコマンドを実行すると、対話的にAPIキーの値を入力するように求められます。

**手順：**
1. ターミナルでプロジェクトルートに移動
   ```bash
   cd C:\Users\takashi.izhitsu_path\Desktop\SIApp
   ```

2. Firebase CLIでログイン（未ログインの場合）
   ```bash
   firebase login
   ```

3. 環境変数を設定
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
   - プロンプトが表示されたら、APIキーを入力: `AIzaSyCUiMgoBgUJl8NSgzPdWz3i0ubuyMjx2Po`
   - Enterキーを押す

4. 関数を再デプロイ
   ```bash
   firebase deploy --only functions:chatWithGemini
   ```

### 方法2: コードを修正してFirebase Secretsを使用

Firebase Secretsを使用する場合、コードを修正する必要があります。ただし、現在の実装では`process.env`を使用しているため、方法1を使用することを推奨します。

### 方法3: .envファイルを使用（ローカル開発用のみ）

ローカル開発用に`.env`ファイルを使用することもできますが、本番環境では使用できません。

1. `functions/.env`ファイルを作成
   ```
   GEMINI_API_KEY=AIzaSyCUiMgoBgUJl8NSgzPdWz3i0ubuyMjx2Po
   ```

2. `dotenv`パッケージをインストール
   ```bash
   cd functions
   npm install dotenv
   ```

3. `functions/src/index.ts`の先頭に以下を追加
   ```typescript
   import * as dotenv from 'dotenv';
   dotenv.config();
   ```

ただし、この方法はローカル開発用のみで、本番環境では使用できません。

## 推奨される方法

**方法1（Firebase CLIで環境変数を設定）を推奨します。**

理由：
- 本番環境で確実に動作する
- Firebase ConsoleのUIに依存しない
- セキュアに環境変数を管理できる

## 手順の詳細

### ステップ1: Firebase CLIで環境変数を設定

```bash
cd C:\Users\takashi.izhitsu_path\Desktop\SIApp
firebase functions:secrets:set GEMINI_API_KEY
```

プロンプトが表示されたら：
```
? Enter a value for GEMINI_API_KEY: AIzaSyCUiMgoBgUJl8NSgzPdWz3i0ubuyMjx2Po
```

### ステップ2: 関数を再デプロイ

環境変数を設定した後、関数を再デプロイする必要があります：

```bash
firebase deploy --only functions:chatWithGemini
```

### ステップ3: 動作確認

1. アプリを開いて「ナレッジ」タブをクリック
2. チャット機能をテスト
3. 質問を入力して、AIアシスタントからの応答を確認

## トラブルシューティング

### エラー: "Gemini API key is not configured"
- 環境変数が正しく設定されているか確認してください
- 関数を再デプロイしたか確認してください
- Firebase Functionsのログを確認してください：
  - Firebase Console → Functions → chatWithGemini → ログ

### エラー: "Failed to get response from Gemini"
- APIキーが有効か確認してください
- APIキーに必要な権限があるか確認してください
- Firebase Functionsのログを確認してください

## 注意事項

- APIキーは機密情報です。Gitにコミットしないでください
- `.env`ファイルは`.gitignore`に追加されています
- 本番環境では、Firebase Secretsを使用することを推奨します

