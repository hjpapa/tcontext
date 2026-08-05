import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { InterviewSessionProvider } from "@/components/layout/interview-session-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tcontext.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "TContext — 교사 컨텍스트 인터뷰",
    template: "%s | TContext",
  },
  description:
    "교사의 교육관과 학급 맥락을 차분히 정리해 여러 AI에서 활용할 수 있는 Markdown 컨텍스트 문서로 만듭니다.",
  applicationName: "TContext",
  keywords: [
    "교사",
    "수업 설계",
    "교사 컨텍스트",
    "생성형 AI",
    "교육",
    "개인정보 보호",
  ],
  authors: [{ name: "TContext" }],
  creator: "TContext",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: appUrl,
    siteName: "TContext",
    title: "TContext — 교사 컨텍스트 인터뷰",
    description:
      "나의 교육관과 학급 맥락을 정리해, 더 나다운 수업 설계를 준비합니다.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "TContext — 교사의 수업 맥락을 AI가 이해할 문서로",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TContext — 교사 컨텍스트 인터뷰",
    description:
      "나의 교육관과 학급 맥락을 정리해, 더 나다운 수업 설계를 준비합니다.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f4ed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <InterviewSessionProvider>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </InterviewSessionProvider>
      </body>
    </html>
  );
}
