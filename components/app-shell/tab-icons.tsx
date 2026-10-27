import type { ComponentProps } from "react";

// SVGs da tab bar do protótipo (docs/PFitness.html)
type IconProps = ComponentProps<"svg">;

export function TodayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

export function WorkoutIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <rect x="1.5" y="9" width="3" height="6" rx="1" fill="currentColor" />
      <rect x="5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
      <rect x="8.5" y="11" width="7" height="2" fill="currentColor" />
      <rect x="15.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
      <rect x="19.5" y="9" width="3" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

export function DietIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ProgressIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor" />
      <rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 21a8 7 0 0 1 16 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
