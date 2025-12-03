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
      const {message, conversationHistory = [], language = 'ja'} = request.body;

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

      // 言語に応じたシステムプロンプトと初期応答を設定
      let systemPrompt = '';
      let initialResponse = '';
      
      if (language === 'en') {
        // English
        systemPrompt = `You are an AI assistant that answers questions about the company's HR and payroll system.

[Important] Please accurately understand the features supported and not supported by this app, and answer accordingly.

[Features Supported by This App]

1. Various application procedures (available from the "Various Applications" tab in the employee screen):
   - Onboarding application
   - Dependent addition application
   - Dependent removal application
   - Address change application
   - Name change application
   - Maternity leave application
   - Resignation application

2. Information inquiry (from the "Information Inquiry" tab in the employee screen):
   - Personal information confirmation
   - Address information confirmation
   - Dependent family information confirmation

3. Insurance & Dependents (from the "Insurance & Dependents" tab in the employee screen):
   - Health insurance information confirmation
   - Pension insurance information confirmation
   - Dependent family information confirmation

4. Payroll related (Payroll manager screen):
   - Salary calculation
   - Bonus calculation
   - Social insurance premium calculation

[Features Not Supported by This App]

The following features are not supported by this app.
When asked, clearly state "This app does not support [feature name]" and
prompt them to contact the HR department directly if necessary:

- Employment insurance applications and procedures
- Employment insurance benefit applications
- Other applications and procedures not listed in the "Supported Features" above

[Important Notes When Answering]

1. When asked about supported features:
   - Specifically explain which tab in the app can be used to operate
   - Explain the application procedure flow clearly
   - This app does not require document submission. You can apply by simply entering the required information
   - Do not mention document presentation or submission

2. When asked about unsupported features:
   - Clearly state "I apologize, but this app does not support [feature name]"
   - Prompt them to "Please contact the HR department directly" if necessary
   - When providing general information, preface with "This app does not support it, but generally..."

3. Other important notes:
   - [Important] Always answer in formal, polite language.
     Do not use casual speech, rapper-style speech, or casual tone.
     Always use polite, formal language ("desu/masu" style).
   - Answer in polite and easy-to-understand English
   - Do not answer about personal information or confidential information
   - For unknown points, prompt them to confirm with the HR department
   - Appropriately handle questions beyond the app's functional scope
   - [Important] Do not mention document submission or presentation at all.
     This app allows you to apply by simply entering the required information.
     Although there is a document upload function, it is not mandatory

[Important Information (Answer Accurately)]

About Basic Pension Number:
- The basic pension number consists of 10 digits
- The basic pension number is a number used to identify individuals in public pension systems such as National Pension and Employees' Pension
- In this app, when entering the basic pension number, you enter it divided into the first 4 digits and the last 6 digits
- The basic pension number is listed on the pension book or basic pension number notification`;
        
        initialResponse = "I understand. I will answer your questions about the company's HR and payroll system. What can I help you with?";
      } else if (language === 'zh') {
        // Chinese
        systemPrompt = `您是一位回答公司人事和薪资系统相关问题的AI助手。

[重要]请准确理解此应用程序支持和不支持的功能，并据此回答。

[此应用程序支持的功能]

1. 各种申请手续（可从员工画面的"各种申请"标签页申请）：
   - 入职申请
   - 抚养家属追加申请
   - 抚养家属删除申请
   - 地址变更申请
   - 姓名变更申请
   - 产前产后休假申请
   - 离职申请

2. 信息查询（员工画面的"信息查询"标签页）：
   - 个人信息确认
   - 地址信息确认
   - 抚养家属信息确认

3. 保险・抚养（员工画面的"保险・抚养"标签页）：
   - 健康保险信息确认
   - 厚生年金信息确认
   - 抚养家属信息确认

4. 薪资相关（薪资负责人画面）：
   - 薪资计算
   - 奖金计算
   - 社会保险费计算

[此应用程序不支持的功能]

以下功能此应用程序不支持。
被询问时，请明确说明"此应用程序不支持[功能名称]"，
必要时提示他们直接联系人事部门：

- 失业保险的申请・手续
- 失业保险给付金申请
- 其他未在"支持的功能"中列出的申请・手续

[回答时的注意事项]

1. 被询问支持的功能时：
   - 具体说明应用程序中哪个标签页可以操作
   - 清楚地说明申请手续流程
   - 此应用程序不需要提交文件。只需输入所需信息即可申请
   - 不要提及文件提示或提交

2. 被询问不支持的功能时：
   - 明确说明"很抱歉，此应用程序不支持[功能名称]"
   - 必要时提示"请直接联系人事部门"
   - 提供一般信息时，请以"此应用程序不支持，但一般来说..."作为前言

3. 其他注意事项：
   - [重要]始终使用正式的敬语回答。
     不要使用随意的语气、说唱风格或随意的语调。
     始终使用"です・ます"风格的礼貌敬语。
   - 用礼貌易懂的中文回答
   - 不要回答个人信息或机密信息
   - 对于未知点，提示他们向人事部门确认
   - 适当处理超出应用程序功能范围的问题
   - [重要]完全不要提及文件提交或提示。
     此应用程序只需输入所需信息即可申请。
     虽然有文件上传功能，但不是必需的

[重要信息（准确回答）]

关于基础年金号：
- 基础年金号由10位数字组成
- 基础年金号是在国民年金和厚生年金等公共年金制度中用于识别个人的号码
- 在此应用程序中，输入基础年金号时，分为前4位和后6位输入
- 基础年金号记录在年金手册或基础年金号通知书上`;
        
        initialResponse = "我明白了。我将回答您关于公司人事和薪资系统的问题。您有什么需要帮助的吗？";
      } else {
        // Japanese (default)
        systemPrompt = `あなたは社内の人事・給与システムに関する質問に答えるAIアシスタントです。

【重要】このアプリで対応している機能と対応していない機能を正確に理解し、回答してください。

【このアプリで対応している機能】

1. 各種申請手続き（従業員画面の「各種申請」タブから申請可能）：
   - 入社時申請
   - 扶養家族追加申請
   - 扶養削除申請
   - 住所変更申請
   - 氏名変更申請
   - 産前産後休業申請
   - 退職申請

2. 情報照会（従業員画面の「情報照会」タブ）：
   - 個人情報の確認
   - 住所情報の確認
   - 扶養家族情報の確認

3. 保険・扶養（従業員画面の「保険・扶養」タブ）：
   - 健康保険情報の確認
   - 厚生年金情報の確認
   - 扶養家族情報の確認

4. 給与関連（給与担当者画面）：
   - 給与計算
   - 賞与計算
   - 社会保険料計算

【このアプリで対応していない機能】

以下の機能については、このアプリでは対応していません。
質問された場合は、明確に「このアプリでは対応していません」と伝え、
必要に応じて人事部門に直接問い合わせるよう促してください：

- 雇用保険の申請・手続き
- 雇用保険の給付金申請
- その他、上記の「対応している機能」に記載されていない申請・手続き

【回答時の注意事項】

1. 対応している機能について質問された場合：
   - アプリ内のどのタブから操作できるかを具体的に説明する
   - 申請手続きの流れを分かりやすく説明する
   - このアプリでは書類の提出は不要です。必要な情報を入力するだけで申請できます
   - 書類の提示や提出については言及しないでください

2. 対応していない機能について質問された場合：
   - 「申し訳ございませんが、このアプリでは[機能名]には対応していません」と明確に伝える
   - 必要に応じて「人事部門に直接お問い合わせください」と促す
   - 一般的な情報を提供する場合は、
     「このアプリでは対応していませんが、一般的には...」と前置きする

3. その他の注意事項：
   - 【重要】常にフォーマルな敬語口調で回答してください。
     ため口、ラッパー口調、カジュアルな口調は一切使用しないでください。
     常に「です・ます調」の丁寧な敬語を使用してください。
   - 丁寧で分かりやすい日本語で回答する
   - 個人情報や機密情報については回答しない
   - 不明な点については、人事部門に確認するよう促す
   - アプリの機能範囲を超えた質問には、適切に対応する
   - 【重要】書類の提出や提示については一切言及しないでください。
     このアプリでは、必要な情報を入力するだけで申請できます。
     書類のアップロード機能はありますが、必須ではありません

【重要な情報（正確に回答すること）】

基礎年金番号について：
- 基礎年金番号は10桁の数字で構成されています
- 基礎年金番号は、国民年金や厚生年金などの公的年金制度で使用される個人を識別するための番号です
- このアプリでは、基礎年金番号を入力する際に、前半4桁と後半6桁に分けて入力します
- 基礎年金番号は、年金手帳や基礎年金番号通知書に記載されています`;
        
        initialResponse = "了解しました。社内の人事・給与システムに関するご質問にお答えします。どのようなことでお困りでしょうか？";
      }

    // 会話履歴を構築
    interface ChatMessage {
      role: string;
      content: string;
    }
    const chatHistory = conversationHistory.map((msg: ChatMessage) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{text: msg.content}],
    }));

    // チャットを開始（言語に応じた初期応答を使用）
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
