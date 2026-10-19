export default function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="brand-mark"
    >
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke="currentColor"
        strokeWidth="2.2"
        opacity=".65"
      />
      <path
        d="M24 4v4m20 16h-4M24 44v-4M4 24h4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity=".65"
      />
      <g className="compass-needle">
        <path d="m24 10 7 14H17l7-14Z" fill="currentColor" />
        <path d="m17 24 7 14 7-14H17Z" fill="currentColor" opacity=".32" />
      </g>
    </svg>
  );
}
