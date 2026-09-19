"use client";

/**
 * 한 부위의 기록 목록. 기록을 고치고 지우는 곳은 여기 하나뿐이다.
 *
 * 저장 일시 최신순으로 보여준다. 기록을 고치면 저장 일시가 갱신되므로 고친 기록이 맨 위로 온다.
 */

import Link from "next/link";
import { SIDE_LABELS, bodyPartLabel, findBodyPart } from "@/app/lib/bodyParts";
import type { SymptomRecord } from "@/app/lib/records";

type RecordListProps = {
  bodyPartId: string;
  records: SymptomRecord[];
  onDelete: (id: string) => void;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function RecordList({ bodyPartId, records, onDelete }: RecordListProps) {
  const part = findBodyPart(bodyPartId);
  const showSide = part?.hasSides ?? false;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {bodyPartLabel(bodyPartId)}
        </h2>
        <Link
          href={`/diagnose?bodyPartId=${encodeURIComponent(bodyPartId)}`}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-200 dark:text-slate-900"
        >
          기록 추가
        </Link>
      </header>

      {records.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">아직 기록이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((record) => (
            <li
              key={record.id}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(record.createdAt)}
                  {showSide && ` · ${SIDE_LABELS[record.side]}`}
                </p>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/diagnose?recordId=${encodeURIComponent(record.id)}`}
                    className="text-xs font-medium text-slate-600 underline dark:text-slate-300"
                  >
                    수정
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("이 기록을 지울까요? 되돌릴 수 없습니다.")) {
                        onDelete(record.id);
                      }
                    }}
                    className="text-xs font-medium text-red-600 underline dark:text-red-400"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {record.symptoms.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {record.symptoms.map((symptom) => (
                    <li
                      key={symptom}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {symptom}
                    </li>
                  ))}
                </ul>
              )}

              {record.predictedCondition && (
                <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">
                  <span className="font-medium">예측한 병명</span> · {record.predictedCondition}
                </p>
              )}

              {record.summary && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{record.summary}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
