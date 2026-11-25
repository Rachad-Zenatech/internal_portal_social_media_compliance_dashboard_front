import type { ComplianceViolation, ImageFindingRegion } from "@/services/complianceService";
import { useComplianceRules } from "@/hooks/useComplianceRules";

interface Props {
  findings: ComplianceViolation[];
  sourceRegions?: ImageFindingRegion[];
  disclaimerRegions?: ImageFindingRegion[];
  fileId?: string;
  currentTime?: number;
  showRuleTooltip?: boolean;
}

function validRegion(
  r: { x?: number | null; y?: number | null; w?: number | null; h?: number | null; start_sec?: number | null; end_sec?: number | null },
  currentTime?: number,
) {
  return (
    [r.x, r.y, r.w, r.h].every((v) => typeof v === "number" && Number.isFinite(v)) &&
    r.x! >= 0 && r.y! >= 0 && r.w! > 0 && r.h! > 0 && r.x! + r.w! <= 1.000001 && r.y! + r.h! <= 1.000001 &&
    (currentTime == null || r.start_sec == null || r.end_sec == null || (currentTime >= r.start_sec && currentTime <= r.end_sec))
  );
}

/** Only measured regions are shown; never place a finding in an arbitrary area. */
export default function MediaFindingOverlay({ findings, sourceRegions = [], disclaimerRegions = [], fileId, currentTime, showRuleTooltip = false }: Props) {
  const { data: rules } = useComplianceRules();
  const descriptions = new Map((rules ?? []).map((rule) => [rule.id, rule.summary]));
  const boxes = findings.flatMap((finding, index) => {
    if (finding.evaluation?.source === "ADJUSTED" && finding.evaluation.model_decision === "NO_VIOLATION") return [];
    const regions = fileId
      ? (finding.image_regions ?? []).filter((region) => region.file_id === fileId)
      : [{ x: finding.region_x, y: finding.region_y, w: finding.region_w, h: finding.region_h, start_sec: undefined, end_sec: undefined }];
    return regions.filter((r) => validRegion(r, currentTime)).map((region, n) => ({
      region,
      finding,
      ruleLabel: `Rule ${finding.rule_number.replace(/^rule\s+/i, "")}`,
      description: descriptions.get(finding.rule_id) ?? finding.explanation,
      key: `${index}-${n}`,
    }));
  });
  const filterRegions = (list: ImageFindingRegion[]) =>
    (fileId ? list.filter((r) => r.file_id === fileId) : list).filter((r) => validRegion(r, currentTime));
  const badges = [
    ...filterRegions(sourceRegions).map((region, idx) => ({
      key: `source-${idx}`, label: "Source", title: "Detected source citation",
      boxCls: "border-sky-500 bg-sky-400/20 shadow-[0_0_0_1px_rgba(3,105,161,0.55)]",
      tagCls: "bg-sky-500 text-white", region,
    })),
    ...filterRegions(disclaimerRegions).map((region, idx) => ({
      key: `disclaimer-${idx}`, label: "Disclaimer", title: "Detected disclaimer",
      boxCls: "border-emerald-500 bg-emerald-400/20 shadow-[0_0_0_1px_rgba(4,120,87,0.55)]",
      tagCls: "bg-emerald-600 text-white", region,
    })),
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      {badges.map(({ key, label, title, boxCls, tagCls, region }) => (
        <div key={key} title={title} onClick={(event) => event.stopPropagation()}
          className={`absolute rounded-sm border-2 ${boxCls}`}
          style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }}>
          <span className={`absolute bottom-full left-0 whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-bold ${tagCls}`}>
            {label}
          </span>
        </div>
      ))}
      {boxes.map(({ region, finding, ruleLabel, description, key }) => (
        <div key={key} title={showRuleTooltip ? undefined : `${ruleLabel}: ${finding.title}`} onClick={(event) => event.stopPropagation()}
          className={`absolute rounded-sm border-2 border-yellow-400 bg-yellow-300/25 shadow-[0_0_0_1px_rgba(113,63,18,0.65)] ${showRuleTooltip ? "pointer-events-auto group cursor-help" : ""}`}
          style={{ left: `${region.x! * 100}%`, top: `${region.y! * 100}%`, width: `${region.w! * 100}%`, height: `${region.h! * 100}%` }}>
          <span className="absolute bottom-full left-0 whitespace-nowrap rounded bg-yellow-400 px-1 py-0.5 text-[10px] font-bold text-yellow-950">
            {ruleLabel}
          </span>
          {showRuleTooltip && (
            <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-80 whitespace-normal rounded bg-slate-950 px-2 py-1.5 text-left text-xs text-white shadow-lg group-hover:block">
              <span className="block font-semibold">{ruleLabel}: {finding.title}</span>
              <span className="mt-1 block leading-relaxed text-slate-200">{description}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
