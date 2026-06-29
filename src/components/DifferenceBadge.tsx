import { differenceTone } from "@/lib/inventory";

export function DifferenceBadge({ value }: { value: number }) {
  const tone = differenceTone(value);
  const label = value > 0 ? `+${value}` : value.toString();

  return <span className={`badge ${tone}`}>{label}</span>;
}
