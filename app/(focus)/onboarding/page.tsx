import type { Metadata } from "next";
import { Suspense } from "react";
import { getOnboardingDefaults } from "@/lib/profile-data";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Seu perfil" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingLoader />
    </Suspense>
  );
}

async function OnboardingLoader() {
  const defaults = await getOnboardingDefaults();
  return <OnboardingFlow defaults={defaults} />;
}

function OnboardingSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4 px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="h-1.5 rounded-full bg-white/8" />
      <div className="h-8 w-56 rounded-md bg-white/6" />
      <div className="h-[55dvh] rounded-card border border-white/8 bg-white/[0.035]" />
    </div>
  );
}
