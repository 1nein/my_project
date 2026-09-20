"use client";

/**
 * 진단 화면.
 *
 * 홈과 달리 흰 바탕에 글을 읽고 고르는 곳이다. 고른 부위는 위쪽 막대에 한 번만 나오고,
 * 부위를 바꾸는 것도 그 막대에서 한다. 같은 이름을 아래에 다시 적지 않는다.
 *
 * 부위를 고르면 AI가 먼저 묻는다. 사용자는 보기를 누르거나 직접 적어 답하고, 정리하기를 누르면
 * 부위·면·증상·예측 병명·요약이 정리되어 나온다. 대화를 건너뛰고 증상만 체크해 저장해도 된다.
 * 저장하지 않고 떠나면 체크 내용과 대화는 남지 않는다.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BodyModel from "@/app/components/BodyModel";
import BodyPartPicker from "@/app/components/BodyPartPicker";
import SymptomChecklist from "@/app/components/SymptomChecklist";
import ChatPanel from "@/app/components/ChatPanel";
import SummaryLines from "@/app/components/SummaryLines";
import {
  SIDES,
  SIDE_LABELS,
  bodyPartLabel,
  findBodyPart,
  isBodyPartId,
  isSide,
  type Side,
} from "@/app/lib/bodyParts";
import {
  createRecord,
  getRecordsSnapshot,
  getServerRecordsSnapshot,
  isSavable,
  subscribeRecords,
  updateRecord,
  type SymptomRecord,
} from "@/app/lib/records";
import { symptomsFromRecords } from "@/app/lib/symptoms";
import {
  ChatError,
  requestSummary,
  sendChat,
  type ChatMessage,
  type Choice,
  type SummaryResult,
} from "@/app/lib/chatClient";

type Draft = {
  bodyPartId: string | null;
  side: Side;
  checkedSymptoms: string[];
  predictedCondition: string;
  summary: string;
};

/**
 * 주소와 저장소에서 시작값을 읽어 폼에 넘긴다.
 *
 * 폼에 `key`를 주는 이유는, 저장소를 읽기 전(서버 렌더 직후)과 읽은 뒤의 시작값이 다르기
 * 때문이다. key가 바뀌면 폼이 새로 만들어지면서 올바른 값으로 다시 시작한다.
 */
function DiagnoseLoader() {
  const params = useSearchParams();
  const records = useSyncExternalStore(
    subscribeRecords,
    getRecordsSnapshot,
    getServerRecordsSnapshot,
  );

  const recordId = params.get("recordId");
  const editing: SymptomRecord | null = recordId
    ? (records.find((record) => record.id === recordId) ?? null)
    : null;

  const partFromUrl = params.get("bodyPartId");
  const sideFromUrl = params.get("side");

  const draft: Draft = editing
    ? {
        bodyPartId: editing.bodyPartId,
        side: editing.side,
        checkedSymptoms: editing.symptoms,
        predictedCondition: editing.predictedCondition,
        summary: editing.summary,
      }
    : {
        bodyPartId: isBodyPartId(partFromUrl) ? partFromUrl : null,
        side: isSide(sideFromUrl) ? sideFromUrl : "unspecified",
        checkedSymptoms: [],
        predictedCondition: "",
        summary: "",
      };

  const key = editing
    ? `edit:${editing.id}:${editing.createdAt}`
    : `new:${draft.bodyPartId ?? ""}:${draft.side}`;

  return (
    <DiagnoseForm key={key} records={records} editingId={editing?.id ?? null} draft={draft} />
  );
}

type DiagnoseFormProps = {
  records: SymptomRecord[];
  editingId: string | null;
  draft: Draft;
};

function DiagnoseForm({ records, editingId, draft }: DiagnoseFormProps) {
  const router = useRouter();

  const [bodyPartId, setBodyPartId] = useState<string | null>(draft.bodyPartId);
  const [side, setSide] = useState<Side>(draft.side);
  const [checked, setChecked] = useState<string[]>(draft.checkedSymptoms);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  /** 정리를 요청한 시점에 사용자가 고른 부위와 면. AI가 바꿔 제안했는지 판단하는 기준이다. */
  const [requested, setRequested] = useState<{ bodyPartId: string; side: Side } | null>(null);

  /** 첫 질문을 이미 부른 부위. 같은 부위에 두 번 묻지 않게 막는다. */
  const asked = useRef<string | null>(null);

  const symptoms = useMemo(
    () => (bodyPartId ? symptomsFromRecords(records, bodyPartId) : []),
    [records, bodyPartId],
  );

  const part = findBodyPart(bodyPartId);
  const showSide = part?.hasSides ?? false;

  const runChat = useCallback(
    async (next: ChatMessage[]) => {
      if (!bodyPartId) return;
      setMessages(next);
      setChoices([]);
      setBusy(true);
      setChatError(null);
      try {
        const turn = await sendChat({
          bodyPartId,
          side,
          checkedSymptoms: checked,
          messages: next,
        });
        setMessages([...next, { role: "assistant", content: turn.reply }]);
        setChoices(turn.choices);
      } catch (error) {
        // 실패해도 체크한 증상은 그대로 둔다. 그 상태로 저장할 수 있어야 한다.
        setChatError(error instanceof ChatError ? error.message : "AI 요청이 실패했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [bodyPartId, side, checked],
  );

  /*
   * 부위를 고르면 AI가 먼저 묻는다.
   *
   * 빈 입력창을 내밀면 무엇부터 적어야 할지 알기 어렵다. 첫 질문과 보기를 먼저 받아 두면
   * 누르기만 해도 대화가 시작된다. 고치는 중일 때는 부르지 않는다. 원래 정리 결과를 그대로
   * 두고 증상만 손보려는 경우가 있기 때문이다.
   */
  useEffect(() => {
    if (!bodyPartId || editingId) return;
    if (asked.current === bodyPartId) return;
    asked.current = bodyPartId;
    void runChat([]);
  }, [bodyPartId, editingId, runChat]);

  function selectPart(nextId: string, nextSide: Side) {
    if (nextId !== bodyPartId) {
      // 부위가 바뀌면 그 부위의 증상 목록이 달라지므로 체크와 대화를 비운다.
      setChecked([]);
      setMessages([]);
      setChoices([]);
      setSummary(null);
      setRequested(null);
      setChatError(null);
      asked.current = null;
    }
    setBodyPartId(nextId);
    setSide(nextSide);
  }

  function toggleSymptom(symptom: string) {
    setChecked((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    );
  }

  async function handleSummarize() {
    if (!bodyPartId) return;
    setBusy(true);
    setChatError(null);
    setChoices([]);
    setRequested({ bodyPartId, side });
    try {
      const result = await requestSummary({
        bodyPartId,
        side,
        checkedSymptoms: checked,
        messages,
      });
      setSummary(result);
      setBodyPartId(result.bodyPartId);
      setSide(result.side);
    } catch (error) {
      setChatError(error instanceof ChatError ? error.message : "정리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * 저장될 내용.
   *
   * AI 정리를 받았으면 그 결과가 남고, 받지 않았으면 체크한 증상이 남는다. 둘을 합치지 않는다.
   * 고치는 중이고 AI를 다시 부르지 않았다면 원래 병명과 요약을 그대로 유지한다.
   */
  const pending = bodyPartId
    ? {
        bodyPartId,
        side,
        symptoms: summary ? summary.symptoms : checked,
        predictedCondition: summary ? summary.predictedCondition : draft.predictedCondition,
        summary: summary ? summary.summary : draft.summary,
      }
    : null;

  const canSave = pending !== null && isSavable(pending);

  function handleSave() {
    if (!pending || !canSave) return;
    if (editingId) {
      updateRecord(editingId, pending);
    } else {
      createRecord(pending);
    }
    router.push("/");
  }

  // 사용자가 직접 부위를 바꾼 것은 제외한다. 정리를 요청한 시점의 선택과 비교한다.
  const aiChangedTarget =
    summary !== null &&
    requested !== null &&
    (summary.bodyPartId !== requested.bodyPartId || summary.side !== requested.side);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <Link
          href="/"
          aria-label="홈으로"
          className="shrink-0 px-1 text-xl leading-none text-slate-400"
        >
          ←
        </Link>
        <BodyPartPicker
          value={bodyPartId}
          onChange={(id) => selectPart(id, side)}
          className="min-w-0 flex-1 truncate bg-transparent py-1 text-base font-semibold text-slate-900 dark:text-slate-50"
        />
        {showSide && (
          <select
            aria-label="면 고르기"
            value={side}
            onChange={(event) => {
              // 네 값만 들어 있는 목록이라 다른 값이 나올 수 없다.
              setSide(event.target.value as Side);
            }}
            className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
          >
            {SIDES.map((value) => (
              <option key={value} value={value}>
                {SIDE_LABELS[value]}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-5 px-4 py-4">
        {bodyPartId === null ? (
          <div className="h-[460px] overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-900">
            <BodyModel className="relative h-full w-full" onSelect={selectPart} />
          </div>
        ) : (
          <>
            <SymptomChecklist symptoms={symptoms} checked={checked} onToggle={toggleSymptom} />

            <ChatPanel
              messages={messages}
              choices={choices}
              busy={busy}
              error={chatError}
              onSend={(text) => void runChat([...messages, { role: "user", content: text }])}
              onRetry={() => void runChat(messages)}
            />

            {summary && (
              <section className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/30">
                {aiChangedTarget && requested && (
                  <button
                    type="button"
                    onClick={() => {
                      setBodyPartId(requested.bodyPartId);
                      setSide(requested.side);
                    }}
                    className="self-start rounded-full border border-amber-500 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
                  >
                    {bodyPartLabel(requested.bodyPartId)}(으)로 되돌리기
                  </button>
                )}

                {summary.predictedCondition && (
                  <p className="flex items-center gap-1.5">
                    {/* 확정된 진단이 아니라는 것을 이름 옆에 붙여 둔다. */}
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                      예측
                    </span>
                    <span className="min-w-0 text-base font-semibold text-slate-900 dark:text-slate-50">
                      {summary.predictedCondition}
                    </span>
                  </p>
                )}

                {summary.symptoms.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {summary.symptoms.map((item) => (
                      <li
                        key={item}
                        className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                <SummaryLines summary={summary.summary} />
              </section>
            )}
          </>
        )}
      </div>

      {bodyPartId && (
        <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => void handleSummarize()}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-300 py-3.5 text-sm font-semibold text-slate-700 disabled:opacity-30 dark:border-slate-600 dark:text-slate-200"
            >
              정리하기
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white disabled:opacity-25 dark:bg-white dark:text-slate-900"
          >
            저장
          </button>
        </div>
      )}
    </main>
  );
}

export default function DiagnosePage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-white dark:bg-slate-950" />}>
      <DiagnoseLoader />
    </Suspense>
  );
}
