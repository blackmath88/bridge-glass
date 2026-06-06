export function SignalMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="5" y="5" width="43.5" height="43.5" rx="1.5" fill="#1a7a6d" />
      <rect x="51.5" y="5" width="43.5" height="43.5" rx="1.5" fill="#3d1f47" />
      <rect x="5" y="51.5" width="43.5" height="43.5" rx="1.5" fill="#3d1f47" />
      <path d="M51.5 95 Q51.5 51.5 95 51.5 L95 95 Z" fill="#2a8fa0" />
    </svg>
  )
}
