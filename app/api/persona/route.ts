import { NextResponse } from "next/server";
import { judgePersonaLocal } from "@/lib/personaRules";
import type {
  ActionChoice,
  PersonaJudgePlayer,
  PersonaJudgeRequest,
  PersonaVerdict,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RULE_TYPES = new Set(["negotiation", "bidding", "escape"]);

const SYSTEM_PROMPT = `你是桌游《群戏》的群主人设裁判。
你的任务：根据每个玩家的群聊标签，判断他这一回合的行动像不像这个人。
只输出 JSON，不要 markdown，不要解释。

判定规则：
1. 行动明显符合至少一个标签：delta = 1。
2. 行动明显违背至少一个标签：delta = -1。
3. 信息不足或动作中性：delta = 0。
4. 每个玩家必须恰好一条 verdict。
5. line 用中文，20 字以内，损友语气，但不人身攻击、不评价真实人格、不涉及隐私。
6. 只能引用输入里出现的标签；不要编造新标签。
7. delta = 0 时 line 可以是空字符串。

输出格式：
{"verdicts":[{"id":"m1","delta":1,"tag":"外卖部长","line":"阿伟 的「自荐」很像「外卖部长」，人设 +1"}]}`;

function isJudgeRequest(value: unknown): value is PersonaJudgeRequest {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (typeof data.ruleType !== "string" || !RULE_TYPES.has(data.ruleType)) return false;
  if (typeof data.round !== "number" || typeof data.event !== "string") return false;
  if (!Array.isArray(data.players) || data.players.length < 1 || data.players.length > 6) return false;

  return data.players.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const player = entry as Record<string, unknown>;
    if (typeof player.id !== "string" || typeof player.name !== "string" || !Array.isArray(player.tags)) {
      return false;
    }
    if (!player.action || typeof player.action !== "object") return false;
    const action = player.action as Record<string, unknown>;
    return (
      typeof action.kind === "string" &&
      typeof action.label === "string" &&
      typeof action.detail === "string"
    );
  });
}

function localVerdicts(players: PersonaJudgePlayer[]): PersonaVerdict[] {
  return players.map((player) => {
    const action: ActionChoice = {
      kind: player.action.kind,
      amount: player.action.amount,
      bid: player.action.bid,
      contribution: player.action.contribution,
    };
    return judgePersonaLocal(player.id, player.name, player.tags, action);
  });
}

async function callLLM(request: PersonaJudgeRequest): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("missing LLM_API_KEY");

  const baseUrl = (
    process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
  ).replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || "qwen-plus";
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 9000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `请判定这一回合：\n${JSON.stringify(request, null, 2)}` },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`LLM ${response.status}: ${detail.slice(0, 160)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | { text?: string }[] } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map((part) => part?.text ?? "").join("");
    throw new Error("LLM returned empty content");
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM returned no JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeVerdicts(raw: unknown, request: PersonaJudgeRequest): PersonaVerdict[] {
  const data = raw as { verdicts?: unknown };
  if (!Array.isArray(data.verdicts)) throw new Error("verdicts missing");

  const playerIds = new Set(request.players.map((player) => player.id));
  const verdicts: PersonaVerdict[] = [];

  for (const entry of data.verdicts) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || !playerIds.has(item.id)) continue;

    const delta = item.delta === 1 ? 1 : item.delta === -1 ? -1 : 0;
    const line = typeof item.line === "string" ? item.line.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    const tag = typeof item.tag === "string" ? item.tag.trim().slice(0, 20) : undefined;
    verdicts.push({ id: item.id, delta, line, tag });
  }

  if (verdicts.length === 0) throw new Error("no valid verdicts");
  return verdicts;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!isJudgeRequest(body)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const mock = process.env.LLM_MOCK === "1";
  const apiKey = process.env.LLM_API_KEY;

  if (mock || !apiKey) {
    if (!mock) {
      return NextResponse.json(
        {
          error: "LLM not configured",
          hint: "Set LLM_API_KEY in .env.local, or LLM_MOCK=1 for a local test.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      verdicts: localVerdicts(body.players),
      source: "mock",
    });
  }

  try {
    const text = await callLLM(body);
    const verdicts = normalizeVerdicts(extractJson(text), body);
    return NextResponse.json({
      verdicts,
      source: "llm",
      model: process.env.LLM_MODEL || "qwen-plus",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "LLM judge failed",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 502 },
    );
  }
}
