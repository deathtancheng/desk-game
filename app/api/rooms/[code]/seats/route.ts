import { NextResponse } from "next/server";
import { getRoom, touchRoom, toView } from "@/lib/roomStore";
import { DEMO_MEMBERS } from "@/lib/demoData";

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

  const { hostId, humanIds, hostMemberId } = body as {
    hostId?: unknown;
    humanIds?: unknown;
    hostMemberId?: unknown;
  };
  if (typeof hostId !== "string" || hostId !== room.hostId) {
    return NextResponse.json({ error: "只有房主可以调整席位" }, { status: 403 });
  }
  if (room.state) {
    return NextResponse.json({ error: "已经开局，不能再调整席位" }, { status: 409 });
  }
  if (
    !Array.isArray(humanIds) ||
    humanIds.length < 1 ||
    humanIds.length > 10 ||
    new Set(humanIds).size !== humanIds.length
  ) {
    return NextResponse.json({ error: "真人席位需要 1–10 个且不能重复" }, { status: 400 });
  }

  const validIds = new Set(DEMO_MEMBERS.map((member) => member.id));
  if (!humanIds.every((id) => typeof id === "string" && validIds.has(id))) {
    return NextResponse.json({ error: "invalid memberId" }, { status: 400 });
  }

  const hostPlayer = room.players.find((player) => player.clientId === room.hostId);
  const nextHostMemberId =
    typeof hostMemberId === "string" && hostMemberId ? hostMemberId : hostPlayer?.memberId;
  if (!nextHostMemberId || !humanIds.includes(nextHostMemberId)) {
    return NextResponse.json({ error: "房主角色必须在真人席位里" }, { status: 400 });
  }

  const targetClaim = room.players.find((player) => player.memberId === nextHostMemberId);
  if (targetClaim && targetClaim.clientId !== room.hostId) {
    return NextResponse.json({ error: "这个角色已经被室友认领" }, { status: 409 });
  }

  const joinedAt = hostPlayer?.joinedAt ?? Date.now();
  room.humanIds = humanIds as string[];
  room.players = room.players.filter(
    (player) => player.clientId !== room.hostId && room.humanIds.includes(player.memberId),
  );
  room.players.push({
    memberId: nextHostMemberId,
    clientId: room.hostId,
    name: "房主",
    joinedAt,
  });
  touchRoom(room);

  return NextResponse.json(toView(room, true));
}
