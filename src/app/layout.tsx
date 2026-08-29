import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Assessment Extraction & Answer Mapping",
  description: "Upload a question paper and a handwritten answer sheet to extract, map, highlight, and grade answers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
