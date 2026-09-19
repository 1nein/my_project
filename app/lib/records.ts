/**
 * 기록 저장소.
 *
 * `localStorage`를 직접 부르는 곳은 이 파일 한 곳이다. 화면과 컴포넌트는 여기를 거친다.
 * 브라우저에서만 동작하므로, 서버 렌더 중에 불리면 빈 값을 돌려준다.
 */

import { isBodyPartId, isSide, type Side } from "@/app/lib/bodyParts";

export const STORAGE_KEY = "bodylog.records";

export type SymptomRecord = {
  id: string;
  bodyPartId: string;
  side: Side;
  symptoms: string[];
  predictedCondition: string;
  summary: string;
  /** ISO 8601 문자열. 기록을 고쳐 저장하면 그때 시각으로 갱신된다. */
  createdAt: string;
};

/** 저장할 내용. `id`와 `createdAt`은 이 파일이 붙인다. */
export type RecordInput = {
  bodyPartId: string;
  side: Side;
  symptoms: string[];
  predictedCondition: string;
  summary: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * 저장된 값 하나를 기록으로 읽는다.
 *
 * 모델을 교체해 부위 식별자가 맞지 않게 된 기록은 버린다. 형식이 깨진 값도 버린다.
 * 어느 쪽이든 예외를 밖으로 던지지 않는다.
 */
function parseRecord(value: unknown): SymptomRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const id = toText(raw.id);
  const bodyPartId = toText(raw.bodyPartId);
  const createdAt = toText(raw.createdAt);
  const side = raw.side;

  if (!id || !createdAt) return null;
  if (!isBodyPartId(bodyPartId)) return null;
  if (typeof side !== "string" || !isSide(side)) return null;

  return {
    id,
    bodyPartId,
    side,
    symptoms: toStringArray(raw.symptoms),
    predictedCondition: toText(raw.predictedCondition),
    summary: toText(raw.summary),
    createdAt,
  };
}

/** 저장된 기록 전부. 저장 일시 최신순. */
export function loadRecords(): SymptomRecord[] {
  if (!isBrowser()) return [];

  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!stored) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(parseRecord)
    .filter((record): record is SymptomRecord => record !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeRecords(records: SymptomRecord[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 저장 공간이 가득 찼거나 브라우저가 막은 경우. 화면을 멈추지는 않는다.
  }
  invalidate();
}

/*
 * 화면이 저장소를 구독하는 방법.
 *
 * 저장소는 React 바깥에 있는 값이라 `useSyncExternalStore`로 읽는다. 읽은 결과를 캐시해 두는
 * 이유는 그 훅이 같은 내용이면 **같은 객체**를 돌려받기를 요구하기 때문이다. 매번 새 배열을
 * 만들면 렌더가 끝없이 반복된다. 저장할 때마다 캐시를 버려 다음 읽기에서 다시 만든다.
 *
 * 서버에는 저장소가 없으므로 서버용 값은 항상 빈 배열 하나를 돌려준다. 이 값도 매번 같은
 * 객체여야 한다.
 */

const EMPTY: SymptomRecord[] = [];
let cache: SymptomRecord[] | null = null;
const listeners = new Set<() => void>();

function invalidate(): void {
  cache = null;
  for (const listener of listeners) listener();
}

function handleStorageEvent(event: StorageEvent): void {
  // 다른 탭에서 바꾼 경우. 같은 탭의 변경은 writeRecords가 직접 알린다.
  if (event.key === null || event.key === STORAGE_KEY) invalidate();
}

export function subscribeRecords(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && isBrowser()) {
    window.addEventListener("storage", handleStorageEvent);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && isBrowser()) {
      window.removeEventListener("storage", handleStorageEvent);
    }
  };
}

export function getRecordsSnapshot(): SymptomRecord[] {
  if (cache === null) cache = loadRecords();
  return cache;
}

export function getServerRecordsSnapshot(): SymptomRecord[] {
  return EMPTY;
}

/** 증상도 병명도 요약도 모두 비어 있으면 저장하지 않는다. */
export function isSavable(input: RecordInput): boolean {
  return (
    input.symptoms.length > 0 ||
    input.predictedCondition.trim().length > 0 ||
    input.summary.trim().length > 0
  );
}

function newId(): string {
  if (isBrowser() && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createRecord(input: RecordInput): SymptomRecord | null {
  if (!isSavable(input)) return null;

  const record: SymptomRecord = {
    id: newId(),
    bodyPartId: input.bodyPartId,
    side: input.side,
    symptoms: input.symptoms,
    predictedCondition: input.predictedCondition,
    summary: input.summary,
    createdAt: new Date().toISOString(),
  };

  writeRecords([record, ...loadRecords()]);
  return record;
}

/**
 * 기록을 고친다. `id`는 그대로 두고 저장 일시를 지금으로 갱신한다.
 * 갱신된 기록은 목록의 맨 위로 올라온다.
 */
export function updateRecord(id: string, input: RecordInput): SymptomRecord | null {
  if (!isSavable(input)) return null;

  const records = loadRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return null;

  const updated: SymptomRecord = {
    ...records[index],
    bodyPartId: input.bodyPartId,
    side: input.side,
    symptoms: input.symptoms,
    predictedCondition: input.predictedCondition,
    summary: input.summary,
    createdAt: new Date().toISOString(),
  };

  records.splice(index, 1);
  writeRecords([updated, ...records]);
  return updated;
}

export function deleteRecord(id: string): void {
  writeRecords(loadRecords().filter((record) => record.id !== id));
}

export function findRecord(id: string | null | undefined): SymptomRecord | null {
  if (!id) return null;
  return loadRecords().find((record) => record.id === id) ?? null;
}

/** 기록이 하나라도 있는 부위의 식별자. 홈 화면에서 강조할 부위를 정하는 데 쓴다. */
export function recordedBodyPartIds(records: SymptomRecord[]): string[] {
  return [...new Set(records.map((record) => record.bodyPartId))];
}

export function recordsForPart(records: SymptomRecord[], bodyPartId: string): SymptomRecord[] {
  return records.filter((record) => record.bodyPartId === bodyPartId);
}
