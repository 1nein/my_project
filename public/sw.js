/*
 * 오프라인용 캐시.
 *
 * 두 가지를 노린다. 하나는 인터넷이 끊겨도 화면과 3D 모델이 뜨는 것, 다른 하나는 모델(111KB)을
 * 매번 다시 받지 않는 것이다.
 *
 * AI 호출(`/api/`)은 절대 캐시하지 않는다. 지난 답변이 다시 나오면 안 되기 때문이다.
 * 새로 배포하면 CACHE 이름을 바꿔 옛 캐시를 버린다.
 */

const CACHE = "bodylog-v1";

/** 설치할 때 미리 받아 두는 것. 이것만 있으면 오프라인에서도 첫 화면이 뜬다. */
const PRECACHE = ["/", "/human-body.glb"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

function putInCache(request, response) {
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // AI 호출은 건드리지 않는다. 지난 답변을 다시 내보내면 안 된다.
  if (url.pathname.startsWith("/api/")) return;

  /*
   * 내용이 바뀌면 파일 이름도 바뀌는 것들은 캐시를 먼저 본다.
   * 모델 파일은 이름이 고정이지만 거의 바뀌지 않고, 바뀌면 CACHE 이름을 올려 버린다.
   */
  const cacheFirst =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/human-body.glb";

  if (cacheFirst) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) putInCache(request, response);
            return response;
          }),
      ),
    );
    return;
  }

  // 화면은 네트워크를 먼저 본다. 새로 배포한 내용이 바로 보여야 하기 때문이다.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.mode === "navigate") putInCache(request, response);
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("/"))),
  );
});
