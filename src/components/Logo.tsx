export default function Logo({ size = 28 }: { size?: number }) {
  // Marca real: toro + "Stratex" (PNG con fondo transparente). La imagen ya
  // incluye el wordmark, por eso no se añade texto aparte.
  return (
    <img
      src="/logo.png"
      alt="Stratex"
      draggable={false}
      className="w-auto select-none"
      style={{ height: Math.round(size * 1.9) }}
    />
  );
}
