/**
 * AI가 정리한 요약을 목록으로 보여준다.
 *
 * 요약은 줄마다 한 가지씩 적은 것이다. 줄글로 이어 붙여 놓으면 한눈에 들어오지 않아, 줄을
 * 나눠 점을 찍어 보여준다. 줄이 하나뿐인 예전 기록은 한 줄짜리 목록이 된다.
 */

import { summaryLines } from "@/app/lib/records";

type SummaryLinesProps = {
  summary: string;
  className?: string;
};

export default function SummaryLines({ summary, className }: SummaryLinesProps) {
  const lines = summaryLines(summary);
  if (lines.length === 0) return null;

  return (
    <ul className={`flex flex-col gap-1 ${className ?? ""}`}>
      {lines.map((line) => (
        <li key={line} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
            ·
          </span>
          <span className="min-w-0 flex-1">{line}</span>
        </li>
      ))}
    </ul>
  );
}
