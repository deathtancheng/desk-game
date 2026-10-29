"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import MemberCard from "./MemberCard";

export default function LobbyScreen() {
  const config = useGameStore((state) => state.config);
  const humanIds = useGameStore((state) => state.humanIds);
  const setHumanIds = useGameStore((state) => state.setHumanIds);
  const startGame = useGameStore((state) => state.startGame);
  const ruleReason = useGameStore((state) => state.ruleReason);
  const usedDemoChat = useGameStore((state) => state.usedDemoChat);
  const cloudMode = useGameStore((state) => state.cloudMode);
  const roomCode = useGameStore((state) => state.roomCode);
  const cloudError = useGameStore((state) => state.cloudError);
  const setCloudMode = useGameStore((state) => state.setCloudMode);
  const createCloudRoom = useGameStore((state) => state.createCloudRoom);
  const [copied, setCopied] = useState(false);

  if (!config) return null;

  const hostMember = config.members.find((member) => member.id === humanIds[0]);

  const copyInvite = async () => {
    if (!roomCode || typeof window === "undefined") return;
    const url = `${window.location.origin}/?join=${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("把链接发给室友：", url);
    }
  };

  const toggle = (memberId: string) => {
    if (humanIds.includes(memberId)) {
      if (humanIds.length <= 2) return;
      setHumanIds(humanIds.filter((id) => id !== memberId));
      return;
    }
    if (humanIds.length >= 6) return;
    setHumanIds([...humanIds, memberId]);
  };

  const quickSelect = (count: number) => {
    setHumanIds(config.members.slice(0, count).map((member) => member.id));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
      <div className="flex flex-col justify-between gap-4 pt-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.18em] text-muted">
            <span className="rounded-full border border-neon/30 bg-neon/10 px-2.5 py-1 text-neon">第二步 · 认领角色</span>
            <span>{config.groupName}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{config.ruleTitle}</span>
            {usedDemoChat && (
              <span className="rounded-full border border-ember/25 bg-ember/10 px-2 py-0.5 text-[9px] text-ember">
                聊天记录不足 · 已用示例群
              </span>
            )}
          </div>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight sm:text-4xl">认领你的群友身份</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            6 个成员都会上场。你认领的成员由真人操作，剩下的变成幽灵群友，按人设出牌。
            当前 <span className="text-neon">{humanIds.length} 真人</span> +{" "}
            <span className="text-white/80">{config.members.length - humanIds.length} 幽灵</span>。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[2, 3, 4, 6].map((count) => (
            <button
              key={count}
              onClick={() => quickSelect(count)}
              disabled={Boolean(roomCode)}
              className={`rounded-xl border px-3 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                humanIds.length === count
                  ? "border-neon/50 bg-neon/10 text-neon"
                  : "border-line bg-panel2/50 text-white/60 hover:text-white"
              }`}
            >
              {count === 6 ? "全员真人" : `${count} 真人`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.55fr_0.45fr]">
        <div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {config.members.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <MemberCard
                  member={member}
                  isHuman={humanIds.includes(member.id)}
                  onToggle={roomCode ? undefined : () => toggle(member.id)}
                />
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] leading-5 text-muted">
              提示：至少 2 人、最多 6 人。真人数会改变回合数：2–3 人 3 回合，4–6 人 2 回合。幽灵群友 4 点起手，真人 5 点。
            </div>
            <button
              className="btn-primary"
              onClick={startGame}
              disabled={humanIds.length < 2 || (cloudMode && !roomCode)}
            >
              开始这局 · 3:00
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] tracking-[0.2em] text-muted">怎么玩</div>
              <div className="flex rounded-lg border border-line/70 bg-ink/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setCloudMode(false)}
                  className={`rounded-md px-2 py-1 text-[9px] transition ${
                    !cloudMode ? "bg-white/10 text-white" : "text-muted"
                  }`}
                >
                  一台设备
                </button>
                <button
                  type="button"
                  onClick={() => setCloudMode(true)}
                  className={`rounded-md px-2 py-1 text-[9px] transition ${
                    cloudMode ? "bg-white/10 text-white" : "text-muted"
                  }`}
                >
                  云端房间
                </button>
              </div>
            </div>

            {!cloudMode ? (
              <p className="mt-3 text-[11px] leading-5 text-muted">
                热座模式：一台电脑或平板传给下一位，适合 2–3 个人围着一张桌子玩。
              </p>
            ) : !roomCode ? (
              <div className="mt-3 space-y-3">
                <p className="text-[11px] leading-5 text-white/55">
                  房主这台电脑当牌桌，其他人用手机加入。房主页面别关，牌桌就一直在。
                </p>
                <button className="btn-primary w-full !py-2.5 text-xs" onClick={createCloudRoom}>
                  创建云端房间
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-neon/30 bg-neon/[0.06] px-3 py-2.5">
                  <div>
                    <div className="text-[9px] tracking-[0.16em] text-muted">房间号</div>
                    <div className="font-mono text-xl font-black tracking-[0.24em] text-neon">{roomCode}</div>
                  </div>
                  <div className="text-right text-[9px] leading-4 text-muted">
                    房主：{hostMember?.name ?? "你"}
                    <br />
                    其他人：手机加入
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost !py-2 text-[10px]" onClick={copyInvite}>
                    {copied ? "已复制" : "复制邀请链接"}
                  </button>
                  <a
                    className="btn-ghost !py-2 text-[10px]"
                    href={`/?join=${roomCode}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开加入页
                  </a>
                </div>
                <p className="text-[9px] leading-4 text-muted">
                  房主默认操作 {hostMember?.name ?? "第一个角色"}；其他真人位置由加入的人操作。云端模式下隐藏诉求是信任制。
                </p>
              </div>
            )}

            {cloudError && <div className="mt-2 text-[10px] text-ember">{cloudError}</div>}
          </div>

          <div className="panel p-5">
            <div className="text-[10px] tracking-[0.2em] text-muted">为什么是这套规则</div>
            <div className="mt-2 text-sm font-semibold text-white/85">这局安排</div>
            <div className="mt-1 text-xl font-black text-neon">{config.ruleTitle}</div>
            <p className="mt-3 text-[11px] leading-6 text-white/55">{ruleReason}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                ["谈判", config.signals.negotiation],
                ["竞标", config.signals.bidding],
                ["逃脱", config.signals.escape],
              ].map(([label, value]) => (
                <span key={String(label)} className="pill">
                  {label} {String(value)}
                </span>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-[10px] tracking-[0.2em] text-muted">一页规则</div>
            <div className="mt-2 text-sm font-bold">{config.ruleTitle}</div>
            <ul className="mt-3 space-y-2">
              {config.ruleSheet.map((line, index) => (
                <li key={line} className="flex gap-2 text-[11px] leading-5 text-white/60">
                  <span className="mt-0.5 font-mono text-[9px] text-neon">{index + 1}.</span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl border border-line/60 bg-ink/40 p-3 text-[10px] leading-5 text-muted">
              6 人宿舍，2–6 人可玩；幽灵群友会计入投票和出力要求。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
