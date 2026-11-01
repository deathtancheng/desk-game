"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DEMO_CHAT, DEMO_GROUP_NAME, DEMO_MEMBERS } from "@/lib/demoData";
import { parseChat } from "@/lib/parser";
import { useGameStore } from "@/store/gameStore";

const FEATURES = [
  {
    title: "聊天 → 角色",
    detail: "发言量、被 @、外卖、深夜 emo，变成 10 张角色卡。",
  },
  {
    title: "角色 → 规则",
    detail: "把谈判 / 竞标 / 逃脱混成 8–9 个随机事件，每个事件带变数和悬赏。",
  },
  {
    title: "一局 → 群年鉴",
    detail: "淘汰到最后，每个人带走一个只有你们懂的称号。",
  },
];

export default function ImportScreen() {
  const groupName = useGameStore((state) => state.groupName);
  const rawChat = useGameStore((state) => state.rawChat);
  const setGroupName = useGameStore((state) => state.setGroupName);
  const setRawChat = useGameStore((state) => state.setRawChat);
  const useDemo = useGameStore((state) => state.useDemo);
  const compile = useGameStore((state) => state.compile);
  const quickCreateRoom = useGameStore((state) => state.quickCreateRoom);
  const [importError, setImportError] = useState("");
  const [importedFrom, setImportedFrom] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [hostOpen, setHostOpen] = useState(false);
  const [hostCount, setHostCount] = useState(3);
  const [hostChoiceId, setHostChoiceId] = useState(DEMO_MEMBERS[0].id);
  const [hostCreating, setHostCreating] = useState(false);
  const [hostError, setHostError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseChat(rawChat), [rawChat]);
  const parsedNames = useMemo(() => [...new Set(parsed.map((line) => line.name))], [parsed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("host") === "1") setHostOpen(true);
    const openHost = () => {
      setHostError("");
      setHostOpen(true);
    };
    window.addEventListener("qunxi-open-host", openHost);
    return () => window.removeEventListener("qunxi-open-host", openHost);
  }, []);

  const createHostRoom = async () => {
    setHostCreating(true);
    setHostError("");
    try {
      await quickCreateRoom(hostCount, hostChoiceId);
    } catch (error) {
      setHostError(error instanceof Error ? error.message : "创建房间失败，请稍后再试。");
    } finally {
      setHostCreating(false);
    }
  };

  const closeHost = () => {
    setHostOpen(false);
    setHostError("");
    const url = new URL(window.location.href);
    if (url.searchParams.get("host") === "1") {
      url.searchParams.delete("host");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  };

  const fillDemo = () => {
    useDemo();
    setRawChat(DEMO_CHAT);
    setImportedFrom("示例群");
    setImportError("");
  };

  const stripHtml = (raw: string): string => {
    const start = raw.search(/<!doctype|<html/i);
    const html = start >= 0 ? raw.slice(start) : raw;
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.innerText || doc.body.textContent || "";
  };

  const readFile = async (file: File) => {
    try {
      const text = await file.text();
      const looksLikeHtml = /\.(html?|mht)$/i.test(file.name) || /<html|<body|<div/i.test(text);
      setRawChat(looksLikeHtml ? stripHtml(text) : text);
      setImportedFrom(file.name);
      setImportError("");
    } catch {
      setImportError("读取文件失败，试试复制文本后直接粘贴。");
    }
  };

  const readClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setImportError("剪贴板是空的，先在微信/QQ 里多选消息并复制。");
        return;
      }
      setRawChat(text);
      setImportedFrom("剪贴板");
      setImportError("");
    } catch {
      setImportError("浏览器没给剪贴板权限，直接粘贴到输入框也可以。");
    }
  };

  const openJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 5) {
      setJoinError("邀请码是 5 位，问一下房主。");
      return;
    }
    window.location.assign(`/?join=${encodeURIComponent(code)}`);
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
            10 人群，1–10 个真人可玩。从聊天里提取角色、梗和矛盾，生成 8–9 个随机事件（每个带变数和悬赏）+ 1 页规则 + 卡牌 + 淘汰结算。
            淘汰到最后，带走一张群年鉴。
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
              10 人 · 40 条消息
            </span>
          </div>

          <div className="mt-5 grid grid-cols-5 gap-x-1 gap-y-3">
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
              ["10", "角色"],
              ["3", "规则骨架"],
              ["淘汰", "一局"],
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
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 rounded-2xl border border-mint/25 bg-mint/[0.04] p-4 sm:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="text-[10px] tracking-[0.2em] text-mint">已有房间？直接联机</div>
            <div className="mt-1 font-serif text-lg font-bold text-white">输入室友发来的 5 位邀请码</div>
            <p className="mt-1 text-[10px] leading-5 text-muted">
              不用重新导入聊天。房主电脑负责结算，你可以在手机上随时聊天、发表情包和图片。
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              openJoin();
            }}
          >
            <input
              value={joinCode}
              onChange={(event) => {
                setJoinCode(event.target.value.toUpperCase());
                setJoinError("");
              }}
              maxLength={5}
              placeholder="例如 A7K2M"
              className="w-36 rounded-xl border border-mint/25 bg-ink/40 px-3 py-2.5 font-mono text-sm tracking-[0.2em] text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-white/20 focus:border-mint/60"
            />
            <button type="submit" className="btn-primary !px-4 !py-2.5 text-xs">
              加入
            </button>
          </form>
        </div>
        <div className="mt-3 flex flex-col gap-2 border-t border-mint/10 pt-3 text-[9px] leading-4 text-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div>想当房主？可以直接开一个房间，不用先编译；想用自己群的聊天，再往下导入。</div>
            <div className="mt-0.5">开房后选择真人席位，创建成功会进入角色页并拿到 5 位邀请码。</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary !px-3 !py-2 text-[10px]"
              onClick={() => {
                setHostError("");
                setHostOpen(true);
              }}
            >
              开一个房间
            </button>
            <a className="text-mint/90 underline-offset-2 hover:underline" href="/?join=1">
              打开联机大厅
            </a>
          </div>
        </div>
        {joinError && <div className="mt-2 text-[10px] text-ember">{joinError}</div>}
      </motion.section>

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
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.html,.htm,.mht"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                  event.target.value = "";
                }}
              />
              <button className="btn-ghost !px-3 !py-2 text-xs" onClick={readClipboard}>
                从剪贴板
              </button>
              <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => fileInputRef.current?.click()}>
                上传文件
              </button>
              <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setHelpOpen(true)}>
                怎么导出？
              </button>
              <button className="btn-ghost !px-3 !py-2 text-xs" onClick={fillDemo}>
                填入示例群
              </button>
            </div>
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
                QQ 导出 .txt / .mht
                <br />
                微信复制文本 / 剪贴板
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

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
            {parsed.length > 0 ? (
              <span className={parsed.length >= 8 ? "text-mint" : "text-ember"}>
                已识别 {parsed.length} 条 / {parsedNames.length} 人
              </span>
            ) : (
              <span className="text-muted">还没识别到消息</span>
            )}
            {importedFrom && <span className="text-muted">· 来源：{importedFrom}</span>}
            {rawChat && parsed.length === 0 && (
              <span className="text-ember">· 格式没认出来，点“怎么导出？”看示例</span>
            )}
            {parsed.length > 0 && parsed.length < 8 && (
              <span className="text-ember">· 少于 8 条，编译时会用示例群</span>
            )}
            {importError && <span className="text-ember">· {importError}</span>}
          </div>

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
                ["10 张角色卡", "每个人的标签、属性、隐藏诉求和梗料。"],
                ["8–9 个随机事件", "谈判 / 竞标 / 逃脱混排，每事件带变数 + 悬赏，最低分出局。"],
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

      <AnimatePresence>
        {hostOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5 backdrop-blur"
            onClick={closeHost}
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 6 }}
              className="w-full max-w-md rounded-2xl border border-mint/30 bg-panel p-5 shadow-paper"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] tracking-[0.18em] text-mint">房主 · 一键开房</div>
                  <div className="mt-1 font-serif text-xl font-bold text-white">开一个云端房间</div>
                </div>
                <button type="button" className="text-[10px] text-muted" onClick={closeHost}>
                  关闭
                </button>
              </div>

              <p className="mt-2 text-[10px] leading-5 text-muted">
                房主这台设备当牌桌。创建后会直接进入角色页，拿到 5 位邀请码发给室友；室友从首页“联机加入”进来。
              </p>
              <p className="mt-1 text-[9px] leading-4 text-ember/70">
                没加入的真人位置仍算真人，开局后可在牌桌用“托管”代出牌；其余角色由策略 AI 操作。
              </p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-white/75">我扮演</span>
                  <span className="text-muted">房主角色不再固定为阿伟</span>
                </div>
                <select
                  value={hostChoiceId}
                  onChange={(event) => setHostChoiceId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line/60 bg-ink/30 px-3 py-2.5 text-xs text-white/80 outline-none transition focus:border-mint/50"
                >
                  {DEMO_MEMBERS.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.emoji} {member.name} · {member.tags[0]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-white/75">真人席位</span>
                  <span className="text-muted">其余角色由策略 AI 补齐</span>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setHostCount(count)}
                      className={`rounded-xl border px-1 py-2 text-center transition ${
                        hostCount === count
                          ? "border-mint/60 bg-mint/10 text-mint"
                          : "border-line/60 bg-ink/30 text-white/55 hover:border-mint/40"
                      }`}
                    >
                      <div className="font-mono text-base font-bold">{count}</div>
                      <div className="mt-0.5 text-[8px]">{count === 1 ? "+ 9 AI" : count === 10 ? "全员" : "真人"}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-line/60 bg-ink/30 px-3 py-2 text-[9px] leading-4 text-muted">
                本局使用：
                <span className="ml-1 text-white/70">
                  {parsed.length >= 8 ? `当前聊天记录（${parsed.length} 条 / ${parsedNames.length} 人）` : `示例群「${DEMO_GROUP_NAME}」`}
                </span>
                <br />
                想用自己的群聊？关闭这里，在下方导入聊天后点“开始编译”，再在角色页创建房间也可以。
                <br />
                想指定具体哪几个室友是真人？关闭后先进入角色页自由勾选，再创建云端房间。
              </div>

              {hostError && <div className="mt-2 text-[10px] leading-4 text-ember">{hostError}</div>}

              <div className="mt-4 flex gap-2">
                <button type="button" className="btn-ghost flex-1 !py-2.5 text-xs" onClick={closeHost}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 !py-2.5 text-xs"
                  disabled={hostCreating}
                  onClick={() => void createHostRoom()}
                >
                  {hostCreating ? "正在创建…" : `创建房间 · ${hostCount} 真人`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5 backdrop-blur"
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 6 }}
              className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-paper"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="font-serif text-xl font-bold">怎么把聊天导进来</div>
              <p className="mt-1 text-[10px] text-muted">微信没有官方明文导出；QQ 可以直接导出文件。</p>

              <div className="mt-5 space-y-4 text-[11px] leading-5">
                <div>
                  <div className="font-semibold text-neon">QQ：直接导出文件</div>
                  <ol className="mt-1 list-decimal space-y-1 pl-4 text-white/65">
                    <li>电脑 QQ 左下角主菜单 → 消息管理 → 选择群</li>
                    <li>右键“导出消息记录” → 选 .txt（推荐）或 .mht</li>
                    <li>回到这里点“上传文件”，选刚导出的文件</li>
                  </ol>
                </div>

                <div>
                  <div className="font-semibold text-neon">微信：复制文本 / 剪贴板</div>
                  <ol className="mt-1 list-decimal space-y-1 pl-4 text-white/65">
                    <li>电脑微信打开群聊 → 多选消息 → 复制</li>
                    <li>回到这里点“从剪贴板”</li>
                    <li>手机微信可以“多选 → 合并转发 → 复制”再粘贴</li>
                  </ol>
                </div>

                <div className="rounded-xl border border-line/60 bg-ink/30 p-3 text-[10px] leading-5 text-muted">
                  微信“聊天记录备份”是加密文件，暂不支持直接读取；复制文本是最稳的方式。
                  聊天只在本地解析，不上传原文。
                </div>
              </div>

              <button className="btn-primary mt-5 w-full !py-2.5 text-xs" onClick={() => setHelpOpen(false)}>
                知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
