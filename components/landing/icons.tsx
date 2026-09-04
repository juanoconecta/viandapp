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

export function IconPlato({ className }: { className?: string }) {
  return base(
    <>
      <ellipse cx="12" cy="14.5" rx="8" ry="3.2" />
      <path d="M4 14.5c0 3 3.6 5.2 8 5.2s8-2.2 8-5.2" />
      <path d="M8.5 8c.5-1.8 1.6-3.2 1.6-5" />
      <path d="M12 7.3c.3-1.9 1-3.3 1-4.8" />
      <path d="M15.2 8.2c.6-1.6 1-2.9.7-4.5" />
    </>,
    className,
  );
}

export function IconMoneda({ className }: { className?: string }) {
  return base(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.3c0-1 1-1.8 2.5-1.8s2.5.7 2.5 1.6c0 2.4-5 1.5-5 4 0 .9 1.1 1.7 2.5 1.7s2.5-.7 2.5-1.8" />
      <path d="M12 6.3v1.3M12 16.4v1.3" />
    </>,
    className,
  );
}

export function IconPin({ className }: { className?: string }) {
  return base(
    <>
      <path d="M12 21c4-4.2 7-7.8 7-11.5A7 7 0 0 0 5 9.5C5 13.2 8 16.8 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </>,
    className,
  );
}

export function IconControles({ className }: { className?: string }) {
  return base(
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="14.5" cy="7" r="2.2" />
      <circle cx="7.5" cy="17" r="2.2" />
    </>,
    className,
  );
}

export function IconChispa({ className }: { className?: string }) {
  return base(
    <>
      <path d="M12 3.5c.5 3.2 1.8 4.5 5 5-3.2.5-4.5 1.8-5 5-.5-3.2-1.8-4.5-5-5 3.2-.5 4.5-1.8 5-5Z" />
      <path d="M18.5 15c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" />
    </>,
    className,
  );
}

export function IconCheck({ className }: { className?: string }) {
  return base(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.5 5-5.2" />
    </>,
    className,
  );
}

export function IconPuni({ className }: { className?: string }) {
  return base(
    <>
      <path d="M4 16.5V9.8l8-4.3 8 4.3v6.7" />
      <path d="M7.5 13.5h9" />
      <circle cx="8" cy="17.5" r="1.8" />
      <circle cx="16" cy="17.5" r="1.8" />
      <path d="M12 5.5v8" />
    </>,
    className,
  );
}

export function IconFlechaIzquierda({ className }: { className?: string }) {
  return base(<path d="M15 5l-7 7 7 7" />, className);
}

export function IconFlechaDerecha({ className }: { className?: string }) {
  return base(<path d="M9 5l7 7-7 7" />, className);
}

export function IconPausa({ className }: { className?: string }) {
  return base(
    <>
      <path d="M8 5v14" />
      <path d="M16 5v14" />
    </>,
    className,
  );
}

export function IconReproducir({ className }: { className?: string }) {
  return base(<path d="M7 4.5v15l13-7.5-13-7.5Z" strokeLinejoin="round" />, className);
}
