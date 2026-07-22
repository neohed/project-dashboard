import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "project-dashboard",
  description: "A local-first dashboard for tracking personal coding projects.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          theme="dark"
          toastOptions={{
            style: {
              background: "#131826",
              border: "1px solid #232b3d",
              color: "#e7eaf0",
            },
          }}
        />
      </body>
    </html>
  );
}
