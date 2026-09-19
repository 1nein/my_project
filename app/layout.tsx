import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegistrar from "@/app/components/ServiceWorkerRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "인체 증상 기록",
  description: "3D 인체 모델에서 아픈 부위를 눌러 증상을 기록하고 AI와 정리하는 앱",
  // iOS는 manifest 대신 이 값들을 본다. 이게 있어야 홈 화면에서 앱처럼 열린다.
  appleWebApp: {
    capable: true,
    title: "증상기록",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  other: {
    // 이 버전의 Next.js는 표준 이름인 mobile-web-app-capable만 넣는다.
    // 예전 iOS는 apple- 접두사가 붙은 이름만 알아보므로 함께 넣어 둔다.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
