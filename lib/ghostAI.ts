import type { ActionChoice, GameState, PlayerState, RuleType } from "./types";

function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value % 10000) / 10000;
}

function memberTags(game: GameState, player: PlayerState): string[] {
  return game.config.members.find((member) => member.id === player.memberId)?.tags ?? [];
}

function otherPlayer(game: GameState, player: PlayerState): PlayerState {
  const candidates = game.players.filter((item) => item.memberId !== player.memberId);
  return candidates[Math.floor(hash(`${game.round}-${player.memberId}-target`) * candidates.length)] ?? player;
}

function negotiationAction(game: GameState, player: PlayerState): ActionChoice {
  const tags = memberTags(game, player);
  const r = hash(`neg-${game.round}-${player.memberId}`);
  const target = otherPlayer(game, player);

  if (tags.includes("群聊永动机") || tags.includes("群主候补")) {
    if (r < 0.5) return { kind: "propose", targetId: target.memberId, amount: r < 0.2 ? 2 : 1 };
    if (r < 0.85) return { kind: "support" };
    return { kind: "pass" };
  }
  if (tags.includes("已读不回") || tags.includes("摸鱼冠军")) {
    if (r < 0.62) return { kind: "pass" };
    if (r < 0.9) return { kind: "support" };
    return { kind: "meme", targetId: target.memberId };
  }
  if (tags.includes("背锅侠") || tags.includes("老好人")) {
    if (r < 0.5) return { kind: "volunteer" };
    if (r < 0.85) return { kind: "support" };
    return { kind: "pass" };
  }
  if (tags.includes("梗王") || tags.includes("深夜emo")) {
    if (r < 0.45) return { kind: "meme", targetId: target.memberId };
    if (r < 0.8) return { kind: "support" };
    return { kind: "pass" };
  }
  return r < 0.55 ? { kind: "support" } : { kind: "pass" };
}

function biddingAction(game: GameState, player: PlayerState): ActionChoice {
  const tags = memberTags(game, player);
  const lot = game.config.lots[game.round - 1] ?? game.config.lots[game.config.lots.length - 1];
  const value = lot?.values[player.memberId] ?? 1;
  const r = hash(`bid-${game.round}-${player.memberId}`);
  const maxBid = Math.min(3, player.gp);

  if (tags.includes("已读不回") && r < 0.28) return { kind: "abstain" };
  if (player.goalKey === "get_lot" && player.goalLotId === lot?.id) {
    return { kind: "bid", bid: maxBid };
  }
  if (value >= 3) return { kind: "bid", bid: r < 0.55 ? 3 : Math.min(2, maxBid) };
  if (value === 2) return { kind: "bid", bid: r < 0.5 ? 2 : Math.min(1, maxBid) };
  if (r < 0.35) return { kind: "abstain" };
  return { kind: "bid", bid: r < 0.75 ? 1 : 0 };
}

function escapeAction(game: GameState, player: PlayerState): ActionChoice {
  const tags = memberTags(game, player);
  const member = game.config.members.find((item) => item.id === player.memberId);
  const reliability = member?.stats.reliability ?? 2;
  const r = hash(`esc-${game.round}-${player.memberId}`);
  const maxToken = Math.min(2, player.tokens);

  if (tags.includes("摸鱼冠军") || tags.includes("游戏代练")) {
    return { kind: "contribute", contribution: r < 0.68 ? 0 : Math.min(1, maxToken) };
  }
  if (tags.includes("已读不回")) {
    return { kind: "contribute", contribution: r < 0.5 ? 0 : Math.min(1, maxToken) };
  }
  if (reliability >= 4) return { kind: "contribute", contribution: maxToken };
  if (reliability === 3) return { kind: "contribute", contribution: r < 0.65 ? maxToken : Math.min(1, maxToken) };
  if (reliability === 2) return { kind: "contribute", contribution: Math.min(1, maxToken) };
  return { kind: "contribute", contribution: r < 0.5 ? 0 : Math.min(1, maxToken) };
}

export function decideGhost(game: GameState, player: PlayerState): ActionChoice {
  const ruleType: RuleType = game.config.ruleType;
  if (ruleType === "negotiation") return negotiationAction(game, player);
  if (ruleType === "bidding") return biddingAction(game, player);
  return escapeAction(game, player);
}
