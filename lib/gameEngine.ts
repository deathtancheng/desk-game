import type {
  ActionChoice,
  ChatMessage,
  GameConfig,
  GameState,
  Member,
  PersonaJudgeRequest,
  PersonaVerdict,
  PlayerState,
  RoundResult,
  SkillKey,
} from "./types";
import { decideGhost } from "./ghostAI";
import { judgePersonaBatch } from "./personaClient";
import { actionLabel, judgePersonaLocal } from "./personaRules";

let counter = 0;

function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getMember(game: GameState, memberId: string): Member {
  return game.config.members.find((member) => member.id === memberId) ?? game.config.members[0];
}

function getPlayer(game: GameState, memberId?: string): PlayerState | undefined {
  return game.players.find((player) => player.memberId === memberId);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function skillUsedBy(game: GameState, key: SkillKey): boolean {
  return game.players.some((player) => player.played?.useSkill && player.skillKey === key);
}

function buildGoal(
  member: Member,
  config: GameConfig,
  index: number,
): Pick<PlayerState, "goalKey" | "goalText" | "goalTargetId" | "goalLotId"> {
  const others = config.members.filter((item) => item.id !== member.id);
  const target = others[index % Math.max(1, others.length)] ?? member;
  const lot = config.lots[index % Math.max(1, config.lots.length)];

  if (config.ruleType === "negotiation") {
    if (member.desire === "早睡" || member.desire === "摸鱼") {
      return { goalKey: "never_assigned", goalText: "今晚绝不接活" };
    }
    if (member.desire === "立威" || member.desire === "被夸") {
      return { goalKey: "proposal_passed", goalText: "让你的提案通过一次" };
    }
    if (member.desire === "省钱") {
      return { goalKey: "compensation_2", goalText: "拿一次 2 点补偿" };
    }
    return { goalKey: "target_assigned", goalText: `让${target.name}接一次活`, goalTargetId: target.id };
  }

  if (config.ruleType === "bidding") {
    if (member.desire === "省钱") {
      return { goalKey: "cheap_win", goalText: "用 1 点赢下任意一件" };
    }
    if (member.desire === "立威") {
      return { goalKey: "unsold_lot", goalText: "让一件拍品流拍" };
    }
    if (member.desire === "摸鱼") {
      return { goalKey: "deny_lot", goalText: `让${target.name}一件都拿不到`, goalTargetId: target.id };
    }
    return {
      goalKey: "get_lot",
      goalText: lot ? `拿到「${lot.name}」` : "拿到一件拍品",
      goalLotId: lot?.id,
    };
  }

  if (member.desire === "省钱") {
    return { goalKey: "save_group", goalText: "保住全群" };
  }
  if (member.desire === "立威" || member.desire === "被夸") {
    return { goalKey: "mvp", goalText: "当一次 MVP" };
  }
  if (member.desire === "摸鱼" || member.desire === "早睡") {
    return { goalKey: "slack_pass", goalText: "全程摸鱼但全群通关" };
  }
  return { goalKey: "blame_target", goalText: `让${target.name}背一次锅`, goalTargetId: target.id };
}

export function getRoundPrompt(config: GameConfig, round: number): { title: string; subtitle: string; badge: string } {
  if (config.ruleType === "negotiation") {
    const event = config.events[round - 1] ?? config.events[0] ?? config.event;
    return {
      title: event.title,
      subtitle: event.quote,
      badge: `任务难度 ${event.difficulty}`,
    };
  }
  if (config.ruleType === "bidding") {
    const lot = config.lots[round - 1] ?? config.lots[config.lots.length - 1];
    return {
      title: `拍品：${lot?.name ?? "神秘拍品"}`,
      subtitle: lot?.flavor ?? "价高者得。",
      badge: "隐藏估值只有你自己知道",
    };
  }
  const challenge = config.challenges[round - 1] ?? config.challenges[config.challenges.length - 1];
  return {
    title: `挑战：${challenge?.name ?? "宿管来了"}`,
    subtitle: challenge?.flavor ?? "全群凑够出力才能过关。",
    badge: `需要 ${challenge?.requirement ?? 6} 点出力`,
  };
}

export function createGame(config: GameConfig, humanIds: string[]): GameState {
  const humans = humanIds.length > 0 ? humanIds : config.members.slice(0, 3).map((member) => member.id);
  const players: PlayerState[] = config.members.map((member, index) => {
    const goal = buildGoal(member, config, index);
    return {
      memberId: member.id,
      isHuman: humans.includes(member.id),
      gp: humans.includes(member.id) ? 5 : 4,
      tokens: 3,
      ...goal,
      goalDone: false,
      skillKey: member.skill.key,
      skillName: member.skill.name,
      skillDesc: member.skill.desc,
      skillUsed: false,
      personaHits: 0,
      ooc: 0,
      scapegoat: 0,
      assignedCount: 0,
      compensationReceived: 0,
      proposalsPassed: 0,
      wonLots: [],
      totalContribution: 0,
      zeroRounds: 0,
      cheapWin: false,
      played: null,
      actionHistory: [],
    };
  });

  const firstHuman = players.findIndex((player) => player.isHuman);
  const prompt = getRoundPrompt(config, 1);
  const game: GameState = {
    config,
    players,
    round: 1,
    phase: "action",
    log: [
      {
        id: uid("sys"),
        kind: "system",
        text: `${config.ruleTitle} 已生成 · ${players.length} 人局 · ${config.rounds} 回合`,
      },
      {
        id: uid("host"),
        kind: "host",
        author: "群主",
        emoji: "📣",
        text: "规则已置顶。先看群公告，再决定你要当哪种人。",
        tone: "glow",
      },
      {
        id: uid("event"),
        kind: "event",
        author: "本回合",
        emoji: "📌",
        text: `${prompt.title}｜${prompt.subtitle}`,
      },
    ],
    pendingIndex: firstHuman >= 0 ? firstHuman : 0,
    lastResult: null,
    history: [],
    hostName: "群主",
    hostEmoji: "📣",
    passedChallenges: 0,
    unsoldLots: 0,
  };

  return game;
}

function describeAction(game: GameState, player: PlayerState, choice: ActionChoice): string {
  const target = getPlayer(game, choice.targetId);
  switch (choice.kind) {
    case "propose":
      return `提议：让 ${target ? getMember(game, target.memberId).name : "某人"} 去做，补偿 ${choice.amount ?? 0} 点`;
    case "support":
      return "附议";
    case "meme": {
      const member = target ? getMember(game, target.memberId) : null;
      return member ? `甩出梗料：「${member.meme}」` : "甩出梗料";
    }
    case "pass":
      return "装死";
    case "volunteer":
      return "自荐：我来";
    case "bid":
      return "暗标已提交（点数保密）";
    case "abstain":
      return "弃权，等 +1";
    case "coalition":
      return target ? `联合 ${getMember(game, target.memberId).name}，一起压价` : "联合";
    case "contribute":
      return "出力已提交（点数保密）";
    case "blame":
      return target ? `准备甩锅给 ${getMember(game, target.memberId).name}` : "准备甩锅";
    default:
      return "行动";
  }
}

function applyPlayerAction(game: GameState, player: PlayerState, choice: ActionChoice, ghost = false): void {
  const effectiveChoice: ActionChoice =
    choice.useSkill && player.skillUsed ? { ...choice, useSkill: false } : choice;
  const member = getMember(game, player.memberId);

  if (effectiveChoice.useSkill) {
    player.skillUsed = true;
    game.log.push({
      id: uid("skill"),
      kind: "host",
      author: "群主",
      emoji: "📣",
      text: `${member.name} 发动人设技能「${player.skillName}」`,
      tone: "glow",
    });
  }

  player.played = effectiveChoice;
  player.actionHistory.push(effectiveChoice);
  game.log.push({
    id: uid("act"),
    kind: "player",
    author: member.name,
    emoji: member.emoji,
    text: `${describeAction(game, player, effectiveChoice)}${ghost ? "（幽灵群友）" : ""}`,
  });
}

export async function playHumanAction(game: GameState, choice: ActionChoice): Promise<GameState> {
  if (game.phase !== "action") return game;
  const next = clone(game);
  const player = next.players[next.pendingIndex];
  if (!player?.isHuman || player.played) return next;

  applyPlayerAction(next, player, choice);

  const nextIndex = next.players.findIndex(
    (candidate, index) => index > next.pendingIndex && candidate.isHuman && !candidate.played,
  );
  if (nextIndex >= 0) {
    next.pendingIndex = nextIndex;
    return next;
  }

  return resolveRound(next);
}

function resolveNegotiation(game: GameState): { headline: string; detail: string; lines: string[] } {
  const players = game.players;
  const proposers = players.filter((player) => player.played?.kind === "propose");
  let proposer = proposers.sort(
    (a, b) => getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence,
  )[0];
  let target: PlayerState | undefined;
  let compensation = 0;
  let mode: "propose" | "volunteer" | "synthetic" = "propose";
  let proposerLabel = "";

  if (proposer) {
    target = getPlayer(game, proposer.played?.targetId);
    compensation = clamp(proposer.played?.amount ?? 0, 0, 2);
    proposerLabel = getMember(game, proposer.memberId).name;
  } else {
    const volunteers = players.filter((player) => player.played?.kind === "volunteer");
    if (volunteers.length > 0) {
      const volunteer = volunteers.sort(
        (a, b) => getMember(game, b.memberId).stats.reliability - getMember(game, a.memberId).stats.reliability,
      )[0];
      proposer = volunteer;
      target = volunteer;
      compensation = 1;
      mode = "volunteer";
      proposerLabel = `${getMember(game, volunteer.memberId).name}（自荐）`;
      game.log.push({
        id: uid("host"),
        kind: "host",
        author: "群主",
        emoji: "📣",
        text: `${getMember(game, volunteer.memberId).name} 自荐，群主直接通过。`,
        tone: "good",
      });
    } else {
      proposer = [...players].sort(
        (a, b) => getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence,
      )[0];
      target = [...players]
        .filter((player) => player.memberId !== proposer.memberId)
        .sort(
          (a, b) =>
            getMember(game, a.memberId).stats.reliability - getMember(game, b.memberId).stats.reliability,
        )[0];
      compensation = 1;
      mode = "synthetic";
      proposerLabel = "群主";
      game.log.push({
        id: uid("host"),
        kind: "host",
        author: "群主",
        emoji: "📣",
        text: "没人提案？群主替你们推了一个。",
        tone: "glow",
      });
    }
  }

  if (!target) {
    return { headline: "提案无效", detail: "目标不存在，本回合跳过。", lines: [] };
  }
  const targetMember = getMember(game, target.memberId);
  const roundEvent = game.config.events[game.round - 1] ?? game.config.events[0] ?? game.config.event;
  const difficulty = roundEvent.difficulty;

  const yes: string[] = [];
  const no: string[] = [];
  let passed = false;

  if (mode === "volunteer") {
    passed = true;
    yes.push(...players.map((player) => getMember(game, player.memberId).name));
  } else {
    for (const voter of players) {
      const choice = voter.played;
      let vote = false;
      if (mode === "propose" && voter.memberId === proposer.memberId) vote = true;
      else if (choice?.kind === "support") vote = true;
      else if (choice?.kind === "meme" && choice.targetId === target.memberId) vote = true;
      else if (choice?.kind === "volunteer" && voter.memberId === target.memberId) vote = true;
      else if (choice?.kind === "propose") vote = target.memberId !== voter.memberId;
      else if (choice?.kind === "meme") vote = target.memberId !== voter.memberId;
      else vote = false;

      if (vote) yes.push(getMember(game, voter.memberId).name);
      else no.push(getMember(game, voter.memberId).name);
    }
    const threshold = Math.floor(players.length / 2) + 1;
    passed = yes.length >= threshold;
  }

  const lines = [
    `提案：${proposerLabel} → ${targetMember.name}，补偿 ${compensation} 点`,
    mode === "volunteer"
      ? `投票：全群同意 ${targetMember.name} 自荐`
      : `投票：赞成 ${yes.length}（${yes.join("、") || "无"}） / 反对 ${no.length}（${no.join("、") || "无"}）`,
    `任务难度 ${difficulty}，${targetMember.name} 靠谱度 ${targetMember.stats.reliability}`,
  ];

  const forcedPass = skillUsedBy(game, "force_proposal");
  if (forcedPass) {
    passed = true;
    lines.push("人设技能「拉个群」生效：提案直接通过。");
  }

  let headline: string;
  let detail: string;

  if (passed) {
    target.gp += compensation;
    target.compensationReceived = Math.max(target.compensationReceived, compensation);
    target.assignedCount += 1;
    if (mode === "propose") {
      proposer.gp += 1;
      proposer.proposalsPassed += 1;
    }
    const bonusText = mode === "propose" ? `；${getMember(game, proposer.memberId).name} 提案 +1` : "";
    headline = mode === "volunteer" ? "自荐通过" : mode === "synthetic" ? "群主指定" : "提案通过";
    if (targetMember.stats.reliability < difficulty) {
      target.gp -= 2;
      target.scapegoat += 1;
      detail = `${targetMember.name} 接活但翻车，背锅 +1${bonusText}。`;
      lines.push("任务失败：靠谱度不够，全群看着你社死。");
    } else {
      detail = `${targetMember.name} 接活，拿到 ${compensation} 点补偿${bonusText}。`;
      lines.push("任务完成：今晚的群聊恢复了和平。");
    }
  } else {
    const saved = skillUsedBy(game, "save_group");
    if (!saved) {
      for (const player of players) player.gp -= 1;
    }
    const victim = [...players].sort((a, b) => {
      const reliabilityDiff =
        getMember(game, a.memberId).stats.reliability - getMember(game, b.memberId).stats.reliability;
      if (reliabilityDiff !== 0) return reliabilityDiff;
      return a.gp - b.gp;
    })[0];
    victim.gp -= 3;
    victim.scapegoat += 1;
    headline = "没人接活";
    detail = `${saved ? "老好人兜底，全群免扣" : "全群 -1"}；${getMember(game, victim.memberId).name} 被群主点名背锅 -3。`;
    lines.push("结局：外卖凉了，群聊安静了 4 分钟。");
    if (saved) lines.push("人设技能「老好人」生效：全群免扣。");
  }

  return { headline, detail, lines };
}

function resolveBidding(game: GameState): { headline: string; detail: string; lines: string[] } {
  const lot = game.config.lots[game.round - 1] ?? game.config.lots[game.config.lots.length - 1];
  if (!lot) {
    return { headline: "拍品缺失", detail: "没有拍品，本回合跳过。", lines: [] };
  }

  const bids = new Map<string, number>();
  const coalitionLines: string[] = [];
  const seenCoalitions = new Set<string>();

  for (const player of game.players) {
    if (player.played?.kind !== "coalition") continue;
    const partner = getPlayer(game, player.played.targetId);
    if (!partner || partner.played?.kind !== "coalition" || partner.played.targetId !== player.memberId) continue;
    const key = [player.memberId, partner.memberId].sort().join("-");
    if (seenCoalitions.has(key)) continue;
    seenCoalitions.add(key);
    player.gp += 2;
    partner.gp += 2;
    coalitionLines.push(
      `联合：${getMember(game, player.memberId).name} + ${getMember(game, partner.memberId).name} 各 +2 点，本回合不出价`,
    );
  }

  for (const player of game.players) {
    if (player.played?.kind === "abstain") {
      player.gp += 1;
      bids.set(player.memberId, 0);
      continue;
    }
    if (player.played?.kind === "coalition") {
      bids.set(player.memberId, 0);
      continue;
    }
    const rawBid = player.played?.kind === "bid" ? player.played.bid ?? 0 : 0;
    bids.set(player.memberId, clamp(rawBid, 0, Math.max(0, player.gp)));
  }

  const maxBid = Math.max(...bids.values());
  const reveal = game.players
    .map((player) => `${getMember(game, player.memberId).name} ${bids.get(player.memberId) ?? 0}`)
    .join(" / ");
  const lines = [...coalitionLines, `揭标：${reveal}`];

  if (maxBid === 0) {
    game.unsoldLots += 1;
    lines.push("流拍：没人愿意为它花点数。");
    return {
      headline: "流拍",
      detail: `「${lot.name}」无人出价，今晚谁也别想用。`,
      lines,
    };
  }

  const candidates = game.players.filter((player) => (bids.get(player.memberId) ?? 0) === maxBid);
  const winner = candidates.sort(
    (a, b) => getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence,
  )[0];
  const value = lot.values[winner.memberId] ?? 1;
  winner.gp -= maxBid;
  winner.gp += value;
  winner.wonLots.push(lot.id);
  if (maxBid === 1) winner.cheapWin = true;

  lines.push(`成交：${getMember(game, winner.memberId).name} 出 ${maxBid} 点，拍品对他值 ${value} 点，净收益 ${value - maxBid} 点。`);

  return {
    headline: `${getMember(game, winner.memberId).name} 拿下「${lot.name}」`,
    detail: `出价 ${maxBid} 点，隐藏价值 ${value} 点，净收益 ${value - maxBid} 点。`,
    lines,
  };
}

function resolveEscape(game: GameState): { headline: string; detail: string; lines: string[] } {
  const challenge =
    game.config.challenges[game.round - 1] ?? game.config.challenges[game.config.challenges.length - 1];
  if (!challenge) {
    return { headline: "挑战缺失", detail: "没有挑战，本回合跳过。", lines: [] };
  }

  const amounts = new Map<string, number>();
  for (const player of game.players) {
    const raw = player.played?.kind === "contribute" ? player.played.contribution ?? 0 : 0;
    const amount = clamp(raw, 0, Math.min(2, player.tokens));
    player.tokens -= amount;
    player.totalContribution += amount;
    if (amount === 0) player.zeroRounds += 1;
    amounts.set(player.memberId, amount);
  }

  const total = [...amounts.values()].reduce((sum, value) => sum + value, 0);
  const passed = total >= challenge.requirement;
  const reveal = game.players
    .map((player) => `${getMember(game, player.memberId).name} ${amounts.get(player.memberId) ?? 0}`)
    .join(" / ");
  const lines = [`揭榜：${reveal}`, `总出力 ${total} / 需要 ${challenge.requirement}`];

  const maxAmount = Math.max(...amounts.values());
  const minAmount = Math.min(...amounts.values());
  const topPlayers = game.players.filter((player) => (amounts.get(player.memberId) ?? 0) === maxAmount);
  const mvp = topPlayers.sort(
    (a, b) => getMember(game, b.memberId).stats.reliability - getMember(game, a.memberId).stats.reliability,
  )[0];

  const lowPlayers = game.players.filter((player) => (amounts.get(player.memberId) ?? 0) === minAmount);
  const loser = lowPlayers.sort(
    (a, b) => getMember(game, a.memberId).stats.reliability - getMember(game, b.memberId).stats.reliability,
  )[0];

  let headline: string;
  let detail: string;

  if (passed) {
    for (const player of game.players) player.gp += 1;
    mvp.gp += 2;
    game.passedChallenges += 1;
    headline = "挑战通过";
    detail = `全群 +1；${getMember(game, mvp.memberId).name} 出力最高 +2。`;
    lines.push(`最低贡献：${getMember(game, loser.memberId).name}（${minAmount} 点，摸鱼标记）`);
  } else {
    const saved = skillUsedBy(game, "save_group");
    if (!saved) {
      for (const player of game.players) player.gp -= 1;
    }
    loser.gp -= 2;
    loser.scapegoat += 1;
    headline = "挑战失败";
    detail = `${saved ? "老好人兜底，全群免扣" : "全群 -1"}；${getMember(game, loser.memberId).name} 背锅 -2。`;
    if (saved) lines.push("人设技能「老好人」生效：全群免扣。");

    const blameActions = loser.actionHistory.filter((action) => action.kind === "blame");
    const blameTarget = getPlayer(game, loser.played?.targetId);
    if (blameActions.length === 1 && blameTarget) {
      loser.scapegoat = Math.max(0, loser.scapegoat - 1);
      blameTarget.scapegoat += 1;
      loser.gp += 1;
      blameTarget.gp -= 1;
      lines.push(`甩锅生效：${getMember(game, loser.memberId).name} 把锅转给了 ${getMember(game, blameTarget.memberId).name}。`);
    }
  }

  return { headline, detail, lines };
}

function applyVerdict(
  game: GameState,
  player: PlayerState,
  member: Member,
  verdict: PersonaVerdict,
  lines: string[],
): void {
  const delta = verdict.delta === 1 ? 1 : verdict.delta === -1 ? -1 : 0;
  if (delta === 0) return;

  if (delta === -1 && player.played?.useSkill && player.skillKey === "immune_ooc") {
    const line = `${member.name} 发动「这波不亏」，出戏判定无效`;
    lines.push(line);
    game.log.push({ id: uid("skill"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "good" });
    return;
  }

  const label = player.played ? actionLabel(player.played) : "行动";
  const validTag = verdict.tag && member.tags.includes(verdict.tag) ? verdict.tag : undefined;
  const tag = validTag ? `「${validTag}」` : "";
  const line =
    verdict.line?.trim() ||
    (delta === 1
      ? `${member.name} 的「${label}」很像${tag || "自己的人设"}，人设 +1`
      : `${member.name} 居然「${label}」，和${tag || "自己的人设"}不符，出戏 -1`);

  if (delta === 1) {
    player.gp += 1;
    player.personaHits += 1;
    lines.push(line);
    game.log.push({ id: uid("persona"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "good" });
  } else {
    player.gp -= 1;
    player.ooc += 1;
    lines.push(line);
    game.log.push({ id: uid("persona"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "bad" });
  }
}

function applyPersonaChecksLocal(game: GameState): string[] {
  const lines: string[] = [];
  for (const player of game.players) {
    if (!player.played) continue;
    const member = getMember(game, player.memberId);
    const verdict = judgePersonaLocal(player.memberId, member.name, member.tags, player.played);
    applyVerdict(game, player, member, verdict, lines);
  }
  return lines;
}

function buildPersonaRequest(game: GameState): PersonaJudgeRequest {
  const prompt = getRoundPrompt(game.config, game.round);
  return {
    ruleType: game.config.ruleType,
    round: game.round,
    event: prompt.title,
    players: game.players
      .filter((player) => player.played)
      .map((player) => {
        const member = getMember(game, player.memberId);
        const target = getPlayer(game, player.played?.targetId);
        return {
          id: player.memberId,
          name: member.name,
          tags: member.tags,
          action: {
            kind: player.played!.kind,
            amount: player.played!.amount,
            bid: player.played!.bid,
            contribution: player.played!.contribution,
            label: actionLabel(player.played!),
            detail: describeAction(game, player, player.played!),
            targetName: target ? getMember(game, target.memberId).name : undefined,
          },
        };
      }),
  };
}

async function applyPersonaChecksWithLLM(
  game: GameState,
): Promise<{ lines: string[]; source: "llm" | "local" }> {
  const request = buildPersonaRequest(game);
  if (request.players.length === 0) return { lines: [], source: "local" };

  try {
    const { verdicts, source } = await judgePersonaBatch(request);
    const lines: string[] = [];
    for (const player of game.players) {
      if (!player.played) continue;
      const member = getMember(game, player.memberId);
      const verdict =
        verdicts.find((item) => item.id === player.memberId) ??
        judgePersonaLocal(player.memberId, member.name, member.tags, player.played);
      applyVerdict(game, player, member, verdict, lines);
    }
    return { lines, source: source === "mock" ? "local" : "llm" };
  } catch {
    return { lines: applyPersonaChecksLocal(game), source: "local" };
  }
}

function evaluateGoals(game: GameState): string[] {
  const lines: string[] = [];
  const maxContribution = Math.max(...game.players.map((player) => player.totalContribution));

  for (const player of game.players) {
    if (player.goalDone) continue;
    const target = getPlayer(game, player.goalTargetId);
    let done = false;
    switch (player.goalKey) {
      case "never_assigned":
        done = player.assignedCount === 0;
        break;
      case "target_assigned":
        done = (target?.assignedCount ?? 0) > 0;
        break;
      case "compensation_2":
        done = player.compensationReceived >= 2;
        break;
      case "proposal_passed":
        done = player.proposalsPassed > 0;
        break;
      case "get_lot":
        done = Boolean(player.goalLotId && player.wonLots.includes(player.goalLotId));
        break;
      case "deny_lot":
        done = Boolean(target && target.wonLots.length === 0);
        break;
      case "cheap_win":
        done = player.cheapWin;
        break;
      case "unsold_lot":
        done = game.unsoldLots > 0;
        break;
      case "slack_pass":
        done = game.passedChallenges === game.config.rounds && player.zeroRounds === game.config.rounds;
        break;
      case "mvp":
        done = player.totalContribution === maxContribution && maxContribution > 0;
        break;
      case "blame_target":
        done = (target?.scapegoat ?? 0) > 0;
        break;
      case "save_group":
        done = game.passedChallenges === game.config.rounds;
        break;
      default:
        break;
    }

    if (done) {
      player.goalDone = true;
      player.gp += 3;
      const member = getMember(game, player.memberId);
      const line = `隐藏诉求达成：${member.name}「${player.goalText}」+3`;
      lines.push(line);
      game.log.push({ id: uid("goal"), kind: "result", text: line, tone: "good" });
    }
  }

  return lines;
}

function applySkillEffects(game: GameState): string[] {
  const lines: string[] = [];
  const push = (line: string) => {
    lines.push(line);
    game.log.push({ id: uid("skill"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "glow" });
  };

  for (const player of game.players) {
    if (!player.played?.useSkill) continue;
    const member = getMember(game, player.memberId);

    if (player.skillKey === "extra_gp") {
      player.gp += 2;
      push(`${member.name} 发动「这单我熟」，+2 群地位`);
    } else if (player.skillKey === "radio") {
      for (const target of game.players) target.gp += 1;
      player.gp += 2;
      push(`${member.name} 发动「深夜电台」，全场 +1，自己 +2`);
    } else if (player.skillKey === "slack_bonus") {
      const slack =
        player.played.kind === "pass" ||
        player.played.kind === "abstain" ||
        player.played.kind === "blame" ||
        (player.played.kind === "contribute" && (player.played.contribution ?? 0) === 0);
      if (slack) {
        player.gp += 1;
        push(`${member.name} 发动「真·装死」，+1 群地位`);
      }
    }
  }

  return lines;
}

async function resolveRound(game: GameState): Promise<GameState> {
  const next = clone(game);

  for (const player of next.players) {
    if (!player.played) {
      const choice = decideGhost(next, player);
      applyPlayerAction(next, player, choice, true);
    }
  }

  const before = new Map(next.players.map((player) => [player.memberId, player.gp]));
  let base: { headline: string; detail: string; lines: string[] };

  if (next.config.ruleType === "negotiation") base = resolveNegotiation(next);
  else if (next.config.ruleType === "bidding") base = resolveBidding(next);
  else base = resolveEscape(next);

  const persona = await applyPersonaChecksWithLLM(next);
  const personaLines = persona.lines;
  const skillLines = applySkillEffects(next);
  const goalLines = next.round >= next.config.rounds ? evaluateGoals(next) : [];
  const deltas: Record<string, number> = {};
  for (const player of next.players) {
    deltas[player.memberId] = player.gp - (before.get(player.memberId) ?? player.gp);
  }

  const result: RoundResult = {
    round: next.round,
    headline: base.headline,
    detail: base.detail,
    lines: [...base.lines, ...personaLines, ...skillLines, ...goalLines],
    deltas,
    personaLine: personaLines[0],
    judgeSource: persona.source,
  };

  next.lastResult = result;
  next.history.push(result);
  next.phase = next.round >= next.config.rounds ? "done" : "resolve";
  next.log.push({
    id: uid("result"),
    kind: "result",
    text: `${base.headline}｜${base.detail}`,
    tone: "glow",
  });

  return next;
}

export function nextRound(game: GameState): GameState {
  if (game.phase === "done") return game;
  const next = clone(game);
  next.round += 1;
  next.phase = "action";
  next.pendingIndex = next.players.findIndex((player) => player.isHuman);
  for (const player of next.players) player.played = null;
  const prompt = getRoundPrompt(next.config, next.round);
  next.log.push({
    id: uid("round"),
    kind: "system",
    text: `第 ${next.round} 回合 · ${prompt.title}`,
  });
  next.log.push({
    id: uid("host"),
    kind: "host",
    author: "群主",
    emoji: "📣",
    text: `新的回合：${prompt.title}。${prompt.subtitle}`,
    tone: "normal",
  });
  return next;
}

export function rankPlayers(game: GameState): PlayerState[] {
  return [...game.players].sort((a, b) => {
    if (b.gp !== a.gp) return b.gp - a.gp;
    if (Number(b.goalDone) !== Number(a.goalDone)) return Number(b.goalDone) - Number(a.goalDone);
    return getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence;
  });
}

export function getMemberOf(game: GameState, player: PlayerState): Member {
  return getMember(game, player.memberId);
}
