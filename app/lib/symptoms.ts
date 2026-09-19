/**
 * 한 부위의 증상 목록.
 *
 * 증상 목록은 따로 저장하지 않는다. 그 부위에 저장된 기록들이 담고 있는 증상 이름을 모아
 * 그때그때 계산한다. AI를 새로 부르지 않으므로 기다림이 없다.
 *
 * 면이 달라도 같은 부위면 목록을 함께 쓴다. 가슴 기록의 증상이 등을 고를 때도 나온다.
 */

import { loadRecords, type SymptomRecord } from "@/app/lib/records";

/** 대소문자와 앞뒤 공백을 없애고 비교한다. 같으면 같은 증상으로 본다. */
function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function symptomsFromRecords(
  records: SymptomRecord[],
  bodyPartId: string,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const record of records) {
    if (record.bodyPartId !== bodyPartId) continue;
    for (const symptom of record.symptoms) {
      const name = symptom.trim();
      if (!name) continue;
      const key = normalize(name);
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }

  return names;
}

/** 저장된 기록을 읽어 그 부위의 증상 목록을 돌려준다. 기록이 없으면 빈 배열이다. */
export function symptomsForPart(bodyPartId: string): string[] {
  return symptomsFromRecords(loadRecords(), bodyPartId);
}
