"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";

export default function CompileScreen() {
  const config = useGameStore((state) => state.config);
  const finishCompile = useGameStore((state) => state.finishCompile);
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      "读取群成员…… 6 人",
      `提取 ${config?.signals.totalMessages ?? 0} 条消息 / ${config?.signals.memeCount ?? 0} 个梗`,
      `检测信号：${config?.signals.topKeywords.slice(0, 4).join(" / ") || "谁去 / 外卖 / 上次"}`,
      `选择规则骨架：${config?.ruleTitle ?? "《今晚谁去拿外卖》"}`,
      "检查这局能不能玩……",
      "生成群公告、角色卡和群年鉴……",
    ],
    [config],
  );

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          if (!cancelled) setStep(index + 1);
        }, 430 * (index + 1)),
      );
    });
    timers.push(
      setTimeout(() => {
        if (!cancelled) finishCompile();
      }, 430 * steps.length + 650),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [finishCompile, steps.length]);

  const progress = Math.min(100, Math.round((step / steps.length) * 100));

  return (
    <div className="mx-auto flex min-h-[78vh] w-full max-w-4xl items-center px-5 pb-16 sm:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="panel relative w-full overflow-hidden p-6 sm:p-10"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon/10 to-transparent" />
        <div className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent via-neon/10 to-transparent" />

        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.28em] text-neon">正在改编</div>
            <h2 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">正在把群聊改编成一局桌游</h2>
          </div>
          <div className="font-mono text-3xl font-black text-neon">{progress}%</div>
        </div>

        <div className="relative mt-7 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-neon"
            animate={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: 0.35 }}
          />
        </div>

        <div className="relative mt-7 space-y-3 font-mono text-xs sm:text-sm">
          {steps.map((text, index) => {
            const done = step > index;
            const active = step === index;
            return (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: done || active ? 1 : 0.28, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="flex items-center gap-3"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                    done
                      ? "border-neon/40 bg-neon/15 text-neon"
                      : active
                        ? "border-mint/40 bg-mint/10 text-mint"
                        : "border-line bg-white/[0.02] text-white/30"
                  }`}
                >
                  {done ? "✓" : active ? "·" : index + 1}
                </span>
                <span className={done ? "text-white/80" : active ? "text-white" : "text-white/35"}>
                  {text}
                  {active && <span className="ml-1 animate-pulse text-neon">_</span>}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="relative mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-5">
          <div className="text-[10px] leading-5 text-muted">
            本地解析 · 只提取特征 · 不上传原文
            <br />
            规则是写死的，内容才是现填的
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon" />
            平衡模拟中
          </div>
        </div>
      </motion.div>
    </div>
  );
}
