export default function Skeleton({ w = "100%", h = 14, r, className = "" }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
  return <span className={`skel ${className}`.trim()} style={{ display: "block", width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}
