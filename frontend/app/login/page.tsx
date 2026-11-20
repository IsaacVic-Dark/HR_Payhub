import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthBrand } from "@/components/auth/auth-brand";
import { PayslipPreview } from "@/components/auth/payslip-preview";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-white text-auth-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col px-6 py-6 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <AuthBrand />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-sm text-sm text-auth-muted transition-colors hover:text-auth-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-auth-accent/40"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to site
          </Link>
        </header>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-[400px]">
            <LoginForm />
          </div>
        </div>
      </section>

      <aside className="hidden border-l border-auth-line bg-auth-canvas lg:flex lg:items-center lg:justify-center lg:px-12 lg:py-12 xl:px-20">
        <PayslipPreview />
      </aside>
    </main>
  );
}
