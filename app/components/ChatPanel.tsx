"use client";

/**
 * AI와 주고받는 대화.
 *
 * 주고받은 말 전체는 저장되지 않는다. 저장되는 것은 "정리하기"로 받은 결과뿐이다.
 * 호출이 실패해도 체크한 증상은 지우지 않는다. 실패한 채로도 저장할 수 있어야 하기 때문이다.
 */

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/app/lib/chatClient";

type ChatPanelProps = {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onSummarize: () => void;
};

export default function ChatPanel({
  messages,
  busy,
  error,
  onSend,
  onSummarize,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    onSend(text);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-72 min-h-24 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            언제부터 어떻게 불편한지 적어 주세요. AI가 되물으며 증상을 정리해 줍니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((message, index) => (
              <li
                key={index}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <span
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  {message.content}
                </span>
              </li>
            ))}
          </ul>
        )}
        {busy && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">답변을 기다리는 중…</p>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
        >
          {error} 체크한 증상은 그대로 있으니, 그대로 저장하셔도 됩니다.
        </p>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="예: 계단 내려올 때 무릎 앞쪽이 아파요"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={busy || draft.trim().length === 0}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900"
        >
          보내기
        </button>
      </form>

      <button
        type="button"
        onClick={onSummarize}
        disabled={busy || messages.length === 0}
        className="rounded-lg border border-slate-800 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-40 dark:border-slate-200 dark:text-slate-100"
      >
        정리하기
      </button>
    </div>
  );
}
