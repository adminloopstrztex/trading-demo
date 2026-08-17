export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="9" fill="#16C784" />
        <path
          d="M8 20.5L13 14.5L17.5 18L24 9.5"
          stroke="#0A0B0D"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19.5 9.5H24V14"
          stroke="#0A0B0D"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-semibold text-[17px] text-[#F2F3F5] tracking-tight">Stratex</span>
    </div>
  );
}
