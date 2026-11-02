interface GoodHubLogoProps {
  className?: string;
}

export default function GoodHubLogo({ className = '' }: GoodHubLogoProps) {
  return (
    <span
      role="img"
      aria-label="GOODHUB"
      className={`inline-flex h-9 items-center gap-2 font-display text-[17px] font-extrabold leading-none tracking-[-0.06em] text-foreground ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
        <rect width="32" height="32" rx="10" fill="#e7f52c" />
        <path
          d="M23.4 10.1A9 9 0 1 0 25 17h-9v-3h12v3.2A12 12 0 1 1 25.8 8Z"
          fill="#10264a"
        />
      </svg>
      <span>GOODHUB</span>
    </span>
  );
}
