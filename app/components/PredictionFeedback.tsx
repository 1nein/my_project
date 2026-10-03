"use client";

/**
 * 정리 결과가 맞는지 묻는 칸.
 *
 * 질문을 길게 이어가는 대신 결과를 먼저 보여주고, 맞는지 틀린지는 여기서 사용자가 말한다.
 * "맞아요"는 그대로 저장하고, "아니에요"는 무엇이 다른지 적는 칸을 연다. 적은 말은 바깥으로
 * 올라가 다시 정리하는 데 쓰인다. AI를 부르는 것은 화면이 한다.
 */

import { useRef, useState } from "react";

type PredictionFeedbackProps = {
  busy: boolean;
  canSave: boolean;
  onConfirm: () => void;
  onCorrect: (text: string) => void;
};

export default function PredictionFeedback({
  busy,
  canSave,
  onConfirm,
  onCorrect,
}: PredictionFeedbackProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = !busy && draft.trim().length > 0;

  function send() {
    if (!canSend) return;
    onCorrect(draft.trim());
  }

  return (
    <div className="mt-1 flex flex-col gap-2 border-t border-red-200 pt-3 dark:border-red-900">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">이 예측이 맞나요?</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !canSave}
          className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-30"
        >
          맞아요, 저장
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            // 렌더가 끝난 뒤에 칸이 생기므로 다음 차례에 데려다 준다.
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          disabled={busy}
          aria-expanded={open}
          className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          아니에요
        </button>
      </div>

      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="relative"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="무엇이 다른가요? 예: 열은 없어요"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="다시 예측하기"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-base leading-none text-slate-400 disabled:opacity-30"
          >
            ⏎
          </button>
        </form>
      )}
    </div>
  );
}
