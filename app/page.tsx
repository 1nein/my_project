"use client";

/**
 * 홈 화면.
 *
 * 기록이 있는 부위가 강조색으로 칠해진다. 그 부위를 누르면 기록이 최신순으로 펼쳐지고,
 * 기록이 없는 부위를 누르면 그 부위의 진단 화면으로 넘어간다.
 * 기록 목록만 따로 보는 화면은 두지 않는다.
 */

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BodyModel from "@/app/components/BodyModel";
import BodyPartPicker from "@/app/components/BodyPartPicker";
import RecordList from "@/app/components/RecordList";
import type { Side } from "@/app/lib/bodyParts";
import {
  deleteRecord,
  getRecordsSnapshot,
  getServerRecordsSnapshot,
  recordedBodyPartIds,
  recordsForPart,
  subscribeRecords,
} from "@/app/lib/records";

export default function HomePage() {
  const router = useRouter();

  // 저장소는 React 바깥의 값이다. 구독해서 읽으면 저장·삭제가 바로 화면에 반영된다.
  const records = useSyncExternalStore(
    subscribeRecords,
    getRecordsSnapshot,
    getServerRecordsSnapshot,
  );

  const [openPartId, setOpenPartId] = useState<string | null>(null);

  const recordedIds = useMemo(() => recordedBodyPartIds(records), [records]);
  const openRecords = useMemo(
    () => (openPartId ? recordsForPart(records, openPartId) : []),
    [records, openPartId],
  );

  function handleSelect(bodyPartId: string, side: Side) {
    if (recordedIds.includes(bodyPartId)) {
      setOpenPartId(bodyPartId);
      return;
    }
    router.push(
      `/diagnose?bodyPartId=${encodeURIComponent(bodyPartId)}&side=${encodeURIComponent(side)}`,
    );
  }

  function handleDelete(id: string) {
    deleteRecord(id);
  }

  const openPartEmptied = openPartId !== null && openRecords.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">인체 증상 기록</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          아픈 부위를 눌러 증상을 기록하고, AI와 대화해 정리해 둘 수 있습니다.
        </p>
      </header>

      <div className="h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
        <BodyModel
          className="relative h-full w-full"
          selectedId={openPartId}
          recordedIds={recordedIds}
          onSelect={handleSelect}
        />
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        드래그하면 돌아갑니다. 뒤쪽 기록을 보려면 모델을 돌려 주세요.
        {recordedIds.length > 0 && " 주황색으로 칠해진 부위에 기록이 있습니다."}
      </p>

      <BodyPartPicker value={openPartId} onChange={(id) => handleSelect(id, "unspecified")} />

      {recordedIds.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-600">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            아직 기록이 없습니다. 모델에서 아픈 부위를 눌러 첫 기록을 남겨 보세요.
          </p>
          <Link
            href="/diagnose"
            className="mt-3 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white dark:bg-slate-200 dark:text-slate-900"
          >
            기록 시작하기
          </Link>
        </section>
      ) : openPartId && !openPartEmptied ? (
        <RecordList bodyPartId={openPartId} records={openRecords} onDelete={handleDelete} />
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          주황색으로 칠해진 부위를 누르면 그 부위의 기록을 볼 수 있습니다.
        </p>
      )}
    </main>
  );
}
