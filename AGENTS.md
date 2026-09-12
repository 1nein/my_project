# 인체 증상 기록 앱

인체 그림에서 신체 부위를 눌러 증상을 기록하고, AI와 대화해 증상과 예측 병명을 정리해 남기는 웹
앱이다. 고등학교 입학 제출용 포트폴리오로, 개발자가 아닌 면접관이 열어 보고 판단한다. 혼자
만드는 개인 프로젝트이며 사용자 계정도 로그인도 없다.

Next.js(App Router) · React · TypeScript · Tailwind CSS로 만들고 Vercel에 배포한다.

## 문서 구조

```
.
├── CLAUDE.md                            ← 이 파일. 프로젝트 전체를 먼저 파악하는 곳
├── AGENTS.md                            ← 이 파일과 같은 내용
├── docs/
│   ├── business-rules.md                ← 도메인 규칙. 부위·증상·기록·대화의 동작과 부위 목록
│   ├── architecture.md                  ← 화면과 코드의 구성, 대표 흐름, 디렉터리 구조
│   ├── contracts.md                     ← 화면과 서버가 주고받는 형식, 저장되는 값의 형식
│   ├── security.md                      ← API 키를 지키는 방법, 무엇을 지키지 않기로 했는지
│   ├── standards.md                     ← 지켜야 할 규칙 전체와 검증 기준
│   ├── engineering-notes.md             ← 모르면 걸리는 것들
│   ├── operations.md                    ← 설치·실행·환경변수·배포
│   └── tracking/
│       ├── status.md                    ← 지금 어디까지 왔고 무엇이 남았는지
│       ├── findings.md                  ← 지금 해결하지 못한 문제
│       └── decisions/
│           ├── index.md                 ← 결정 목록
│           └── 0001~0005-*.md           ← 되돌리기 전에 읽을 결정들
└── app/
    └── AGENTS.md                        ← app 폴더의 담당 범위와 경계
```

## 어길 수 없는 것

전체 규칙은 `docs/standards.md`에 있다. 그중 어기면 되돌리기 어려운 것이 이 넷이다.

1. **OpenAI API는 `app/api/chat/route.ts`에서만 호출한다.** 브라우저에서 실행되는 코드가 OpenAI를
   직접 부르거나 API 키를 읽으면 안 된다. 환경변수 이름에 `NEXT_PUBLIC_`을 붙이지 않는다.
2. **기록은 브라우저 `localStorage`에만 저장하고, 저장소 접근은 `app/lib/records.ts` 한 곳에서만
   한다.** 서버 데이터베이스도 로그인도 만들지 않는다.
3. **인체 그림을 그리는 코드와 부위 선택·기록 로직을 분리한다.** `app/components/BodyMap.tsx`가
   기록이나 증상을 직접 다루면 안 된다.
4. **`npm run lint`와 `npm run build`가 모두 종료 코드 0이어야 작업이 끝난 것이다.** 테스트
   프레임워크는 도입하지 않는다.

## 작업 전에 읽을 것

어떤 작업이든 `docs/standards.md`와 `docs/engineering-notes.md`를 먼저 읽는다. `app/` 아래를
건드린다면 `app/AGENTS.md`도 읽는다. 그 위에 작업별로:

| 건드릴 것 | 먼저 읽을 것 |
|---|---|
| 인체 그림, 부위 선택 | `docs/business-rules.md`의 부위 목록, `docs/architecture.md`의 그림과 선택 분리 |
| 기록 저장·수정·삭제 | `docs/business-rules.md`의 기록 규칙, `docs/contracts.md`의 저장 형식 |
| 증상 목록 | `docs/tracking/decisions/0003-symptoms-from-saved-records.md` |
| AI 연결, 프롬프트 | `docs/contracts.md`의 호출 통로, `docs/security.md`의 키 정책 |
| 배포, 환경변수 | `docs/operations.md` |
| 새 기능을 시작하기 전 | `docs/tracking/status.md`로 지금 위치를 확인 |

`docs/business-rules.md`에 없는 도메인 판단이 필요하면 임의로 정하지 말고 사람에게 묻는다.

## 문제가 생겼을 때

아래 셋은 **즉시 사람에게 알린다.** 고쳐 놓고 넘어가지 않는다.

- API 키가 브라우저로 내려갈 수 있는 구조를 발견했을 때 (`NEXT_PUBLIC_` 접두사, 브라우저 코드의
  OpenAI 호출, 응답 본문이나 오류 메시지에 섞인 키)
- 저장된 기록이 사라지거나 덮어써지는 동작을 발견했을 때. 기록은 브라우저에만 있어 복구할 수단이
  없다
- `docs/business-rules.md`의 규칙과 실제로 필요한 동작이 어긋날 때

그 밖에 그 자리에서 해결하지 못한 문제는 `docs/tracking/findings.md`에 적는다. 무엇이 막히는지,
왜 지금 해결할 수 없는지를 함께 적는다. 그 자리에서 해결한 문제는 적지 않되, 알아둘 만한 것을
배웠으면 `docs/engineering-notes.md`에 남긴다.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
