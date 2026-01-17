import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { ServiceWorkerRegister } from "@/components/push-notifications/service-worker-register";
import { NotificationPermissionRequest } from "@/components/push-notifications/notification-permission-request";
import { ProjectContextProvider } from "@/contexts/ProjectContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Doshaki Construction Accountability System",
  description: "Streamline your construction project management with real-time tracking of materials, expenses, and labour. Ensure transparency, optimize costs, and drive project success.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <ProjectContextProvider>
            <ServiceWorkerRegister />
            <NotificationPermissionRequest />
            {children}
          </ProjectContextProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
