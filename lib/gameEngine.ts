import type {
  ActionChoice,
  ChatMessage,
  EventPlan,
  GameConfig,
  GameState,
  Member,
  PersonaJudgeRequest,
  PersonaVerdict,
  PlayerState,
  RoundResult,
  RuleType,
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

export function activePlayers(game: GameState): PlayerState[] {
  return game.players.filter((player) => !player.eliminated);
}

export function activeHumans(game: GameState): PlayerState[] {
  return activePlayers(game).filter((player) => player.isHuman);
}

export function getCurrentPlan(game: GameState): EventPlan | undefined {
  return game.config.plans?.[game.round - 1] ?? game.config.plans?.[game.config.plans.length - 1];
}

export function getCurrentRuleType(game: GameState): RuleType {
  return getCurrentPlan(game)?.kind ?? game.config.ruleType;
}

export function challengeRequirement(activeCount: number, difficulty: number): number {
  return Math.max(2, Math.ceil(activeCount * 1.2) + difficulty - 2);
}

export function isSkillAvailable(skillKey: SkillKey, kind: RuleType): boolean {
  if (skillKey === "force_proposal") return kind === "negotiation";
  if (skillKey === "save_group") return kind === "negotiation" || kind === "escape";
  if (skillKey === "discount") return kind === "bidding";
  if (skillKey === "rally") return kind === "escape";
  return true;
}

function skillUsedBy(game: GameState, key: SkillKey): boolean {
  return activePlayers(game).some((player) => player.played?.useSkill && player.skillKey === key);
}

function buildGoal(
  member: Member,
  config: GameConfig,
  index: number,
): Pick<PlayerState, "goalKey" | "goalText" | "goalTargetId" | "goalLotId"> {
  const others = config.members.filter((item) => item.id !== member.id);
  const target = others[index % Math.max(1, others.length)] ?? member;
  const lot = config.plans?.find((plan) => plan.kind === "bidding")?.lot ?? config.lots?.[0];
  const odd = index % 2 === 1;

  if (member.desire === "早睡") {
    return { goalKey: "never_assigned", goalText: "整局绝不接活" };
  }
  if (member.desire === "立威") {
    return odd
      ? { goalKey: "target_assigned", goalText: `让${target.name}接一次活`, goalTargetId: target.id }
      : { goalKey: "proposal_passed", goalText: "让你的提案通过一次" };
  }
  if (member.desire === "省钱") {
    return odd
      ? { goalKey: "unsold_lot", goalText: "让一件拍品流拍" }
      : { goalKey: "cheap_win", goalText: "用 1 点赢下任意一件" };
  }
  if (member.desire === "被夸") {
    return odd
      ? { goalKey: "compensation_2", goalText: "拿一次 2 点补偿" }
      : { goalKey: "mvp", goalText: "当一次出力 MVP" };
  }
  if (member.desire === "摸鱼") {
    return odd
      ? { goalKey: "never_assigned", goalText: "整局绝不接活" }
      : { goalKey: "slack_pass", goalText: "全程摸鱼但全群过关" };
  }
  if (member.desire === "脱单") {
    return lot
      ? { goalKey: "get_lot", goalText: `拿到「${lot.name}」`, goalLotId: lot.id }
      : { goalKey: "get_lot", goalText: "拿到一件拍品" };
  }
  return { goalKey: "blame_target", goalText: `让${target.name}背一次锅`, goalTargetId: target.id };
}

export function getRoundPrompt(
  config: GameConfig,
  round: number,
  activeCount = config.members.length,
): { title: string; subtitle: string; badge: string; kind: RuleType } {
  const plan = config.plans?.[round - 1] ?? config.plans?.[config.plans.length - 1];
  if (plan) {
    if (plan.kind === "bidding") {
      return {
        title: plan.title,
        subtitle: plan.quote,
        badge: "竞标 · 隐藏估值",
        kind: plan.kind,
      };
    }
    if (plan.kind === "escape") {
      const requirement = challengeRequirement(activeCount, plan.difficulty);
      return {
        title: plan.title,
        subtitle: plan.quote,
        badge: `逃脱 · 需要 ${requirement} 点出力`,
        kind: plan.kind,
      };
    }
    return {
      title: plan.title,
      subtitle: plan.quote,
      badge: `谈判 · 难度 ${plan.difficulty}`,
      kind: plan.kind,
    };
  }

  if (config.ruleType === "negotiation") {
    const event = config.events[round - 1] ?? config.events[0] ?? config.event;
    return {
      title: event.title,
      subtitle: event.quote,
      badge: `任务难度 ${event.difficulty}`,
      kind: "negotiation",
    };
  }
  if (config.ruleType === "bidding") {
    const lot = config.lots[round - 1] ?? config.lots[config.lots.length - 1];
    return {
      title: `拍品：${lot?.name ?? "神秘拍品"}`,
      subtitle: lot?.flavor ?? "价高者得。",
      badge: "隐藏估值只有你自己知道",
      kind: "bidding",
    };
  }
  const challenge = config.challenges[round - 1] ?? config.challenges[config.challenges.length - 1];
  return {
    title: `挑战：${challenge?.name ?? "宿管来了"}`,
    subtitle: challenge?.flavor ?? "全群凑够出力才能过关。",
    badge: `需要 ${challenge?.requirement ?? 6} 点出力`,
    kind: "escape",
  };
}

const GHOST_LINES = [
  "我先说好，今晚别投我。",
  "群地位能当饭吃吗？能。",
  "谁先出局谁请奶茶。",
  "我已经在路上了（指在群里）。",
  "别看我，我在打团。",
  "这局我准备认真了，大概。",
  "有没有人一起？没有我待会再问。",
  "稳住，我们能赢。",
];

function pushGhostChatter(game: GameState, count: number): void {
  const ghosts = activePlayers(game).filter((player) => !player.isHuman);
  if (ghosts.length === 0) return;
  for (let i = 0; i < Math.min(count, ghosts.length); i += 1) {
    const player = ghosts[(game.round * 3 + i * 5) % ghosts.length];
    const member = getMember(game, player.memberId);
    const text = i === 0 ? member.quote : GHOST_LINES[(game.round + i * 3) % GHOST_LINES.length];
    game.log.push({
      id: uid("chat"),
      kind: "chat",
      memberId: member.id,
      author: member.name,
      emoji: member.emoji,
      text,
      at: Date.now(),
    });
  }
}

function pushPlanBriefing(game: GameState): void {
  const plan = getCurrentPlan(game);
  if (!plan) return;
  const parts: string[] = [];
  if (plan.twist) parts.push(`变数「${plan.twist.title}」：${plan.twist.desc}`);
  if (plan.bounty) parts.push(`悬赏「${plan.bounty.title}」：${plan.bounty.desc}`);
  if (parts.length === 0) return;
  game.log.push({
    id: uid("brief"),
    kind: "host",
    author: "群主",
    emoji: "📣",
    text: parts.join("｜"),
    tone: "glow",
  });
}

export function createGame(config: GameConfig, humanIds: string[], startMemberId?: string): GameState {
  const humans = humanIds.length > 0 ? humanIds : config.members.slice(0, 1).map((member) => member.id);
  const players: PlayerState[] = config.members.map((member, index) => {
    const goal = buildGoal(member, config, index);
    return {
      memberId: member.id,
      isHuman: humans.includes(member.id),
      gp: 5,
      tokens: 2,
      eliminated: false,
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

  if (startMemberId) {
    const startIndex = players.findIndex((player) => player.memberId === startMemberId && player.isHuman);
    if (startIndex > 0) {
      const [starter] = players.splice(startIndex, 1);
      players.unshift(starter);
    }
  }

  const firstHuman = players.findIndex((player) => player.isHuman);
  const prompt = getRoundPrompt(config, 1, players.length);
  const game: GameState = {
    config,
    players,
    round: 1,
    phase: "action",
    log: [
      {
        id: uid("sys"),
        kind: "system",
        text: `${config.groupName} · ${players.length} 人群 · 淘汰赛 · ${config.maxEvents} 个随机事件`,
      },
      {
        id: uid("host"),
        kind: "host",
        author: "群主",
        emoji: "📣",
        text: "规则：每个事件结算后，群地位最低的人当场出局。活到最后，或积分最高的人赢。",
        tone: "glow",
      },
      {
        id: uid("event"),
        kind: "event",
        author: `事件 1 · ${prompt.kind === "negotiation" ? "谈判" : prompt.kind === "bidding" ? "竞标" : "逃脱"}`,
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
    challengeAttempts: 0,
    unsoldLots: 0,
  };

  pushPlanBriefing(game);
  pushGhostChatter(game, 2);
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
      const custom = choice.memeText?.trim();
      if (custom) return `${member ? `对 ${member.name} ` : ""}甩出自定义梗料：「${custom}」`;
      return member ? `甩出梗料：「${member.meme}」` : "甩出梗料";
    }
    case "pass":
      return "装死";
    case "volunteer":
      return "自荐：我来";
    case "underbid":
      return "抢活：0 补偿我来";
    case "back":
      return target ? `站队：押 ${getMember(game, target.memberId).name} 接活` : "站队";
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
  if (player.eliminated) return;
  const member = getMember(game, player.memberId);
  const kind = getCurrentRuleType(game);
  const allowedSkill =
    Boolean(choice.useSkill) && !player.skillUsed && isSkillAvailable(player.skillKey, kind);
  const effectiveChoice: ActionChoice = allowedSkill ? choice : { ...choice, useSkill: false };

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
  if (!player?.isHuman || player.eliminated || player.played) return next;

  applyPlayerAction(next, player, choice);

  const nextIndex = next.players.findIndex(
    (candidate, index) =>
      index > next.pendingIndex && candidate.isHuman && !candidate.eliminated && !candidate.played,
  );
  if (nextIndex >= 0) {
    next.pendingIndex = nextIndex;
    return next;
  }

  return resolveRound(next);
}

interface ResolutionMeta {
  proposerId?: string;
  winnerId?: string;
  cost?: number;
  maxBid?: number;
  mvpId?: string;
  maxAmount?: number;
}

interface BaseResolution {
  headline: string;
  detail: string;
  lines: string[];
  meta?: ResolutionMeta;
}

function resolveNegotiation(game: GameState): BaseResolution {
  const players = activePlayers(game);
  if (players.length < 2) {
    return { headline: "无人可谈", detail: "场上只剩一个人，谈判自动结束。", lines: [] };
  }

  const proposers = players.filter((player) => {
    if (player.played?.kind !== "propose") return false;
    const target = getPlayer(game, player.played.targetId);
    return Boolean(target && !target.eliminated && target.memberId !== player.memberId);
  });
  let proposer = proposers.sort(
    (a, b) => getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence,
  )[0];
  let target: PlayerState | undefined;
  let compensation = 0;
  let mode: "propose" | "volunteer" | "underbid" | "synthetic" = "propose";
  let proposerLabel = "";

  const underbidders = players.filter((player) => player.played?.kind === "underbid");
  if (underbidders.length > 0) {
    const chosen = [...underbidders].sort((a, b) => {
      const reliability =
        getMember(game, b.memberId).stats.reliability - getMember(game, a.memberId).stats.reliability;
      if (reliability !== 0) return reliability;
      return getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence;
    })[0];
    proposer = chosen;
    target = chosen;
    compensation = 0;
    mode = "underbid";
    proposerLabel = `${getMember(game, chosen.memberId).name}（抢活）`;
    game.log.push({
      id: uid("host"),
      kind: "host",
      author: "群主",
      emoji: "📣",
      text: `${getMember(game, chosen.memberId).name} 抢活：0 补偿接单，群主直接通过。`,
      tone: "glow",
    });
  } else if (proposer) {
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
      const backedTargets = players
        .filter((player) => player.played?.kind === "back")
        .map((player) => getPlayer(game, player.played?.targetId))
        .filter((player): player is PlayerState => Boolean(player && !player.eliminated));
      const tally = new Map<string, number>();
      for (const backed of backedTargets) {
        tally.set(backed.memberId, (tally.get(backed.memberId) ?? 0) + 1);
      }
      const backedWinner = [...tally.entries()].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return getMember(game, b[0]).stats.influence - getMember(game, a[0]).stats.influence;
      })[0]?.[0];
      const backedPlayer = backedWinner ? getPlayer(game, backedWinner) : undefined;
      proposer = [...players]
        .filter((player) => player.memberId !== backedPlayer?.memberId)
        .sort((a, b) => getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence)[0];
      target = backedPlayer ?? [...players]
        .filter((player) => player.memberId !== proposer.memberId)
        .sort(
          (a, b) =>
            getMember(game, a.memberId).stats.reliability - getMember(game, b.memberId).stats.reliability,
        )[0];
      compensation = 1;
      mode = "synthetic";
      proposerLabel = backedPlayer ? "群主（按站队）" : "群主";
      game.log.push({
        id: uid("host"),
        kind: "host",
        author: "群主",
        emoji: "📣",
        text: backedPlayer
          ? `没人提案？群主按站队人数指定了 ${getMember(game, backedPlayer.memberId).name}。`
          : "没人提案？群主替你们推了一个。",
        tone: "glow",
      });
    }
  }

  if (!target) {
    return { headline: "提案无效", detail: "目标不存在，本事件跳过。", lines: [] };
  }
  const targetMember = getMember(game, target.memberId);
  const plan = getCurrentPlan(game);
  const difficulty = plan?.difficulty ?? 2;

  const yes: string[] = [];
  const no: string[] = [];
  let passed = false;

  if (mode === "volunteer" || mode === "underbid") {
    passed = true;
    yes.push(...players.map((player) => getMember(game, player.memberId).name));
  } else {
    for (const voter of players) {
      const choice = voter.played;
      let vote = false;
      if (mode === "propose" && voter.memberId === proposer.memberId) vote = true;
      else if (choice?.kind === "support") vote = true;
      else if (choice?.kind === "meme" && choice.targetId === target.memberId) vote = true;
      else if (choice?.kind === "back") vote = choice.targetId === target.memberId;
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
    mode === "underbid"
      ? `抢活：${targetMember.name} 0 补偿接单`
      : `提案：${proposerLabel} → ${targetMember.name}，补偿 ${compensation} 点`,
    mode === "volunteer" || mode === "underbid"
      ? mode === "underbid"
        ? `抢活：群主直接通过，${targetMember.name} 负责到底`
        : `投票：全群同意 ${targetMember.name} 自荐`
      : `投票：赞成 ${yes.length}（${yes.join("、") || "无"}） / 反对 ${no.length}（${no.join("、") || "无"}）`,
    `任务难度 ${difficulty}，${targetMember.name} 靠谱度 ${targetMember.stats.reliability}`,
  ];

  const customMeme = players.find((player) => player.played?.kind === "meme" && player.played.memeText?.trim())
    ?.played?.memeText;
  if (customMeme) lines.push(`群梗现场：「${customMeme}」`);

  const forcedPass = skillUsedBy(game, "force_proposal");
  if (forcedPass) {
    passed = true;
    lines.push("人设技能「拉个群」生效：提案直接通过。");
  }

  let headline: string;
  let detail: string;
  let taskSucceeded = false;

  if (passed) {
    target.gp += compensation;
    target.compensationReceived = Math.max(target.compensationReceived, compensation);
    target.assignedCount += 1;
    if (mode === "propose" && proposer) {
      proposer.gp += 1;
      proposer.proposalsPassed += 1;
    }
    const bonusText = mode === "propose" && proposer ? `；${getMember(game, proposer.memberId).name} 提案 +1` : "";
    headline =
      mode === "volunteer"
        ? "自荐通过"
        : mode === "underbid"
          ? "抢活接单"
          : mode === "synthetic"
            ? "群主指定"
            : "提案通过";
    if (targetMember.stats.reliability < difficulty) {
      target.gp -= 2;
      target.scapegoat += 1;
      detail =
        mode === "underbid"
          ? `${targetMember.name} 0 补偿抢活但翻车，背锅 +1。`
          : `${targetMember.name} 接活但翻车，背锅 +1${bonusText}。`;
      if (mode === "underbid") headline = "抢活翻车";
      lines.push("任务失败：靠谱度不够，全群看着你社死。");
    } else {
      taskSucceeded = true;
      if (mode === "underbid") {
        target.gp += 1;
        detail = `${targetMember.name} 0 补偿接单，抢活 +1。`;
        lines.push("抢活成功：这单白干，但群地位 +1。");
      } else {
        detail = `${targetMember.name} 接活，拿到 ${compensation} 点补偿${bonusText}。`;
        lines.push("任务完成：今晚的群聊恢复了和平。");
      }
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

  for (const backer of players.filter((player) => player.played?.kind === "back")) {
    const backed = getPlayer(game, backer.played?.targetId);
    if (!backed) continue;
    const positive = backed.memberId === target.memberId && taskSucceeded;
    backer.gp += positive ? 1 : -1;
    const line = positive
      ? `站队：${getMember(game, backer.memberId).name} 押中 ${targetMember.name}，+1。`
      : `站队：${getMember(game, backer.memberId).name} 押错，-1。`;
    lines.push(line);
    game.log.push({
      id: uid("back"),
      kind: "host",
      author: "群主",
      emoji: "📣",
      text: line,
      tone: positive ? "good" : "bad",
    });
  }

  return {
    headline,
    detail,
    lines,
    meta: { proposerId: mode === "propose" && passed ? proposer?.memberId : undefined },
  };
}

function resolveBidding(game: GameState): BaseResolution {
  const plan = getCurrentPlan(game);
  const lot = plan?.lot ?? game.config.lots[game.round - 1] ?? game.config.lots[game.config.lots.length - 1];
  if (!lot) {
    return { headline: "拍品缺失", detail: "没有拍品，本事件跳过。", lines: [] };
  }

  const players = activePlayers(game);
  const bids = new Map<string, number>();
  const coalitionLines: string[] = [];
  const seenCoalitions = new Set<string>();

  for (const player of players) {
    if (player.played?.kind !== "coalition") continue;
    const partner = getPlayer(game, player.played.targetId);
    if (!partner || partner.eliminated || partner.played?.kind !== "coalition" || partner.played.targetId !== player.memberId) {
      continue;
    }
    const key = [player.memberId, partner.memberId].sort().join("-");
    if (seenCoalitions.has(key)) continue;
    seenCoalitions.add(key);
    player.gp += 2;
    partner.gp += 2;
    coalitionLines.push(
      `联合：${getMember(game, player.memberId).name} + ${getMember(game, partner.memberId).name} 各 +2 点，本事件不出价`,
    );
  }

  for (const player of players) {
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
  const reveal = players
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
      meta: { maxBid: 0 },
    };
  }

  const candidates = players.filter((player) => (bids.get(player.memberId) ?? 0) === maxBid);
  const winner = candidates.sort(
    (a, b) => getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence,
  )[0];
  const value = lot.values[winner.memberId] ?? 1;
  const discount = winner.played?.useSkill && winner.skillKey === "discount" ? 1 : 0;
  const cost = Math.max(0, maxBid - discount);
  winner.gp -= cost;
  winner.gp += value;
  winner.wonLots.push(lot.id);
  if (maxBid === 1) winner.cheapWin = true;
  if (discount > 0) {
    lines.push(`${getMember(game, winner.memberId).name} 发动「内部价」，少付 1 点。`);
  }

  lines.push(
    `成交：${getMember(game, winner.memberId).name} 出 ${maxBid} 点${discount ? `（实付 ${cost}）` : ""}，拍品对他值 ${value} 点，净收益 ${value - cost} 点。`,
  );

  return {
    headline: `${getMember(game, winner.memberId).name} 拿下「${lot.name}」`,
    detail: `出价 ${maxBid} 点${discount ? `、实付 ${cost} 点` : ""}，隐藏价值 ${value} 点，净收益 ${value - cost} 点。`,
    lines,
    meta: { winnerId: winner.memberId, cost, maxBid },
  };
}

function resolveEscape(game: GameState): BaseResolution {
  const plan = getCurrentPlan(game);
  const challenge =
    plan?.challenge ?? game.config.challenges[game.round - 1] ?? game.config.challenges[game.config.challenges.length - 1];
  if (!challenge) {
    return { headline: "挑战缺失", detail: "没有挑战，本事件跳过。", lines: [] };
  }

  const players = activePlayers(game);
  const amounts = new Map<string, number>();
  for (const player of players) {
    const raw = player.played?.kind === "contribute" ? player.played.contribution ?? 0 : 0;
    const amount = clamp(raw, 0, Math.min(2, player.tokens));
    player.tokens -= amount;
    player.totalContribution += amount;
    if (amount === 0) player.zeroRounds += 1;
    amounts.set(player.memberId, amount);
  }

  const lines: string[] = [];
  let total = [...amounts.values()].reduce((sum, value) => sum + value, 0);
  const rallied = skillUsedBy(game, "rally");
  if (rallied) {
    total += 2;
    lines.push("人设技能「摇人」生效：全队出力 +2。");
  }
  const requirement = challengeRequirement(players.length, plan?.difficulty ?? 2);
  const passed = total >= requirement;
  const reveal = players
    .map((player) => `${getMember(game, player.memberId).name} ${amounts.get(player.memberId) ?? 0}`)
    .join(" / ");
  lines.push(`揭榜：${reveal}`, `总出力 ${total} / 需要 ${requirement}`);
  game.challengeAttempts = (game.challengeAttempts ?? 0) + 1;

  const maxAmount = Math.max(...amounts.values());
  const minAmount = Math.min(...amounts.values());
  const topPlayers = players.filter((player) => (amounts.get(player.memberId) ?? 0) === maxAmount);
  const mvp = topPlayers.sort(
    (a, b) => getMember(game, b.memberId).stats.reliability - getMember(game, a.memberId).stats.reliability,
  )[0];

  const lowPlayers = players.filter((player) => (amounts.get(player.memberId) ?? 0) === minAmount);
  const loser = lowPlayers.sort(
    (a, b) => getMember(game, a.memberId).stats.reliability - getMember(game, b.memberId).stats.reliability,
  )[0];

  let headline: string;
  let detail: string;

  if (passed) {
    for (const player of players) player.gp += 1;
    mvp.gp += 2;
    game.passedChallenges += 1;
    headline = "挑战通过";
    detail = `全群 +1；${getMember(game, mvp.memberId).name} 出力最高 +2。`;
    lines.push(`最低贡献：${getMember(game, loser.memberId).name}（${minAmount} 点，摸鱼标记）`);
  } else {
    const saved = skillUsedBy(game, "save_group");
    if (!saved) {
      for (const player of players) player.gp -= 1;
    }
    loser.gp -= 2;
    loser.scapegoat += 1;
    headline = "挑战失败";
    detail = `${saved ? "老好人兜底，全群免扣" : "全群 -1"}；${getMember(game, loser.memberId).name} 背锅 -2。`;
    if (saved) lines.push("人设技能「老好人」生效：全群免扣。");

    const blameTarget = getPlayer(game, loser.played?.targetId);
    if (loser.played?.kind === "blame" && blameTarget && !blameTarget.eliminated) {
      loser.scapegoat = Math.max(0, loser.scapegoat - 1);
      blameTarget.scapegoat += 1;
      loser.gp += 1;
      blameTarget.gp -= 1;
      lines.push(`甩锅生效：${getMember(game, loser.memberId).name} 把锅转给了 ${getMember(game, blameTarget.memberId).name}。`);
    }
  }

  return { headline, detail, lines, meta: { mvpId: mvp.memberId, maxAmount } };
}

function applyVerdict(
  game: GameState,
  player: PlayerState,
  member: Member,
  verdict: PersonaVerdict,
  lines: string[],
): void {
  if (player.eliminated) return;
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
  const spotlight = getCurrentPlan(game)?.twist?.key === "spotlight";
  const amount = spotlight ? 2 : 1;
  const line =
    verdict.line?.trim() ||
    (delta === 1
      ? `${member.name} 的「${label}」很像${tag || "自己的人设"}，人设 +${amount}`
      : `${member.name} 居然「${label}」，和${tag || "自己的人设"}不符，出戏 -${amount}`);
  const finalLine = spotlight ? `${line}（聚光灯 ×2）` : line;

  if (delta === 1) {
    player.gp += amount;
    player.personaHits += 1;
    lines.push(finalLine);
    game.log.push({ id: uid("persona"), kind: "host", author: "群主", emoji: "📣", text: finalLine, tone: "good" });
  } else {
    player.gp -= amount;
    player.ooc += 1;
    lines.push(finalLine);
    game.log.push({ id: uid("persona"), kind: "host", author: "群主", emoji: "📣", text: finalLine, tone: "bad" });
  }
}

function applyPersonaChecksLocal(game: GameState): string[] {
  const lines: string[] = [];
  for (const player of activePlayers(game)) {
    if (!player.played) continue;
    const member = getMember(game, player.memberId);
    const verdict = judgePersonaLocal(player.memberId, member.name, member.tags, player.played);
    applyVerdict(game, player, member, verdict, lines);
  }
  return lines;
}

function buildPersonaRequest(game: GameState): PersonaJudgeRequest {
  const prompt = getRoundPrompt(game.config, game.round, activePlayers(game).length);
  return {
    ruleType: getCurrentRuleType(game),
    round: game.round,
    event: prompt.title,
    players: activePlayers(game)
      .filter((player) => player.played)
      .map((player) => {
        const member = getMember(game, player.memberId);
        const target = getPlayer(game, player.played?.targetId);
        const chats = game.log
          .filter((message) => message.kind === "chat" && message.memberId === player.memberId && message.text)
          .slice(-2)
          .map((message) => message.text);
        return {
          id: player.memberId,
          name: member.name,
          tags: member.tags,
          chat: chats.length > 0 ? chats : undefined,
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
    for (const player of activePlayers(game)) {
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
  const maxContribution = Math.max(0, ...game.players.map((player) => player.totalContribution));
  const attempts = game.challengeAttempts ?? 0;
  const passedAll = attempts > 0 && game.passedChallenges === attempts;

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
        done = player.goalLotId ? player.wonLots.includes(player.goalLotId) : player.wonLots.length > 0;
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
        done = passedAll && player.zeroRounds >= 1;
        break;
      case "mvp":
        done = player.totalContribution === maxContribution && maxContribution > 0;
        break;
      case "blame_target":
        done = (target?.scapegoat ?? 0) > 0;
        break;
      case "save_group":
        done = passedAll;
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
  const active = activePlayers(game);
  const push = (line: string) => {
    lines.push(line);
    game.log.push({ id: uid("skill"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "glow" });
  };

  for (const player of active) {
    if (!player.played?.useSkill) continue;
    const member = getMember(game, player.memberId);

    if (player.skillKey === "extra_gp") {
      player.gp += 2;
      push(`${member.name} 发动「这单我熟」，+2 群地位`);
    } else if (player.skillKey === "radio") {
      for (const target of active) target.gp += 1;
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
    } else if (player.skillKey === "steal") {
      const richest = [...active]
        .filter((target) => target.memberId !== player.memberId)
        .sort((a, b) => b.gp - a.gp)[0];
      if (richest && richest.gp > 0) {
        richest.gp -= 1;
        player.gp += 1;
        push(`${member.name} 发动「顺手牵羊」，从 ${getMember(game, richest.memberId).name} 手里拿走 1 点`);
      }
    } else if (player.skillKey === "shield") {
      push(`${member.name} 把「我有人罩」放在桌上：本事件不会被淘汰`);
    }
  }

  return lines;
}

function isSlackPlay(player: PlayerState): boolean {
  const choice = player.played;
  return Boolean(
    choice &&
      (choice.kind === "pass" ||
        choice.kind === "abstain" ||
        choice.kind === "blame" ||
        (choice.kind === "contribute" && (choice.contribution ?? 0) === 0)),
  );
}

function applyTwistAfterSkills(game: GameState): { lines: string[]; skipElimination: boolean } {
  const twist = getCurrentPlan(game)?.twist;
  const lines: string[] = [];
  if (!twist) return { lines, skipElimination: false };

  const push = (line: string) => {
    lines.push(line);
    game.log.push({ id: uid("twist"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "glow" });
  };
  const active = activePlayers(game);

  if (twist.key === "generous") {
    for (const player of active) player.gp += 1;
    push("变数「群主请客」：所有存活玩家 +1。");
  } else if (twist.key === "anonymous") {
    push("变数「匿名模式」：本事件关闭人设判定。");
  } else if (twist.key === "amnesty") {
    push("变数「缓刑」：本事件无人出局。");
  } else if (twist.key === "comeback") {
    const lowest = [...active].sort((a, b) => a.gp - b.gp || a.memberId.localeCompare(b.memberId))[0];
    if (lowest) {
      lowest.gp += 2;
      push(`变数「逆风翻盘」：${getMember(game, lowest.memberId).name} +2。`);
    }
  } else if (twist.key === "tax") {
    const sorted = [...active].sort((a, b) => b.gp - a.gp || a.memberId.localeCompare(b.memberId));
    const richest = sorted[0];
    const poorest = sorted[sorted.length - 1];
    if (richest && poorest && richest.memberId !== poorest.memberId) {
      richest.gp -= 1;
      poorest.gp += 1;
      push(
        `变数「群费征收」：${getMember(game, richest.memberId).name} -1，${getMember(game, poorest.memberId).name} +1。`,
      );
    }
  } else if (twist.key === "spotlight") {
    push("变数「聚光灯」：本事件人设判定双倍（+2 / -2）。");
  } else if (twist.key === "swap") {
    const sorted = [...active].sort((a, b) => b.gp - a.gp || a.memberId.localeCompare(b.memberId));
    const richest = sorted[0];
    const poorest = sorted[sorted.length - 1];
    if (richest && poorest && richest.memberId !== poorest.memberId) {
      const richestGp = richest.gp;
      richest.gp = poorest.gp;
      poorest.gp = richestGp;
      push(
        `变数「贫富互换」：${getMember(game, richest.memberId).name} 与 ${getMember(game, poorest.memberId).name} 互换群地位。`,
      );
    }
  } else if (twist.key === "silence") {
    push("变数「断网」：本事件所有人设技能失效。");
  }

  return { lines, skipElimination: twist.key === "amnesty" };
}

function applyBounty(game: GameState, base: BaseResolution, before: Map<string, number>): string[] {
  const bounty = getCurrentPlan(game)?.bounty;
  if (!bounty) return [];

  const active = activePlayers(game);
  let targets: PlayerState[] = [];

  if (bounty.key === "proposer") {
    targets = active.filter((player) => player.memberId === base.meta?.proposerId);
  } else if (bounty.key === "cheap_win") {
    targets =
      base.meta?.maxBid === 1
        ? active.filter((player) => player.memberId === base.meta?.winnerId)
        : [];
  } else if (bounty.key === "mvp" || (bounty.key === "risky" && getCurrentRuleType(game) === "escape")) {
    targets = active.filter((player) => player.memberId === base.meta?.mvpId);
  } else if (bounty.key === "risky") {
    targets = active.filter((player) => player.memberId === base.meta?.winnerId);
  } else if (bounty.key === "meme") {
    const memers = active.filter((player) => player.played?.kind === "meme");
    memers.sort((a, b) => {
      const custom = Number(Boolean(b.played?.memeText?.trim())) - Number(Boolean(a.played?.memeText?.trim()));
      if (custom !== 0) return custom;
      return (
        getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence
      );
    });
    targets = memers.slice(0, 1);
  } else if (bounty.key === "underbid") {
    const pool = active
      .filter((player) => player.played?.kind === "underbid")
      .sort(
        (a, b) =>
          getMember(game, b.memberId).stats.reliability -
          getMember(game, a.memberId).stats.reliability,
      );
    targets = pool.slice(0, 1);
  } else if (bounty.key === "no_skill") {
    const pool = active
      .filter((player) => !player.played?.useSkill)
      .sort((a, b) => a.gp - b.gp || a.memberId.localeCompare(b.memberId));
    targets = pool.slice(0, 1);
  } else if (bounty.key === "slacker") {
    targets = active.filter(isSlackPlay);
  } else if (bounty.key === "comeback") {
    const pool = [...active].sort(
      (a, b) =>
        (before.get(a.memberId) ?? a.gp) - (before.get(b.memberId) ?? b.gp) ||
        a.memberId.localeCompare(b.memberId),
    );
    targets = pool.slice(0, 1);
  }

  const unique = [...new Map(targets.filter((player) => !player.eliminated).map((player) => [player.memberId, player])).values()];
  if (unique.length === 0) {
    const line = `悬赏「${bounty.title}」本事件无人达成。`;
    game.log.push({ id: uid("bounty"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "normal" });
    return [line];
  }

  for (const player of unique) player.gp += bounty.reward;
  const names = unique.map((player) => getMember(game, player.memberId).name).join("、");
  const line = `悬赏「${bounty.title}」：${names} +${bounty.reward}${unique.length > 1 ? " 每人" : ""}。`;
  game.log.push({ id: uid("bounty"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "good" });
  return [line];
}

interface EliminationResult {
  lines: string[];
  eliminatedIds: string[];
}

function eliminateLowest(game: GameState): EliminationResult {
  const lines: string[] = [];
  const eliminatedIds: string[] = [];
  const active = activePlayers(game);
  if (active.length <= 1) return { lines, eliminatedIds };

  const order = [...active].sort((a, b) => {
    if (a.gp !== b.gp) return a.gp - b.gp;
    if (a.personaHits !== b.personaHits) return a.personaHits - b.personaHits;
    const influenceA = getMember(game, a.memberId).stats.influence;
    const influenceB = getMember(game, b.memberId).stats.influence;
    if (influenceA !== influenceB) return influenceA - influenceB;
    return a.memberId.localeCompare(b.memberId);
  });

  const soloHuman = game.players.filter((player) => player.isHuman).length === 1;
  const shieldProtected = new Set(
    order
      .filter((player) => player.played?.useSkill && player.skillKey === "shield")
      .map((player) => player.memberId),
  );
  const candidates = order.filter(
    (player) => !shieldProtected.has(player.memberId) && !(soloHuman && player.isHuman),
  );
  const victim = candidates[0];

  if (!victim) {
    const line = "本事件无人出局：护身与主角保护同时生效，牌桌继续。";
    lines.push(line);
    game.log.push({ id: uid("host"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "good" });
    return { lines, eliminatedIds };
  }

  if (order[0].memberId !== victim.memberId) {
    if (shieldProtected.has(order[0].memberId)) {
      const member = getMember(game, order[0].memberId);
      const line = `${member.name} 的「我有人罩」生效，免于出局。`;
      lines.push(line);
      game.log.push({ id: uid("skill"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "good" });
    }
    if (soloHuman && order[0].isHuman) {
      const member = getMember(game, order[0].memberId);
      const line = `单人局主角保护：${member.name} 不会被淘汰，改判 ${getMember(game, victim.memberId).name} 出局。`;
      lines.push(line);
      game.log.push({ id: uid("solo"), kind: "host", author: "群主", emoji: "📣", text: line, tone: "good" });
    }
  }

  victim.eliminated = true;
  victim.eliminatedAt = game.round;
  eliminatedIds.push(victim.memberId);
  const member = getMember(game, victim.memberId);
  const line = `出局：${member.name} 群地位 ${victim.gp} 点，成为本事件最低。`;
  lines.push(line);
  game.log.push({ id: uid("out"), kind: "result", text: line, tone: "bad" });
  if (victim.isHuman) {
    game.log.push({
      id: uid("sys"),
      kind: "system",
      text: `${member.name} 已出局，进入观战席；还可以继续在群里聊天。`,
    });
  } else {
    game.log.push({
      id: uid("chat"),
      kind: "chat",
      memberId: member.id,
      author: member.name,
      emoji: member.emoji,
      text: "行吧，这波不亏。",
      at: Date.now(),
    });
  }

  return { lines, eliminatedIds };
}

async function resolveRound(game: GameState): Promise<GameState> {
  const next = clone(game);
  const plan = getCurrentPlan(next);
  const kind = plan?.kind ?? next.config.ruleType;

  for (const player of activePlayers(next)) {
    if (!player.played) {
      const choice = decideGhost(next, player);
      applyPlayerAction(next, player, choice, true);
    }
  }

  const before = new Map(next.players.map((player) => [player.memberId, player.gp]));
  let base: BaseResolution;

  if (kind === "negotiation") base = resolveNegotiation(next);
  else if (kind === "bidding") base = resolveBidding(next);
  else base = resolveEscape(next);

  const anonymous = plan?.twist?.key === "anonymous";
  const persona = anonymous
    ? { lines: [] as string[], source: "local" as const }
    : await applyPersonaChecksWithLLM(next);
  const personaLines = persona.lines;
  const skillLines = plan?.twist?.key === "silence" ? [] : applySkillEffects(next);
  const twistResult = applyTwistAfterSkills(next);
  const twistLines = twistResult.lines;
  const bountyLines = applyBounty(next, base, before);

  const activeBefore = activePlayers(next);
  const humansBefore = activeHumans(next).length;
  const maxEvents = next.config.maxEvents ?? next.config.rounds ?? 3;
  const maxReached = next.round >= maxEvents;
  let eliminationLines: string[] = [];
  let eliminatedIds: string[] = [];

  if (!maxReached && humansBefore > 0 && activeBefore.length > 1 && !twistResult.skipElimination) {
    const elimination = eliminateLowest(next);
    eliminationLines = elimination.lines;
    eliminatedIds = elimination.eliminatedIds;
  }

  const activeAfter = activePlayers(next);
  const humansAfter = activeAfter.filter((player) => player.isHuman).length;
  const done = maxReached || activeAfter.length <= 1 || humansAfter === 0;
  let goalLines: string[] = [];
  let winnerId: string | undefined;

  if (done) {
    goalLines = evaluateGoals(next);
    const ranked = rankPlayers(next);
    const winner = ranked[0];
    winnerId = winner?.memberId;
    if (winner) {
      const member = getMember(next, winner.memberId);
      const survivors = activeAfter.length;
      const line = maxReached
        ? `本局结束：${member.name} 以 ${winner.gp} 点拿下最高群地位。`
        : humansAfter === 0
          ? `真人全部出局，本局结束：${member.name} 以 ${winner.gp} 点拿下最高群地位。`
          : `本局结束：${member.name} 活到最后，场上剩 ${survivors} 人。`;
      goalLines.push(line);
      next.log.push({ id: uid("champion"), kind: "result", text: line, tone: "glow" });
    }
  }

  const deltas: Record<string, number> = {};
  for (const player of next.players) {
    deltas[player.memberId] = player.gp - (before.get(player.memberId) ?? player.gp);
  }

  const result: RoundResult = {
    round: next.round,
    headline: base.headline,
    detail: base.detail,
    lines: [
      ...base.lines,
      ...twistLines,
      ...bountyLines,
      ...personaLines,
      ...skillLines,
      ...eliminationLines,
      ...goalLines,
    ],
    deltas,
    personaLine: personaLines[0],
    judgeSource: anonymous ? undefined : persona.source,
    eliminatedIds,
    winnerId,
  };

  next.lastResult = result;
  next.history.push(result);
  next.phase = done ? "done" : "resolve";
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
  const nextHuman = next.players.findIndex((player) => player.isHuman && !player.eliminated);
  next.pendingIndex = nextHuman >= 0 ? nextHuman : 0;
  for (const player of next.players) {
    player.played = null;
    if (!player.eliminated) player.tokens = 2;
  }
  const prompt = getRoundPrompt(next.config, next.round, activePlayers(next).length);
  next.log.push({
    id: uid("round"),
    kind: "system",
    text: `第 ${next.round} / ${next.config.maxEvents ?? next.config.rounds} 个事件 · ${prompt.title} · 场上 ${activePlayers(next).length} 人`,
  });
  next.log.push({
    id: uid("host"),
    kind: "host",
    author: "群主",
    emoji: "📣",
    text: `新的随机事件：${prompt.title}。${prompt.subtitle}`,
    tone: "normal",
  });
  pushPlanBriefing(next);
  pushGhostChatter(next, 1);
  return next;
}

export function rankPlayers(game: GameState): PlayerState[] {
  return [...game.players].sort((a, b) => {
    if (Boolean(a.eliminated) !== Boolean(b.eliminated)) return a.eliminated ? 1 : -1;
    if (a.eliminated && b.eliminated) {
      const atA = a.eliminatedAt ?? 0;
      const atB = b.eliminatedAt ?? 0;
      if (atB !== atA) return atB - atA;
    }
    if (b.gp !== a.gp) return b.gp - a.gp;
    if (Number(b.goalDone) !== Number(a.goalDone)) return Number(b.goalDone) - Number(a.goalDone);
    return getMember(game, b.memberId).stats.influence - getMember(game, a.memberId).stats.influence;
  });
}

export function getMemberOf(game: GameState, player: PlayerState): Member {
  return getMember(game, player.memberId);
}

export function appendChatMessage(
  game: GameState,
  authorId: string,
  text: string,
  options?: { emoji?: string; image?: string; big?: boolean; id?: string },
): GameState {
  const member = game.config.members.find((item) => item.id === authorId);
  if (!member) return game;
  const next = clone(game);
  const message: ChatMessage = {
    id: options?.id ?? uid("chat"),
    kind: "chat",
    memberId: member.id,
    author: member.name,
    emoji: options?.emoji ?? member.emoji,
    avatar: member.emoji,
    text: text.trim().slice(0, 300),
    image: options?.image,
    big: options?.big,
    at: Date.now(),
  };
  next.log.push(message);
  return trimChatImages(next);
}

export function trimChatImages(game: GameState, maxImages = 6): GameState {
  const imageMessages = game.log.filter((message) => message.kind === "chat" && message.image);
  if (imageMessages.length <= maxImages) return game;
  const drop = new Set(imageMessages.slice(0, imageMessages.length - maxImages).map((message) => message.id));
  return {
    ...game,
    log: game.log.map((message) =>
      drop.has(message.id)
        ? { ...message, image: undefined, text: message.text || "（旧图片已压缩清理）" }
        : message,
    ),
  };
}
