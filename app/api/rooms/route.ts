import { NextResponse } from "next/server";
import { DEMO_MEMBERS } from "@/lib/demoData";
import { createRoom, toView } from "@/lib/roomStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { hostId, humanIds, groupName } = body as {
    hostId?: unknown;
    humanIds?: unknown;
    groupName?: unknown;
  };

  if (typeof hostId !== "string" || !hostId) {
    return NextResponse.json({ error: "missing hostId" }, { status: 400 });
  }
  if (
    !Array.isArray(humanIds) ||
    humanIds.length < 1 ||
    humanIds.length > 10 ||
    new Set(humanIds).size !== humanIds.length
  ) {
    return NextResponse.json({ error: "需要 1–10 个不同的真人位置" }, { status: 400 });
  }

  const validIds = new Set(DEMO_MEMBERS.map((member) => member.id));
  if (!humanIds.every((id) => typeof id === "string" && validIds.has(id))) {
    return NextResponse.json({ error: "invalid memberId" }, { status: 400 });
  }

  const hostMember = DEMO_MEMBERS.find((member) => member.id === humanIds[0]);
  const room = createRoom(
    hostId,
    humanIds as string[],
    typeof groupName === "string" && groupName.trim() ? groupName.trim() : "306 不熄灯",
    hostMember?.name ?? "房主",
  );

  return NextResponse.json(toView(room, true));
}
