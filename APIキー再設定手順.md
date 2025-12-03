# APIキー再設定手順

## 問題
エラーメッセージ：
```
Your API key was reported as leaked. Please use another API key.
```

現在のAPIキーが漏洩として報告されているため、新しいAPIキーを取得して設定する必要があります。

## 解決手順

### ステップ1: 新しいGemini APIキーを取得

1. **Google AI Studioにアクセス**
   - https://makersuite.google.com/app/apikey
   - または https://aistudio.google.com/app/apikey

2. **新しいAPIキーを生成**
   - 「Create API Key」をクリック
   - 新しいAPIキーをコピー（表示されるのは一度だけなので注意）

3. **古いAPIキーを無効化（推奨）**
   - 古いAPIキーを削除または無効化して、セキュリティを確保

### ステップ2: Firebase Secretsで新しいAPIキーを設定

```bash
# プロジェクトルートで実行
cd C:\Users\takashi.izhitsu_path\Desktop\SIApp

# 新しいAPIキーを設定
firebase functions:secrets:set GEMINI_API_KEY
```

**実行時の操作：**
1. プロンプトが表示されたら、新しいAPIキーをコピー＆ペーストしてEnterキーを押す
2. 確認プロンプトが表示されたら、`y`を入力してEnterキーを押す

### ステップ3: 関数を再デプロイ

```bash
firebase deploy --only functions:chatWithGemini
```

### ステップ4: 動作確認

1. アプリを開いて「ナレッジ」タブをクリック
2. チャット機能をテスト
3. メッセージを送信して、正常に応答が返ってくることを確認

## セキュリティのベストプラクティス

### APIキーの保護

1. **Gitにコミットしない**
   - `.env`ファイルは`.gitignore`に追加済み
   - APIキーをコードに直接書かない

2. **Firebase Secretsを使用**
   - 本番環境では必ずFirebase Secretsを使用
   - 環境変数として直接設定しない

3. **APIキーの制限**
   - Google Cloud ConsoleでAPIキーの使用を制限できる
   - 特定のIPアドレスやリファラーからのみアクセスを許可

4. **定期的なローテーション**
   - 定期的にAPIキーを更新することを推奨

## トラブルシューティング

### エラー: "API key is not configured"
- Firebase Secretsが正しく設定されているか確認
- 関数を再デプロイしたか確認

### エラー: "API key is invalid"
- APIキーが正しくコピーされているか確認
- APIキーが有効か確認（Google AI Studioで確認）

### エラー: "Quota exceeded"
- APIキーの使用制限に達している可能性
- Google Cloud Consoleで使用量を確認

## 注意事項

- 新しいAPIキーを取得したら、必ずFirebase Secretsに設定してください
- 古いAPIキーは無効化することを推奨します
- APIキーは機密情報です。他人と共有しないでください

