export default function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 88"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M40,78 Q24,62,12,38 A28,28,0,0,1,68,38 Q56,62,40,78 Z"
        className="fill-coral"
      />
      <rect x="28" y="16" width="4" height="17" rx="2" fill="white" />
      <rect x="38" y="14" width="4" height="19" rx="2" fill="white" />
      <rect x="48" y="16" width="4" height="17" rx="2" fill="white" />
      <rect x="26" y="31" width="28" height="4" rx="2" fill="white" />
      <rect x="38" y="35" width="4" height="26" rx="2" fill="white" />
    </svg>
  );
}
