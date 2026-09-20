"use client";

/**
 * 홈 화면.
 *
 * 화면 전체가 3D 인체다. 머리글도 설명도 두지 않는다. 기록이 있는 부위가 강조색으로 칠해지고,
 * 그 부위를 누르면 아래에서 기록이 최신순으로 올라온다. 기록이 없는 부위를 누르면 그 부위의
 * 진단 화면으로 넘어간다. 기록 목록만 따로 보는 화면은 두지 않는다.
 *
 * 바탕은 진단 화면과 같은 흰색이다. 두 화면을 가르는 것은 색이 아니라 짜임이다. 이 화면에는
 * 막대도 글도 없이 모델만 있고, 진단 화면은 위아래 막대 사이에서 글을 읽고 고르는 곳이다.
 */

import { useMemo, useState, useSyncExternalStore } from "react";
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

  // 마지막 기록을 지우면 펼칠 것이 없다. 빈 시트를 남기지 않고 닫는다.
  const sheetOpen = openPartId !== null && openRecords.length > 0;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-white dark:bg-slate-950">
      {/* 화면 전체를 쓰므로 진단 화면보다 물러나서 본다. 전신 둘레에 여백이 남는다. */}
      <BodyModel
        className="absolute inset-0"
        selectedId={openPartId}
        recordedIds={recordedIds}
        onSelect={handleSelect}
        distance={4.8}
      />

      <div className="absolute inset-x-0 top-0 flex justify-end p-3">
        <BodyPartPicker
          value={openPartId}
          onChange={(id) => handleSelect(id, "unspecified")}
          className="max-w-40 truncate rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs text-slate-600 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
        />
      </div>

      {recordedIds.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/80 to-transparent pt-16 pb-10 text-center dark:from-slate-950 dark:via-slate-950/80">
          <p className="text-sm text-slate-400">아픈 곳을 눌러 보세요</p>
        </div>
      )}

      {sheetOpen && openPartId && (
        <div className="absolute inset-x-0 bottom-0 max-h-[65%] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-5 pb-8 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900">
          <RecordList
            bodyPartId={openPartId}
            records={openRecords}
            onDelete={deleteRecord}
            onClose={() => setOpenPartId(null)}
          />
        </div>
      )}
    </main>
  );
}
