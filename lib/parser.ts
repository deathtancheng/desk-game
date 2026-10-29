import type { ChatSignal, Member } from "./types";

export interface ParsedLine {
  time?: string;
  name: string;
  text: string;
}

const KEYWORD_GROUPS = {
  negotiation: ["谁去", "帮我", "轮到你", "上次", "凭什么", "下去", "拿外卖", "带饭", "倒垃圾", "交涉"],
  bidding: ["最后一个", "插座", "空调", "我的", "抢", "床位", "洗澡", "遥控器", "冰激凌", "拼单"],
  escape: ["查寝", "停电", "蟑螂", "考试", "完了", "救命", "DDL", "怎么办", "突击", "翻车"],
  memes: ["笑死", "哈哈哈哈", "绷不住", "逆天", "离谱", "这波不亏", "问题不大", "救命"],
};

export function parseChat(raw: string): ParsedLine[] {
  const lines = raw.split(/\r?\n/);
  const parsed: ParsedLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bracketed = trimmed.match(/^\[(.+?)\]\s*([^:：]{1,16})[:：]\s*(.+)$/);
    if (bracketed) {
      parsed.push({ time: bracketed[1], name: bracketed[2].trim(), text: bracketed[3].trim() });
      continue;
    }

    const simple = trimmed.match(/^([^:：]{1,16})[:：]\s*(.+)$/);
    if (simple) {
      parsed.push({ name: simple[1].trim(), text: simple[2].trim() });
    }
  }

  return parsed;
}

function countOccurrences(text: string, words: string[]): number {
  return words.reduce((total, word) => {
    if (!word) return total;
    return total + text.split(word).length - 1;
  }, 0);
}

function score(raw: number): number {
  return Math.max(8, Math.min(99, Math.round(raw * 4 + 10)));
}

export function deriveSignals(raw: string, members: Member[]): ChatSignal {
  const parsed = parseChat(raw);
  const text = parsed.map((line) => line.text).join("\n");
  const knownNames = new Set(members.map((m) => m.name));
  const activeMembers = new Set(parsed.filter((line) => knownNames.has(line.name)).map((line) => line.name)).size;

  const negotiationRaw = countOccurrences(text, KEYWORD_GROUPS.negotiation);
  const biddingRaw = countOccurrences(text, KEYWORD_GROUPS.bidding);
  const escapeRaw = countOccurrences(text, KEYWORD_GROUPS.escape);
  const memeCount = countOccurrences(text, KEYWORD_GROUPS.memes);

  const allKeywords = [
    ...KEYWORD_GROUPS.negotiation,
    ...KEYWORD_GROUPS.bidding,
    ...KEYWORD_GROUPS.escape,
    ...KEYWORD_GROUPS.memes,
  ];
  const topKeywords = [...new Set(allKeywords)]
    .map((keyword) => ({ keyword, count: countOccurrences(text, [keyword]) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((item) => item.keyword);

  return {
    negotiation: score(negotiationRaw * 1.15),
    bidding: score(biddingRaw),
    escape: score(escapeRaw),
    totalMessages: parsed.length,
    activeMembers: activeMembers || Math.min(members.length, 6),
    memeCount,
    topKeywords,
  };
}
