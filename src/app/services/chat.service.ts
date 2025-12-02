import { Injectable } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private conversationHistory: ChatMessage[] = [];

  /**
   * Gemini APIとチャットする
   */
  async sendMessage(message: string): Promise<string> {
    try {
      // 会話履歴にユーザーメッセージを追加
      this.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      // Firebase Functionsのエンドポイントを呼び出す
      const functionsUrl = 'https://us-central1-kensyu10117.cloudfunctions.net/chatWithGemini';
      
      const response = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          conversationHistory: this.conversationHistory.slice(0, -1) // 現在のメッセージを除く
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'チャット応答の取得に失敗しました');
      }

      const result = await response.json();
      
      if (result.success && result.response) {
        // 会話履歴にアシスタントの応答を追加
        this.conversationHistory.push({
          role: 'assistant',
          content: result.response,
          timestamp: new Date()
        });
        
        return result.response;
      } else {
        throw new Error(result.error || 'チャット応答の取得に失敗しました');
      }
    } catch (error: any) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  /**
   * 会話履歴を取得
   */
  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * 会話履歴をクリア
   */
  clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * 会話履歴の長さを取得
   */
  getConversationLength(): number {
    return this.conversationHistory.length;
  }
}

