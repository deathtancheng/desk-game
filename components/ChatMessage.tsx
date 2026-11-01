"use client";

import { motion } from "framer-motion";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  if (message.kind === "system") {
    return (
      <div className="my-3 flex items-center gap-2 text-[10px] text-white/30">
        <span className="h-px flex-1 bg-line/60" />
        <span className="whitespace-nowrap">{message.text}</span>
        <span className="h-px flex-1 bg-line/60" />
      </div>
    );
  }

  if (message.kind === "event") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="my-2 rounded-xl border-l-2 border-neon bg-neon/[0.04] px-3 py-2.5"
      >
        <div className="flex items-center gap-1.5 text-[9px] tracking-[0.14em] text-neon">
          <span>{message.emoji}</span>
          {message.author}
        </div>
        <div className="mt-1 font-serif text-xs leading-5 text-white/80">{message.text}</div>
      </motion.div>
    );
  }

  if (message.kind === "result") {
    const tone =
      message.tone === "good"
        ? "border-mint/30 bg-mint/[0.05]"
        : message.tone === "bad"
          ? "border-ember/30 bg-ember/[0.05]"
          : "border-neon/30 bg-neon/[0.05]";
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`my-3 rounded-xl border px-3 py-2.5 ${tone}`}
      >
        <div className="flex items-center gap-1.5 text-[9px] tracking-[0.14em] text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-neon" />
          群主公告
        </div>
        <div className="mt-1 text-xs leading-5 text-white/85">{message.text}</div>
      </motion.div>
    );
  }

  if (message.kind === "chat") {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="my-2 flex gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm">
          {message.avatar ?? message.emoji ?? "🙂"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[9px] text-white/35">
            <span>{message.author ?? "群友"}</span>
            <span className="rounded bg-white/5 px-1 text-[8px] text-muted">闲聊</span>
          </div>
          {message.image ? (
            <div className="mt-1 inline-block rounded-2xl rounded-tl-md border border-line/70 bg-white/[0.04] p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.image}
                alt={`${message.author ?? "群友"}发的图片`}
                className="max-h-52 max-w-[240px] rounded-xl object-cover"
              />
              {message.text && <div className="px-1 pb-1 pt-1.5 text-[10px] text-white/60">{message.text}</div>}
            </div>
          ) : message.big ? (
            <div className="mt-1 inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-neon/20 bg-neon/[0.06] px-3 py-2">
              <span className="text-2xl">{message.emoji ?? "🙂"}</span>
              <span className="font-serif text-sm font-bold text-white/80">{message.text}</span>
            </div>
          ) : (
            <div className="mt-0.5 inline-block rounded-2xl rounded-tl-md border border-line/70 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-white/75">
              {message.text}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  const isHost = message.kind === "host";
  const toneClass =
    message.tone === "good"
      ? "border-mint/25 bg-mint/[0.06] text-mint/90"
      : message.tone === "bad"
        ? "border-ember/25 bg-ember/[0.06] text-ember/90"
        : message.tone === "glow"
          ? "border-neon/25 bg-neon/[0.06] text-neon/90"
          : "border-line/70 bg-white/[0.04] text-white/75";

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="my-2 flex gap-2">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm ${
          isHost ? "border-neon/30 bg-neon/10" : "border-white/10 bg-white/[0.04]"
        }`}
      >
        {message.emoji ?? (isHost ? "📣" : "🙂")}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[9px] text-white/35">
          <span>{message.author ?? (isHost ? "群主" : "群友")}</span>
          {isHost && <span className="rounded bg-neon/10 px-1 text-[8px] text-neon">主持</span>}
        </div>
        <div className={`mt-0.5 inline-block rounded-2xl rounded-tl-md border px-3 py-2 text-xs leading-5 ${toneClass}`}>
          {message.text}
        </div>
      </div>
    </motion.div>
  );
}
