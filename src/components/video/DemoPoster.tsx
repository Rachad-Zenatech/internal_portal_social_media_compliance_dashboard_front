import type { PosterVariant } from "@/context/VideoUploadQueueContext";

const SCENES: Record<PosterVariant, { sky: [string, string, string]; ground: string; far: string; sun?: string; stars?: boolean }> = {
  dusk: { sky: ["#fbbf24", "#ea580c", "#431407"], ground: "#1c1917", far: "#44403c", sun: "#fde68a" },
  desert: { sky: ["#bae6fd", "#fde4c3", "#e9b17a"], ground: "#b45309", far: "#d9935a", sun: "#fff7ed" },
  night: { sky: ["#1e3a8a", "#0f172a", "#020617"], ground: "#020617", far: "#1e293b", stars: true },
};

/**
 * Illustrated placeholder for demo queue items that have no real video file.
 * Uses `slice` scaling so it fills both 16:9 cards and the 9:16 player.
 */
export default function DemoPoster({ variant = "dusk", className = "" }: { variant?: PosterVariant; className?: string }) {
  const scene = SCENES[variant];
  const id = `poster-${variant}`;
  return (
    <svg viewBox="0 0 320 320" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={scene.sky[0]} />
          <stop offset="0.55" stopColor={scene.sky[1]} />
          <stop offset="1" stopColor={scene.sky[2]} />
        </linearGradient>
      </defs>
      <rect width="320" height="320" fill={`url(#${id}-sky)`} />

      {scene.stars &&
        [[30, 40], [80, 70], [140, 30], [210, 55], [270, 35], [295, 90], [50, 110], [180, 95]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="#e2e8f0" opacity="0.8" />
        ))}
      {scene.sun && <circle cx="232" cy="205" r="26" fill={scene.sun} opacity="0.9" />}

      {/* Far hills and foreground */}
      <path d="M0 215 Q60 185 120 205 T240 198 T320 208 V320 H0Z" fill={scene.far} />
      <path d="M0 240 Q80 222 160 236 T320 230 V320 H0Z" fill={scene.ground} />
      {variant === "night" &&
        [20, 48, 70, 230, 255, 285].map((x, i) => (
          <rect key={x} x={x} y={232 - (i % 3) * 10 - 8} width="16" height={30 + (i % 3) * 10} fill="#0b1224" />
        ))}

      {/* Quadcopter */}
      <g transform="translate(160 150)">
        <ellipse cx="0" cy="38" rx="34" ry="4" fill="#000" opacity="0.18" />
        <g stroke="#0f172a" strokeWidth="3" strokeLinecap="round">
          <line x1="-14" y1="0" x2="-44" y2="-10" />
          <line x1="14" y1="0" x2="44" y2="-10" />
          <line x1="-10" y1="6" x2="-16" y2="18" />
          <line x1="10" y1="6" x2="16" y2="18" />
          <line x1="-20" y1="18" x2="-10" y2="18" />
          <line x1="10" y1="18" x2="20" y2="18" />
        </g>
        <rect x="-18" y="-6" width="36" height="14" rx="6" fill="#111827" />
        <circle cx="0" cy="8" r="4" fill="#334155" />
        {[-44, 44].map((x) => (
          <g key={x}>
            <rect x={x - 2} y="-16" width="4" height="7" fill="#0f172a" />
            <ellipse cx={x} cy="-17" rx="20" ry="2.6" fill="#e5e7eb" opacity="0.75" />
          </g>
        ))}
      </g>
    </svg>
  );
}
