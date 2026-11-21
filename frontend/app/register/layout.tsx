import type { Metadata } from "next";
import { authFontClasses } from "@/components/auth/auth-fonts";

export const metadata: Metadata = {
  title: "Create your account | PayKe",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <div className={authFontClasses}>{children}</div>;
}
