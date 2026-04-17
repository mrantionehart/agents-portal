'use client'

/**
 * HartFelt geometric heart logo — SVG component
 * Geometric/hexagonal heart with vertical split creating 3D open-book effect
 */
export default function HartFeltHeart({
  className = '',
  color = 'currentColor',
  size = 200,
  opacity = 0.04,
  strokeWidth = 7,
}: {
  className?: string
  color?: string
  size?: number
  opacity?: number
  strokeWidth?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ opacity }}
    >
      {/*
        Geometric heart with hexagonal styling and center split
        Left half has an inward vertical notch, right half is clean
        Both halves meet at bottom point
      */}
      {/* Left half — with inner vertical edge creating the "open book" look */}
      <path
        d="
          M 100 172
          L 42 118
          L 30 78
          L 48 42
          L 82 32
          L 96 48
          L 96 82
          L 82 82
          L 82 56
          L 70 42
          L 52 48
          L 40 76
          L 50 112
          L 100 158
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right half — clean hexagonal curve */}
      <path
        d="
          M 100 172
          L 158 118
          L 170 78
          L 152 42
          L 118 32
          L 104 48
          L 104 82
          L 104 48
          L 118 32
          L 152 42
          L 170 78
          L 158 118
          L 100 158
        "
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/**
 * Full-page watermark — positions the heart centered in the background
 */
export function HartFeltWatermark({ color = '#C9A84C', opacity = 0.20 }: { color?: string; opacity?: number }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none flex items-center justify-center z-0"
      aria-hidden="true"
    >
      <HartFeltHeart size={520} color={color} opacity={opacity} strokeWidth={8} />
    </div>
  )
}
