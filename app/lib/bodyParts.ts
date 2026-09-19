/**
 * 신체 부위 목록.
 *
 * 여기 있는 25개 식별자는 `public/human-body.glb` 안의 덩어리 이름과 정확히 같아야 한다.
 * 앱이 이름을 새로 지으면 눌러도 맞는 부위를 찾지 못한다.
 *
 * 좌우는 사용자의 몸 기준이다. `left_knee`는 정면에서 볼 때 화면 오른쪽에 보인다.
 */

export type Side = "front" | "back" | "side" | "unspecified";

export const SIDES: readonly Side[] = ["front", "back", "side", "unspecified"];

export const SIDE_LABELS: Record<Side, string> = {
  front: "앞쪽",
  back: "뒤쪽",
  side: "옆쪽",
  unspecified: "정하지 않음",
};

export type BodyPart = {
  id: string;
  label: string;
  /** 앞뒤를 나누는 것이 의미 있는 부위인지. 몸통만 해당한다. */
  hasSides: boolean;
};

export const BODY_PARTS: readonly BodyPart[] = [
  { id: "head", label: "머리", hasSides: true },
  { id: "neck", label: "목", hasSides: true },
  { id: "chest", label: "가슴 / 등", hasSides: true },
  { id: "abdomen", label: "복부 / 허리", hasSides: true },
  { id: "pelvis", label: "골반", hasSides: true },
  { id: "left_upper_arm", label: "왼쪽 위팔 / 어깨", hasSides: false },
  { id: "left_elbow", label: "왼쪽 팔꿈치", hasSides: false },
  { id: "left_forearm", label: "왼쪽 아래팔", hasSides: false },
  { id: "left_wrist", label: "왼쪽 손목", hasSides: false },
  { id: "left_hand", label: "왼쪽 손", hasSides: false },
  { id: "left_thigh", label: "왼쪽 허벅지", hasSides: false },
  { id: "left_knee", label: "왼쪽 무릎", hasSides: false },
  { id: "left_shin", label: "왼쪽 종아리 / 정강이", hasSides: false },
  { id: "left_ankle", label: "왼쪽 발목", hasSides: false },
  { id: "left_foot", label: "왼쪽 발", hasSides: false },
  { id: "right_upper_arm", label: "오른쪽 위팔 / 어깨", hasSides: false },
  { id: "right_elbow", label: "오른쪽 팔꿈치", hasSides: false },
  { id: "right_forearm", label: "오른쪽 아래팔", hasSides: false },
  { id: "right_wrist", label: "오른쪽 손목", hasSides: false },
  { id: "right_hand", label: "오른쪽 손", hasSides: false },
  { id: "right_thigh", label: "오른쪽 허벅지", hasSides: false },
  { id: "right_knee", label: "오른쪽 무릎", hasSides: false },
  { id: "right_shin", label: "오른쪽 종아리 / 정강이", hasSides: false },
  { id: "right_ankle", label: "오른쪽 발목", hasSides: false },
  { id: "right_foot", label: "오른쪽 발", hasSides: false },
];

const BY_ID = new Map(BODY_PARTS.map((part) => [part.id, part]));

export function findBodyPart(id: string | null | undefined): BodyPart | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function isBodyPartId(id: string | null | undefined): boolean {
  return findBodyPart(id) !== null;
}

export function bodyPartLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

export function isSide(value: string | null | undefined): value is Side {
  return value !== null && value !== undefined && SIDES.includes(value as Side);
}

/**
 * 누른 지점의 모델 로컬 좌표로 면을 판별한다.
 *
 * 모델은 +Z가 앞이다. 세계 좌표나 화면 좌표로 판단하면 카메라를 돌렸을 때 앞뒤가 뒤바뀐다.
 * 경계 부근은 `side`로 둔다. 그렇지 않으면 옆구리에서 앞뒤가 계속 뒤집힌다.
 */
export const SIDE_BAND_METERS = 0.03;

export function sideFromLocalZ(localZ: number): Side {
  if (localZ > SIDE_BAND_METERS) return "front";
  if (localZ < -SIDE_BAND_METERS) return "back";
  return "side";
}
