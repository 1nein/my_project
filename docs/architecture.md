# 시스템 구성

## 전체 그림

브라우저에서 돌아가는 Next.js(App Router) 앱 하나다. 서버에서 돌아가는 부분은 AI 호출 통로
하나뿐이고, 나머지는 전부 브라우저 안에서 끝난다.

```
브라우저                              서버(Next.js)              외부
────────                              ─────────────              ────
홈 화면 ──┐
진단 화면 ─┼─→ app/lib/records.ts ──→ localStorage
          │
          └─→ app/lib/chatClient.ts ──→ app/api/chat/route.ts ──→ OpenAI API
```

- **기록은 서버를 지나가지 않는다.** 저장·조회·삭제 모두 브라우저 안에서 `localStorage`를 상대로
  끝난다. 서버 데이터베이스가 없고 로그인도 없다.
- **OpenAI 호출만 서버를 지나간다.** 브라우저는 `app/api/chat/route.ts`를 부르고, 그 안에서만
  OpenAI API를 부른다. API 키는 서버에만 있고 브라우저로 내려가지 않는다.
- 브라우저에서 서버로 올라가는 것은 부위 식별자, 체크한 증상 목록, 대화 메시지 목록이다. 저장된
  기록 전체가 올라가지는 않는다.

## 디렉터리 구조

```
app/
  layout.tsx                모든 화면을 감싸는 틀
  page.tsx                  홈 화면
  diagnose/page.tsx         진단 화면
  api/chat/route.ts         AI 호출 통로 (서버에서만 실행)
  components/
    BodyMap.tsx             인체 그림 — 그리기와 부위 클릭 영역
    BodyPartMarks.tsx       인체 그림 위에 얹는 기록 마크
    SymptomChecklist.tsx    증상 체크 목록
    ChatPanel.tsx           AI 대화 주고받기
    RecordList.tsx          한 부위의 기록 목록
  lib/
    bodyParts.ts            부위 목록 (고정 데이터)
    records.ts              기록 읽기·쓰기·삭제
    symptoms.ts             한 부위의 증상 목록 계산
    chatClient.ts           app/api/chat 호출
docs/                       프로젝트 문서
public/                     이미지 등 정적 파일
```

| 구성 요소 | 역할 | 무엇에 기댄다 |
|---|---|---|
| `app/page.tsx` | 홈 화면 조립 | `BodyMap`, `BodyPartMarks`, `RecordList`, `records.ts` |
| `app/diagnose/page.tsx` | 진단 흐름 진행 | `BodyMap`, `SymptomChecklist`, `ChatPanel`, `records.ts`, `symptoms.ts`, `chatClient.ts` |
| `app/api/chat/route.ts` | OpenAI 호출 | 환경변수 `OPENAI_API_KEY` |
| `BodyMap.tsx` | 인체 그림을 그리고 부위 클릭을 알림 | `bodyParts.ts` |
| `records.ts` | `localStorage` 접근 | 브라우저 `localStorage` |
| `symptoms.ts` | 기록에서 증상 목록을 뽑음 | `records.ts` |
| `bodyParts.ts` | 부위 목록 | 없음 |

의존은 화면 → 컴포넌트 → `lib` 한 방향으로만 흐른다. `lib` 안의 파일이 컴포넌트나 화면을 부르지
않는다.

## 대표 흐름 — 오른쪽 무릎에 기록을 남기기까지

1. 사용자가 진단 화면에서 `BodyMap`의 오른쪽 무릎 영역을 누른다. `BodyMap`은 부위 식별자
   `front.knee.right`를 화면에 올려준다.
2. 화면이 `symptoms.ts`에 그 식별자를 넘긴다. `symptoms.ts`는 `records.ts`로 저장된 기록을 읽어
   그 부위의 기록들에서 증상 이름을 모아 중복을 없앤 목록을 돌려준다. 이 과정에 네트워크 호출이
   없으므로 기다림이 없다.
3. `SymptomChecklist`가 그 목록을 보여주고 사용자가 체크한다. 저장된 기록이 없으면 목록이 비어
   있고 다음 단계로 바로 간다.
4. `ChatPanel`이 `chatClient.ts`를 통해 `app/api/chat/route.ts`를 부른다. 보내는 것은 부위
   식별자, 체크한 증상, 지금까지의 대화 메시지다. 서버가 OpenAI API를 부르고 답변을 돌려준다.
   이 과정이 여러 번 반복된다.
5. 사용자가 정리를 요청하면 같은 통로로 한 번 더 부르되, 이번에는 `bodyPartId`·`symptoms`·
   `predictedCondition`·`summary` 네 가지가 든 결과를 받는다.
6. 화면이 결과를 보여준다. AI가 부위를 바꿔 제안했다면 사용자가 여기서 되돌릴 수 있다.
7. 사용자가 저장을 누르면 화면이 `records.ts`에 기록을 넘긴다. `records.ts`가 고유 식별자와 저장
   일시를 붙여 `localStorage`에 쓴다.
8. 홈 화면으로 돌아가면 `records.ts`가 읽은 기록을 바탕으로 `BodyPartMarks`가 오른쪽 무릎에 마크를
   그린다.

## 화면 사이의 이동

두 화면을 오가는 길은 세 갈래이고, 필요한 값은 모두 **URL 쿼리 문자열**로 넘긴다. 화면 사이에
남는 상태를 두지 않으므로 주소를 그대로 열어도 같은 화면이 나온다.

| 언제 | 어디로 | 넘기는 값 |
|---|---|---|
| 홈에서 기록 없는 부위를 누름 | `/diagnose?bodyPartId=<식별자>` | 고른 부위 |
| 홈에서 펼친 기록의 수정을 누름 | `/diagnose?recordId=<기록 id>` | 고칠 기록. 부위와 증상은 그 기록에서 읽는다 |
| 진단 화면에서 저장을 마침 | `/` | 없음 |

- `/diagnose`를 아무 값 없이 열면 부위를 고르지 않은 상태로 시작한다.
- `recordId`가 저장된 기록에 없으면 값 없이 연 것과 같이 다룬다.
- `bodyPartId`가 부위 목록에 없으면 값 없이 연 것과 같이 다룬다.

## 인체 그림과 부위 선택의 분리

`BodyMap.tsx`는 **그리는 일만** 한다. 부위를 누르면 부위 식별자를 바깥으로 알릴 뿐, 그 뒤에
무슨 일이 일어나는지 모른다. 부위 식별자와 표시 이름은 `bodyParts.ts`가 갖고 있다.

이 경계가 있어야 인체 그림을 2D에서 3D로 바꿀 때 `BodyMap.tsx`와 좌표 데이터만 갈아끼우면 되고,
화면·기록·증상 쪽 코드는 손대지 않는다. 그림을 그리는 코드가 기록을 직접 읽거나 저장하면 이
교체가 불가능해진다.

현재는 앞면·뒷면 두 장의 2D 이미지 위에 부위별 클릭 영역을 얹는 방식이다.

## 외부에 기대는 것

| 대상 | 쓰는 곳 | 없으면 |
|---|---|---|
| OpenAI API | `app/api/chat/route.ts` | 대화와 정리 기능이 동작하지 않는다. 증상 체크와 저장은 동작한다 |
| Vercel | 배포 | 로컬 개발에는 영향이 없다 |
| 브라우저 `localStorage` | `app/lib/records.ts` | 기록을 저장하거나 읽을 수 없다 |

**쓸 OpenAI 모델은 아직 정하지 않았다.** `app/api/chat/route.ts`를 만들 때 하나를 골라 이 절에
적어 확정한다. 모델을 바꿔도 통로가 돌려주는 네 항목(`bodyPartId`·`symptoms`·
`predictedCondition`·`summary`)은 그대로 유지한다.
