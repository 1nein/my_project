/**
 * AI 호출 통로. **서버에서만 실행된다.**
 *
 * 브라우저가 OpenAI를 직접 부르지 않는 이유는 API 키 때문이다. 브라우저 코드에 들어간 키는
 * 배포된 사이트에서 누구나 꺼낼 수 있고, 꺼낸 사람이 쓴 요금이 키 주인에게 청구된다.
 * 그래서 키는 이 파일에서만 읽고, 오류 메시지에도 담지 않는다.
 *
 * 모델 이름도 이 파일 한 곳에만 둔다. 바꿀 때 한 줄만 고치면 되게 하기 위해서다.
 */

import { NextResponse } from "next/server";
import { BODY_PARTS, SIDES } from "@/app/lib/bodyParts";

const OPENAI_MODEL = "gpt-5-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatRequest = {
  mode: "chat" | "summarize";
  bodyPartId: string;
  side: string;
  checkedSymptoms: string[];
  messages: ChatMessage[];
};

const PART_IDS = BODY_PARTS.map((part) => part.id);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseBody(raw: unknown): ChatRequest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;

  const mode = body.mode;
  if (mode !== "chat" && mode !== "summarize") return null;

  const bodyPartId = body.bodyPartId;
  if (typeof bodyPartId !== "string" || !PART_IDS.includes(bodyPartId)) return null;

  const side = body.side;
  if (typeof side !== "string" || !SIDES.includes(side as (typeof SIDES)[number])) return null;

  if (!Array.isArray(body.messages)) return null;
  const messages: ChatMessage[] = [];
  for (const item of body.messages) {
    if (typeof item !== "object" || item === null) return null;
    const message = item as Record<string, unknown>;
    if (message.role !== "user" && message.role !== "assistant") return null;
    if (typeof message.content !== "string") return null;
    messages.push({ role: message.role, content: message.content });
  }

  const checkedSymptoms = Array.isArray(body.checkedSymptoms)
    ? body.checkedSymptoms.filter((item): item is string => typeof item === "string")
    : [];

  return { mode, bodyPartId, side, checkedSymptoms, messages };
}

function partLabel(id: string): string {
  return BODY_PARTS.find((part) => part.id === id)?.label ?? id;
}

function systemPrompt(request: ChatRequest): string {
  const checked =
    request.checkedSymptoms.length > 0
      ? request.checkedSymptoms.join(", ")
      : "(체크한 증상 없음)";

  return [
    "너는 사용자가 몸의 어디가 어떻게 불편한지 스스로 정리하도록 돕는 한국어 도우미다.",
    "",
    `사용자가 고른 부위: ${partLabel(request.bodyPartId)} (${request.bodyPartId})`,
    `고른 면: ${request.side}`,
    `사용자가 체크한 증상: ${checked}`,
    "",
    "지켜야 할 것:",
    "- 한국어로, 짧고 쉬운 말로 답한다. 한 번에 한두 가지만 묻는다.",
    "- 병명을 확정해서 말하지 않는다. 말하게 되면 항상 '예측'임을 밝힌다.",
    "- 사용자가 말한 내용을 넘겨짚지 않는다. 모르는 것은 묻는다.",
    "- 대화 내용이 고른 부위와 다른 곳을 가리키면 다른 부위를 제안해도 된다.",
    "- 증상 이름은 짧고 일관되게 쓴다. 같은 증상을 매번 다르게 부르지 않는다.",
  ].join("\n");
}

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    bodyPartId: {
      type: "string",
      enum: PART_IDS,
      description: "대화를 바탕으로 판단한 부위 식별자",
    },
    side: {
      type: "string",
      enum: [...SIDES],
      description: "앞쪽 front, 뒤쪽 back, 옆쪽 side, 정하지 않음 unspecified",
    },
    symptoms: {
      type: "array",
      items: { type: "string" },
      description: "정리한 증상 이름. 짧은 명사구로 쓴다",
    },
    predictedCondition: {
      type: "string",
      description: "예측한 병명. 예측할 수 없으면 빈 문자열",
    },
    summary: { type: "string", description: "한두 문장 요약" },
  },
  required: ["bodyPartId", "side", "symptoms", "predictedCondition", "summary"],
  additionalProperties: false,
} as const;

const SUMMARY_INSTRUCTION = [
  "지금까지의 대화와 체크한 증상을 바탕으로 정리 결과를 만들어라.",
  "증상 이름은 짧은 명사구로 쓴다. 예: '무릎 앞쪽 통증', '계단 내려올 때 악화'.",
  "병명은 확신할 수 없으면 빈 문자열로 둔다. 확정 표현을 쓰지 않는다.",
  "부위나 면이 처음 고른 것과 다르다고 판단되면 바꿔서 돌려줘도 된다.",
].join("\n");

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("요청 형식을 읽을 수 없습니다.");
  }

  const parsed = parseBody(raw);
  if (!parsed) {
    return badRequest("요청 내용이 올바르지 않습니다.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI 기능이 설정되지 않았습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt(parsed) },
    ...parsed.messages,
  ];
  if (parsed.mode === "summarize") {
    messages.push({ role: "user", content: SUMMARY_INSTRUCTION });
  }

  const payload: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages,
  };
  if (parsed.mode === "summarize") {
    payload.response_format = {
      type: "json_schema",
      json_schema: { name: "symptom_summary", strict: true, schema: SUMMARY_SCHEMA },
    };
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // 네트워크 오류. 원문에 키가 섞일 수 있으므로 그대로 흘리지 않는다.
    return NextResponse.json(
      { error: "AI에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    console.error(`OpenAI 호출 실패: ${response.status}`);
    return NextResponse.json(
      { error: "AI가 응답하지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  let content: string;
  try {
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    content = data.choices?.[0]?.message?.content ?? "";
  } catch {
    return NextResponse.json(
      { error: "AI 응답을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  if (!content.trim()) {
    return NextResponse.json(
      { error: "AI가 빈 응답을 보냈습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  if (parsed.mode === "chat") {
    return NextResponse.json({ reply: content });
  }

  try {
    const summary = JSON.parse(content) as Record<string, unknown>;
    return NextResponse.json({
      bodyPartId: summary.bodyPartId,
      side: summary.side,
      symptoms: summary.symptoms,
      predictedCondition: summary.predictedCondition,
      summary: summary.summary,
    });
  } catch {
    return NextResponse.json(
      { error: "AI 정리 결과를 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
