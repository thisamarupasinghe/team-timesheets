/** The app mark: a clock, drawn inline so it follows the theme, on the same tile the sidebar and sign-in use. */
export default function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#111111" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="9.5" />
        <path d="M16 10.5V16l3.6 2.2" />
      </svg>
    </span>
  );
}

export function Brand() {
  return <span className="brand"><BrandMark /><span className="brand-text"><b>Team</b><span>Timesheets</span></span></span>;
}
