import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import { viVN } from '@clerk/localizations'
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css";

const customViVN = {
  ...viVN,
  unstable__errors: {
    ...viVN.unstable__errors,
    // Ghi đè các câu thông báo lỗi chưa được dịch
    form_identifier_not_found: "Không tìm thấy tài khoản này.",
    form_password_incorrect: "Mật khẩu không chính xác.",
    user_banned: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
    banned: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
    "You have been banned. If you think this was by mistake, please contact support.": "Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên."
  }
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gym Management App",
  description: "Phần mềm quản lý phòng Gym toàn diện",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={customViVN}>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
