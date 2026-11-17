import { Info } from "lucide-react";

/** A small (i) that explains a number or a rule on hover and keyboard focus. */
export default function InfoTip({ text, pos }: { text: string; pos?: "left" }) {
  return (
    <span className="info-tip" tabIndex={0} data-tip={text} data-tip-pos={pos} aria-label={text} role="note">
      <Info aria-hidden="true" />
    </span>
  );
}
