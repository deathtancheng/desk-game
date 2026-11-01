"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchCloudRoom } from "@/lib/cloudClient";
import { useGameStore } from "@/store/gameStore";
import type { RoomPlayer } from "@/lib/types";
import MemberCard from "./MemberCard";

export default function LobbyScreen() {
  const config = useGameStore((state) => state.config);
  const humanIds = useGameStore((state) => state.humanIds);
  const setHumanIds = useGameStore((state) => state.setHumanIds);
  const startGame = useGameStore((state) => state.startGame);
  const ruleReason = useGameStore((state) => state.ruleReason);
  const usedDemoChat = useGameStore((state) => state.usedDemoChat);
  const cloudMode = useGameStore((state) => state.cloudMode);
  const cloudRole = useGameStore((state) => state.cloudRole);
  const roomCode = useGameStore((state) => state.roomCode);
  const cloudHostMemberId = useGameStore((state) => state.cloudHostMemberId);
  const cloudClientId = useGameStore((state) => state.cloudClientId);
  const cloudError = useGameStore((state) => state.cloudError);
  const setCloudMode = useGameStore((state) => state.setCloudMode);
  const createCloudRoom = useGameStore((state) => state.createCloudRoom);
  const updateCloudSeats = useGameStore((state) => state.updateCloudSeats);
  const setCloudHostMemberId = useGameStore((state) => state.setCloudHostMemberId);
  const closeCloudRoom = useGameStore((state) => state.closeCloudRoom);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinedPlayers, setJoinedPlayers] = useState<RoomPlayer[]>([]);
  const [seatSaving, setSeatSaving] = useState(false);

  useEffect(() => {
    if (!cloudMode || cloudRole !== "host" || !roomCode) {
      setJoinedPlayers([]);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const room = await fetchCloudRoom(roomCode);
        if (!cancelled) setJoinedPlayers(room?.players ?? []);
      } catch {
        // 房间轮询失败时保留上一次结果
      }
    };
    tick();
    const timer = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cloudMode, cloudRole, roomCode]);

  if (!config) return null;

  const hostSeatId =
    cloudHostMemberId && humanIds.includes(cloudHostMemberId) ? cloudHostMemberId : humanIds[0];
  const hostMember = config.members.find((member) => member.id === hostSeatId);
  const joinedIds = new Set([
    ...(roomCode ? [hostSeatId] : []),
    ...joinedPlayers.map((player) => player.memberId),
  ]);
  const joinedNames = humanIds
    .filter((memberId) => joinedIds.has(memberId))
    .map((memberId) => config.members.find((member) => member.id === memberId)?.name ?? memberId);
  const joinedCount = joinedNames.length;
  const waitingCount = Math.max(0, humanIds.length - joinedCount);

  const copyCode = async () => {
    if (!roomCode || typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1600);
    } catch {
      window.prompt("把邀请码发给室友：", roomCode);
    }
  };

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

  const closeRoom = () => {
    if (window.confirm("关闭这个云端房间？室友会断开，当前角色选择不会保留。")) {
      void closeCloudRoom();
    }
  };

  const applyHumanSelection = async (next: string[]) => {
    const unique = [...new Set(next)].slice(0, 10);
    if (unique.length < 1) return;
    if (cloudMode && (!hostSeatId || !unique.includes(hostSeatId))) return;
    if (roomCode) {
      const removedJoined = joinedPlayers.filter(
        (player) =>
          player.clientId !== cloudClientId &&
          humanIds.includes(player.memberId) &&
          !unique.includes(player.memberId),
      );
      if (removedJoined.length > 0) {
        const names = removedJoined
          .map((player) => config.members.find((member) => member.id === player.memberId)?.name ?? player.name)
          .join("、");
        if (!window.confirm(`${names} 已经加入房间，移除席位后 TA 会被请出。继续吗？`)) return;
      }
      setSeatSaving(true);
      try {
        await updateCloudSeats(unique);
      } catch {
        // 失败原因已写入 cloudError，在房间面板展示
      } finally {
        setSeatSaving(false);
      }
      return;
    }
    setHumanIds(unique);
  };

  const changeRole = (memberId: string) => {
    if (seatSaving || memberId === hostSeatId) return;
    if (roomCode) {
      const claimed = joinedPlayers.find(
        (player) => player.memberId === memberId && player.clientId !== cloudClientId,
      );
      if (claimed) {
        window.alert("这个角色已经有室友认领了，换一个没有人的角色吧。");
        return;
      }
      const nextHumanIds = humanIds.includes(memberId)
        ? humanIds
        : humanIds.map((id) => (id === hostSeatId ? memberId : id));
      setSeatSaving(true);
      void updateCloudSeats(nextHumanIds, memberId)
        .catch(() => {})
        .finally(() => setSeatSaving(false));
      return;
    }
    const nextHumanIds = humanIds.includes(memberId)
      ? humanIds
      : humanIds.map((id) => (id === hostSeatId ? memberId : id));
    setHumanIds(nextHumanIds);
    setCloudHostMemberId(memberId);
  };

  const quickSelect = (count: number) => {
    if (seatSaving) return;
    const others = config.members
      .filter((member) => member.id !== hostSeatId)
      .slice(0, Math.max(0, count - 1))
      .map((member) => member.id);
    void applyHumanSelection([hostSeatId, ...others]);
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
            10 个成员都会上场。你认领的成员由真人操作，剩下的变成策略 AI 幽灵群友，会抢分、会自保、也会在群里说话。
            当前 <span className="text-neon">{humanIds.length} 真人</span> +{" "}
            <span className="text-white/80">{config.members.length - humanIds.length} 幽灵</span>。
          </p>
        </div>

        <div className="flex flex-col items-start gap-1 lg:items-end">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-panel2/50 px-3 py-2 text-[10px] text-muted">
            真人席位
            <select
              value={humanIds.length}
              onChange={(event) => quickSelect(Number(event.target.value))}
              disabled={seatSaving}
              className="rounded-md border border-line/60 bg-ink/40 px-2 py-1 font-mono text-xs text-neon outline-none disabled:opacity-40"
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
            人
          </label>
          <span className="text-[9px] text-muted">点角色卡 = 切换你扮演的角色；真人数量用这里调。</span>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.55fr_0.45fr]">
        <div className="order-2 lg:order-1">
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
                  host={member.id === hostSeatId}
                  onToggle={
                    seatSaving || member.id === hostSeatId
                      ? undefined
                      : () => changeRole(member.id)
                  }
                />
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] leading-5 text-muted">
              1–10 个真人可玩。每局 8–9 个随机事件，每个事件带 1 个变数和 1 个悬赏；结算后群地位最低的人出局，剩 1 人或事件用完结束。所有人 5 点起手，幽灵是策略 AI。
              {humanIds.length === 1 && (
                <span className="mt-1 block text-mint">
                  单人局有主角保护：你不会被淘汰，但最后仍可能输给分数更高的 AI。
                </span>
              )}
              {cloudMode && roomCode && waitingCount > 0 && (
                <span className="mt-1 block text-ember/80">
                  还有 {waitingCount} 个真人位置未加入；仍可开始，牌桌会提供托管。
                </span>
              )}
            </div>
            {!(cloudMode && roomCode) && (
              <button
                className="btn-primary"
                onClick={startGame}
                disabled={humanIds.length < 1 || (cloudMode && !roomCode)}
              >
                开始这局 · 淘汰赛
                <span aria-hidden>→</span>
              </button>
            )}
          </div>
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <div className="panel p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] tracking-[0.2em] text-muted">怎么玩</div>
              <div className="flex rounded-lg border border-line/70 bg-ink/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setCloudMode(false)}
                  disabled={Boolean(roomCode)}
                  className={`rounded-md px-2 py-1 text-[9px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    !cloudMode ? "bg-white/10 text-white" : "text-muted"
                  }`}
                >
                  一台设备
                </button>
                <button
                  type="button"
                  onClick={() => setCloudMode(true)}
                  disabled={Boolean(roomCode)}
                  className={`rounded-md px-2 py-1 text-[9px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    cloudMode ? "bg-white/10 text-white" : "text-muted"
                  }`}
                >
                  云端房间
                </button>
              </div>
            </div>

            {!cloudMode ? (
              <p className="mt-3 text-[11px] leading-5 text-muted">
                热座模式：一台电脑或平板传给下一位，适合 1–3 个人围着一张桌子玩；也可以一个人带 9 个 AI 幽灵开一局。
              </p>
            ) : !roomCode ? (
              <div className="mt-3 space-y-3">
                <p className="text-[11px] leading-5 text-white/55">
                  房主这台电脑当牌桌，其他人用手机加入。创建后会生成 5 位邀请码；房主页面别关，牌桌就一直在。
                </p>
                <label className="block">
                  <span className="mb-1 block text-[9px] tracking-[0.12em] text-muted">我扮演</span>
                  <select
                    value={hostSeatId}
                    onChange={(event) => setCloudHostMemberId(event.target.value)}
                    className="w-full rounded-xl border border-line/60 bg-ink/30 px-3 py-2 text-[10px] text-white/75 outline-none focus:border-mint/50"
                  >
                    {humanIds.map((memberId) => {
                      const member = config.members.find((item) => item.id === memberId);
                      return (
                        <option key={memberId} value={memberId}>
                          {member?.emoji} {member?.name}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <button className="btn-primary w-full !py-2.5 text-xs" onClick={createCloudRoom}>
                  创建云端房间
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-neon/30 bg-neon/[0.06] px-3 py-2.5">
                  <div>
                    <div className="text-[9px] tracking-[0.16em] text-muted">邀请码</div>
                    <div className="font-mono text-xl font-black tracking-[0.24em] text-neon">{roomCode}</div>
                  </div>
                  <div className="text-right text-[9px] leading-4 text-muted">
                    房主：{hostMember?.name ?? "你"}
                    <br />
                    已加入 <span className="text-mint">{joinedCount}/{humanIds.length}</span>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2 text-[9px] leading-4 text-muted">
                  <span className="min-w-0 flex-1 break-words">已加入：{joinedNames.join("、") || hostMember?.name || "房主"}</span>
                  <button type="button" className="shrink-0 text-ember/70 hover:text-ember" onClick={closeRoom}>
                    关闭房间
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-ghost !py-2 text-[10px]" onClick={copyCode}>
                    {copiedCode ? "邀请码已复制" : "复制邀请码"}
                  </button>
                  <button className="btn-ghost !py-2 text-[10px]" onClick={copyInvite}>
                    {copied ? "链接已复制" : "复制邀请链接"}
                  </button>
                  <a
                    className="btn-ghost col-span-2 !py-2 text-[10px]"
                    href={`/?join=${roomCode}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开加入页
                  </a>
                </div>
                <p className="text-[9px] leading-4 text-muted">
                  室友在首页点“联机加入”，输入这 5 位邀请码即可。房主默认操作 {hostMember?.name ?? "第一个角色"}；其他真人位置由加入的人操作。
                  {waitingCount > 0 ? ` 还差 ${waitingCount} 个真人位置。` : " 真人已到齐，可以开局。"}
                </p>
                <p className="text-[9px] leading-4 text-muted">
                  房间已创建；点角色卡可切换你扮演的角色（已有室友的角色不可抢），真人数量用上方“真人席位”下拉调整，开局前生效。关闭房间后才能切换为“一台设备”模式。
                </p>
                {seatSaving && <p className="text-[9px] text-mint">正在同步真人席位…</p>}
                <button className="btn-primary w-full !py-2.5 text-xs" onClick={startGame} disabled={seatSaving}>
                  开始这局 · 淘汰赛
                </button>
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
              10 人群，1–10 个真人可玩；幽灵群友会计入投票和出力要求，也会按策略抢分、自保和聊天。所有人 5 点起手。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
