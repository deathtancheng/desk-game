"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatSpeaker {
  id: string;
  name: string;
  emoji: string;
}

interface ChatComposerProps {
  speakers: ChatSpeaker[];
  defaultSpeakerId: string;
  onSend: (authorId: string, text: string, options?: { emoji?: string; image?: string; big?: boolean }) => void;
  disabled?: boolean;
  placeholder?: string;
}

const EMOJIS = [
  "😂",
  "😭",
  "😅",
  "😡",
  "😴",
  "🤡",
  "💀",
  "🙃",
  "😏",
  "🥲",
  "🫠",
  "🤔",
  "👀",
  "🐶",
  "🐱",
  "🐢",
  "🦊",
  "🐼",
  "🍜",
  "🧋",
  "🛵",
  "🔌",
  "📣",
  "💤",
];

const STICKERS = [
  { emoji: "😂", label: "笑死" },
  { emoji: "💀", label: "绷不住" },
  { emoji: "🫠", label: "人麻了" },
  { emoji: "😭", label: "破防" },
  { emoji: "🙏", label: "求放过" },
  { emoji: "🐢", label: "先苟为敬" },
  { emoji: "🍜", label: "泡面救急" },
  { emoji: "🔌", label: "插座归我" },
];

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("image_failed"));
    element.src = dataUrl;
  });

  const maxSide = 480;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let result = canvas.toDataURL("image/jpeg", 0.52);
  if (result.length > 110_000) result = canvas.toDataURL("image/jpeg", 0.36);
  return result;
}

export default function ChatComposer({
  speakers,
  defaultSpeakerId,
  onSend,
  disabled,
  placeholder = "随时说点什么，回合外也能聊",
}: ChatComposerProps) {
  const [speakerId, setSpeakerId] = useState(defaultSpeakerId);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (speakers.some((speaker) => speaker.id === defaultSpeakerId)) setSpeakerId(defaultSpeakerId);
  }, [defaultSpeakerId, speakers]);

  const send = (options?: { emoji?: string; image?: string; big?: boolean; text?: string }) => {
    if (disabled) return;
    const body = (options?.text ?? text).trim();
    const imageData = options?.image ?? image;
    if (!body && !imageData) return;
    onSend(speakerId, body, {
      emoji: options?.emoji,
      image: imageData || undefined,
      big: options?.big,
    });
    setText("");
    setImage("");
    setShowEmoji(false);
    setShowStickers(false);
    setError("");
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("只能发图片。");
      return;
    }
    try {
      const compressed = await compressImage(file);
      if (compressed.length > 140_000) {
        setError("图片还是有点大，换一张小一点的吧。");
        return;
      }
      setImage(compressed);
      setError("");
    } catch {
      setError("这张图片读不出来，换一张试试。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="border-t border-line/60 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        {speakers.length > 1 ? (
          <select
            value={speakerId}
            onChange={(event) => setSpeakerId(event.target.value)}
            className="max-w-[92px] shrink-0 rounded-lg border border-line/60 bg-ink/40 px-1.5 py-2 text-[9px] text-white/70 outline-none"
            aria-label="发言身份"
          >
            {speakers.map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.emoji} {speaker.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="shrink-0 rounded-lg border border-line/60 bg-ink/40 px-2 py-2 text-[9px] text-white/55">
            {speakers[0]?.emoji} {speakers[0]?.name}
          </span>
        )}

        <button
          type="button"
          className={`shrink-0 rounded-lg border px-2 py-2 text-xs transition ${
            showEmoji || showStickers ? "border-neon/50 bg-neon/10" : "border-line/60 bg-white/[0.03] hover:border-neon/40"
          }`}
          onClick={() => {
            setShowEmoji((value) => !value);
            setShowStickers(false);
          }}
          aria-label="表情"
        >
          🙂
        </button>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-line/60 bg-white/[0.03] px-2 py-2 text-xs transition hover:border-neon/40"
          onClick={() => fileRef.current?.click()}
          aria-label="发送图片"
        >
          🖼
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void upload(event.target.files?.[0])}
        />

        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          maxLength={200}
          className="min-w-0 flex-1 rounded-xl border border-line/50 bg-ink/30 px-3 py-2 text-[10px] text-white/75 outline-none transition placeholder:text-white/20 focus:border-neon/40"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={disabled || (!text.trim() && !image)}
          className="shrink-0 rounded-lg bg-neon/15 px-2.5 py-2 text-[9px] font-semibold text-neon transition hover:bg-neon/25 disabled:opacity-30"
        >
          发送
        </button>
      </div>

      {showEmoji && (
        <div className="mt-2 rounded-xl border border-line/60 bg-ink/40 p-2">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-[8px] tracking-[0.14em] text-muted">表情</span>
            <button
              type="button"
              className="text-[8px] text-neon/80"
              onClick={() => {
                setShowStickers(true);
                setShowEmoji(false);
              }}
            >
              切到表情包
            </button>
          </div>
          <div className="grid grid-cols-12 gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setText((value) => `${value}${emoji}`)}
                className="rounded-md py-1 text-base transition hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {showStickers && (
        <div className="mt-2 rounded-xl border border-line/60 bg-ink/40 p-2">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-[8px] tracking-[0.14em] text-muted">群表情包 · 点了直接发</span>
            <button
              type="button"
              className="text-[8px] text-neon/80"
              onClick={() => {
                setShowStickers(false);
                setShowEmoji(true);
              }}
            >
              切到 emoji
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {STICKERS.map((sticker) => (
              <button
                key={sticker.label}
                type="button"
                onClick={() => send({ emoji: sticker.emoji, text: sticker.label, big: true })}
                className="rounded-lg border border-line/50 bg-panel2/40 px-1 py-2 text-center transition hover:border-neon/40"
              >
                <div className="text-xl">{sticker.emoji}</div>
                <div className="mt-0.5 text-[8px] text-white/55">{sticker.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {image && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-neon/25 bg-neon/[0.04] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="待发送图片" className="h-12 w-12 rounded-lg object-cover" />
          <div className="flex-1 text-[9px] leading-4 text-muted">图片已压缩，确认后点发送。</div>
          <button type="button" className="text-[9px] text-ember/80" onClick={() => setImage("")}>
            移除
          </button>
        </div>
      )}

      {error && <div className="mt-1.5 px-1 text-[9px] text-ember">{error}</div>}
    </div>
  );
}
