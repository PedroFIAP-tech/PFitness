import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-field border px-4 py-3 text-[13px] leading-snug",
        tone === "error"
          ? "border-danger/35 bg-danger/8 text-danger"
          : "border-lime/35 bg-lime/8 text-lime",
      )}
    >
      {children}
    </p>
  );
}
