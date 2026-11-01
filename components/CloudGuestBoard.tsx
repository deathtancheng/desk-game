"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchCloudRoom, sendCloudChat, submitCloudAction } from "@/lib/cloudClient";
import { PLAN_RULE_SHEETS } from "@/lib/compiler";
import {
  activePlayers,
  getCurrentRuleType,
  getMemberOf,
} from "@/lib/gameEngine";
import type { ActionChoice, ChatMessage as ChatMessageType, RoomView } from "@/lib/types";
import ActionPanel from "./ActionPanel";
import ChatComposer, { type ChatSpeaker } from "./ChatComposer";
import ChatMessage from "./ChatMessage";
import EventCard from "./EventCard";
import EventTrack from "./EventTrack";
import PawnIcon from "./PawnIcon";
import RoundResultCard from "./RoundResultCard";
import RuleSheet from "./RuleSheet";
import Scoreboard from "./Scoreboard";

interface CloudGuestBoardProps {
  roomCode: string;
  clientId: string;
  memberId: string;
}

const KIND_LABEL = {
  negotiation: "谈判",
  bidding: "竞标",
  escape: "逃脱",
} as const;

export default function CloudGuestBoard({ roomCode, clientId, memberId }: CloudGuestBoardProps) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [pendingChat, setPendingChat] = useState<ChatMessageType[]>([]);
  const [copied, setCopied] = useState(false);
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
  const member = state && myPlayer ? getMemberOf(state, myPlayer) : null;
  const activeCount = state ? activePlayers(state).length : 0;
  const kind = state ? getCurrentRuleType(state) : "negotiation";
  const chatting = Boolean(state && myPlayer);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state?.log.length, state?.phase, pendingChat.length]);

  useEffect(() => {
    setSubmitted(false);
  }, [state?.round, state?.pendingIndex, state?.phase]);

  useEffect(() => {
    if (!state) return;
    const ids = new Set(state.log.map((message) => message.id));
    setPendingChat((previous) => {
      const remaining = previous.filter((message) => !ids.has(message.id));
      return remaining.length === previous.length ? previous : remaining;
    });
  }, [state]);

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

  const chat = async (
    authorId: string,
    text: string,
    options?: { emoji?: string; image?: string; big?: boolean },
  ) => {
    if (!state || !member) return;
    const id = `chat-${clientId.slice(0, 6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: ChatMessageType = {
      id,
      kind: "chat",
      memberId: authorId,
      author: member.name,
      emoji: options?.emoji ?? member.emoji,
      avatar: member.emoji,
      text: text.trim().slice(0, 300),
      image: options?.image,
      big: options?.big,
      at: Date.now(),
    };
    setPendingChat((previous) => [...previous, optimistic]);
    try {
      await sendCloudChat(roomCode, clientId, authorId, {
        id,
        text: optimistic.text,
        emoji: optimistic.emoji,
        image: optimistic.image,
        big: optimistic.big,
      });
    } catch (chatError) {
      setPendingChat((previous) => previous.filter((message) => message.id !== id));
      setError(chatError instanceof Error ? chatError.message : "聊天发送失败。");
    }
  };

  const chatSpeakers: ChatSpeaker[] =
    state && member && myPlayer
      ? [{ id: myPlayer.memberId, name: member.name, emoji: member.emoji }]
      : [];

  const copyInvite = async () => {
    if (typeof window === "undefined") return;
    const invite = `群戏邀请码：${roomCode}\n${window.location.origin}/?join=${roomCode}`;
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("把邀请码发给室友：", invite);
    }
  };

  const leaveRoom = () => {
    if (!window.confirm("离开房间？席位会保留，下次用邀请码还能回来。")) return;
    window.sessionStorage.removeItem("qunxi-guest-session");
    window.location.href = "/";
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
          {myPlayer && member && <span className="pill">你是 {member.name}</span>}
          <button className="btn-ghost !px-2.5 !py-1.5 text-[9px]" onClick={copyInvite}>
            {copied ? "已复制" : "邀请码"}
          </button>
          <button className="btn-ghost !px-2.5 !py-1.5 text-[9px] text-white/55" onClick={leaveRoom}>
            离开
          </button>
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
                <a className="btn-primary mt-4 inline-flex" href="/?join=1">
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
      ) : !room.humanIds.includes(memberId) ||
        !room.players.some((player) => player.memberId === memberId && player.clientId === clientId) ? (
        <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-5">
          <div className="panel w-full p-8 text-center">
            <div className="text-4xl">🪑</div>
            <div className="mt-3 font-serif text-xl font-bold text-white">这个真人席位被调整了</div>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              房主在开局前重新调整了真人/幽灵席位，你当前的角色不再由真人操作。
              <br />
              房间 <span className="font-mono text-neon">{room.code}</span> 还在，可以重新选一个位置。
            </p>
            <a className="btn-primary mt-4 inline-flex" href={`/?join=${room.code}`}>
              重新选位置
            </a>
          </div>
        </div>
      ) : !state || !myPlayer || !member ? (
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
                  <span className="pill !py-0.5">淘汰赛 · 无时限</span>
                  <span className="pill !py-0.5">
                    事件 {state.round} / {state.config.maxEvents}
                  </span>
                  <span className="pill !py-0.5 text-neon">云端 {room.code}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted">
                  你操作 {member.name} · 场上 {activeCount} 人
                  {myPlayer.eliminated && " · 你已出局，可以继续聊天观战"}
                  {!myPlayer.eliminated && " · 房主电脑负责结算"}
                </div>
              </div>
              <button className="btn-ghost !px-3 !py-2 text-[10px]" onClick={() => setShowGoal(true)}>
                看我的隐藏诉求
              </button>
            </div>
            <Scoreboard game={state} currentId={current?.memberId} phase={state.phase} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
            <section className="table-frame order-2 h-[62vh] min-h-[440px] lg:order-1 lg:h-[calc(100vh-280px)] lg:min-h-[540px]">
              <div className="table-felt h-full">
                <div className="flex items-center justify-between border-b border-[#c9a15e]/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PawnIcon className="h-3.5 w-3.5 text-[#d8bb85]" />
                    <span className="text-[11px] font-semibold text-[#f0dfc2]">牌桌同步 · 群聊</span>
                  </div>
                  <span className="text-[9px] tracking-[0.14em] text-[#c7b89e]/65">回合外也能聊</span>
                </div>

                <div className="px-3 pt-2.5">
                  <EventTrack
                    round={state.round}
                    maxEvents={state.config.maxEvents}
                    done={state.phase === "done"}
                  />
                </div>

                <div className="px-3 pt-1">
                  <RuleSheet
                    title={`${KIND_LABEL[kind]} · 第 ${state.round} 个事件`}
                    lines={PLAN_RULE_SHEETS[kind]}
                  />
                </div>

                <div ref={scrollRef} className="chat-scroll flex-1 space-y-1 overflow-y-auto px-3 py-2">
                  {state.log.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  {pendingChat
                    .filter((message) => !state.log.some((item) => item.id === message.id))
                    .map((message) => (
                      <ChatMessage key={message.id} message={message} />
                    ))}
                </div>

                <ChatComposer
                  speakers={chatSpeakers}
                  defaultSpeakerId={myPlayer.memberId}
                  onSend={chat}
                  disabled={!chatting}
                  placeholder="在群里说点什么，回合外也能聊"
                />
              </div>
            </section>

            <aside className="order-1 space-y-3 lg:order-2">
              <EventCard game={state} />

              {state.phase !== "action" ? (
                <RoundResultCard game={state} onNext={() => {}} onSettle={() => {}} readOnly />
              ) : myPlayer.eliminated ? (
                <div className="rounded-2xl border border-ember/25 bg-ember/[0.04] p-5">
                  <div className="text-sm font-bold text-white">你已出局</div>
                  <p className="mt-1 text-[10px] leading-5 text-muted">
                    群地位最低，提前下班。你还可以在左边继续聊天、发表情，看他们互相博弈。
                  </p>
                </div>
              ) : current && current.memberId === memberId ? (
                submitted ? (
                  <div className="rounded-2xl border border-mint/25 bg-mint/[0.05] p-5">
                    <div className="text-sm font-bold text-white">已提交，等房主同步…</div>
                    <p className="mt-1 text-[10px] leading-5 text-muted">
                      房主电脑会自动接收你的动作，然后结算并淘汰最低的人。页面不用刷新。
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
              ) : (
                <div className="rounded-2xl border border-line/70 bg-panel2/40 p-5">
                  <div className="text-sm font-bold text-white/75">
                    等 {current ? getMemberOf(state, current).name : "下一位"} 出牌…
                  </div>
                  <p className="mt-1 text-[10px] leading-5 text-muted">
                    牌桌会自动刷新。轮到你会亮起来；现在也可以先在群里聊天。
                  </p>
                </div>
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
        {showGoal && state && myPlayer && member && (
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
                  {member.emoji}
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
                你的标签：{member.tags.join(" / ")}
                <br />
                当前群地位：{myPlayer.gp} 点 · 本次出力：{myPlayer.tokens} 点
                <br />
                达成隐藏诉求：终局 +3 点，可能改变冠军。
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
