import type { ActionChoice, GameState, PlayerState, RuleType } from "./types";

function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value % 10000) / 10000;
}

function memberOf(game: GameState, player: PlayerState) {
  return game.config.members.find((member) => member.id === player.memberId) ?? game.config.members[0];
}

function activeOf(game: GameState): PlayerState[] {
  return game.players.filter((player) => !player.eliminated);
}

function currentKind(game: GameState): RuleType {
  const plan = game.config.plans?.[game.round - 1] ?? game.config.plans?.[game.config.plans.length - 1];
  return plan?.kind ?? game.config.ruleType;
}

function riskRank(game: GameState, player: PlayerState): number {
  const active = activeOf(game).sort((a, b) => a.gp - b.gp || a.memberId.localeCompare(b.memberId));
  return active.findIndex((item) => item.memberId === player.memberId);
}

function isAtRisk(game: GameState, player: PlayerState): boolean {
  const active = activeOf(game);
  if (active.length <= 1) return false;
  const bottom = Math.max(1, Math.ceil(active.length / 3));
  return riskRank(game, player) >= 0 && riskRank(game, player) < bottom;
}

function pickTarget(game: GameState, player: PlayerState): PlayerState {
  const others = activeOf(game).filter((item) => item.memberId !== player.memberId);
  if (others.length === 0) return player;
  return [...others].sort((a, b) => {
    const memberA = memberOf(game, a);
    const memberB = memberOf(game, b);
    const scoreA =
      (5 - memberA.stats.reliability) * 2 +
      a.gp * 0.3 +
      (memberA.tags.includes("老好人") || memberA.tags.includes("背锅侠") ? -1.5 : 0) +
      (a.isHuman ? 0.4 : 0);
    const scoreB =
      (5 - memberB.stats.reliability) * 2 +
      b.gp * 0.3 +
      (memberB.tags.includes("老好人") || memberB.tags.includes("背锅侠") ? -1.5 : 0) +
      (b.isHuman ? 0.4 : 0);
    return scoreB - scoreA;
  })[0];
}

function negotiationAction(game: GameState, player: PlayerState): ActionChoice {
  const tags = memberOf(game, player).tags;
  const reliability = memberOf(game, player).stats.reliability;
  const target = pickTarget(game, player);
  const r = hash(`neg-${game.round}-${player.memberId}`);
  const risky = isAtRisk(game, player);

  if (player.goalKey === "proposal_passed") {
    return { kind: "propose", targetId: target.memberId, amount: 1 };
  }
  if (player.goalKey === "target_assigned") {
    if (r < 0.5) return { kind: "back", targetId: target.memberId };
    return { kind: "propose", targetId: target.memberId, amount: 2 };
  }
  if (player.goalKey === "never_assigned") {
    return risky ? { kind: "support" } : { kind: "pass" };
  }
  if (risky && reliability >= 3 && r < 0.14) {
    return { kind: "underbid" };
  }
  if (tags.includes("群主候补") || tags.includes("群聊永动机") || tags.includes("寝室长")) {
    if (r < 0.18) return { kind: "back", targetId: target.memberId };
    if (r < 0.64) return { kind: "propose", targetId: target.memberId, amount: r < 0.3 ? 2 : 1 };
    return { kind: "support" };
  }
  if (tags.includes("老好人") || tags.includes("背锅侠")) {
    if (r < 0.18) return { kind: "underbid" };
    if (r < 0.38) return { kind: "volunteer" };
    return { kind: "support" };
  }
  if (tags.includes("梗王") || tags.includes("深夜emo") || tags.includes("深夜emo诗人") || tags.includes("气氛组")) {
    if (r < 0.16) return { kind: "back", targetId: target.memberId };
    if (r < 0.44) return { kind: "meme", targetId: target.memberId };
    return { kind: "support" };
  }
  if (tags.includes("已读不回") || tags.includes("摸鱼冠军")) {
    return risky ? { kind: "support" } : { kind: "pass" };
  }
  if (risky) return { kind: "support" };
  if (r < 0.12) return { kind: "back", targetId: target.memberId };
  return r < 0.58 ? { kind: "support" } : { kind: "pass" };
}

function biddingAction(game: GameState, player: PlayerState): ActionChoice {
  const tags = memberOf(game, player).tags;
  const plan = game.config.plans?.[game.round - 1] ?? game.config.plans?.[game.config.plans.length - 1];
  const lot = plan?.lot ?? game.config.lots[game.round - 1] ?? game.config.lots[game.config.lots.length - 1];
  if (!lot) return { kind: "abstain" };
  const value = lot.values[player.memberId] ?? 1;
  const r = hash(`bid-${game.round}-${player.memberId}`);
  const maxBid = Math.min(3, Math.max(0, player.gp));
  const risky = isAtRisk(game, player);

  if (player.goalKey === "get_lot" && (!player.goalLotId || player.goalLotId === lot.id)) {
    return { kind: "bid", bid: maxBid };
  }
  if (player.goalKey === "cheap_win" && maxBid >= 1) {
    return { kind: "bid", bid: 1 };
  }
  if (player.goalKey === "unsold_lot") {
    return { kind: "abstain" };
  }
  if (value >= 3) {
    return { kind: "bid", bid: risky ? Math.min(maxBid, 3) : Math.min(maxBid, r < 0.6 ? 2 : 3) };
  }
  if (value === 2) {
    if (risky && maxBid >= 2) return { kind: "bid", bid: 2 };
    return { kind: "bid", bid: Math.min(maxBid, r < 0.55 ? 1 : 2) };
  }
  if (tags.includes("省钱") || tags.includes("已读不回") || tags.includes("摸鱼冠军")) {
    return { kind: "abstain" };
  }
  if (risky) return { kind: "abstain" };
  if (r < 0.55) return { kind: "abstain" };
  return { kind: "bid", bid: maxBid >= 1 ? 1 : 0 };
}

function escapeAction(game: GameState, player: PlayerState): ActionChoice {
  const tags = memberOf(game, player).tags;
  const member = memberOf(game, player);
  const reliability = member.stats.reliability;
  const maxToken = Math.min(2, player.tokens);
  const r = hash(`esc-${game.round}-${player.memberId}`);
  const risky = isAtRisk(game, player);

  if (player.goalKey === "slack_pass" && !risky) {
    return { kind: "contribute", contribution: 0 };
  }
  if (player.goalKey === "mvp") {
    return { kind: "contribute", contribution: maxToken };
  }
  if (risky) {
    return { kind: "contribute", contribution: maxToken };
  }
  if (tags.includes("健身狂魔") || tags.includes("早起冠军") || tags.includes("老好人")) {
    return { kind: "contribute", contribution: maxToken };
  }
  if (tags.includes("摸鱼冠军") || tags.includes("游戏代练") || tags.includes("夜班保安")) {
    return { kind: "contribute", contribution: r < 0.6 ? 0 : Math.min(1, maxToken) };
  }
  if (tags.includes("已读不回") || tags.includes("神秘人")) {
    return { kind: "contribute", contribution: r < 0.5 ? 0 : Math.min(1, maxToken) };
  }
  if (reliability >= 4) return { kind: "contribute", contribution: maxToken };
  if (reliability === 3) {
    return { kind: "contribute", contribution: r < 0.7 ? maxToken : Math.min(1, maxToken) };
  }
  if (reliability === 2) return { kind: "contribute", contribution: Math.min(1, maxToken) };
  return { kind: "contribute", contribution: r < 0.5 ? 0 : Math.min(1, maxToken) };
}

function withSkill(game: GameState, player: PlayerState, choice: ActionChoice, kind: RuleType): ActionChoice {
  if (player.skillUsed) return choice;
  const risky = isAtRisk(game, player);
  const active = activeOf(game);
  const richest = Math.max(0, ...active.filter((item) => item.memberId !== player.memberId).map((item) => item.gp));
  let use = false;

  switch (player.skillKey) {
    case "extra_gp":
      use = risky || player.gp <= 4;
      break;
    case "force_proposal":
      use = kind === "negotiation" && choice.kind === "propose";
      break;
    case "immune_ooc":
      use = risky && (choice.kind === "pass" || choice.kind === "meme" || choice.kind === "abstain");
      break;
    case "save_group":
      use = (kind === "negotiation" || kind === "escape") && risky;
      break;
    case "slack_bonus":
      use =
        choice.kind === "pass" ||
        choice.kind === "abstain" ||
        (choice.kind === "contribute" && (choice.contribution ?? 0) === 0);
      break;
    case "radio":
      use = risky || active.length >= 6;
      break;
    case "shield":
      use = risky;
      break;
    case "steal":
      use = !risky && richest > player.gp + 1;
      break;
    case "discount":
      use = kind === "bidding" && choice.kind === "bid" && (choice.bid ?? 0) >= 2;
      break;
    case "rally":
      use = kind === "escape" && (risky || active.length <= 4);
      break;
    default:
      break;
  }

  return use ? { ...choice, useSkill: true } : choice;
}

export function decideGhost(game: GameState, player: PlayerState): ActionChoice {
  const kind = currentKind(game);
  let choice: ActionChoice;
  if (kind === "negotiation") choice = negotiationAction(game, player);
  else if (kind === "bidding") choice = biddingAction(game, player);
  else choice = escapeAction(game, player);
  return withSkill(game, player, choice, kind);
}
