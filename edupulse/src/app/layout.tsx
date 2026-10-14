import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduPulse – Student–Professional Mentoring Platform",
  description: "Find mentors, connect, chat and get guidance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
