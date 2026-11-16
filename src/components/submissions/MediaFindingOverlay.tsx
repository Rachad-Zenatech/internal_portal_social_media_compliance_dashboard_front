import type { ComplianceViolation } from "@/services/complianceService";

const fallbackBoxes = [
  { x: 0.22, y: 0.22 },
  { x: 0.5, y: 0.18 },
  { x: 0.34, y: 0.52 },
];

/** Yellow boxes over media findings. Coordinates are fractions of the rendered image or video frame. */
export default function MediaFindingOverlay({ findings }: { findings: ComplianceViolation[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {findings.map((finding, index) => {
        const fallback = fallbackBoxes[index % fallbackBoxes.length];
        const x = finding.region_x ?? fallback.x;
        const y = finding.region_y ?? fallback.y;
        const w = finding.region_w ?? 0.32;
        const h = finding.region_h ?? 0.24;
        return (
          <div
            key={`${finding.rule_id}-${index}`}
            className="absolute border-4 border-yellow-400 bg-yellow-300/15 shadow-[0_0_0_1px_rgba(113,63,18,0.65)]"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
          >
            <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-yellow-950">
              Rule {finding.rule_number}
            </span>
          </div>
        );
      })}
    </div>
  );
}
