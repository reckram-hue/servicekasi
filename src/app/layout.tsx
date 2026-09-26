import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServiceKasi",
  description: "Field Service Management Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}