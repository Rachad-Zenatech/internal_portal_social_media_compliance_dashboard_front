import type { ComplianceViolation } from "@/services/complianceService";

interface Props {
  findings: ComplianceViolation[];
  fileId?: string;
}

/** Only measured regions are shown; never place a finding in an arbitrary area. */
export default function MediaFindingOverlay({ findings, fileId }: Props) {
  const boxes = findings.flatMap((finding, index) => {
    const regions = fileId
      ? (finding.image_regions ?? []).filter((region) => region.file_id === fileId)
      : [{ x: finding.region_x, y: finding.region_y, w: finding.region_w, h: finding.region_h }];
    return regions.filter((r) =>
      [r.x, r.y, r.w, r.h].every((v) => typeof v === "number" && Number.isFinite(v)) &&
      r.x! >= 0 && r.y! >= 0 && r.w! > 0 && r.h! > 0 && r.x! + r.w! <= 1.000001 && r.y! + r.h! <= 1.000001,
    ).map((region, n) => ({ region, finding, key: `${index}-${n}` }));
  });
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {boxes.map(({ region, finding, key }) => (
        <div key={key} title={`Rule ${finding.rule_number}: ${finding.title}`}
          className="absolute rounded-sm border-2 border-yellow-400 bg-yellow-300/25 shadow-[0_0_0_1px_rgba(113,63,18,0.65)]"
          style={{ left: `${region.x! * 100}%`, top: `${region.y! * 100}%`, width: `${region.w! * 100}%`, height: `${region.h! * 100}%` }}>
          <span className="absolute bottom-full left-0 whitespace-nowrap rounded bg-yellow-400 px-1 py-0.5 text-[10px] font-bold text-yellow-950">
            Rule {finding.rule_number}
          </span>
        </div>
      ))}
    </div>
  );
}
