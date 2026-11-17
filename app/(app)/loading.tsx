import Skeleton from "../components/ui/Skeleton";

/** Shown in the content area while a page's data loads; the sidebar stays put. */
export default function Loading() {
  return (
    <div className="stack-lg" aria-busy="true" aria-label="Loading">
      <div className="stack-sm">
        <Skeleton w={180} h={28} />
        <Skeleton w={320} h={16} />
      </div>
      <div className="row" style={{ gap: 12 }}>
        <Skeleton w={260} h={36} r={10} />
        <Skeleton w={220} h={36} r={10} />
      </div>
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card stat"><Skeleton w="45%" h={13} /><Skeleton w="60%" h={30} /><Skeleton w="75%" h={12} /></div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><Skeleton w={160} h={20} /></div>
        <div className="card-body stack">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
              <Skeleton w={28} h={28} r={14} />
              <Skeleton w={`${30 + ((i * 17) % 40)}%`} h={14} />
              <span className="spacer" />
              <Skeleton w={64} h={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
