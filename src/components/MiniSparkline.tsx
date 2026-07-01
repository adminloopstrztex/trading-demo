export default function MiniSparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return <div className="w-20 h-8" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 80;
      const y = 28 - ((v - min) / range) * 28;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="80" height="28" viewBox="0 0 80 28" className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#16C784' : '#FF5C5C'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
