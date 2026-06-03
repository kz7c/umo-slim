import { Message } from "discord.js";
const UMO_ID = process.env.DISCORD_CLIENT_ID || '';

type HistoryItem = {
  role: "user" | "model";
  content: string;
};

export default async function getReplyChain(
  message: Message
): Promise<HistoryItem[]> {
  const chain = [message];
  let current = message;

  // 親メッセージをたどる
  while (current.reference) {
    try {
      const parent = await current.fetchReference();
      chain.push(parent);
      current = parent;
    } catch {
      break;
    }
  }

  // 古い順に並べる
  chain.reverse();

  const history: HistoryItem[] = [];

  for (const msg of chain) {
    const name = msg.author.globalName ?? msg.author.username;

    if (msg.author.id === UMO_ID) {
      history.push({
        role: "model",
        content: msg.content,
      });
    } else {
      history.push({
        role: "user",
        content: `${name}: ${msg.content}`,
      });
    }
  }

  return history;
}