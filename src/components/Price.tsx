import { useEffect, useRef, useState } from 'react';

// Renders a price that briefly flashes green/red when its value changes,
// so live updates feel like a real ticker.
export default function Price({
  value,
  format,
  className = '',
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<'' | 'up' | 'down'>('');

  useEffect(() => {
    const previous = prev.current;
    if (value === previous) return;
    setFlash(value > previous ? 'up' : 'down');
    prev.current = value;
    const t = setTimeout(() => setFlash(''), 600);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span className={`rounded px-1 -mx-1 ${flash ? `strx-flash-${flash}` : ''} ${className}`}>{format(value)}</span>
  );
}
