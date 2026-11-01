import type {
  Bounty,
  Challenge,
  ChatSignal,
  EventPlan,
  GameConfig,
  GameEvent,
  Lot,
  Member,
  RuleType,
  Twist,
} from "./types";

export interface RuleChoice {
  ruleType: RuleType;
  reason: string;
  scores: Record<RuleType, number>;
}

const RULE_LABELS: Record<RuleType, string> = {
  negotiation: "《今晚谁去拿外卖》",
  bidding: "《最后一个插座》",
  escape: "《宿管来了》",
};

export function selectRule(signals: ChatSignal): RuleChoice {
  const scores: Record<RuleType, number> = {
    negotiation: signals.negotiation,
    bidding: signals.bidding,
    escape: signals.escape,
  };
  const sorted = (Object.entries(scores) as [RuleType, number][]).sort((a, b) => b[1] - a[1]);
  const [topRule, topScore] = sorted[0];
  const lead = topScore - sorted[1][1];
  const leadText = lead > 0 ? `，领先 ${lead} 分` : "，三类信号很接近";
  const signalText =
    topRule === "negotiation"
      ? "「谁去 / 外卖 / 上次」的信号最强"
      : topRule === "bidding"
        ? "「最后一个 / 插座 / 空调」的信号最强"
        : "「查寝 / 停电 / 蟑螂」的信号最强";

  return {
    ruleType: topRule,
    reason: `你们群最近有 ${signals.totalMessages} 条消息、${signals.memeCount} 次接梗；${signalText}（${topScore} 分${leadText}）。本局以${RULE_LABELS[topRule]}的信号为主，事件牌堆会把谈判、竞标、逃脱混在一起随机抽。`,
    scores,
  };
}

interface TaskSeed {
  id: string;
  kind: RuleType;
  title: string;
  quote: string;
  stakes: string;
  difficulty: number;
  lotId?: string;
  challengeId?: string;
}

const NEGOTIATION_TASKS: TaskSeed[] = [
  {
    id: "neg-waimai",
    kind: "negotiation",
    title: "外卖到了，没人下楼",
    quote: "谁的外卖？放门口了。再没人拿，全宿舍吃凉的。",
    stakes: "失败：全群 -1，群主指定一个人背锅",
    difficulty: 2,
  },
  {
    id: "neg-shuifei",
    kind: "negotiation",
    title: "水费该交了，没人想当坏人",
    quote: "谁去群里收一下钱？上次收钱的人已经被拉黑了。",
    stakes: "失败：今晚停水，全群 -1",
    difficulty: 2,
  },
  {
    id: "neg-suguan",
    kind: "negotiation",
    title: "宿管在楼下抓外卖",
    quote: "谁下去把袋子拿上来？被抓到就是全群通报。",
    stakes: "失败：全群通报，背锅者 -3",
    difficulty: 3,
  },
  {
    id: "neg-paomian",
    kind: "negotiation",
    title: "最后一包泡面归谁",
    quote: "开水已经烧好了，泡面只剩一包。谁去谁吃，还是让给熬夜的人？",
    stakes: "失败：全群饿到天亮，全群 -1",
    difficulty: 1,
  },
  {
    id: "neg-kongtiao",
    kind: "negotiation",
    title: "空调温度谈判",
    quote: "一个要 24 度，一个要 28 度，遥控器在中间人手里。",
    stakes: "失败：全群睡不好，全群 -1",
    difficulty: 2,
  },
  {
    id: "neg-dalaji",
    kind: "negotiation",
    title: "谁去倒垃圾",
    quote: "垃圾桶已经溢出来了，袋子还漏汤。再没人动，整个走廊都是你们宿舍的味道。",
    stakes: "失败：全群 -1，走廊名声 -1",
    difficulty: 1,
  },
  {
    id: "neg-kuaidi",
    kind: "negotiation",
    title: "半夜的快递谁去拿",
    quote: "快递柜 23:59 关门，里面是别人等了半个月的东西。",
    stakes: "失败：快递被退回，全群 -1",
    difficulty: 2,
  },
];

const BIDDING_TASKS: TaskSeed[] = [
  {
    id: "bid-outlet",
    kind: "bidding",
    title: "最后一个插座",
    quote: "深夜开黑的生命线，谁插上谁就是全宿舍的义父。",
    stakes: "暗标竞价，出价即支付；价值只有自己知道",
    difficulty: 1,
    lotId: "lot-outlet",
  },
  {
    id: "bid-ac",
    kind: "bidding",
    title: "空调遥控器",
    quote: "24 度还是 26 度，这是一场关于体感主权的战争。",
    stakes: "暗标竞价，出价即支付；价值只有自己知道",
    difficulty: 1,
    lotId: "lot-ac",
  },
  {
    id: "bid-shower",
    kind: "bidding",
    title: "今晚洗澡优先权",
    quote: "热水只够两个人，先到先得，后到洗冷水。",
    stakes: "暗标竞价，出价即支付；价值只有自己知道",
    difficulty: 2,
    lotId: "lot-shower",
  },
  {
    id: "bid-chair",
    kind: "bidding",
    title: "宿舍唯一一把电竞椅",
    quote: "坐上去的人，今晚就是全宿舍的排面。",
    stakes: "暗标竞价，出价即支付；价值只有自己知道",
    difficulty: 2,
    lotId: "lot-chair",
  },
  {
    id: "bid-dryer",
    kind: "bidding",
    title: "宿舍唯一一台吹风机",
    quote: "洗完头才发现吹风机在别人床上，今晚谁先洗谁先吹。",
    stakes: "暗标竞价，出价即支付；价值只有自己知道",
    difficulty: 1,
    lotId: "lot-dryer",
  },
  {
    id: "bid-window",
    kind: "bidding",
    title: "靠窗的下铺",
    quote: "能晒到太阳、能吹到风、还能第一个发现外卖到了的黄金床位。",
    stakes: "暗标竞价，出价即支付；价值只有自己知道",
    difficulty: 3,
    lotId: "lot-window",
  },
];

const ESCAPE_TASKS: TaskSeed[] = [
  {
    id: "esc-chaqin",
    kind: "escape",
    title: "宿管突击查寝",
    quote: "锅还在桌上，人都在床上，谁去处理？",
    stakes: "总出力不够就全群背锅",
    difficulty: 2,
    challengeId: "ch-chaqin",
  },
  {
    id: "esc-dianting",
    kind: "escape",
    title: "突然停电",
    quote: "整层楼黑了，手机电量只剩 8%，谁去找电闸？",
    stakes: "总出力不够就全群摸黑",
    difficulty: 2,
    challengeId: "ch-dianting",
  },
  {
    id: "esc-zhanglang",
    kind: "escape",
    title: "蟑螂危机",
    quote: "会飞的那种。已经上墙了，谁先动手？",
    stakes: "总出力不够就全群失眠",
    difficulty: 1,
    challengeId: "ch-zhanglang",
  },
  {
    id: "esc-weisheng",
    kind: "escape",
    title: "卫生大检查",
    quote: "检查组十分钟后到，地上还有三双袜子。",
    stakes: "总出力不够就全群通报",
    difficulty: 3,
    challengeId: "ch-weisheng",
  },
  {
    id: "esc-fire",
    kind: "escape",
    title: "消防演练突击",
    quote: "警报响了，楼道全是人，宿舍里还有人戴着耳机打团。",
    stakes: "总出力不够就全群被记名",
    difficulty: 2,
    challengeId: "ch-fire",
  },
  {
    id: "esc-hotwater",
    kind: "escape",
    title: "热水器坏了",
    quote: "满身泡沫的时候水变凉了，维修电话在客厅，扳手在床底。",
    stakes: "总出力不够就全群洗冷水",
    difficulty: 2,
    challengeId: "ch-hotwater",
  },
];

const LOT_DEFS: Record<string, Omit<Lot, "values">> = {
  "lot-outlet": {
    id: "lot-outlet",
    name: "最后一个插座",
    flavor: "深夜开黑的生命线，谁插上谁就是全宿舍的义父。",
  },
  "lot-ac": {
    id: "lot-ac",
    name: "空调遥控器",
    flavor: "24 度还是 26 度，这是一场关于体感主权的战争。",
  },
  "lot-shower": {
    id: "lot-shower",
    name: "今晚洗澡优先权",
    flavor: "热水只够两个人，先到先得，后到洗冷水。",
  },
  "lot-chair": {
    id: "lot-chair",
    name: "宿舍唯一一把电竞椅",
    flavor: "坐上去的人，今晚就是全宿舍的排面。",
  },
  "lot-dryer": {
    id: "lot-dryer",
    name: "宿舍唯一一台吹风机",
    flavor: "谁先洗完谁先吹，晚一步就只能自然风干。",
  },
  "lot-window": {
    id: "lot-window",
    name: "靠窗的下铺",
    flavor: "有太阳、有风、离外卖最近，宿舍的黄金地段。",
  },
};

const CHALLENGE_DEFS: Record<string, Omit<Challenge, "requirement">> = {
  "ch-chaqin": {
    id: "ch-chaqin",
    name: "把锅藏进衣柜",
    flavor: "宿管已经上到二楼了，锅还在桌上冒热气。",
  },
  "ch-dianting": {
    id: "ch-dianting",
    name: "摸黑找到电闸",
    flavor: "整层楼停电，手机电量告急，走廊伸手不见五指。",
  },
  "ch-zhanglang": {
    id: "ch-zhanglang",
    name: "处理会飞的蟑螂",
    flavor: "它上墙了。没有人愿意承认自己害怕。",
  },
  "ch-weisheng": {
    id: "ch-weisheng",
    name: "十分钟清理现场",
    flavor: "泡面桶、外卖袋、三双袜子，检查组马上到。",
  },
  "ch-fire": {
    id: "ch-fire",
    name: "把所有人叫下楼",
    flavor: "警报已经响了两分钟，还有人问能不能打完这把。",
  },
  "ch-hotwater": {
    id: "ch-hotwater",
    name: "修好热水器",
    flavor: "满身泡沫的室友在浴室里唱歌，维修电话一直占线。",
  },
};

function lotValue(member: Member, lotId: string, index: number): number {
  if (lotId === "lot-outlet") {
    if (member.tags.includes("游戏代练")) return 3;
    if (member.tags.includes("群主候补")) return 2;
    return index % 3 === 0 ? 2 : 1;
  }
  if (lotId === "lot-ac") {
    if (member.tags.includes("空调管理员")) return 3;
    if (member.tags.includes("深夜emo") || member.tags.includes("深夜emo诗人")) return 2;
    return index % 2 === 0 ? 2 : 1;
  }
  if (lotId === "lot-shower") {
    if (member.tags.includes("早起冠军") || member.tags.includes("健身狂魔")) return 3;
    return index % 3 === 0 ? 2 : 1;
  }
  if (lotId === "lot-dryer") {
    if (member.tags.includes("宿舍广播") || member.tags.includes("气氛组")) return 3;
    if (member.tags.includes("深夜emo") || member.tags.includes("深夜emo诗人")) return 2;
    return index % 2 === 0 ? 2 : 1;
  }
  if (lotId === "lot-window") {
    if (member.tags.includes("早起冠军") || member.tags.includes("健身狂魔")) return 3;
    if (member.tags.includes("游戏代练") || member.tags.includes("夜班保安")) return 2;
    return index % 3 === 1 ? 2 : 1;
  }
  if (member.tags.includes("寝室长")) return 3;
  if (member.tags.includes("夜班保安") || member.tags.includes("游戏代练")) return 2;
  return index % 3 === 1 ? 2 : 1;
}

function buildLot(memberList: Member[], lotId: string): Lot {
  const def = LOT_DEFS[lotId] ?? Object.values(LOT_DEFS)[0];
  const values: Record<string, number> = {};
  memberList.forEach((member, index) => {
    values[member.id] = lotValue(member, def.id, index);
  });
  return { ...def, values };
}

function buildChallenge(challengeId: string): Challenge {
  const def = CHALLENGE_DEFS[challengeId] ?? Object.values(CHALLENGE_DEFS)[0];
  return { ...def, requirement: 6 };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let value = seed || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    value = (value * 1664525 + 1013904223) % 4294967296;
    const j = value % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickPlans(members: Member[], maxEvents: number, seed: number): EventPlan[] {
  const picked: TaskSeed[] = [
    NEGOTIATION_TASKS[seed % NEGOTIATION_TASKS.length],
    BIDDING_TASKS[(seed + 1) % BIDDING_TASKS.length],
    ESCAPE_TASKS[(seed + 2) % ESCAPE_TASKS.length],
  ];
  const rest = seededShuffle(
    [...NEGOTIATION_TASKS, ...BIDDING_TASKS, ...ESCAPE_TASKS].filter(
      (task) => !picked.some((item) => item.id === task.id),
    ),
    seed + 7,
  );

  while (picked.length < maxEvents && rest.length > 0) {
    picked.push(rest.shift()!);
  }

  const shuffled = seededShuffle(picked, seed + 13);
  const twists = seededShuffle(TWISTS, seed + 21);
  const usedLots = new Set<string>();
  const usedChallenges = new Set<string>();

  return shuffled.map((task, index) => {
    let lot: Lot | undefined;
    let challenge: Challenge | undefined;
    if (task.kind === "bidding") {
      let lotId = task.lotId;
      if (!lotId || usedLots.has(lotId)) {
        lotId = Object.keys(LOT_DEFS).find((id) => !usedLots.has(id)) ?? task.lotId;
      }
      if (lotId) {
        usedLots.add(lotId);
        lot = buildLot(members, lotId);
      }
    }
    if (task.kind === "escape") {
      let challengeId = task.challengeId;
      if (!challengeId || usedChallenges.has(challengeId)) {
        challengeId = Object.keys(CHALLENGE_DEFS).find((id) => !usedChallenges.has(id)) ?? task.challengeId;
      }
      if (challengeId) {
        usedChallenges.add(challengeId);
        challenge = buildChallenge(challengeId);
      }
    }
    const twist = twists[index % twists.length];
    const bountyPool = BOUNTY_POOLS[task.kind];
    const bounty = bountyPool[(seed + index * 3) % bountyPool.length];
    return {
      id: `plan-${index + 1}-${task.id}`,
      kind: task.kind,
      title: task.kind === "bidding" && lot ? `拍品：${lot.name}` : task.kind === "escape" && challenge ? `挑战：${challenge.name}` : task.title,
      quote: task.kind === "bidding" && lot ? lot.flavor : task.kind === "escape" && challenge ? challenge.flavor : task.quote,
      stakes: task.stakes,
      difficulty: task.difficulty,
      lot,
      challenge,
      twist,
      bounty,
    };
  });
}

export const GENERAL_RULE_SHEET = [
  "每局 8–9 个随机事件：谈判 / 竞标 / 逃脱轮换出现，每个事件规则不同。",
  "每个事件还会抽 1 个变数和 1 个悬赏；变数改规则，悬赏给额外分。",
  "事件结算后，群地位最低的人当场出局；群地位相同看人设命中，再看影响力。",
  "场上只剩 1 人，或本局事件全部结束，本局结束；幸存者中群地位最高者获胜。",
  "像你的人设 +1，出戏 -1；隐藏诉求在终局揭晓并 +3。技能每局只能发动一次。",
];

const TWISTS: Twist[] = [
  {
    key: "generous",
    title: "群主请客",
    desc: "本事件结算后，所有存活玩家 +1。",
  },
  {
    key: "anonymous",
    title: "匿名模式",
    desc: "本事件关闭人设判定，标签不再加分或扣分。",
  },
  {
    key: "amnesty",
    title: "缓刑",
    desc: "本事件不淘汰任何人，最低分只拿警告。",
  },
  {
    key: "comeback",
    title: "逆风翻盘",
    desc: "本事件结算前，群地位最低的存活玩家 +2。",
  },
  {
    key: "tax",
    title: "群费征收",
    desc: "本事件结算后，最高分 -1，最低分 +1。",
  },
  {
    key: "spotlight",
    title: "聚光灯",
    desc: "本事件人设判定双倍：+2 / -2。",
  },
  {
    key: "swap",
    title: "贫富互换",
    desc: "本事件结算前，最高分与最低分互换群地位。",
  },
  {
    key: "silence",
    title: "断网",
    desc: "本事件所有人设技能失效，技能仍然会被消耗。",
  },
];

const BOUNTY_POOLS: Record<RuleType, Bounty[]> = {
  negotiation: [
    { key: "proposer", title: "提案之星", desc: "本事件提案通过的人 +2", reward: 2 },
    { key: "underbid", title: "抢活王", desc: "本事件抢活接单的人 +1", reward: 1 },
    { key: "meme", title: "爆梗王", desc: "本事件甩梗/自定义爆梗的人 +2（群主挑一位）", reward: 2 },
    { key: "no_skill", title: "省技能", desc: "本事件没用技能的人里，分最低的 +1", reward: 1 },
    { key: "slacker", title: "摸鱼奖", desc: "本事件装死/弃权/0 出力的人各 +1", reward: 1 },
    { key: "comeback", title: "逆袭位", desc: "本事件结算前最低分 +1", reward: 1 },
  ],
  bidding: [
    { key: "cheap_win", title: "捡漏王", desc: "用 1 点拿下拍品的人 +2", reward: 2 },
    { key: "risky", title: "冒险家", desc: "本事件出价最高的人 +1", reward: 1 },
    { key: "no_skill", title: "省技能", desc: "本事件没用技能的人里，分最低的 +1", reward: 1 },
    { key: "slacker", title: "摸鱼奖", desc: "本事件装死/弃权/0 出力的人各 +1", reward: 1 },
    { key: "comeback", title: "逆袭位", desc: "本事件结算前最低分 +1", reward: 1 },
  ],
  escape: [
    { key: "mvp", title: "出力之星", desc: "本事件出力最高的人 +2", reward: 2 },
    { key: "risky", title: "冒险家", desc: "本事件出力最高的人 +1", reward: 1 },
    { key: "no_skill", title: "省技能", desc: "本事件没用技能的人里，分最低的 +1", reward: 1 },
    { key: "slacker", title: "摸鱼奖", desc: "本事件装死/弃权/0 出力的人各 +1", reward: 1 },
    { key: "comeback", title: "逆袭位", desc: "本事件结算前最低分 +1", reward: 1 },
  ],
};


export const PLAN_RULE_SHEETS: Record<RuleType, string[]> = {
  negotiation: [
    "任意玩家可提案：指定一个人接活，并承诺 0–2 点补偿。",
    "过半同意即通过；提案人 +1，接活者拿补偿。",
    "没人接活：全群 -1，群主点名一个人背锅 -3。",
    "新动作：抢活 0 补偿接单，成功 +1；站队押人，押中 +1、押错 -1。",
  ],
  bidding: [
    "所有人暗标 0–3 点，同时揭标，价高者得并支付。",
    "同分看影响力；弃权直接 +1；双方互选联合各 +2。",
    "拍品价值只有自己知道；全员 0 点则流拍。",
  ],
  escape: [
    "每人本次事件有 2 点出力，暗选出力 0/1/2。",
    "总出力达到事件门槛即通过：全群 +1，MVP 额外 +2。",
    "失败时全群 -1，最低贡献者背锅 -2；可提前甩锅。",
  ],
};

export function buildConfig(
  groupName: string,
  ruleType: RuleType,
  members: Member[],
  signals: ChatSignal,
): GameConfig {
  const seedBase =
    Date.now() +
    Math.floor(Math.random() * 1_000_000) +
    signals.totalMessages * 31 +
    signals.negotiation * 7 +
    signals.bidding * 13 +
    signals.escape * 17 +
    groupName.length;
  const seed = Math.abs(seedBase) % 100000;
  const maxEvents = 8 + (seed % 2);
  const plans = pickPlans(members, maxEvents, seed);
  const events: GameEvent[] = plans.map((plan) => ({
    title: plan.title,
    quote: plan.quote,
    stakes: plan.stakes,
    difficulty: plan.difficulty,
  }));

  return {
    groupName,
    ruleType,
    ruleTitle: "《宿舍生存淘汰赛》",
    ruleSheet: GENERAL_RULE_SHEET,
    rounds: maxEvents,
    maxEvents,
    elimination: true,
    members,
    event: events[0],
    events,
    lots: plans.flatMap((plan) => (plan.lot ? [plan.lot] : [])),
    challenges: plans.flatMap((plan) => (plan.challenge ? [plan.challenge] : [])),
    plans,
    signals,
  };
}
