"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ackCloudAction, fetchCloudRoom, publishCloudState } from "@/lib/cloudClient";
import { getMemberOf, getRoundPrompt } from "@/lib/gameEngine";
import type { ActionChoice, RoomPlayer } from "@/lib/types";
import { useGameStore } from "@/store/gameStore";
import ActionPanel from "./ActionPanel";
import ChatMessage from "./ChatMessage";
import RoundResultCard from "./RoundResultCard";
import RuleSheet from "./RuleSheet";
import Scoreboard from "./Scoreboard";

export default function GameBoard() {
  const game = useGameStore((state) => state.game);
  const chooseAction = useGameStore((state) => state.chooseAction);
  const nextRound = useGameStore((state) => state.nextRound);
  const goSettlement = useGameStore((state) => state.goSettlement);
  const judging = useGameStore((state) => state.judging);
  const judgeError = useGameStore((state) => state.judgeError);
  const cloudMode = useGameStore((state) => state.cloudMode);
  const cloudRole = useGameStore((state) => state.cloudRole);
  const roomCode = useGameStore((state) => state.roomCode);
  const cloudClientId = useGameStore((state) => state.cloudClientId);
  const cloudHostMemberId = useGameStore((state) => state.cloudHostMemberId);
  const closeCloudRoom = useGameStore((state) => state.closeCloudRoom);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(60);
  const [showGoal, setShowGoal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cloudPlayers, setCloudPlayers] = useState<RoomPlayer[]>([]);
  const gameRef = useRef(game);
  const judgingRef = useRef(judging);
  const processingRef = useRef(false);
  gameRef.current = game;
  judgingRef.current = judging;

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => (value <= 0 ? 0 : value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!game) return;
    setSeconds(Math.floor(180 / game.config.rounds));
  }, [game?.round, game?.config.rounds]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [game?.log.length, game?.phase]);

  useEffect(() => {
    setShowGoal(false);
  }, [game?.round, game?.pendingIndex]);

  useEffect(() => {
    if (!cloudMode || cloudRole !== "host" || !roomCode || !cloudClientId || !game) return;
    const timer = setTimeout(() => {
      publishCloudState(roomCode, cloudClientId, game).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [game, cloudMode, cloudRole, roomCode, cloudClientId]);

  useEffect(() => {
    if (!cloudMode || cloudRole !== "host" || !roomCode || !cloudClientId) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled || processingRef.current || judgingRef.current) return;
      const currentGame = gameRef.current;
      if (!currentGame || currentGame.phase !== "action") return;

      try {
        const room = await fetchCloudRoom(roomCode, cloudClientId);
        if (!cancelled) setCloudPlayers(room?.players ?? []);
        if (!room?.pending?.length) return;
        const currentPlayer = currentGame.players[currentGame.pendingIndex];
        const pending = room.pending.find((item) => item.memberId === currentPlayer?.memberId);
        if (!pending) return;

        processingRef.current = true;
        await chooseAction(pending.action);
        await ackCloudAction(roomCode, cloudClientId, pending.id);
      } catch {
        // 房间同步失败时保持本地状态，下一次轮询再试
      } finally {
        processingRef.current = false;
      }
    };

    tick();
    const timer = setInterval(tick, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cloudMode, cloudRole, roomCode, cloudClientId, chooseAction]);

  if (!game) return null;

  const current = game.players[game.pendingIndex];
  const currentMember = current ? getMemberOf(game, current) : null;
  const prompt = getRoundPrompt(game.config, game.round);
  const clock =
    seconds <= 0
      ? "超时"
      : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const urgent = seconds <= 15;
  const isGuestTurn = Boolean(
    cloudMode &&
      cloudRole === "host" &&
      current?.isHuman &&
      current.memberId !== cloudHostMemberId &&
      game.phase === "action",
  );
  const humanCount = game.players.filter((player) => player.isHuman).length;
  const joinedCount = cloudPlayers.filter((player) =>
    game.players.some((gamePlayer) => gamePlayer.memberId === player.memberId && gamePlayer.isHuman),
  ).length;
  const currentGuestJoined = cloudPlayers.some((player) => player.memberId === current?.memberId);
  const proxyAction: ActionChoice =
    game.config.ruleType === "bidding"
      ? { kind: "abstain" }
      : game.config.ruleType === "escape"
        ? { kind: "contribute", contribution: 0 }
        : { kind: "pass" };
  const proxyLabel =
    game.config.ruleType === "bidding"
      ? "托管：替 TA 弃权"
      : game.config.ruleType === "escape"
        ? "托管：替 TA 出 0"
        : "托管：替 TA 装死";

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

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-10 sm:px-8">
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon/30 bg-neon/10 text-lg">
              💬
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{game.config.groupName}</span>
                <span className="pill !py-0.5">{game.config.ruleTitle}</span>
                <span className="pill !py-0.5">
                  第 {game.round} / {game.config.rounds} 回合
                </span>
                {cloudMode && roomCode && (
                  <span className="pill !py-0.5 text-neon">
                    云端 {roomCode} · {joinedCount}/{humanCount}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-muted">
                6 人宿舍 · {game.players.filter((player) => player.isHuman).length} 真人 +{" "}
                {game.players.filter((player) => !player.isHuman).length} 幽灵
                {cloudMode && " · 房主这台电脑是牌桌"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cloudMode && roomCode && (
              <button className="btn-ghost !px-2.5 !py-1.5 text-[9px]" onClick={copyInvite}>
                {copied ? "已复制" : "邀请"}
              </button>
            )}
            {cloudMode && cloudRole === "host" && (
              <button
                className="btn-ghost !px-2.5 !py-1.5 text-[9px] text-ember/80 hover:border-ember/40"
                onClick={() => {
                  if (window.confirm("结束当前云端房间？室友会断开，当前对局不会保留。")) {
                    void closeCloudRoom();
                  }
                }}
              >
                结束房间
              </button>
            )}
            <div
              className={`rounded-xl border px-3 py-1.5 text-right ${
                urgent ? "border-ember/40 bg-ember/10 text-ember" : "border-line bg-panel2/50 text-neon"
              }`}
            >
              <div className="text-[8px] tracking-[0.14em] text-muted">本回合</div>
              <div className="font-mono text-lg font-black leading-5">{clock}</div>
            </div>
            <div className="hidden items-center gap-1.5 rounded-xl border border-line/60 bg-panel2/40 px-2.5 py-2 text-[9px] text-muted sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
              规则骨架已锁定
            </div>
          </div>
        </div>

        <Scoreboard game={game} currentId={current?.memberId} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
        <section className="panel flex h-[calc(100vh-260px)] min-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              <span className="text-[11px] font-semibold text-white/75">群聊 · 本局牌桌</span>
            </div>
            <span className="text-[9px] tracking-[0.14em] text-muted">牌桌就是群聊</span>
          </div>

          <div className="px-3 pt-3">
            <RuleSheet title={game.config.ruleTitle} lines={game.config.ruleSheet} />
          </div>

          <div ref={scrollRef} className="chat-scroll flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {game.log.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-line/60 px-3 py-2.5">
            <span className="text-sm">🙂</span>
            <div className="flex-1 rounded-xl border border-line/50 bg-ink/30 px-3 py-2 text-[10px] text-white/25">
              群里只能发表情，不能发表情包……
            </div>
            <span className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[9px] text-white/30">发送</span>
          </div>
        </section>

        <aside className="space-y-3">
          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] tracking-[0.16em] text-muted">本回合</span>
              <span className="pill !py-0.5">{prompt.badge}</span>
            </div>
            <h2 className="mt-1.5 font-serif text-base font-bold text-white">{prompt.title}</h2>
            <p className="mt-1 text-[10px] leading-5 text-muted">{prompt.subtitle}</p>
          </div>

          {isGuestTurn ? (
            <div className="rounded-2xl border border-mint/25 bg-mint/[0.05] p-5">
              <div className="text-sm font-bold text-white">
                等 {currentMember?.name} 在手机上出牌…
              </div>
              <p className="mt-1 text-[10px] leading-5 text-muted">
                云端 {joinedCount}/{humanCount} 已加入
                {!currentGuestJoined ? " · 这个位置还没人" : ""}。房主页面别关，对方提交后会自动同步。
              </p>
              {!currentGuestJoined && (
                <button
                  className="btn-ghost mt-3 w-full !py-2 text-[10px]"
                  onClick={() => chooseAction(proxyAction)}
                >
                  {proxyLabel}
                </button>
              )}
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-mint" />
              </div>
            </div>
          ) : judging ? (
            <JudgeLoading />
          ) : game.phase === "action" && current && currentMember ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-neon/25 bg-neon/[0.05] px-3 py-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" />
                <span className="text-[10px] text-white/70">
                  轮到 <span className="font-bold text-neon">{currentMember.name}</span>
                  {game.players.filter((player) => player.isHuman).length > 1 && " · 把设备交给 TA"}
                </span>
              </div>
              <ActionPanel
                game={game}
                player={current}
                onAction={chooseAction}
                onShowGoal={() => setShowGoal(true)}
              />
            </>
          ) : (
            <RoundResultCard game={game} onNext={nextRound} onSettle={goSettlement} />
          )}

          {judgeError && (
            <div className="rounded-xl border border-ember/25 bg-ember/[0.04] px-3 py-2 text-[10px] leading-5 text-ember">
              {judgeError}
            </div>
          )}

          <div className="rounded-xl border border-line/50 bg-panel2/30 px-3 py-2.5 text-[9px] leading-4 text-muted">
            <span className="text-mint">群主怎么看</span>：动作像你的标签 +1，出戏 -1；隐藏诉求结算时揭晓。
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {showGoal && current && currentMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5 backdrop-blur"
            onClick={() => setShowGoal(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 6 }}
              className="w-full max-w-sm rounded-2xl border border-neon/30 bg-panel p-5 shadow-neon"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neon/30 bg-neon/10 text-xl">
                  {currentMember.emoji}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{currentMember.name} 的隐藏诉求</div>
                  <div className="text-[10px] text-muted">只有你能看到 · 别让其他人瞄到</div>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-neon/20 bg-neon/[0.05] px-3 py-3 text-sm font-semibold text-neon">
                {current.goalText}
              </div>
              <div className="mt-3 space-y-1 text-[10px] leading-5 text-white/55">
                <div>你的标签：{currentMember.tags.join(" / ")}</div>
                <div>当前群地位：{current.gp} 点 · 剩余出力：{current.tokens} 点</div>
                <div>达成隐藏诉求：结算时 +3 点。</div>
              </div>
              <button className="btn-primary mt-5 w-full !py-2.5 text-xs" onClick={() => setShowGoal(false)}>
                记住了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JudgeLoading() {
  return (
    <div className="rounded-2xl border border-neon/25 bg-neon/[0.04] p-5">
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-neon/30 bg-neon/10">
          <span className="text-lg">🤖</span>
          <span className="absolute inset-0 animate-ping rounded-xl border border-neon/20" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">群主正在判断人设…</div>
          <div className="mt-0.5 text-[10px] text-muted">正在读你们的标签和这回合的行动</div>
        </div>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-neon" />
      </div>
      <div className="mt-3 text-[9px] leading-4 text-muted">9 秒内没有响应，会自动切回本地判定。</div>
    </div>
  );
}
