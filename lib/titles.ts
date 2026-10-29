import type { GameState, PlayerState, Yearbook, YearbookEntry } from "./types";
import { getMemberOf, rankPlayers } from "./gameEngine";

function countActions(player: PlayerState, kinds: string[]): number {
  return player.actionHistory.filter((action) => kinds.includes(action.kind)).length;
}

function quoteFor(game: GameState, player: PlayerState, fallback: string): string {
  const member = getMemberOf(game, player);
  const own = game.log.filter((message) => message.kind === "player" && message.author === member.name);
  return own.length > 0 ? own[own.length - 1].text : fallback;
}

interface Metric {
  player: PlayerState;
  gp: number;
  scapegoat: number;
  persona: number;
  ooc: number;
  slack: number;
  blame: number;
  meme: number;
  support: number;
  pass: number;
  contribution: number;
}

function metricsFor(game: GameState): Metric[] {
  return game.players.map((player) => ({
    player,
    gp: player.gp,
    scapegoat: player.scapegoat,
    persona: player.personaHits,
    ooc: player.ooc,
    slack: player.zeroRounds + countActions(player, ["pass", "abstain"]),
    blame: countActions(player, ["blame"]),
    meme: countActions(player, ["meme"]),
    support: countActions(player, ["support"]),
    pass: countActions(player, ["pass", "abstain"]),
    contribution: player.totalContribution,
  }));
}

const TITLE_DEFS: { title: string; metric: keyof Omit<Metric, "player"> }[] = [
  { title: "群柱石", metric: "contribution" },
  { title: "年度最佳背锅侠", metric: "scapegoat" },
  { title: "群聊永动机", metric: "persona" },
  { title: "人设崩塌奖", metric: "ooc" },
  { title: "摸鱼冠军", metric: "slack" },
  { title: "太极宗师", metric: "blame" },
  { title: "最佳损友", metric: "meme" },
  { title: "最佳气氛组", metric: "support" },
  { title: "已读不回大师", metric: "pass" },
];

export function buildYearbook(game: GameState): Yearbook {
  const metrics = metricsFor(game);
  const assigned = new Set<string>();
  const titleMap = new Map<string, string>();

  for (const def of TITLE_DEFS) {
    const candidates = metrics
      .filter((metric) => !assigned.has(metric.player.memberId))
      .sort((a, b) => Number(b[def.metric]) - Number(a[def.metric]));
    const top = candidates[0];
    if (!top) continue;
    if (def.metric === "contribution" && top.contribution === 0) {
      const fallback = candidates.sort((a, b) => b.gp - a.gp)[0];
      if (!fallback) continue;
      titleMap.set(fallback.player.memberId, "群柱石");
      assigned.add(fallback.player.memberId);
      continue;
    }
    if (Number(top[def.metric]) <= 0) continue;
    titleMap.set(top.player.memberId, def.title);
    assigned.add(top.player.memberId);
  }

  for (const metric of metrics) {
    if (!titleMap.has(metric.player.memberId)) titleMap.set(metric.player.memberId, "最佳群友");
  }

  if (game.config.ruleType !== "escape") {
    for (const [memberId, title] of titleMap) {
      if (title === "群柱石") titleMap.set(memberId, "群聊话事人");
    }
  }

  const entries: YearbookEntry[] = rankPlayers(game).map((player) => {
    const member = getMemberOf(game, player);
    return {
      member,
      player,
      title: titleMap.get(player.memberId) ?? "最佳群友",
      quote: quoteFor(game, player, member.quote),
    };
  });

  const moments = [
    ...new Set(
      game.history
        .flatMap((result) => result.lines)
        .filter(
          (line) =>
            line.includes("出戏") ||
            line.includes("OOC") ||
            line.includes("背锅") ||
            line.includes("流拍") ||
            line.includes("隐藏诉求") ||
            line.includes("甩锅") ||
            line.includes("摸鱼"),
        ),
    ),
  ].slice(0, 3);

  if (moments.length < 3) {
    for (const result of game.history) {
      if (moments.length >= 3) break;
      if (!moments.includes(result.headline)) moments.push(result.headline);
    }
  }

  const values = {
    摸鱼: metrics.reduce((sum, metric) => sum + metric.slack, 0),
    接梗: metrics.reduce((sum, metric) => sum + metric.meme, 0),
    背锅: metrics.reduce((sum, metric) => sum + metric.scapegoat, 0),
    深夜: game.config.members.filter((member) => member.tags.some((tag) => tag.includes("深夜"))).length * 2,
    谈判: metrics.reduce((sum, metric) => sum + metric.support, 0) + metrics.reduce((sum, metric) => sum + metric.blame, 0),
    出手: metrics.reduce((sum, metric) => sum + metric.contribution, 0) + game.players.filter((player) => player.played?.kind === "bid").length,
  };
  const maxValue = Math.max(1, ...Object.values(values));
  const radar = Object.entries(values).map(([label, value]) => ({
    label,
    value: Math.max(12, Math.round((value / maxValue) * 100)),
  }));

  const top = rankPlayers(game)[0];
  const backstab = entries.find((entry) => entry.title === "年度最佳背锅侠");
  const summary = `${game.config.groupName} 的《${game.config.ruleTitle.replace(/[《》]/g, "")}》结束：${
    top ? getMemberOf(game, top).name : "群主"
  } 以 ${top?.gp ?? 0} 点成为本局群主${backstab ? `，${backstab.member.name} 拿下年度最佳背锅侠` : ""}。`;

  return { entries, moments, radar, summary };
}
