"use client";

/**
 * 이름 목록으로 부위를 고르는 방법.
 *
 * 3D를 돌려 손목이나 발목 같은 작은 부위를 누르기 어려운 경우를 위한 것이다.
 * 3D 조작이 어려운 사용자에게는 이쪽이 유일한 입력 수단이 된다.
 *
 * 화면마다 바탕이 달라서 겉모습만 `className`으로 받는다. 고르는 동작은 어디서나 같다.
 */

import { BODY_PARTS } from "@/app/lib/bodyParts";

type BodyPartPickerProps = {
  value: string | null;
  onChange: (bodyPartId: string) => void;
  className?: string;
};

const DEFAULT_CLASS =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export default function BodyPartPicker({ value, onChange, className }: BodyPartPickerProps) {
  return (
    <select
      aria-label="부위 고르기"
      value={value ?? ""}
      onChange={(event) => {
        if (event.target.value) onChange(event.target.value);
      }}
      className={className ?? DEFAULT_CLASS}
    >
      <option value="" disabled>
        부위 고르기
      </option>
      {BODY_PARTS.map((part) => (
        <option key={part.id} value={part.id}>
          {part.label}
        </option>
      ))}
    </select>
  );
}
