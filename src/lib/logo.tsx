export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl bg-primary font-bold text-white shadow-lg shadow-primary/30 select-none"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-label="didKasir logo"
    >
      d
    </div>
  );
}
