"use client";

/**
 * 증상 체크 목록.
 *
 * 목록은 그 부위에 저장된 기록들에서 모은 것이다. 부위를 누른 시점에 AI를 부르지 않으므로
 * 기다림이 없다. 처음 쓰는 부위는 목록이 비어 있고, 그때는 대화로 시작한다.
 */

type SymptomChecklistProps = {
  symptoms: string[];
  checked: string[];
  onToggle: (symptom: string) => void;
};

export default function SymptomChecklist({
  symptoms,
  checked,
  onToggle,
}: SymptomChecklistProps) {
  if (symptoms.length === 0) {
    return (
      <p className="rounded-lg bg-slate-100 px-3 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        이 부위에 저장된 증상이 아직 없습니다. 아래에서 AI와 대화하면 정리된 증상이 기록으로
        남고, 다음부터 여기에 나타납니다.
      </p>
    );
  }

  const checkedSet = new Set(checked);

  return (
    <ul className="flex flex-wrap gap-2">
      {symptoms.map((symptom) => {
        const isChecked = checkedSet.has(symptom);
        return (
          <li key={symptom}>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                isChecked
                  ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-200"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(symptom)}
                className="h-4 w-4 accent-red-500"
              />
              {symptom}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
