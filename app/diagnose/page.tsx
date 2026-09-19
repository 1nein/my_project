"use client";

/**
 * 진단 화면.
 *
 * 부위 선택 → 저장된 증상 체크 → AI 대화 → 정리하기 → 저장의 순서로 진행한다.
 * 대화를 건너뛰고 증상만 체크해서 바로 저장할 수도 있다.
 * 저장하지 않고 떠나면 체크 내용과 대화는 남지 않는다.
 */

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BodyModel from "@/app/components/BodyModel";
import BodyPartPicker from "@/app/components/BodyPartPicker";
import SymptomChecklist from "@/app/components/SymptomChecklist";
import ChatPanel from "@/app/components/ChatPanel";
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
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  /** 정리를 요청한 시점에 사용자가 고른 부위와 면. AI가 바꿔 제안했는지 판단하는 기준이다. */
  const [requested, setRequested] = useState<{ bodyPartId: string; side: Side } | null>(null);

  const symptoms = useMemo(
    () => (bodyPartId ? symptomsFromRecords(records, bodyPartId) : []),
    [records, bodyPartId],
  );

  const part = findBodyPart(bodyPartId);
  const showSide = part?.hasSides ?? false;

  function selectPart(nextId: string, nextSide: Side) {
    if (nextId !== bodyPartId) {
      // 부위가 바뀌면 그 부위의 증상 목록이 달라지므로 체크와 대화를 비운다.
      setChecked([]);
      setMessages([]);
      setSummary(null);
      setRequested(null);
      setChatError(null);
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

  async function handleSend(text: string) {
    if (!bodyPartId) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    setChatError(null);
    try {
      const reply = await sendChat({
        bodyPartId,
        side,
        checkedSymptoms: checked,
        messages: next,
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (error) {
      // 실패해도 체크한 증상은 그대로 둔다. 그 상태로 저장할 수 있어야 한다.
      setChatError(error instanceof ChatError ? error.message : "AI 요청이 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSummarize() {
    if (!bodyPartId) return;
    setBusy(true);
    setChatError(null);
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          {editingId ? "기록 수정" : "증상 기록하기"}
        </h1>
        <Link href="/" className="text-sm text-slate-600 underline dark:text-slate-300">
          홈으로
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          1. 아픈 부위 고르기
        </h2>
        <div className="h-[380px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
          <BodyModel className="relative h-full w-full" selectedId={bodyPartId} onSelect={selectPart} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          드래그하면 돌아가고, 부위를 누르면 선택됩니다. 손목·발목처럼 작은 부위는 확대하거나 아래
          목록에서 고르세요.
        </p>
        <BodyPartPicker value={bodyPartId} onChange={(id) => selectPart(id, side)} />

        {bodyPartId && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {bodyPartLabel(bodyPartId)}
            </p>
            {showSide && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span>어느 쪽</span>
                <select
                  value={side}
                  onChange={(event) => setSide(event.target.value as Side)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
                >
                  {SIDES.map((value) => (
                    <option key={value} value={value}>
                      {SIDE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </section>

      {bodyPartId && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              2. 해당하는 증상 고르기
            </h2>
            <SymptomChecklist symptoms={symptoms} checked={checked} onToggle={toggleSymptom} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              3. AI와 이야기하기
            </h2>
            <ChatPanel
              messages={messages}
              busy={busy}
              error={chatError}
              onSend={handleSend}
              onSummarize={handleSummarize}
            />
          </section>

          {summary && (
            <section className="flex flex-col gap-3 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                4. 정리 결과
              </h2>

              {aiChangedTarget && requested && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  <span>AI가 부위를 바꿔 제안했습니다.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBodyPartId(requested.bodyPartId);
                      setSide(requested.side);
                    }}
                    className="rounded-md border border-amber-700 px-2 py-1 text-xs font-medium dark:border-amber-300"
                  >
                    내가 고른 {bodyPartLabel(requested.bodyPartId)}(으)로 되돌리기
                  </button>
                </div>
              )}

              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 font-medium text-slate-600 dark:text-slate-300">부위</dt>
                  <dd className="text-slate-900 dark:text-slate-100">
                    {bodyPartLabel(bodyPartId)}
                    {showSide && ` · ${SIDE_LABELS[side]}`}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 font-medium text-slate-600 dark:text-slate-300">증상</dt>
                  <dd className="text-slate-900 dark:text-slate-100">
                    {summary.symptoms.length > 0 ? summary.symptoms.join(", ") : "—"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 font-medium text-slate-600 dark:text-slate-300">
                    예측한 병명
                  </dt>
                  <dd className="text-slate-900 dark:text-slate-100">
                    {summary.predictedCondition || "—"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 font-medium text-slate-600 dark:text-slate-300">요약</dt>
                  <dd className="text-slate-900 dark:text-slate-100">{summary.summary || "—"}</dd>
                </div>
              </dl>
            </section>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {editingId ? "고쳐서 저장하기" : "기록 저장하기"}
            </button>
            {!canSave && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                증상을 하나 이상 고르거나 AI 정리를 마쳐야 저장할 수 있습니다.
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default function DiagnosePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-3xl px-4 py-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">불러오는 중…</p>
        </main>
      }
    >
      <DiagnoseLoader />
    </Suspense>
  );
}
