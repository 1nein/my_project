# 알아두면 걸리지 않는 것

## `AGENTS.md`의 표시 구간이 되살아난다

**증상.** `AGENTS.md`에서 `<!-- BEGIN:nextjs-agent-rules -->`부터
`<!-- END:nextjs-agent-rules -->`까지를 지우고 커밋해도, `npm run dev`를 돌리면 다시 생겨 있다.
작업 중이던 브랜치에 계속 추적되지 않은 변경이 뜬다.

**원인.** `node_modules/next/dist/server/lib/generate-agent-files.js`가 개발 서버를 띄울 때 이
구간이 없거나 낡았으면 다시 써 넣는다.

**대응.** 지우려 하지 말고 그대로 둔다. 같은 파일의 `upsertAgentRulesBlock`은 **표시 구간만**
교체하고 그 앞뒤 내용은 건드리지 않으므로, 구간 밖에 쓴 내용은 안전하다. `CLAUDE.md`와
`AGENTS.md`를 같은 내용으로 유지할 때도 이 구간을 양쪽에 그대로 포함시키면 된다. 두 파일 중
하나라도 최신 구간을 갖고 있으면 개발 서버는 아무것도 쓰지 않는다.

**확인 방법.** `npm run dev`를 한 번 띄웠다 끄고 `git status`를 본다. `AGENTS.md`가 변경 목록에
없으면 된 것이다.

## `localStorage`는 서버에서 읽을 수 없다

**증상.** 기록을 읽는 코드를 넣었더니 `localStorage is not defined`로 빌드나 첫 렌더가 깨진다.
또는 화면이 잠깐 빈 상태로 보였다가 내용이 나타나면서 콘솔에 렌더 불일치 경고가 뜬다.

**원인.** Next.js App Router의 컴포넌트는 기본적으로 서버에서 먼저 실행된다. 서버에는 브라우저
저장소가 없다. `"use client"`를 붙여도 첫 렌더는 서버에서 한 번 일어나므로, 렌더 중에 저장소를
읽으면 서버 결과와 브라우저 결과가 달라진다.

**대응.** 저장소를 읽는 일은 `"use client"` 컴포넌트의 `useEffect` 안에서 한다. 렌더 함수 본문에서
읽지 않는다. 첫 렌더에는 빈 상태를 그리고, 읽어온 뒤 상태를 채운다. 기록이 없는 것과 아직 읽지
않은 것을 구분하고 싶으면 상태를 `null`(아직 읽기 전)과 `[]`(읽었는데 없음)로 나눈다.

**확인 방법.** `npm run build`가 통과하고, 개발 서버에서 그 화면을 새로고침했을 때 콘솔에
하이드레이션 경고가 없으면 된 것이다.

## Tailwind CSS 4는 설정 파일이 없다

**증상.** `tailwind.config.js` 또는 `tailwind.config.ts`를 찾는데 없다. 만들어서 설정을 넣어도
반영되지 않는다.

**원인.** 이 프로젝트는 Tailwind CSS 4를 쓴다. 4버전은 CSS 파일에서 설정한다.
`app/globals.css`가 `@import "tailwindcss"`로 Tailwind를 가져오고, 색·폰트 같은 값은 같은 파일의
`@theme inline { ... }` 블록에서 정의한다. PostCSS 연결은 `postcss.config.mjs`가 한다.

**대응.** 새 색이나 폰트를 추가하려면 `app/globals.css`의 `@theme inline` 블록에 CSS 변수를
더한다. 설정 파일을 새로 만들지 않는다.

**확인 방법.** 추가한 값을 유틸리티 클래스로 쓴 화면을 개발 서버에서 열어 실제로 적용되는지 본다.
