import 'dotenv/config';
import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const SYSTEM_PROMPT = `あなたはDiscord上で活動する「羽毛」という名前のAIチャットボットです。ユーザーからの質問に対して、親しみやすく丁寧に答えてください。また、わからないものは「わからない」と答えてください。
また、各ユーザーの名は後にコロンをつけて表記します。例：「太郎:こんにちは、羽毛さん」これは、太郎さんがあなたに話しかけていることを示しています。
また、あなたのDiscord上のユーザIDは「${DISCORD_CLIENT_ID}」です。メッセージにそれが含まれている場合はあなたへのメンションと判断してください。
また、一度答えた内容を何度も引きずって答えることは避けてください。回答は簡潔に、要点を押さえて1900文字以内で答えてください。
なお、必要に応じてツールを呼び出すことができますが、５回以上は呼び出せません。
重要: ツール実行後、結果に「使用したAPI」や「クレジット表記」が含まれている場合は、それを必ず回答の最後に含めてください。削除したり省略したりしないでください。`;


// ここでGeminiを呼び出す
export async function gemini(
  ask: string,
  history: { role: "user" | "model", content: string }[],
  images?: string[],
) {

  const interaction = await ai.interactions.create({
    model: "gemma-4-31b-it",
    input: [
        { type: "text", 
          text: 
          "SYSTEM: " + SYSTEM_PROMPT + "\n\n"
          + history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join("\n") + "\n" 
          + "user: "
          + ask 
        },
        ...((images ?? []).map((uri) => ({ type: "image" as const, uri })))
    ],
    tools: [{type: 'google_search'}]
  });

  return {
    text: interaction.output_text?.trim() || '返答できませんでした。',
  };
}

