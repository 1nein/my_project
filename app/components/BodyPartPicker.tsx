"use client";

/**
 * 이름 목록으로 부위를 고르는 방법.
 *
 * 3D를 돌려 손목이나 발목 같은 작은 부위를 누르기 어려운 경우를 위한 것이다.
 * 3D 조작이 어려운 사용자에게는 이쪽이 유일한 입력 수단이 된다.
 */

import { BODY_PARTS } from "@/app/lib/bodyParts";

type BodyPartPickerProps = {
  value: string | null;
  onChange: (bodyPartId: string) => void;
  label?: string;
};

export default function BodyPartPicker({ value, onChange, label }: BodyPartPickerProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {label ?? "목록에서 부위 고르기"}
      </span>
      <select
        value={value ?? ""}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="" disabled>
          부위를 고르세요
        </option>
        {BODY_PARTS.map((part) => (
          <option key={part.id} value={part.id}>
            {part.label}
          </option>
        ))}
      </select>
    </label>
  );
}
