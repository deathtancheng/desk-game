"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchCloudRoom, submitCloudAction } from "@/lib/cloudClient";
import { getMemberOf, getRoundPrompt } from "@/lib/gameEngine";
import type { ActionChoice, RoomView } from "@/lib/types";
import ActionPanel from "./ActionPanel";
import ChatMessage from "./ChatMessage";
import RoundResultCard from "./RoundResultCard";
import RuleSheet from "./RuleSheet";
import Scoreboard from "./Scoreboard";

interface CloudGuestBoardProps {
  roomCode: string;
  clientId: string;
  memberId: string;
}

export default function CloudGuestBoard({ roomCode, clientId, memberId }: CloudGuestBoardProps) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const next = await fetchCloudRoom(roomCode);
        if (!cancelled) {
          setRoom(next);
          setChecked(true);
          setError(next ? "" : "房间不存在或已过期。");
        }
      } catch {
        if (!cancelled) setError("连接房间失败，正在重试…");
      }
    };

    tick();
    const timer = setInterval(tick, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomCode]);

  const state = room?.state ?? null;
  const current = state?.players[state.pendingIndex];
  const myPlayer = state?.players.find((player) => player.memberId === memberId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state?.log.length, state?.phase]);

  useEffect(() => {
    setSubmitted(false);
  }, [state?.round, state?.pendingIndex, state?.phase]);

  const submit = async (action: ActionChoice) => {
    if (!state || submitting || current?.memberId !== memberId) return;
    setSubmitting(true);
    setError("");
    try {
      await submitCloudAction(roomCode, clientId, memberId, action);
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-line/40 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon/40 bg-neon/10 font-serif text-sm font-bold text-neon shadow-paper">
            群
          </div>
          <div className="leading-tight">
            <div className="font-serif text-base font-bold tracking-[0.16em] text-white/90">群戏</div>
            <div className="text-[10px] tracking-[0.18em] text-muted">云端房间 {roomCode}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {myPlayer && (
            <span className="pill">
              你是 {getMemberOf(state!, myPlayer).name}
            </span>
          )}
          <span className="pill hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
            自动同步
          </span>
        </div>
      </header>

      {!room ? (
        <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-5">
          <div className="panel w-full p-8 text-center">
            {checked && error ? (
              <>
                <div className="text-4xl">🫥</div>
                <div className="mt-3 font-serif text-xl font-bold text-white">房间找不到了</div>
                <p className="mt-2 text-[11px] leading-5 text-muted">{error}</p>
                <a className="btn-primary mt-4 inline-flex" href="/join">
                  重新加入
                </a>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-white">正在连接房间…</div>
                <p className="mt-2 text-[11px] text-muted">{error || "第一次同步可能要几秒。"}</p>
              </>
            )}
          </div>
        </div>
      ) : !state || !myPlayer ? (
        <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-5">
          <div className="panel w-full p-8 text-center">
            <div className="text-4xl">🪑</div>
            <div className="mt-3 font-serif text-xl font-bold text-white">房主还没开局</div>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              {room.groupName} · 房间号 <span className="font-mono text-neon">{room.code}</span>
              <br />
              房主在电脑上点“开始这局”后，这里会自动刷新。
            </p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-neon" />
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-7xl px-5 pb-10 sm:px-8">
          <div className="flex flex-col gap-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-sm font-bold text-white">{state.config.groupName}</span>
                  <span className="pill !py-0.5">{state.config.ruleTitle}</span>
                  <span className="pill !py-0.5">
                    第 {state.round} / {state.config.rounds} 回合
                  </span>
                  <span className="pill !py-0.5 text-neon">云端 {room.code}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted">
                  你操作 {getMemberOf(state, myPlayer).name} · 房主电脑负责结算
                </div>
              </div>
              <button className="btn-ghost !px-3 !py-2 text-[10px]" onClick={() => setShowGoal(true)}>
                看我的隐藏诉求
              </button>
            </div>
            <Scoreboard game={state} currentId={current?.memberId} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
            <section className="panel flex h-[calc(100vh-280px)] min-h-[500px] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                  <span className="text-[11px] font-semibold text-white/75">群聊 · 牌桌同步</span>
                </div>
                <span className="text-[9px] tracking-[0.14em] text-muted">云端只读 · 轮到你时出牌</span>
              </div>

              <div className="px-3 pt-3">
                <RuleSheet title={state.config.ruleTitle} lines={state.config.ruleSheet} />
              </div>

              <div ref={scrollRef} className="chat-scroll flex-1 space-y-1 overflow-y-auto px-3 py-2">
                {state.log.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-line/60 px-3 py-2.5">
                <span className="text-sm">🙂</span>
                <div className="flex-1 rounded-xl border border-line/50 bg-ink/30 px-3 py-2 text-[10px] text-white/25">
                  轮到你在手机上出牌，群里会自动出现……
                </div>
              </div>
            </section>

            <aside className="space-y-3">
              <div className="panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] tracking-[0.16em] text-muted">本回合</span>
                  <span className="pill !py-0.5">{promptBadge(state.config.ruleType, state)}</span>
                </div>
                <h2 className="mt-1.5 font-serif text-base font-bold text-white">
                  {getRoundPrompt(state.config, state.round).title}
                </h2>
                <p className="mt-1 text-[10px] leading-5 text-muted">
                  {getRoundPrompt(state.config, state.round).subtitle}
                </p>
              </div>

              {state.phase === "action" && current && current.memberId === memberId ? (
                submitted ? (
                  <div className="rounded-2xl border border-mint/25 bg-mint/[0.05] p-5">
                    <div className="text-sm font-bold text-white">已提交，等房主同步…</div>
                    <p className="mt-1 text-[10px] leading-5 text-muted">
                      房主电脑会自动接收你的动作，然后揭晓结果。页面不用刷新。
                    </p>
                  </div>
                ) : (
                  <ActionPanel
                    game={state}
                    player={myPlayer}
                    onAction={submit}
                    onShowGoal={() => setShowGoal(true)}
                  />
                )
              ) : state.phase === "action" ? (
                <div className="rounded-2xl border border-line/70 bg-panel2/40 p-5">
                  <div className="text-sm font-bold text-white/75">
                    等 {current ? getMemberOf(state, current).name : "下一位"} 出牌…
                  </div>
                  <p className="mt-1 text-[10px] leading-5 text-muted">
                    牌桌会自动刷新。轮到你会亮起来。
                  </p>
                </div>
              ) : (
                <RoundResultCard game={state} onNext={() => {}} onSettle={() => {}} readOnly />
              )}

              {submitting && (
                <div className="rounded-xl border border-neon/25 bg-neon/[0.05] px-3 py-2 text-[10px] text-neon">
                  正在把你的动作发给房主…
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-ember/25 bg-ember/[0.05] px-3 py-2 text-[10px] leading-5 text-ember">
                  {error}
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showGoal && state && myPlayer && (
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
              className="w-full max-w-sm rounded-2xl border border-neon/30 bg-panel p-5 shadow-paper"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neon/30 bg-neon/10 text-xl">
                  {getMemberOf(state, myPlayer).emoji}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">你的隐藏诉求</div>
                  <div className="text-[10px] text-muted">别让其他人瞄到</div>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-neon/20 bg-neon/[0.05] px-3 py-3 text-sm font-semibold text-neon">
                {myPlayer.goalText}
              </div>
              <div className="mt-3 text-[10px] leading-5 text-white/55">
                你的标签：{getMemberOf(state, myPlayer).tags.join(" / ")}
                <br />
                当前群地位：{myPlayer.gp} 点 · 剩余出力：{myPlayer.tokens} 点
              </div>
              <button className="btn-primary mt-5 w-full !py-2.5 text-xs" onClick={() => setShowGoal(false)}>
                记住了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function promptBadge(ruleType: "negotiation" | "bidding" | "escape", state: RoomView["state"]): string {
  if (!state) return "";
  if (ruleType === "negotiation") {
    const event = state.config.events[state.round - 1] ?? state.config.event;
    return `任务难度 ${event.difficulty}`;
  }
  if (ruleType === "bidding") return "隐藏估值只有你知道";
  const challenge = state.config.challenges[state.round - 1];
  return `需要 ${challenge?.requirement ?? 6} 点出力`;
}
