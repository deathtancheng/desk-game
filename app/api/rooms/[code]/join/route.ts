import { NextResponse } from "next/server";
import { DEMO_MEMBERS } from "@/lib/demoData";
import { getRoom, toView } from "@/lib/roomStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const { clientId, memberId } = body as { clientId?: unknown; memberId?: unknown };
  if (typeof clientId !== "string" || typeof memberId !== "string") {
    return NextResponse.json({ error: "missing clientId or memberId" }, { status: 400 });
  }
  if (!room.humanIds.includes(memberId)) {
    return NextResponse.json({ error: "这个角色不在本局" }, { status: 400 });
  }

  const existing = room.players.find((player) => player.memberId === memberId);
  if (existing && existing.clientId !== clientId) {
    return NextResponse.json({ error: "这个位置已经有人了" }, { status: 409 });
  }

  if (!existing) {
    const member = DEMO_MEMBERS.find((item) => item.id === memberId);
    room.players.push({
      memberId,
      clientId,
      name: member?.name ?? "群友",
      joinedAt: Date.now(),
    });
    room.version += 1;
    room.updatedAt = Date.now();
  }

  return NextResponse.json(toView(room, false));
}
