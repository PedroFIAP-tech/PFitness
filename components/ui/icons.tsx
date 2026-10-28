import type { ComponentProps } from "react";

// Ícones de traço do protótipo (docs/PFitness.html), em viewBox 24×24
type IconProps = ComponentProps<"svg">;

function StrokeIcon({ strokeWidth = 2, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <StrokeIcon strokeWidth={2.2} {...props}>
      <path d="M12 5v14M5 12h14" />
    </StrokeIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </StrokeIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M6 9l6 6 6-6" />
    </StrokeIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M15 6l-6 6 6 6" />
    </StrokeIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M9 6l6 6-6 6" />
    </StrokeIcon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <StrokeIcon strokeWidth={2.4} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </StrokeIcon>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </StrokeIcon>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </StrokeIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </StrokeIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M4 10.5L8.5 15L16 5.5" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 16" fill="currentColor" aria-hidden {...props}>
      <path d="M1 1L13 8L1 15Z" />
    </svg>
  );
}
