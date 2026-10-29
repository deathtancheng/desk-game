import type { ActionChoice, PersonaVerdict } from "./types";

export function actionLabel(choice: ActionChoice): string {
  switch (choice.kind) {
    case "propose":
      return "提议";
    case "support":
      return "附议";
    case "meme":
      return "梗料";
    case "pass":
      return "装死";
    case "volunteer":
      return "自荐";
    case "bid":
      return "暗标";
    case "abstain":
      return "弃权";
    case "coalition":
      return "联合";
    case "contribute":
      return "出力";
    case "blame":
      return "甩锅";
    default:
      return "行动";
  }
}

function actionFitsTag(tag: string, action: ActionChoice): boolean {
  if (tag === "已读不回" || tag === "摸鱼冠军" || tag === "游戏代练") {
    return (
      action.kind === "pass" ||
      action.kind === "abstain" ||
      (action.kind === "contribute" && (action.contribution ?? 0) === 0)
    );
  }
  if (tag === "群聊永动机" || tag === "群主候补") {
    return (
      action.kind === "propose" ||
      action.kind === "support" ||
      action.kind === "coalition" ||
      (action.kind === "bid" && (action.bid ?? 0) >= 2)
    );
  }
  if (tag === "背锅侠" || tag === "老好人") {
    return (
      action.kind === "volunteer" ||
      action.kind === "support" ||
      (action.kind === "contribute" && (action.contribution ?? 0) === 2)
    );
  }
  if (tag === "梗王") {
    return action.kind === "meme" || (action.kind === "bid" && (action.bid ?? 0) >= 2);
  }
  if (tag === "深夜emo" || tag === "深夜emo诗人") {
    return action.kind === "meme" || action.kind === "pass";
  }
  if (tag === "外卖部长") return action.kind === "volunteer" || action.kind === "support";
  if (tag === "考试周失踪人口") return action.kind === "pass";
  if (tag === "气氛组") return action.kind === "support" || action.kind === "meme";
  if (tag === "空调管理员") return action.kind === "propose";
  if (tag === "拼单之王") return action.kind === "support" || action.kind === "coalition";
  return false;
}

function actionContradictsTag(tag: string, action: ActionChoice): boolean {
  if (tag === "已读不回" || tag === "摸鱼冠军" || tag === "游戏代练") {
    return (
      action.kind === "volunteer" ||
      action.kind === "propose" ||
      (action.kind === "contribute" && (action.contribution ?? 0) === 2)
    );
  }
  if (tag === "背锅侠" || tag === "老好人") {
    return (
      action.kind === "pass" ||
      action.kind === "abstain" ||
      action.kind === "blame" ||
      (action.kind === "contribute" && (action.contribution ?? 0) === 0)
    );
  }
  if (tag === "群聊永动机") return action.kind === "pass" || action.kind === "abstain";
  return false;
}

export function judgePersonaLocal(
  id: string,
  name: string,
  tags: string[],
  action: ActionChoice,
): PersonaVerdict {
  const label = actionLabel(action);
  const fitTag = tags.find((tag) => actionFitsTag(tag, action));
  if (fitTag) {
    return {
      id,
      delta: 1,
      tag: fitTag,
      line: `${name} 的「${label}」很像「${fitTag}」，人设 +1`,
    };
  }

  const badTag = tags.find((tag) => actionContradictsTag(tag, action));
  if (badTag) {
    return {
      id,
      delta: -1,
      tag: badTag,
      line: `${name} 居然「${label}」，和「${badTag}」不符，出戏 -1`,
    };
  }

  return { id, delta: 0, line: "" };
}
