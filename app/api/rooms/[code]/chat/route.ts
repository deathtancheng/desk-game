import { NextResponse } from "next/server";
import { getRoom, touchRoom } from "@/lib/roomStore";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 300;
const MAX_IMAGE = 140_000;

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "房间不存在或已过期" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { clientId, memberId, id, text, emoji, image, big } = body as {
    clientId?: unknown;
    memberId?: unknown;
    id?: unknown;
    text?: unknown;
    emoji?: unknown;
    image?: unknown;
    big?: unknown;
  };

  if (typeof clientId !== "string" || typeof memberId !== "string") {
    return NextResponse.json({ error: "missing clientId or memberId" }, { status: 400 });
  }

  const claim = room.players.find((player) => player.memberId === memberId);
  if (!claim || claim.clientId !== clientId) {
    return NextResponse.json({ error: "先加入这个位置再聊天" }, { status: 403 });
  }

  const bodyText = typeof text === "string" ? text.trim().slice(0, MAX_TEXT) : "";
  const bodyImage = typeof image === "string" ? image : "";
  if (!bodyText && !bodyImage) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }
  if (bodyImage && (!bodyImage.startsWith("data:image/") || bodyImage.length > MAX_IMAGE)) {
    return NextResponse.json({ error: "图片太大或格式不支持" }, { status: 400 });
  }

  const message: ChatMessage = {
    id: typeof id === "string" && id.length <= 80 ? id : crypto.randomUUID(),
    kind: "chat",
    memberId,
    text: bodyText,
    emoji: typeof emoji === "string" ? emoji.slice(0, 8) : undefined,
    image: bodyImage || undefined,
    big: Boolean(big),
    at: Date.now(),
  };

  room.chat = room.chat ?? [];
  room.chat.push(message);
  if (room.chat.length > 60) room.chat = room.chat.slice(-60);
  const imageMessages = room.chat.filter((item) => item.image);
  for (const old of imageMessages.slice(0, Math.max(0, imageMessages.length - 6))) {
    old.image = undefined;
  }
  touchRoom(room);

  return NextResponse.json({ ok: true, message });
}
