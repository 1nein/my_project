# 규격

화면(브라우저)과 서버 사이에 오가는 것, 그리고 브라우저에 저장되는 값의 형식이다. 이 파일에 적힌
이름과 타입이 기준이며, 코드가 이와 다르면 코드가 틀린 것이다.

## AI 호출 통로

**경로** `POST /api/chat` (`app/api/chat/route.ts`)

브라우저에서 직접 OpenAI API를 부르지 않는다. 모든 호출이 이 통로를 지난다.

### 보내는 것

```json
{
  "mode": "chat",
  "bodyPartId": "front.knee.right",
  "checkedSymptoms": ["통증", "붓기"],
  "messages": [
    { "role": "user", "content": "계단 내려올 때 아파요" },
    { "role": "assistant", "content": "언제부터 그랬나요?" }
  ]
}
```

| 키 | 타입 | 필수 | 뜻 |
|---|---|---|---|
| `mode` | `"chat"` \| `"summarize"` | 예 | `chat`은 대화를 이어가기, `summarize`는 정리 결과 받기 |
| `bodyPartId` | 문자열 | 예 | 사용자가 고른 부위 식별자. `docs/business-rules.md`의 부위 목록에 있는 값 |
| `checkedSymptoms` | 문자열 배열 | 예 | 사용자가 체크한 증상 이름. 없으면 빈 배열 |
| `messages` | 메시지 배열 | 예 | 지금까지 주고받은 대화. 첫 호출이면 사용자 메시지 하나만 들어간다 |

메시지 하나는 `role`(`"user"` 또는 `"assistant"`)과 `content`(문자열)를 갖는다.

### 받는 것 — `mode`가 `"chat"`일 때

상태 코드 `200`.

```json
{ "reply": "언제부터 그랬는지 알려주세요." }
```

| 키 | 타입 | 뜻 |
|---|---|---|
| `reply` | 문자열 | AI의 다음 답변. 빈 문자열이 아니다 |

### 받는 것 — `mode`가 `"summarize"`일 때

상태 코드 `200`.

```json
{
  "bodyPartId": "front.knee.right",
  "symptoms": ["무릎 앞쪽 통증", "계단 내려올 때 악화"],
  "predictedCondition": "슬개건염",
  "summary": "오른쪽 무릎 앞쪽에 계단을 내려올 때 심해지는 통증이 있습니다."
}
```

| 키 | 타입 | 빈 값일 수 있나 | 뜻 |
|---|---|---|---|
| `bodyPartId` | 문자열 | 아니오 | AI가 판단한 부위 식별자. 부위 목록에 있는 값이어야 한다 |
| `symptoms` | 문자열 배열 | 예 (빈 배열) | AI가 정리한 증상 이름 |
| `predictedCondition` | 문자열 | 예 (빈 문자열) | 예측한 병명. 예측할 수 없으면 빈 문자열 |
| `summary` | 문자열 | 예 (빈 문자열) | 한두 문장 요약 |

`bodyPartId`가 부위 목록에 없는 값이면 화면은 사용자가 처음 고른 부위를 그대로 쓴다.

### 오류일 때

| 상태 코드 | 언제 | 본문 |
|---|---|---|
| `400` | `mode`가 둘 중 하나가 아니거나, `bodyPartId`가 없거나, `messages`가 배열이 아닐 때 | `{ "error": "…" }` |
| `500` | 서버에 `OPENAI_API_KEY`가 없을 때 | `{ "error": "…" }` |
| `502` | OpenAI 호출이 실패했거나 응답을 읽을 수 없을 때 | `{ "error": "…" }` |

`error`는 화면에 그대로 보여줄 수 있는 한국어 문장이다. OpenAI가 돌려준 원문이나 키 값을 여기에
넣지 않는다.

화면은 어떤 오류든 실패를 알리고 사용자가 체크한 증상을 유지한다.

## 저장되는 값

**저장 키** `bodylog.records` (`localStorage`)

값은 기록 객체의 배열을 JSON 문자열로 만든 것이다. 키가 없으면 빈 배열로 본다.

```json
[
  {
    "id": "3f1c8a2e-5b7d-4c11-9a3e-8d6f0b2c4571",
    "bodyPartId": "front.knee.right",
    "symptoms": ["무릎 앞쪽 통증"],
    "predictedCondition": "슬개건염",
    "summary": "계단을 내려올 때 심해지는 통증입니다.",
    "createdAt": "2026-09-12T04:21:00.000Z"
  }
]
```

| 키 | 타입 | 빈 값일 수 있나 | 뜻 |
|---|---|---|---|
| `id` | 문자열 | 아니오 | 기록마다 다른 값. `crypto.randomUUID()`로 만든다 |
| `bodyPartId` | 문자열 | 아니오 | 부위 목록에 있는 식별자 |
| `symptoms` | 문자열 배열 | 예 (빈 배열) | 이 기록의 증상 이름 |
| `predictedCondition` | 문자열 | 예 (빈 문자열) | 예측한 병명 |
| `summary` | 문자열 | 예 (빈 문자열) | 요약 |
| `createdAt` | 문자열 | 아니오 | ISO 8601 문자열. `new Date().toISOString()` |

- `symptoms`·`predictedCondition`·`summary`가 **모두** 비어 있는 기록은 저장하지 않는다.
- 기록을 고쳐 저장하면 `id`는 그대로 두고 `createdAt`을 그때 시각으로 바꾼다.
- 저장 키에 이 형식과 다른 값이 들어 있으면(예전 형식, 손상된 JSON) 빈 배열로 취급하고 화면을
  띄운다. 예외를 밖으로 던지지 않는다.

## 값 읽고 쓰는 곳

`localStorage`를 직접 부르는 곳은 `app/lib/records.ts` 한 곳이다. 화면이나 컴포넌트가
`localStorage`를 직접 읽거나 쓰지 않는다.
