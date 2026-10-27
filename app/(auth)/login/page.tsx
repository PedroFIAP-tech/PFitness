import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { AuthForm } from "./auth-form";
import { LinkErrorNotice } from "./link-error-notice";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="flex animate-screen-in flex-col gap-8">
      <header className="flex flex-col items-center gap-5 text-center">
        <BrandMark />
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-title font-semibold">PFitness</h1>
          <p className="text-sm text-fg/60">Treino, dieta e evolução no mesmo lugar.</p>
        </div>
      </header>

      <Suspense>
        <LinkErrorNotice />
      </Suspense>

      <AuthForm />
    </div>
  );
}
