interface CountdownRingProps {
  secondsRemaining: number;
  period: number;
}

export function CountdownRing({
  secondsRemaining,
  period
}: CountdownRingProps) {
  const size = 52;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, secondsRemaining / period));
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      aria-label={`${secondsRemaining} seconds remaining`}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'grid',
        placeItems: 'center'
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(103, 126, 154, 0.18)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <strong
        style={{
          position: 'absolute',
          fontSize: '14px',
          color: 'var(--color-ink-strong)'
        }}
      >
        {secondsRemaining}s
      </strong>
    </div>
  );
}
