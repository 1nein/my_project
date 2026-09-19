"use client";

/**
 * 오프라인 캐시를 켜는 곳.
 *
 * 개발 중에는 켜지 않는다. 캐시가 남아 고친 코드가 화면에 반영되지 않는 일이 생기기 때문이다.
 * 화면에 아무것도 그리지 않는다.
 */

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 등록에 실패해도 앱은 그대로 동작한다. 오프라인 캐시만 없을 뿐이다.
      });
    };

    // 첫 화면이 다 뜬 뒤에 등록해, 모델 내려받기와 대역폭을 다투지 않게 한다.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
