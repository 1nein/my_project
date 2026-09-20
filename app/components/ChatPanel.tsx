"use client";

/**
 * AI와 주고받는 대화.
 *
 * AI가 질문 하나와 고를 수 있는 보기를 함께 내놓고, 사용자는 보기를 체크해 답한다. 여러 개를
 * 골라도 된다. 보기에 맞는 것이 없으면 "기타"를 눌러 아래 칸에 직접 적는다. 고른 보기와 적은
 * 말은 함께 하나의 답으로 올라간다.
 *
 * 보기가 거슬리면 카드를 닫고 직접 적어 답할 수 있다. 닫아도 질문과 체크해 둔 것은 남아 있어
 * 다시 열면 고르던 자리에서 이어간다.
 *
 * 보기 카드는 마지막 질문에만 붙는다. 지나간 질문의 보기를 다시 누르면 대화가 어디까지 왔는지
 * 알 수 없어진다. 답한 질문은 위로 올라가 지난 이야기가 된다.
 *
 * 주고받은 말 전체는 저장되지 않는다. 저장되는 것은 "정리하기"로 받은 결과뿐이다.
 * 호출이 실패해도 체크한 증상은 지우지 않는다. 실패한 채로도 저장할 수 있어야 하기 때문이다.
 */

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Choice } from "@/app/lib/chatClient";

type ChatPanelProps = {
  messages: ChatMessage[];
  /** 마지막 질문에 딸린 보기. 비어 있으면 직접 적기만 남는다. */
  choices: Choice[];
  busy: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onRetry: () => void;
};

export default function ChatPanel({
  messages,
  choices,
  busy,
  error,
  onSend,
  onRetry,
}: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, busy]);

  const last = messages[messages.length - 1];
  const asking = choices.length > 0 && last?.role === "assistant";
  /** 지금 묻는 질문은 답하는 칸이 맡는다. 같은 말을 말풍선으로 한 번 더 보여주지 않는다. */
  const past = asking ? messages.slice(0, -1) : messages;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {past.map((message, index) => (
          <li
            key={index}
            className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <span
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                message.role === "user"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {message.content}
            </span>
          </li>
        ))}
      </ul>

      {busy && (
        <p className="w-fit rounded-2xl bg-slate-100 px-3.5 py-2 text-sm text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          ● ● ●
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-full border border-red-300 px-3 py-1 text-xs font-medium dark:border-red-800"
          >
            다시
          </button>
        </div>
      )}

      {/*
        질문이 바뀌면 답하던 내용이 남아 있으면 안 된다. `key`를 주면 칸이 새로 만들어지면서
        체크와 적던 말이 함께 비워진다. 지우는 코드를 따로 두지 않아도 된다.
      */}
      <AnswerBox
        key={messages.length}
        question={asking ? last.content : null}
        choices={choices}
        busy={busy}
        onSend={onSend}
      />

      <div ref={endRef} />
    </div>
  );
}

/** 건너뛰기를 눌렀을 때 AI에게 올라가는 답. 답하지 않은 것과 모른다는 것은 다르다. */
const SKIP_ANSWER = "잘 모르겠어요";

const ROW = "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left";
const BOX = "h-4 w-4 shrink-0 rounded accent-red-500";

type AnswerBoxProps = {
  /** 지금 묻고 있는 질문. 보기 없이 이어 말하는 차례면 `null`이다. */
  question: string | null;
  choices: Choice[];
  busy: boolean;
  onSend: (text: string) => void;
};

function AnswerBox({ question, choices, busy, onSend }: AnswerBoxProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState(false);
  const [draft, setDraft] = useState("");
  /**
   * 보기 카드를 닫았는지. 닫으면 질문만 남고 직접 적어 답한다.
   *
   * 닫을 때 체크해 둔 것은 지우지 않는다. 다시 열면 고르던 자리에서 이어서 고를 수 있어야 한다.
   */
  const [closed, setClosed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = !busy && (picked.length > 0 || draft.trim().length > 0);
  const showCard = question !== null && !closed;

  function toggle(label: string) {
    setPicked((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }

  function send() {
    const text = [...picked, draft.trim()].filter((item) => item.length > 0).join(", ");
    if (!text || busy) return;
    onSend(text);
  }

  return (
    <div className="flex flex-col gap-3">
      {question !== null && !showCard && (
        <div className="flex max-w-[85%] flex-col items-start gap-1.5 self-start">
          <p className="rounded-2xl bg-slate-100 px-3.5 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {question}
          </p>
          <button
            type="button"
            onClick={() => setClosed(false)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400"
          >
            보기 다시 보기
          </button>
        </div>
      )}

      {showCard && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <header className="flex items-start gap-3 px-4 py-3.5">
            <h3 className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
              {question}
            </h3>
            <button
              type="button"
              onClick={() => setClosed(true)}
              aria-label="보기 닫기"
              className="-mr-1 shrink-0 px-1 text-base leading-none text-slate-400"
            >
              ✕
            </button>
          </header>

          <ul className="border-t border-slate-100 dark:border-slate-800">
            {choices.map((choice) => (
              <li key={choice.label} className="border-b border-slate-100 dark:border-slate-800">
                <label className={ROW}>
                  <input
                    type="checkbox"
                    aria-label={choice.label}
                    checked={picked.includes(choice.label)}
                    onChange={() => toggle(choice.label)}
                    className={BOX}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-50">
                      {choice.label}
                    </span>
                    {choice.hint && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {choice.hint}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}

            <li>
              <label className={ROW}>
                <input
                  type="checkbox"
                  aria-label="기타"
                  checked={other}
                  onChange={(event) => {
                    setOther(event.target.checked);
                    // 기타는 그 자체로 답이 되지 않는다. 적을 칸으로 데려다 준다.
                    if (event.target.checked) inputRef.current?.focus();
                  }}
                  className={BOX}
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">기타</span>
              </label>
            </li>
          </ul>

          <footer className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <p className="min-w-0 flex-1 text-xs text-slate-400">{picked.length}개 선택됨</p>
            <button
              type="button"
              onClick={() => onSend(SKIP_ANSWER)}
              disabled={busy}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 disabled:opacity-30 dark:text-slate-400"
            >
              건너뛰기
            </button>
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label="답 보내기"
              className="shrink-0 rounded-lg bg-red-500 px-3.5 py-1.5 text-sm leading-none text-white disabled:opacity-30"
            >
              ↑
            </button>
          </footer>
        </section>
      )}

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
          placeholder={showCard ? "또는 직접 답장…" : "직접 답장…"}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="보내기"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-base leading-none text-slate-400 disabled:opacity-30"
        >
          ⏎
        </button>
      </form>
    </div>
  );
}
