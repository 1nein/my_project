# 시스템 구성

## 전체 그림

브라우저에서 돌아가는 Next.js(App Router) 앱 하나다. 서버에서 돌아가는 부분은 AI 호출 통로
하나뿐이고, 나머지는 전부 브라우저 안에서 끝난다.

```
브라우저                                  서버(Next.js)              외부
────────                                  ─────────────              ────
홈 화면 ──┐
진단 화면 ─┼─→ app/lib/records.ts ──→ localStorage
          │
          ├─→ /human-body.glb (정적 파일)
          │
          └─→ app/lib/chatClient.ts ──→ app/api/chat/route.ts ──→ OpenAI API
```

- **기록은 서버를 지나가지 않는다.** 저장·조회·삭제 모두 브라우저 안에서 `localStorage`를 상대로
  끝난다. 서버 데이터베이스가 없고 로그인도 없다.
- **3D 모델은 정적 파일이다.** 브라우저가 `/human-body.glb`를 한 번 받아 그린다. 서버가 관여하지
  않는다.
- **OpenAI 호출만 서버를 지나간다.** 브라우저는 `app/api/chat/route.ts`를 부르고, 그 안에서만
  OpenAI API를 부른다. API 키는 서버에만 있고 브라우저로 내려가지 않는다.
- 브라우저에서 서버로 올라가는 것은 부위 식별자, 면, 체크한 증상 목록, 대화 메시지 목록이다.
  저장된 기록 전체가 올라가지는 않는다.

## 3D를 그리는 층

React 위에서 3D를 다루기 위해 세 가지를 쓴다.

| 라이브러리 | 하는 일 |
|---|---|
| `three` | 3D 렌더링 엔진 |
| `@react-three/fiber` | Three.js를 React 컴포넌트로 쓰게 해 준다 |
| `@react-three/drei` | 모델 불러오기와 카메라 조작 같은 자주 쓰는 도구 모음 |

- 모델 불러오기는 `@react-three/drei`의 GLB 로더를 쓴다. 캐시가 있어 화면을 오갈 때 다시 받지
  않는다.
- 회전·확대는 `@react-three/drei`의 카메라 조작 도구를 쓴다. 회전 중심은 바닥이 아니라 인체
  중앙 높이에 둔다. 바닥에 두면 모델이 화면 밖으로 튕겨 나간다.
- 부위 클릭은 각 덩어리의 클릭 이벤트로 받는다. 가장 가까운 덩어리 하나만 처리하고 뒤쪽 덩어리로
  이벤트가 번지지 않게 막는다.
- **불러온 직후 덩어리마다 재질을 복제한다.** 25개가 재질 하나를 공유하고 있어서, 복제하지 않고
  색을 바꾸면 온몸이 함께 바뀐다.

## 디렉터리 구조

```
app/
  layout.tsx                모든 화면을 감싸는 틀
  page.tsx                  홈 화면
  diagnose/page.tsx         진단 화면
  api/chat/route.ts         AI 호출 통로 (서버에서만 실행)
  components/
    BodyModel.tsx           3D 인체 — 그리기, 회전, 부위 클릭 알림
    BodyPartPicker.tsx      이름 목록으로 부위를 고르는 대체 입력
    SymptomChecklist.tsx    증상 체크 목록
    ChatPanel.tsx           AI 대화 주고받기
    RecordList.tsx          한 부위의 기록 목록
  lib/
    bodyParts.ts            부위 25개의 식별자와 한국어 이름
    records.ts              기록 읽기·쓰기·삭제
    symptoms.ts             한 부위의 증상 목록 계산
    chatClient.ts           app/api/chat 호출
public/
  human-body.glb            3D 인체 모델 (브라우저가 받는 파일)
assets/human-body/          모델 편집 원본과 생성 스크립트 (앱 실행에 쓰이지 않음)
docs/                       프로젝트 문서
```

| 구성 요소 | 역할 | 무엇에 기댄다 |
|---|---|---|
| `app/page.tsx` | 홈 화면 조립 | `BodyModel`, `BodyPartPicker`, `RecordList`, `records.ts` |
| `app/diagnose/page.tsx` | 진단 흐름 진행 | `BodyModel`, `BodyPartPicker`, `SymptomChecklist`, `ChatPanel`, `records.ts`, `symptoms.ts`, `chatClient.ts` |
| `app/api/chat/route.ts` | OpenAI 호출 | 환경변수 `OPENAI_API_KEY` |
| `BodyModel.tsx` | 모델을 그리고, 눌린 부위 식별자와 면을 알림 | `/human-body.glb`, `bodyParts.ts` |
| `BodyPartPicker.tsx` | 이름 목록으로 고르기 | `bodyParts.ts` |
| `records.ts` | `localStorage` 접근 | 브라우저 `localStorage` |
| `symptoms.ts` | 기록에서 증상 목록을 뽑음 | `records.ts` |
| `bodyParts.ts` | 부위 목록 | 없음 |

의존은 화면 → 컴포넌트 → `lib` 한 방향으로만 흐른다. `lib` 안의 파일이 컴포넌트나 화면을 부르지
않는다.

## 대표 흐름 — 오른쪽 무릎에 기록을 남기기까지

1. 진단 화면이 `BodyModel`을 띄운다. `BodyModel`이 `/human-body.glb`를 받아 25개 덩어리를 그리고,
   각 덩어리의 재질을 복제해 둔다.
2. 사용자가 오른쪽 무릎을 누른다. `BodyModel`은 눌린 덩어리의 식별자 `right_knee`를 읽고, 누른
   지점을 모델 자신의 좌표로 바꿔 앞뒤 축 값으로 면을 판별한 뒤, 두 값을 화면에 올려준다.
   손가락이 일정 거리 이상 움직였으면 돌리기로 보고 아무것도 올려주지 않는다.
3. 화면이 `symptoms.ts`에 식별자를 넘긴다. `symptoms.ts`는 `records.ts`로 저장된 기록을 읽어 그
   부위의 기록들에서 증상 이름을 모아 중복을 없앤 목록을 돌려준다. 네트워크 호출이 없으므로
   기다림이 없다.
4. `SymptomChecklist`가 그 목록을 보여주고 사용자가 체크한다. 저장된 기록이 없으면 목록이 비어
   있고 다음 단계로 바로 간다.
5. `ChatPanel`이 `chatClient.ts`를 통해 `app/api/chat/route.ts`를 부른다. 보내는 것은 부위
   식별자, 면, 체크한 증상, 지금까지의 대화 메시지다. 서버가 OpenAI API를 부르고 답변을 돌려준다.
   이 과정이 여러 번 반복된다.
6. 사용자가 정리를 요청하면 같은 통로로 한 번 더 부르되, 이번에는 `bodyPartId`·`side`·`symptoms`·
   `predictedCondition`·`summary` 다섯 가지가 든 결과를 받는다.
7. 화면이 결과를 보여준다. AI가 부위나 면을 바꿔 제안했다면 사용자가 여기서 되돌릴 수 있다.
8. 사용자가 저장을 누르면 화면이 `records.ts`에 기록을 넘긴다. `records.ts`가 고유 식별자와 저장
   일시를 붙여 `localStorage`에 쓴다.
9. 홈 화면으로 돌아가면 `records.ts`가 읽은 기록을 바탕으로 `BodyModel`이 오른쪽 무릎 덩어리를
   강조색으로 칠한다.

## 화면 사이의 이동

두 화면을 오가는 길은 세 갈래이고, 필요한 값은 모두 **URL 쿼리 문자열**로 넘긴다. 화면 사이에
남는 상태를 두지 않으므로 주소를 그대로 열어도 같은 화면이 나온다.

| 언제 | 어디로 | 넘기는 값 |
|---|---|---|
| 홈에서 기록 없는 부위를 누름 | `/diagnose?bodyPartId=<식별자>&side=<면>` | 고른 부위와 면 |
| 홈에서 펼친 기록의 수정을 누름 | `/diagnose?recordId=<기록 id>` | 고칠 기록. 부위·면·증상은 그 기록에서 읽는다 |
| 진단 화면에서 저장을 마침 | `/` | 없음 |

- `/diagnose`를 아무 값 없이 열면 부위를 고르지 않은 상태로 시작한다.
- `recordId`가 저장된 기록에 없으면 값 없이 연 것과 같이 다룬다.
- `bodyPartId`가 25개 목록에 없거나 `side`가 네 값 밖이면 값 없이 연 것과 같이 다룬다.

## 인체 모델과 부위 선택의 분리

`BodyModel.tsx`는 **그리고 알리는 일만** 한다. 부위를 누르면 식별자와 면을 바깥으로 올려줄 뿐,
그 뒤에 무슨 일이 일어나는지 모른다. 어느 부위를 강조할지는 바깥에서 받은 목록으로 정한다.

이 경계가 있어야 모델을 더 정밀한 것으로 바꾸거나 렌더링 방식을 바꿀 때 이 파일과 모델 파일만
갈아끼우면 되고, 화면·기록·증상 쪽 코드는 손대지 않는다. 그리는 코드가 기록을 직접 읽거나
저장하면 이 교체가 불가능해진다.

## 외부에 기대는 것

| 대상 | 쓰는 곳 | 없으면 |
|---|---|---|
| OpenAI API | `app/api/chat/route.ts` | 대화와 정리 기능이 동작하지 않는다. 부위 선택·증상 체크·저장은 동작한다 |
| `public/human-body.glb` | `BodyModel.tsx` | 부위를 고를 수 없다. 앱의 거의 모든 기능이 멈춘다 |
| Vercel | 배포 | 로컬 개발에는 영향이 없다 |
| 브라우저 `localStorage` | `app/lib/records.ts` | 기록을 저장하거나 읽을 수 없다 |

**쓰는 OpenAI 모델은 `gpt-5-mini`다.** 모델 이름은 `app/api/chat/route.ts` 한 곳에만 둔다.
바꿀 때 한 줄만 고치면 되게 하기 위해서다. 모델을 바꿔도 통로가 돌려주는 다섯 항목
(`bodyPartId`·`side`·`symptoms`·`predictedCondition`·`summary`)은 그대로 유지한다.
