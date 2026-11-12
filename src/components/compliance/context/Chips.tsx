import type { Option } from "./kinds";

const CHIP = "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold";
const CHIP_ON = "border-blue-600 bg-blue-600 text-white";
const CHIP_OFF = "border-border text-muted-foreground hover:text-foreground";

/** Pick any number of options; none picked means "all" (the first chip). */
export default function Chips({
  options,
  value,
  onChange,
  anyLabel,
}: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  anyLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" aria-pressed={value.length === 0} onClick={() => onChange([])} className={`${CHIP} ${value.length === 0 ? CHIP_ON : CHIP_OFF}`}>
        {anyLabel}
      </button>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
