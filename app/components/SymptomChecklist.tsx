"use client";

/**
 * 증상 체크 목록.
 *
 * 목록은 그 부위에 저장된 기록들에서 모은 것이다. 부위를 누른 시점에 AI를 부르지 않으므로
 * 기다림이 없다. 처음 쓰는 부위는 목록이 비어 있고, 그때는 아무것도 그리지 않는다.
 * 빈 목록은 정상이며, 사용자는 그대로 대화로 넘어간다.
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
  if (symptoms.length === 0) return null;

  const checkedSet = new Set(checked);

  return (
    <ul className="flex flex-wrap gap-2">
      {symptoms.map((symptom) => {
        const isChecked = checkedSet.has(symptom);
        return (
          <li key={symptom}>
            <label
              className={`flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm transition-colors ${
                isChecked
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(symptom)}
                className="sr-only"
              />
              {symptom}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
