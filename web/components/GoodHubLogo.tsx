interface GoodHubLogoProps {
  className?: string;
}

export default function GoodHubLogo({ className = '' }: GoodHubLogoProps) {
  return (
    <span
      role="img"
      aria-label="GOODHUB"
      className={`inline-flex h-9 items-center gap-0.5 rounded-md bg-[#080808] px-2.5 font-display text-[17px] font-extrabold leading-none tracking-[-0.08em] text-white ${className}`}
    >
      <span aria-hidden="true">GO</span>
      <span aria-hidden="true" className="mx-0.5 inline-block h-[0.72em] w-[0.72em] rounded-full bg-[#ff8a3d]" />
      <span aria-hidden="true">DHUB</span>
    </span>
  );
}
