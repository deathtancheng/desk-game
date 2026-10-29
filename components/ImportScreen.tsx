"use client";

import { motion } from "framer-motion";
import { DEMO_CHAT, DEMO_GROUP_NAME, DEMO_MEMBERS } from "@/lib/demoData";
import { useGameStore } from "@/store/gameStore";

const FEATURES = [
  {
    title: "聊天 → 角色",
    detail: "发言量、被 @、外卖、深夜 emo，变成 6 张角色卡。",
  },
  {
    title: "角色 → 规则",
    detail: "从谈判 / 竞标 / 逃脱三套骨架里，选一套最适合你们群的。",
  },
  {
    title: "一局 → 群年鉴",
    detail: "3 分钟玩完，每个人带走一个只有你们懂的称号。",
  },
];

export default function ImportScreen() {
  const groupName = useGameStore((state) => state.groupName);
  const rawChat = useGameStore((state) => state.rawChat);
  const setGroupName = useGameStore((state) => state.setGroupName);
  const setRawChat = useGameStore((state) => state.setRawChat);
  const useDemo = useGameStore((state) => state.useDemo);
  const compile = useGameStore((state) => state.compile);

  const fillDemo = () => {
    useDemo();
    setRawChat(DEMO_CHAT);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
      <section className="grid items-start gap-8 pt-6 lg:grid-cols-[1.15fr_0.85fr] lg:pt-10">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-neon/25 bg-neon/5 px-3 py-1.5 text-[11px] tracking-[0.16em] text-neon"
          >
            QODER 2026 · LIFEHACK
            <span className="h-1 w-1 rounded-full bg-neon/60" />
            群聊改编局
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-2xl font-serif text-4xl font-bold leading-[1.12] tracking-tight sm:text-6xl"
          >
            把你们群的聊天，
            <br />
            <span className="text-neon glow-text">改编成一局桌游。</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base"
          >
            6 人宿舍，2–6 人可玩。从聊天里提取角色、梗和矛盾，选一套规则骨架，生成 1 页规则 + 卡牌 + 结算。
            3 分钟玩完，带走一张群年鉴。
          </motion.p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 + index * 0.06 }}
                className="panel p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/80">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neon/10 text-[10px] text-neon">
                    0{index + 1}
                  </span>
                  {feature.title}
                </div>
                <p className="text-[11px] leading-5 text-muted">{feature.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.12 }}
          className="panel relative overflow-hidden p-5 sm:p-6"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-neon/10 blur-3xl" />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] tracking-[0.24em] text-muted">示例群</div>
              <div className="mt-1 text-lg font-bold">{DEMO_GROUP_NAME}</div>
            </div>
            <span className="pill">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              6 人 · 40 条消息
            </span>
          </div>

          <div className="mt-5 flex items-end justify-between gap-2">
            {DEMO_MEMBERS.map((member, index) => (
              <div
                key={member.id}
                className="animate-float text-center"
                style={{ animationDelay: `${index * 0.25}s` }}
              >
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl shadow-lg">
                  {member.emoji}
                </div>
                <div className="mt-1.5 text-[10px] text-white/60">{member.name}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2.5 rounded-2xl border border-line/70 bg-ink/40 p-4">
            <div className="flex gap-2">
              <span className="mt-0.5 text-sm">🐱</span>
              <div className="rounded-2xl rounded-tl-md bg-white/[0.06] px-3 py-2 text-xs text-white/75">
                外卖到了，谁去拿？
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <div className="rounded-2xl rounded-tr-md bg-neon/15 px-3 py-2 text-xs text-neon">
                我穿拖鞋了
              </div>
              <span className="mt-0.5 text-sm">🐶</span>
            </div>
            <div className="flex gap-2">
              <span className="mt-0.5 text-sm">🐢</span>
              <div className="rounded-2xl rounded-tl-md bg-white/[0.06] px-3 py-2 text-xs text-white/75">
                笑死，上次也是你
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 text-[10px] tracking-[0.18em] text-muted">
              <span className="h-px w-8 bg-line" />
              正在改编成规则
              <span className="h-px w-8 bg-line" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["6", "角色"],
              ["3", "规则骨架"],
              ["3:00", "一局"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-line/60 bg-panel2/50 px-3 py-2.5 text-center">
                <div className="font-mono text-sm font-bold text-white">{value}</div>
                <div className="mt-0.5 text-[9px] tracking-[0.14em] text-muted">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
        className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <div className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] tracking-[0.24em] text-muted">第一步 · 导入</div>
              <h2 className="mt-1 font-serif text-lg font-bold">把聊天记录倒进来</h2>
            </div>
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={fillDemo}>
              填入示例群
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="block">
              <span className="mb-1.5 block text-[11px] text-muted">群名</span>
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="例如：306 不熄灯"
                className="w-full rounded-xl border border-line bg-ink/50 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-neon/50"
              />
            </label>
            <div className="flex items-end">
              <div className="w-full rounded-xl border border-line/60 bg-panel2/40 px-3 py-2.5 text-[10px] leading-5 text-muted">
                支持微信 / QQ 文本
                <br />
                也可直接点“填入示例群”
              </div>
            </div>
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
              <span>聊天记录（20–100 条即可）</span>
              <span className="font-mono text-[10px] text-white/30">{rawChat ? `${rawChat.split("\n").length} 行` : "未导入"}</span>
            </span>
            <textarea
              value={rawChat}
              onChange={(event) => setRawChat(event.target.value)}
              rows={9}
              placeholder={`[21:03] 阿伟: 谁的外卖？放门口了。\n[21:04] 小陈: 问题不大，谁去？\n[21:05] 老王: 凭什么又是我`}
              className="chat-scroll w-full resize-none rounded-xl border border-line bg-ink/50 px-3.5 py-3 font-mono text-xs leading-6 text-white/80 outline-none transition placeholder:text-white/20 focus:border-neon/50"
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-[10px] leading-4 text-muted">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-mint/10 text-mint">锁</span>
              聊天只在本地解析；默认用 emoji + 代号，不上传真名和头像。
            </p>
            <button className="btn-primary w-full sm:w-auto" onClick={compile}>
              开始编译
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>

        <div className="panel flex flex-col justify-between overflow-hidden p-5 sm:p-6">
          <div>
            <div className="text-[10px] tracking-[0.24em] text-muted">你会得到</div>
            <h2 className="mt-1 font-serif text-lg font-bold">不只是生成一段话</h2>
            <div className="mt-4 space-y-3">
              {[
                ["1 页群公告", "规则、行动、结算，全部压在一屏内。"],
                ["6 张角色卡", "每个人的标签、属性、隐藏诉求和梗料。"],
                ["1 套规则骨架", "谈判 / 竞标 / 合作逃脱，LLM 只填内容。"],
                ["1 张群年鉴", "称号、名场面、群聊人格雷达图。"],
              ].map(([title, detail]) => (
                <div key={title} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neon" />
                  <div>
                    <div className="text-xs font-semibold text-white/85">{title}</div>
                    <div className="mt-0.5 text-[11px] leading-5 text-muted">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-line/60 bg-ink/40 p-3.5">
            <div className="text-[10px] tracking-[0.16em] text-muted">一句话介绍</div>
            <div className="mt-1.5 text-xs leading-6 text-white/75">
              “我们不是把群聊总结一遍，
              <br />
              而是把它<span className="text-neon">改编</span>成一局游戏。”
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
