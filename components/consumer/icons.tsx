import type { ReactNode } from "react";

function base(children: ReactNode, className?: string) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconInicio({ className }: { className?: string }) {
  return base(
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5.5h4V20h3a1 1 0 0 0 1-1v-9" />
    </>,
    className,
  );
}

export function IconBuscar({ className }: { className?: string }) {
  return base(
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5 15 15" />
    </>,
    className,
  );
}

export function IconSumar({ className }: { className?: string }) {
  return base(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8 12h8" />
    </>,
    className,
  );
}
