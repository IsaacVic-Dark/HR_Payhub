import type { Metadata } from "next";
import { authFontClasses } from "@/components/auth/auth-fonts";

export const metadata: Metadata = {
  title: "Sign in | PayKe",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={authFontClasses}>{children}</div>;
}
