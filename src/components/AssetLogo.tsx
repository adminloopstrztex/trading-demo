import { useState } from 'react';
import { assetVisual, flag } from '../data/assetVisual';

export default function AssetLogo({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const visual = assetVisual(symbol);
  const [failed, setFailed] = useState(false);

  const fallback = (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-[#16C784]/15 flex items-center justify-center font-semibold text-[#16C784]"
    >
      <span style={{ fontSize: size * 0.32 }}>{symbol.slice(0, 2)}</span>
    </div>
  );

  if (visual.kind === 'badge') {
    return (
      <div
        style={{ width: size, height: size, background: visual.bg, color: visual.color }}
        className="rounded-full flex items-center justify-center font-semibold"
      >
        <span style={{ fontSize: size * 0.34 }}>{visual.label}</span>
      </div>
    );
  }

  if (visual.kind === 'pair') {
    const small = size * 0.66;
    return (
      <div style={{ width: size, height: size }} className="relative">
        <img
          src={flag(visual.flags[0])}
          alt=""
          style={{ width: small, height: small }}
          className="absolute top-0 left-0 rounded-full object-cover border border-[#0A0B0D]"
        />
        <img
          src={flag(visual.flags[1])}
          alt=""
          style={{ width: small, height: small }}
          className="absolute bottom-0 right-0 rounded-full object-cover border border-[#0A0B0D]"
        />
      </div>
    );
  }

  if (failed) return fallback;

  return (
    <div
      style={{ width: size, height: size, background: visual.bg }}
      className="rounded-full flex items-center justify-center overflow-hidden border border-[#262A33]"
    >
      <img
        src={visual.url}
        alt={symbol}
        onError={() => setFailed(true)}
        style={{ width: size * 0.7, height: size * 0.7 }}
        className="object-contain"
      />
    </div>
  );
}
