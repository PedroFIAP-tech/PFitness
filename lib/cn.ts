import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Ensina ao tailwind-merge os tokens de app/globals.css, senão ele não sabe
// que `text-label` é tamanho e `text-fg` é cor (e descartaria um dos dois).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["bg", "fg", "lime", "on-lime", "cyan", "amber", "danger", "line"],
      text: ["label", "title"],
      tracking: ["label", "button"],
      radius: ["field", "button", "card", "hero"],
      shadow: [
        "card",
        "card-accent",
        "button",
        "button-pressed",
        "field-focus",
        "tab-bar",
        "indicator",
        "glow-sm",
        "glow",
        "glow-lg",
      ],
      "drop-shadow": ["glow"],
      font: ["display"],
      ease: ["snap", "sheet"],
      animate: [
        "screen-in",
        "item-in",
        "slide-up",
        "sheet-up",
        "fade-in",
        "pop",
        "toast-in",
        "particle",
        "ring-out",
        "burst",
        "float-up",
        "rays",
        "blink",
        "glow-pulse",
        "pulse-ring",
        "shine",
        "scan",
        "flame",
        "bump",
        "bar-x",
        "ring",
        "bar-y",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
