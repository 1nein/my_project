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
import { BODY_PARTS, SIDES, SIDE_LABELS, type Side } from "@/app/lib/bodyParts";
import { MAX_QUESTIONS } from "@/app/lib/chatClient";

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

/**
 * 면을 AI가 알아듣는 말로 바꾼다.
 *
 * `front` 같은 값만 넘기면 AI는 가슴 / 등 부위에서 그것이 가슴인지 등인지 짐작하지 못한다.
 * 그래서 사용자가 위쪽 막대에서 면을 바꿔도 질문이 달라지지 않았다.
 */
function sideDescription(side: string): string {
  // parseBody가 SIDES 안의 값만 통과시키므로 Side로 볼 수 있다.
  const label = SIDE_LABELS[side as Side];
  return side === "unspecified" ? `${label} (사용자가 정하지 않음)` : `${label} (${side})`;
}

/**
 * 대화 모드에서 지켜야 할 답 형식.
 *
 * 빈 입력창 앞에서 무엇을 적을지 고민하지 않도록, AI가 질문 하나와 고를 수 있는 보기를 함께
 * 내놓는다. 보기에 없는 답은 화면이 따로 마련한 직접 입력으로 받는다.
 *
 * 질문 수는 `MAX_QUESTIONS`로 묶는다. 그 수만큼 답하면 화면이 더 묻지 않고 곧바로 정리를
 * 부른다. AI에게 지금 몇 번째인지 알려 주어야 남은 질문을 아껴 쓴다.
 */
function chatInstruction(request: ChatRequest): string {
  const asked = request.messages.filter((message) => message.role === "assistant").length;
  const turn = Math.min(asked + 1, MAX_QUESTIONS);

  return [
    "이번 답은 형식을 지켜 내놓는다:",
    `- 질문은 모두 ${MAX_QUESTIONS}번까지만 한다. 그 뒤에는 화면이 곧바로 예측 병명을 보여준다. 지금은 ${turn}번째 질문이다.`,
    "- 그러니 병명을 좁히는 데 가장 도움이 되는 것 하나만 묻는다. 이미 짐작 가는 병명이 있으면 그 짐작을 가르는 질문을 한다.",
    "- reply에는 사용자에게 할 질문을 한 문장으로 쓴다. 한 번에 하나만 묻는다.",
    "- choices에는 그 질문에 바로 답이 되는 보기를 2~5개 넣는다.",
    "- 보기의 label은 12자 이내의 짧은 이름이고, hint는 그 보기가 무슨 뜻인지 20자 이내로 덧붙이는 한 줄이다. 덧붙일 말이 없으면 hint를 빈 문자열로 둔다.",
    "- 사용자는 보기를 여러 개 고를 수 있다. 서로 겹치거나 한쪽이 다른 쪽을 포함하는 보기를 넣지 않는다.",
    "- '기타', '모르겠어요', '직접 입력' 같은 보기는 넣지 않는다. 화면이 따로 제공한다.",
    "- 사용자가 이미 답한 내용과 겹치는 보기는 넣지 않는다.",
    "- 주고받은 말이 아직 없으면 그 부위와 면에서 가장 먼저 물어야 할 것을 묻는다.",
    "- 더 물을 것이 없으면 reply에 정리를 권하는 한 문장을 쓰고 choices를 빈 배열로 둔다.",
  ].join("\n");
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
    `고른 면: ${sideDescription(request.side)}`,
    `사용자가 체크한 증상: ${checked}`,
    "",
    "지켜야 할 것:",
    "- 한국어로, 짧고 쉬운 말로 답한다. 한 번에 한 가지만 묻는다.",
    "- 병명을 확정해서 말하지 않는다. 말하게 되면 항상 '예측'임을 밝힌다.",
    "- 사용자가 말한 내용을 넘겨짚지 않는다. 모르는 것은 묻는다.",
    "- 면은 같은 부위 안에서 어느 쪽인지를 뜻한다. 가슴 / 등에서 앞쪽은 가슴, 뒤쪽은 등이다. 복부 / 허리에서 앞쪽은 배, 뒤쪽은 허리다. 머리에서 앞쪽은 이마와 얼굴, 뒤쪽은 뒤통수다. 질문과 보기, 예측은 고른 면에 맞춘다.",
    "- 대화 내용이 고른 부위와 다른 곳을 가리키면 다른 부위를 제안해도 된다.",
    "- 증상 이름은 짧고 일관되게 쓴다. 같은 증상을 매번 다르게 부르지 않는다.",
    ...(request.mode === "chat" ? ["", chatInstruction(request)] : []),
  ].join("\n");
}

const CHAT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "사용자에게 할 질문 한 문장" },
    choices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "보기 이름. 12자 이내" },
          hint: { type: "string", description: "한 줄 설명. 20자 이내. 덧붙일 말이 없으면 빈 문자열" },
        },
        required: ["label", "hint"],
        additionalProperties: false,
      },
      description: "그 질문에 바로 답이 되는 보기 2~5개. 더 물을 것이 없으면 빈 배열",
    },
  },
  required: ["reply", "choices"],
  additionalProperties: false,
} as const;

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
      description: "가장 가능성이 높아 보이는 병명. 좁힐 수 없으면 '두통'처럼 넓은 이름을 쓴다",
    },
    summary: {
      type: "string",
      description: "줄바꿈으로 나눈 2~4줄. 한 줄에 한 가지만 담고, 글머리표는 붙이지 않는다",
    },
  },
  required: ["bodyPartId", "side", "symptoms", "predictedCondition", "summary"],
  additionalProperties: false,
} as const;

const SUMMARY_INSTRUCTION = [
  "지금까지의 대화와 체크한 증상을 바탕으로 정리 결과를 만들어라.",
  "증상 이름은 짧은 명사구로 쓴다. 예: '무릎 앞쪽 통증', '계단 내려올 때 악화'.",
  "병명은 비워 두지 말고 가장 가능성이 높아 보이는 것을 하나 쓴다. 좁힐 수 없으면 '두통', '요통'처럼 넓은 이름이어도 된다. 확정 표현('~입니다', '~로 진단됩니다')은 쓰지 않는다.",
  "병명에는 이름만 쓴다. '(예측)', '의심', '가능성' 같은 말을 덧붙이지 않는다. 예측이라는 것은 화면이 따로 표시한다.",
  "요약은 줄바꿈으로 나눈 2~4줄로 쓴다. 한 줄에 한 가지만 담고 20자 안팎으로 끊는다. 예: '하루 전부터 시작', '이마 부위가 계속 아픔'.",
  "요약의 각 줄 앞에 '-'나 '*' 같은 글머리표를 붙이지 않는다. 화면이 붙인다.",
  "요약에 병명을 다시 적지 않는다. 병명은 따로 표시된다.",
  "요약에는 사용자가 말한 것만 적는다. '체크 없음', '정보 없음'처럼 없는 것을 세는 줄은 넣지 않는다.",
  "부위나 면이 처음 고른 것과 다르다고 판단되면 바꿔서 돌려줘도 된다.",
  "대화가 짧아도 정리한다. 더 물어보자고 하지 말고, 지금까지 들은 것으로 가장 그럴듯한 병명을 고른다.",
  "사용자가 앞선 예측이 아니라고 했다면 그 병명을 다시 내놓지 않는다. 사용자가 덧붙인 말을 가장 우선으로 반영해 다른 병명과 요약을 고른다.",
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

  /*
   * 추론을 짧게 시킨다. 기본값으로 두면 질문 하나에 10~15초가 걸려 대화가 늘어진다.
   * 질문은 보기를 고르는 일이라 가장 짧게, 정리는 병명을 골라야 하므로 한 단계 더 둔다.
   */
  const payload: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages,
    reasoning_effort: parsed.mode === "chat" ? "minimal" : "low",
  };
  payload.response_format =
    parsed.mode === "chat"
      ? {
          type: "json_schema",
          json_schema: { name: "guided_reply", strict: true, schema: CHAT_SCHEMA },
        }
      : {
          type: "json_schema",
          json_schema: { name: "symptom_summary", strict: true, schema: SUMMARY_SCHEMA },
        };

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
    try {
      const turn = JSON.parse(content) as Record<string, unknown>;
      return NextResponse.json({ reply: turn.reply, choices: turn.choices });
    } catch {
      return NextResponse.json(
        { error: "AI 응답을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
        { status: 502 },
      );
    }
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
