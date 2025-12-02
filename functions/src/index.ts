/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import {GoogleGenerativeAI} from "@google/generative-ai";

admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

// 入社時メール送信関数
export const sendOnboardingEmail = onRequest(async (request, response) => {
  // CORS設定
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const {email, name, initialPassword, appUrl} = request.body;

    if (!email || !name || !initialPassword || !appUrl) {
      response.status(400).send("Missing required parameters");
      return;
    }

    // メール本文を作成
    const emailText =
      `${name}さん、以下のURLから情報登録を行ってください。\n` +
      `${appUrl}\n\n初期パスワード: ${initialPassword}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; ` +
      `margin: 0 auto;">
        <h2 style="color: #333;">入社手続きのご案内</h2>
        <p>${name}さん、以下のURLから情報登録を行ってください。</p>
        <p><a href="${appUrl}" ` +
      `style="color: #667eea; text-decoration: none;">${appUrl}</a></p>
        <p>初期パスワード: <strong>${initialPassword}</strong></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">このメールは自動送信されています。</p>
      </div>
    `;

    // メール送信の設定
    // GmailのSMTP設定（直接設定）
    const smtpHost = "smtp.gmail.com";
    const smtpPort = 587;
    const smtpUser = "takashi.izhitsu@pathoslogos.co.jp";
    const smtpPassword = "fzmh wgnl zzse wczo";
    const smtpFrom = "takashi.izhitsu@pathoslogos.co.jp";

    // nodemailerを使用してメール送信
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false, // 587番ポートはTLSを使用
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

      const mailOptions = {
        from: smtpFrom,
        to: email,
        subject: "入社手続きのご案内",
        text: emailText,
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);

      logger.info("Email sent successfully", {
        to: email,
        name: name,
      });

      response.status(200).send({
        success: true,
        message: "Email sent successfully",
        method: "smtp",
      });
    } catch (mailError) {
      logger.error("Error sending email via SMTP:", mailError);

      // SMTP送信に失敗した場合、Firestoreのmailコレクションに保存（フォールバック）
      try {
        const db = admin.firestore();
        const mailCollection = db.collection("mail");
        await mailCollection.add({
          to: email,
          message: {
            subject: "入社手続きのご案内",
            text: emailText,
            html: emailHtml,
          },
        });

        logger.info("Email queued via Firestore (fallback)");
        response.status(200).send({
          success: true,
          message: "Email queued via Trigger Email extension (fallback)",
          method: "firestore-fallback",
        });
      } catch (firestoreError) {
        logger.error("Error saving to Firestore:", firestoreError);
        response.status(500).send({
          success: false,
          error: "Failed to send email via both SMTP and Firestore",
        });
      }
    }
  } catch (error) {
    logger.error("Error sending onboarding email:", error);
    response.status(500).send({success: false, error: "Failed to send email"});
  }
});

// Gemini AIチャット関数
export const chatWithGemini = onRequest(
  {
    secrets: ["GEMINI_API_KEY"],
  },
  async (request, response) => {
  // CORS設定
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const {message, conversationHistory = []} = request.body;

      if (!message) {
        response.status(400).send({
          success: false,
          error: "Message is required",
        });
        return;
      }

      // Gemini APIキーを環境変数から取得
      // Firebase Functions v2では、環境変数は自動的に読み込まれます
      // 本番環境では、Firebase Secretsまたは環境変数として設定
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error("GEMINI_API_KEY is not set");
        response.status(500).send({
          success: false,
          error: "Gemini API key is not configured. " +
          "Please set GEMINI_API_KEY environment variable.",
        });
        return;
      }

      // Google Generative AIを初期化
      const genAI = new GoogleGenerativeAI(apiKey);
      // gemini-2.0-flashを使用
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });

      // システムプロンプトを設定（ナレッジベースとしての役割を定義）
      const systemPrompt = `あなたは社内の人事・給与システムに関する質問に答えるAIアシスタントです。
以下の点に注意して回答してください：
- 健康保険、厚生年金、雇用保険などの社会保険に関する質問に答える
- 各種申請手続きについて説明する
- 給与計算や賞与に関する質問に答える
- 不明な点については、人事部門に確認するよう促す
- 丁寧で分かりやすい日本語で回答する
- 個人情報や機密情報については回答しない`;

    // 会話履歴を構築
    interface ChatMessage {
      role: string;
      content: string;
    }
    const chatHistory = conversationHistory.map((msg: ChatMessage) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{text: msg.content}],
    }));

    // チャットを開始
    const initialResponse =
      "了解しました。社内の人事・給与システムに関するご質問に" +
      "お答えします。どのようなことでお困りでしょうか？";
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{text: systemPrompt}],
        },
        {
          role: "model",
          parts: [{text: initialResponse}],
        },
        ...chatHistory,
      ],
    });

    // メッセージを送信して応答を取得
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    logger.info("Gemini chat response generated", {
      messageLength: message.length,
      responseLength: responseText.length,
    });

    response.status(200).send({
      success: true,
      response: responseText,
    });
    } catch (error: unknown) {
      logger.error("Error in chatWithGemini:", error);
      const errorMessage = error instanceof Error ?
        error.message :
        "Failed to get response from Gemini";
      response.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  },
);
