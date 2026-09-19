/**
 * `app/api/chat` 호출.
 *
 * 여기서 OpenAI 주소를 직접 부르지 않는다. 브라우저에서 실행되는 코드이므로 API 키가 없고,
 * 있어서도 안 된다. 통로를 거치는 이유는 `app/api/chat/route.ts`에 적혀 있다.
 */

import { isBodyPartId, isSide, type Side } from "@/app/lib/bodyParts";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatContext = {
  bodyPartId: string;
  side: Side;
  checkedSymptoms: string[];
  messages: ChatMessage[];
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

export async function sendChat(context: ChatContext): Promise<string> {
  const data = await call("chat", context);
  const reply = (data as { reply?: unknown }).reply;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new ChatError("AI가 빈 응답을 보냈습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  return reply;
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
