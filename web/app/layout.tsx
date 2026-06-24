import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EthioVin — VIN decoder for Ethiopia",
  description: "Decode any imported vehicle's VIN. Free basics for everyone; premium unlocks the full history from garages, insurers, inspections and odometer records.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
