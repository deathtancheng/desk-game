import type { Member } from "./types";

export const DEMO_GROUP_NAME = "306 不熄灯";

export const DEMO_MEMBERS: Member[] = [
  {
    id: "m1",
    name: "阿伟",
    emoji: "🐶",
    tags: ["外卖部长", "已读不回", "深夜emo"],
    stats: { influence: 3, reliability: 2, mystery: 4, scapegoat: 1 },
    desire: "早睡",
    quote: "问题不大",
    meme: "上次也是你",
    messageCount: 1284,
    activeHour: "23:47",
  },
  {
    id: "m2",
    name: "小陈",
    emoji: "🐱",
    tags: ["群聊永动机", "拼单之王", "群主候补"],
    stats: { influence: 4, reliability: 3, mystery: 2, scapegoat: 0 },
    desire: "立威",
    quote: "我已经在路上了",
    meme: "有没有人一起",
    messageCount: 2107,
    activeHour: "21:03",
  },
  {
    id: "m3",
    name: "老王",
    emoji: "🐢",
    tags: ["梗王", "空调管理员", "深夜emo"],
    stats: { influence: 3, reliability: 2, mystery: 3, scapegoat: 2 },
    desire: "省钱",
    quote: "笑死",
    meme: "这波不亏",
    messageCount: 1666,
    activeHour: "01:12",
  },
  {
    id: "m4",
    name: "小李",
    emoji: "🐰",
    tags: ["背锅侠", "考试周失踪人口", "老好人"],
    stats: { influence: 2, reliability: 4, mystery: 2, scapegoat: 3 },
    desire: "被夸",
    quote: "行吧",
    meme: "又是我？",
    messageCount: 932,
    activeHour: "19:28",
  },
  {
    id: "m5",
    name: "阿杰",
    emoji: "🦊",
    tags: ["摸鱼冠军", "已读不回", "游戏代练"],
    stats: { influence: 2, reliability: 1, mystery: 3, scapegoat: 2 },
    desire: "摸鱼",
    quote: "在打团",
    meme: "等我五分钟",
    messageCount: 704,
    activeHour: "02:06",
  },
  {
    id: "m6",
    name: "小雨",
    emoji: "🐼",
    tags: ["深夜emo诗人", "外卖部长", "气氛组"],
    stats: { influence: 3, reliability: 2, mystery: 4, scapegoat: 1 },
    desire: "脱单",
    quote: "算了",
    meme: "有人陪我下楼吗",
    messageCount: 1455,
    activeHour: "00:41",
  },
];

export const DEMO_CHAT = `[2026-09-18 20:58] 小陈: 外卖到了，谁去拿？
[20:59] 阿伟: 我穿拖鞋了
[20:59] 老王: 笑死，上次也是你
[21:00] 小陈: 我已经在路上了（指在群里）
[21:00] 小李: 行吧
[21:01] 阿杰: 在打团，等我五分钟
[21:02] 小雨: 有人陪我下楼吗
[21:03] 阿伟: 谁的外卖？放门口了。
[21:04] 小陈: 问题不大，谁去？
[21:05] 老王: 凭什么又是我
[21:06] 小李: 又是我？
[21:07] 阿杰: 这波不亏
[21:08] 小雨: 算了，我去吧
[21:09] 小陈: 有没有人一起拼奶茶
[21:10] 老王: 最后一个插座谁占了
[21:11] 阿伟: 我的，别抢
[21:12] 小李: 空调开 24 度行不行
[21:13] 小陈: 空调遥控器在我这
[21:14] 阿杰: 等我五分钟
[21:15] 小雨: 有人陪我下楼吗（第二次）
[22:40] 小陈: 明天查寝，谁把锅藏一下
[22:41] 小李: 完了
[22:42] 阿杰: 在打团
[22:43] 老王: 笑死，上次查寝也是你
[22:44] 阿伟: 问题不大
[22:45] 小雨: 救命
[22:46] 小陈: 停电了？
[22:47] 老王: 蟑螂！蟑螂！
[22:48] 小李: 又是我？
[22:49] 阿杰: 这波不亏
[23:47] 阿伟: 谁去拿外卖，最后一次
[23:48] 小陈: 我已经在路上了
[23:49] 小雨: 有人陪我下楼吗
[23:50] 老王: 凭什么又是我
[23:51] 小李: 行吧
[00:41] 小雨: 算了，睡了
[01:12] 老王: 笑死，明天考试
[02:06] 阿杰: 等我五分钟`;
