# Gemini APIキーの環境変数設定手順

## デプロイ完了
✅ Firebase Functions `chatWithGemini` のデプロイが完了しました。

## 次のステップ：環境変数の設定

Firebase Functions v2では、環境変数はFirebase Consoleから設定します。

### 手順

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/
   - プロジェクト「kensyu10117」を選択

2. **Functionsの設定画面を開く**
   - 左メニューから「Functions」を選択
   - 上部のタブから「設定」または「Configuration」をクリック
   - 「環境変数」または「Environment variables」セクションを開く

3. **環境変数を追加**
   - 「環境変数を追加」または「Add environment variable」をクリック
   - 以下の情報を入力：
     - **変数名**: `GEMINI_API_KEY`
     - **値**: `AIzaSyCUiMgoBgUJl8NSgzPdWz3i0ubuyMjx2Po`
   - 「保存」または「Save」をクリック

4. **Functionsの再デプロイ（必要に応じて）**
   - 環境変数を設定した後、Functionsを再デプロイする必要がある場合があります
   - ただし、通常は環境変数を設定するだけで反映されます

### 確認方法

環境変数が正しく設定されているか確認するには：

1. Firebase Consoleの「Functions」→「設定」→「環境変数」で確認
2. アプリでチャット機能をテストして、正常に動作するか確認

### トラブルシューティング

#### エラー: "Gemini API key is not configured"
- 環境変数`GEMINI_API_KEY`が正しく設定されているか確認してください
- Firebase Consoleで環境変数が表示されているか確認してください
- 環境変数を設定した後、数分待ってから再度試してください

#### エラー: "Failed to get response from Gemini"
- APIキーが有効か確認してください
- APIキーに必要な権限があるか確認してください
- Firebase Functionsのログを確認してください：
  - Firebase Console → Functions → chatWithGemini → ログ

### 次のステップ

環境変数を設定した後：

1. アプリを開いて「ナレッジ」タブをクリック
2. チャット機能をテスト
3. 質問を入力して、AIアシスタントからの応答を確認

## 注意事項

- APIキーは機密情報です。Gitにコミットしないでください
- APIキーは`.gitignore`に追加されています
- 本番環境では、Firebase Consoleから環境変数を設定してください

