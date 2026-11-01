export default function PawnIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <circle cx="12" cy="6.2" r="3.1" />
      <path d="M8.8 10.4h6.4c.6 0 1.1.4 1.2 1l1.3 5.4H6.3l1.3-5.4c.1-.6.6-1 1.2-1Z" />
      <rect x="4.6" y="17.6" width="14.8" height="2.9" rx="1.2" />
    </svg>
  );
}
