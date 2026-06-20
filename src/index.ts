import 'dotenv/config';
import { Client, Intents } from 'discord.js';
import { web } from './components/web.js';
import { gemini } from './components/gemini.js';
import getReplyChain from './components/getReplyChain.js';

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,          // サーバー関連イベント
    Intents.FLAGS.GUILD_MESSAGES,  // サーバー内メッセージ
  ],
});


// 起動時
client.once('clientReady', () => {

  if (!client.user) {
    console.error("致命的なエラー：client.user が未定義です。");
    process.exit(1);
  }

  console.log("==============================");
  console.log(`Bot起動しました: ${client.user.tag}`);
  console.log("==============================");

});


// メッセージを受信時
client.on('messageCreate', async (message) => {
  
  if (!client.user) {
    console.error("致命的なエラー：client.user が未定義です。");
    process.exit(1);
  }

  // BOT自身の発言は無視
  if (message.author.bot) return;

  // ボット自身が直接メンションされている場合のみ処理
  // @everyone や @role メンションは除外
  if (!message.mentions.has(client.user) || message.mentions.everyone) return;

  // テキストが送信できるチャンネルか確認
  if (typeof message.channel.sendTyping !== 'function') {
    console.error("エラー：テキストが送信できないチャンネルからメッセージを受け取りました。");
    return;
  }

  // ===================================ここから正常な処理===================================
  const typingInterval = setInterval(() => {// タイピングインジケーターを定期的に送信
    message.channel.sendTyping().catch(console.error);
  }, 3000);

  // 質問を取得
  const ask = message.content;
  console.log(`質問: ${ask}`);

  // 直近のメッセージを取得（今の message は除外）
  let history = await getReplyChain(message);
  
  // 画像を取得(URL)
  const images: string[] = [];
  if (message.attachments.size > 0) {
    for (const [_, attachment] of message.attachments) {
      if (attachment.contentType?.startsWith("image/")) {
        images.push(attachment.url);
      }
    }
  }
  
  try{

    let tryon = 0;// 再試行のカウンター変数
    let success = false;
    let lastError: any = null; // 最後に発生したエラーを保持
    let cachedToolResponses: any[] | undefined = undefined; // ツール結果をキャッシュ

    while(tryon < 5) {// 最大5回まで再試行
      try {
        // Gemini API に質問＋履歴＋画像を送信
        const result = await gemini(ask, history, images.length > 0 ? images : undefined);

        try {
        
          // 生成結果をメンションせずに Discord に送信
          await message.reply({
            content: result.text,
            //allowedMentions: { repliedUser: false },
          });
        
        } catch (sendError) {// 返信できなかった場合
      
          console.error("Discordエラー：返信先が見つかりませんでした。");

        }

        success = true;
        break; // 成功したらループを抜ける

      } catch (error: any) {// Gemini のエラー
        lastError = error;
        // 500系と503以外は再試行しない
        if (error?.status !== 500 && error?.statusCode !== 500 && error?.status !== 503 && error?.statusCode !== 503 && !error?.message?.includes('500') && !error?.message?.includes('503')) {
          await message.reply({
            content: `Gemini API エラーが発生しました。`,
            // allowedMentions: { repliedUser: false },
          });
          console.error("Gemini API エラー (非再試行):", error);
          if (error?.stack) console.error("Stack:", error.stack);
          break;
        }

        // 500系・503など再試行するエラーは詳細をログに残す
        console.error("Gemini API エラー (再試行予定):", error);
        if (error?.stack) console.error("Stack:", error.stack);
      }

      tryon++;
      if (tryon < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** tryon))); // 再試行前に待機（指数関数的に増加）
      }
    }

    // 失敗時のみエラーメッセージを送信
    if (!success) {
      await message.reply({
        content: `Gemini API エラーが発生しました。再試行を試みましたが、残念ながら回答を取得できませんでした。`,
        // allowedMentions: { repliedUser: false },
      });
      console.error("Gemini 最終エラー:", lastError);
      if (lastError?.stack) console.error("Gemini 最終エラーのスタック:", lastError.stack);
      
      return;
    }

  } catch(error) {// Geminiのエラーすら返信できない場合
    console.error("Discordエラー： Gemini のエラーの返信先が見つかりませんでした。", error);
    if ((error as any)?.stack) console.error("Discordエラーのスタック:", (error as any).stack);
  
  } finally {
    clearInterval(typingInterval);// タイピングインジケーター停止
    console.log("タスク完了");
  
  }


});


// Discord にログイン
client.login(process.env.DISCORD_TOKEN);

// web サーバーの起動
web();