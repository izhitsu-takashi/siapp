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
