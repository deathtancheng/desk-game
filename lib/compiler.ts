import type { Challenge, ChatSignal, GameConfig, GameEvent, Lot, Member, RuleType } from "./types";

export interface RuleChoice {
  ruleType: RuleType;
  reason: string;
  scores: Record<RuleType, number>;
}

const RULE_LABELS: Record<RuleType, string> = {
  negotiation: "谈判局《今晚谁去拿外卖》",
  bidding: "竞标局《最后一个插座》",
  escape: "逃脱局《宿管来了》",
};

export function selectRule(signals: ChatSignal): RuleChoice {
  const scores: Record<RuleType, number> = {
    negotiation: signals.negotiation,
    bidding: signals.bidding,
    escape: signals.escape,
  };
  const sorted = (Object.entries(scores) as [RuleType, number][]).sort((a, b) => b[1] - a[1]);
  const [topRule, topScore] = sorted[0];
  const secondScore = sorted[1][1];
  const lead = topScore - secondScore;
  const leadText = lead > 0 ? `，领先 ${lead} 分` : "，三类信号很接近";
  const signalText =
    topRule === "negotiation"
      ? "「谁去 / 外卖 / 上次」的信号最强"
      : topRule === "bidding"
        ? "「最后一个 / 插座 / 空调」的信号最强"
        : "「查寝 / 停电 / 蟑螂」的信号最强";

  return {
    ruleType: topRule,
    reason: `你们群最近有 ${signals.totalMessages} 条消息、${signals.memeCount} 次接梗；${signalText}（${topScore} 分${leadText}），所以生成${RULE_LABELS[topRule]}。`,
    scores,
  };
}

function pickEvents(ruleType: RuleType, members: Member[], rounds: number): GameEvent[] {
  if (ruleType === "negotiation") {
    const events: GameEvent[] = [
      {
        title: "外卖到了，没人下楼",
        quote: "谁的外卖？放门口了。再没人拿，全宿舍吃凉的。",
        stakes: "失败：全群 -1，群主指定一个人背锅",
        difficulty: 2,
      },
      {
        title: "水费该交了，没人想当坏人",
        quote: "谁去群里收一下钱？上次收钱的人已经被拉黑了。",
        stakes: "失败：今晚停水，全群 -1",
        difficulty: 2,
      },
      {
        title: "宿管在楼下抓外卖",
        quote: "谁下去把袋子拿上来？被抓到就是全群通报。",
        stakes: "失败：全群通报，背锅者 -3",
        difficulty: 3,
      },
    ];
    return events.slice(0, Math.max(1, rounds));
  }

  if (ruleType === "bidding") {
    return [
      {
        title: "宿舍资源拍卖夜",
        quote: "最后一个插座、空调遥控器、今晚的洗澡优先权——价高者得。",
        stakes: `${rounds} 件拍品，暗标竞价，出价即支付`,
        difficulty: 1,
      },
    ];
  }

  return [
    {
      title: "宿管来了",
      quote: "突击查寝。锅还在桌上，人都在床上，谁去处理？",
      stakes: `${rounds} 个挑战，总出力不够就全群背锅`,
      difficulty: 2,
    },
  ];
}

function lotValue(member: Member, lotId: string, index: number): number {
  if (lotId === "lot-outlet") {
    if (member.tags.includes("游戏代练")) return 3;
    if (member.tags.includes("群主候补")) return 2;
    return index % 3 === 0 ? 2 : 1;
  }
  if (lotId === "lot-ac") {
    if (member.tags.includes("空调管理员")) return 3;
    if (member.tags.includes("深夜emo")) return 2;
    return index % 2 === 0 ? 2 : 1;
  }
  if (member.tags.includes("外卖部长") || member.tags.includes("背锅侠")) return 2;
  return index % 3 === 0 ? 3 : 1;
}

function buildLots(rounds: number, members: Member[]): Lot[] {
  const all: Omit<Lot, "values">[] = [
    { id: "lot-outlet", name: "最后一个插座", flavor: "深夜开黑的生命线，谁插上谁就是全宿舍的义父。" },
    { id: "lot-ac", name: "空调遥控器", flavor: "24 度还是 26 度，这是一场关于体感主权的战争。" },
    { id: "lot-shower", name: "今晚洗澡优先权", flavor: "热水只够两个人，先到先得，后到洗冷水。" },
  ];
  return all.slice(0, rounds).map((lot) => {
    const values: Record<string, number> = {};
    members.forEach((member, index) => {
      values[member.id] = lotValue(member, lot.id, index);
    });
    return { ...lot, values };
  });
}

function buildChallenges(rounds: number, playerCount: number): Challenge[] {
  const base = playerCount >= 6 ? 8 : playerCount === 5 ? 7 : playerCount === 4 ? 6 : 5;
  const all: Omit<Challenge, "requirement">[] = [
    { id: "ch-1", name: "把锅藏进衣柜", flavor: "三分钟，宿管已经上到二楼了。" },
    { id: "ch-2", name: "应付宿管点名", flavor: "点到谁，谁就要像一个真的在宿舍的人。" },
    { id: "ch-3", name: "清理现场", flavor: "泡面桶、外卖袋、和那只会飞的蟑螂。" },
  ];
  return all.slice(0, rounds).map((challenge, index) => ({
    ...challenge,
    requirement: base + index,
  }));
}

const RULE_TITLES: Record<RuleType, string> = {
  negotiation: "《今晚谁去拿外卖》",
  bidding: "《最后一个插座》",
  escape: "《宿管来了》",
};

const RULE_SHEETS: Record<RuleType, string[]> = {
  negotiation: [
    "每回合 1 个任务；任意玩家可提案：谁做 + 补偿 0–2 点。",
    "过半同意即通过；任务失败则接单人背锅。",
    "没人接活：全群 -1，群主指定一个人 -3。",
    "像你的人设 +1，出戏 -1；隐藏诉求达成 +3。",
  ],
  bidding: [
    "每回合 1 件拍品；所有人暗标 0–3 点，同时揭标。",
    "最高价得标并支付；同分看影响力。",
    "弃权 +1；两人互选联合各 +2；全员 0 点则流拍。",
    "拍品价值只有自己知道；隐藏诉求达成 +3。",
  ],
  escape: [
    "每回合 1 个挑战；每人全程 3 点出力，不恢复。",
    "暗选出力 0/1/2，总额达标即通过。",
    "最低贡献者吃摸鱼标记；失败则背锅。",
    "全群通关有奖励；隐藏诉求达成 +3。",
  ],
};

export function buildConfig(
  groupName: string,
  ruleType: RuleType,
  members: Member[],
  signals: ChatSignal,
  humans: number,
): GameConfig {
  const rounds = humans <= 3 ? 3 : 2;
  const events = pickEvents(ruleType, members, rounds);
  return {
    groupName,
    ruleType,
    ruleTitle: RULE_TITLES[ruleType],
    ruleSheet: RULE_SHEETS[ruleType],
    rounds,
    members,
    event: events[0],
    events,
    lots: buildLots(rounds, members),
    challenges: buildChallenges(rounds, members.length),
    signals,
  };
}
