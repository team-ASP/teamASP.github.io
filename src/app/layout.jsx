import "./globals.css";
import { SessionBanner } from "@/components/session-banner";

export const metadata = {
  title: "ASP Study Hub",
  description: "ASP 팀의 스터디와 프로젝트를 계획, 진행, 정리, 아카이빙하는 운영 허브",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <SessionBanner />
        {children}
      </body>
    </html>
  );
}
