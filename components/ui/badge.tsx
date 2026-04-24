import * as React from 'react'

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

const variantStyles: Record<string, string> = {
  default: 'bg-[#0a0a0f] text-white',
  green: 'bg-green-500/15 text-green-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
  red: 'bg-red-500/15 text-red-800',
  blue: 'bg-blue-500/15 text-blue-400',
  purple: 'bg-purple-500/15 text-purple-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  gold: 'bg-[#D4AF37]/15 text-[#D4AF37]',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantStyles
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    />
  )
)
Badge.displayName = 'Badge'

export { Badge }
