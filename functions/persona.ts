interface PersonaVerdict {
  id: string;
  delta: -1 | 0 | 1;
  tag?: string;
  line: string;
}

const MAX_BODY = 64 * 1024;

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
8. 如果玩家在群聊里说了话，也要参考他说话的口吻是否像标签。

输出格式：
{"verdicts":[{"id":"m1","delta":1,"tag":"外卖部长","line":"阿伟 的「自荐」很像「外卖部长」，人设 +1"}]}`;

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeVerdicts(raw: unknown, players: { id?: unknown }[]): PersonaVerdict[] {
  const data = raw as { verdicts?: unknown };
  if (!Array.isArray(data?.verdicts)) throw new Error("no_verdicts");
  const ids = new Set(players.map((player) => player.id).filter((id): id is string => typeof id === "string"));
  const verdicts: PersonaVerdict[] = [];

  for (const entry of data.verdicts) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || !ids.has(item.id)) continue;
    const delta = item.delta === 1 ? 1 : item.delta === -1 ? -1 : 0;
    const line = typeof item.line === "string" ? item.line.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    const tag = typeof item.tag === "string" ? item.tag.trim().slice(0, 20) : undefined;
    verdicts.push({ id: item.id, delta, line, tag });
  }

  if (verdicts.length === 0) throw new Error("empty_verdicts");
  return verdicts;
}

export async function handlePersona(
  request: Request,
  fail: (code: string, status: number) => never,
): Promise<Response> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("application/json")) fail("invalid_input", 400);
  const text = await request.text();
  if (text.length > MAX_BODY) fail("payload_too_large", 413);

  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    fail("invalid_input", 400);
  }

  if (!body || !Array.isArray(body.players) || body.players.length < 1 || body.players.length > 10) {
    fail("invalid_input", 400);
  }

  const apiKey = Deno.env.get("LLM_API_KEY");
  if (!apiKey) fail("llm_not_configured", 503);

  const baseUrl = (Deno.env.get("LLM_BASE_URL") || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(
    /\/+$/,
    "",
  );
  const model = Deno.env.get("LLM_MODEL") || "qwen-plus";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

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
          { role: "user", content: `请判定这一回合：\n${JSON.stringify(body, null, 2)}` },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      await response.body?.cancel();
      return Response.json({ error: "llm_unavailable" }, { status: 502 });
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | { text?: string }[] } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    const answer =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((part) => part?.text || "").join("")
          : "";
    if (!answer) return Response.json({ error: "llm_empty" }, { status: 502 });

    const verdicts = normalizeVerdicts(extractJson(answer), body.players);
    return Response.json({ verdicts, source: "llm", model });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return Response.json(
      { error: aborted ? "llm_timeout" : "llm_failed" },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
