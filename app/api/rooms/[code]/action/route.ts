import { NextResponse } from "next/server";
import { getRoom } from "@/lib/roomStore";
import type { ActionChoice } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_KINDS = new Set([
  "propose",
  "support",
  "meme",
  "pass",
  "volunteer",
  "underbid",
  "back",
  "bid",
  "abstain",
  "coalition",
  "contribute",
  "blame",
]);

function validAction(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  if (typeof action.kind !== "string" || !ACTION_KINDS.has(action.kind)) return false;
  if (
    action.targetId !== undefined &&
    (typeof action.targetId !== "string" || !action.targetId || action.targetId.length > 24)
  ) {
    return false;
  }
  if (action.memeText !== undefined && (typeof action.memeText !== "string" || action.memeText.length > 40)) {
    return false;
  }
  if (action.useSkill !== undefined && typeof action.useSkill !== "boolean") return false;
  const bounded = (input: unknown, max: number) =>
    input === undefined || (typeof input === "number" && Number.isInteger(input) && input >= 0 && input <= max);
  return bounded(action.amount, 2) && bounded(action.bid, 3) && bounded(action.contribution, 2);
}

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

  const { clientId, memberId, action } = body as {
    clientId?: unknown;
    memberId?: unknown;
    action?: unknown;
  };

  if (typeof clientId !== "string" || typeof memberId !== "string") {
    return NextResponse.json({ error: "missing clientId or memberId" }, { status: 400 });
  }
  if (!validAction(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const claim = room.players.find((player) => player.memberId === memberId);
  if (!claim || claim.clientId !== clientId) {
    return NextResponse.json({ error: "你还没有加入这个位置" }, { status: 403 });
  }
  if (!room.state) {
    return NextResponse.json({ error: "房主还没开局" }, { status: 409 });
  }
  if (room.state.phase !== "action") {
    return NextResponse.json({ error: "现在不是出牌阶段" }, { status: 409 });
  }

  const current = room.state.players[room.state.pendingIndex];
  if (!current || current.memberId !== memberId) {
    return NextResponse.json({ error: "还没轮到你" }, { status: 409 });
  }

  room.pending = room.pending.filter((item) => item.memberId !== memberId);
  room.pending.push({
    id: crypto.randomUUID(),
    memberId,
    clientId,
    action: action as ActionChoice,
    round: typeof room.state.round === "number" ? room.state.round : undefined,
    createdAt: Date.now(),
  });
  room.updatedAt = Date.now();

  return NextResponse.json({ ok: true });
}
