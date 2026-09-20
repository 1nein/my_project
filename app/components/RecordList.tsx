"use client";

/**
 * 한 부위의 기록 목록. 기록을 고치고 지우는 곳은 여기 하나뿐이다.
 *
 * 저장 일시 최신순으로 보여준다. 기록을 고치면 저장 일시가 갱신되므로 고친 기록이 맨 위로 온다.
 */

import Link from "next/link";
import { SIDE_LABELS, bodyPartLabel, findBodyPart } from "@/app/lib/bodyParts";
import SummaryLines from "@/app/components/SummaryLines";
import type { SymptomRecord } from "@/app/lib/records";

type RecordListProps = {
  bodyPartId: string;
  records: SymptomRecord[];
  onDelete: (id: string) => void;
  onClose: () => void;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date);
}

export default function RecordList({
  bodyPartId,
  records,
  onDelete,
  onClose,
}: RecordListProps) {
  const part = findBodyPart(bodyPartId);
  const showSide = part?.hasSides ?? false;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900 dark:text-slate-50">
          {bodyPartLabel(bodyPartId)}
        </h2>
        <Link
          href={`/diagnose?bodyPartId=${encodeURIComponent(bodyPartId)}`}
          className="shrink-0 rounded-full bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
        >
          추가
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-slate-400"
        >
          ✕
        </button>
      </header>

      <ul className="flex flex-col gap-3">
        {records.map((record) => (
          <li
            key={record.id}
            className="rounded-2xl border border-slate-200 p-3.5 dark:border-slate-700"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-slate-400">
                {formatDate(record.createdAt)}
                {showSide && ` · ${SIDE_LABELS[record.side]}`}
              </p>
              <div className="flex shrink-0 gap-3 text-xs">
                <Link
                  href={`/diagnose?recordId=${encodeURIComponent(record.id)}`}
                  className="text-slate-500 dark:text-slate-400"
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
                  className="text-red-500"
                >
                  삭제
                </button>
              </div>
            </div>

            {record.predictedCondition && (
              <p className="mt-1.5 flex items-center gap-1.5">
                {/* 확정된 진단이 아니라는 것을 이름 옆에 붙여 둔다. */}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  예측
                </span>
                <span className="min-w-0 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {record.predictedCondition}
                </span>
              </p>
            )}

            {record.symptoms.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {record.symptoms.map((symptom) => (
                  <li
                    key={symptom}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {symptom}
                  </li>
                ))}
              </ul>
            )}

            <SummaryLines summary={record.summary} className="mt-2" />
          </li>
        ))}
      </ul>
    </section>
  );
}
