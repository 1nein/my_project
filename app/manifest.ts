import type { MetadataRoute } from "next";

/**
 * 홈 화면에 설치했을 때 쓰이는 앱 정보.
 *
 * `display: "standalone"`이라 설치한 뒤에는 주소창 없이 앱처럼 열린다.
 * 아이콘은 192와 512 두 크기가 모두 있어야 안드로이드가 설치 대상으로 인정한다.
 * `maskable`은 안드로이드가 아이콘을 자기 모양으로 잘라낼 때 쓰는 것으로, 잘려도 그림이 남도록
 * 사람 모양을 더 작게 그려 둔 판이다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "인체 증상 기록",
    short_name: "증상기록",
    description: "아픈 부위를 눌러 증상을 기록하고 AI와 정리하는 앱",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
