/**
 * `app/api/chat` 호출.
 *
 * 여기서 OpenAI 주소를 직접 부르지 않는다. 브라우저에서 실행되는 코드이므로 API 키가 없고,
 * 있어서도 안 된다. 통로를 거치는 이유는 `app/api/chat/route.ts`에 적혀 있다.
 */

import { isBodyPartId, isSide, type Side } from "@/app/lib/bodyParts";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * AI가 묻는 질문 수의 한도.
 *
 * 사용자가 이만큼 답하면 화면은 더 묻지 않고 곧바로 정리를 불러 예측 병명을 보여준다.
 * 맞는지 틀린지는 그 결과를 보고 사용자가 말해 고친다. 질문이 끝없이 이어지면 결과를 보기
 * 전에 지친다. 통로(`app/api/chat/route.ts`)도 이 값을 AI에게 알려 준다.
 */
export const MAX_QUESTIONS = 2;

export type ChatContext = {
  bodyPartId: string;
  side: Side;
  checkedSymptoms: string[];
  messages: ChatMessage[];
};

/** 고를 수 있는 보기 하나. `hint`는 비어 있을 수 있다. */
export type Choice = {
  label: string;
  hint: string;
};

/**
 * 대화 한 차례. 질문 하나와 고를 수 있는 보기가 함께 온다.
 *
 * 보기는 비어 있을 수 있다. 더 물을 것이 없다는 뜻이며, 그때 화면은 직접 적기만 남긴다.
 */
export type ChatTurn = {
  reply: string;
  choices: Choice[];
};

export type SummaryResult = {
  bodyPartId: string;
  side: Side;
  symptoms: string[];
  predictedCondition: string;
  summary: string;
};

/** 화면에 그대로 보여줄 수 있는 오류. 서버가 준 한국어 문장을 담는다. */
export class ChatError extends Error {}

async function call(mode: "chat" | "summarize", context: ChatContext): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, ...context }),
    });
  } catch {
    throw new ChatError("연결에 실패했습니다. 인터넷 상태를 확인해 주세요.");
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    throw new ChatError("응답을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "AI 요청이 실패했습니다. 잠시 뒤 다시 시도해 주세요.";
    throw new ChatError(message);
  }

  return data;
}

/** 카드 하나에 담을 수 있는 수. 이보다 많이 오면 앞에서부터 자른다. */
const MAX_CHOICES = 5;

/**
 * 보기 목록을 읽는다.
 *
 * 이름이 비어 있는 보기는 버린다. 누를 수는 있는데 무엇을 고른 것인지 알 수 없는 줄이 화면에
 * 생기면 안 된다.
 */
function toChoices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];

  const choices: Choice[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const raw = item as Record<string, unknown>;
    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    if (!label) continue;
    const hint = typeof raw.hint === "string" ? raw.hint.trim() : "";
    choices.push({ label, hint });
  }

  return choices.slice(0, MAX_CHOICES);
}

export async function sendChat(context: ChatContext): Promise<ChatTurn> {
  const data = (await call("chat", context)) as Record<string, unknown>;

  const reply = typeof data.reply === "string" ? data.reply.trim() : "";
  if (!reply) {
    throw new ChatError("AI가 빈 응답을 보냈습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  return { reply, choices: toChoices(data.choices) };
}

/**
 * 정리 결과를 받는다.
 *
 * AI가 목록에 없는 부위나 면을 돌려주면 사용자가 처음 고른 값을 그대로 쓴다.
 * 화면이 다시 판단할 필요가 없도록 여기서 정리해 내보낸다.
 */
export async function requestSummary(context: ChatContext): Promise<SummaryResult> {
  const data = (await call("summarize", context)) as Record<string, unknown>;

  const bodyPartId =
    typeof data.bodyPartId === "string" && isBodyPartId(data.bodyPartId)
      ? data.bodyPartId
      : context.bodyPartId;

  const side = typeof data.side === "string" && isSide(data.side) ? data.side : context.side;

  const symptoms = Array.isArray(data.symptoms)
    ? data.symptoms
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

  return {
    bodyPartId,
    side,
    symptoms,
    predictedCondition: typeof data.predictedCondition === "string" ? data.predictedCondition : "",
    summary: typeof data.summary === "string" ? data.summary : "",
  };
}
