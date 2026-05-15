interface CountdownRingProps {
  secondsRemaining: number;
  period: number;
}

export function CountdownRing({
  secondsRemaining,
  period
}: CountdownRingProps) {
  const size = 34;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, secondsRemaining / period));
  const dashOffset = circumference * (1 - progress);
  const label = `${secondsRemaining}s`;

  return (
    <div
      aria-label={`${secondsRemaining} seconds remaining`}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'grid',
        placeItems: 'center',
        alignSelf: 'center'
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
          stroke="var(--color-line)"
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
          fontSize: '10px',
          lineHeight: 1,
          color: 'var(--color-ink-strong)'
        }}
      >
        {label}
      </strong>
    </div>
  );
}
