import type { ReactNode } from "react";

/** Telas cheias (editar ficha, treino em andamento): sem tab bar, entrando de baixo. */
export default function FocusLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="mx-auto min-h-dvh w-full max-w-md animate-slide-up">{children}</div>;
}
