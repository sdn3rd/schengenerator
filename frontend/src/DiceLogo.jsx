// Single bolt component reused in header title and as the standalone logo mark
export function Bolt({ size = 20, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 24"
      width={size}
      height={size * (24 / 14)}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Classic lightning bolt — upper half tilts down-left, notch right, lower half tilts down-left */}
      <path d="M11 0L2 13h5.5L1 24l13-14H8.5L14 0z" />
    </svg>
  );
}

// Two bolts side-by-side — the SS logo mark
export default function DiceLogo({ size = 34 }) {
  const h = size * (24 / 14);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 24"
      width={size * 2.4}
      height={h}
      fill="currentColor"
      aria-label="SchengenShuffler"
      className="ss-logo"
    >
      {/* Left bolt */}
      <path d="M11 0L2 13h5.5L1 24l13-14H8.5L14 0z" />
      {/* Right bolt — offset right by 18 */}
      <path d="M29 0l-9 13h5.5L19 24l13-14H26.5L32 0z" />
    </svg>
  );
}
