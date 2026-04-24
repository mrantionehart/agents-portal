import * as React from 'react'

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

const variantStyles: Record<string, string> = {
  default: 'bg-[#1E2761] text-white hover:bg-[#162050] shadow-sm shadow-black/10',
  gold: 'bg-[#D4AF37] text-white hover:bg-[#C5A033] shadow-sm shadow-black/10',
  outline: 'border border-[#1a1a2e] bg-[#0a0a0f] text-gray-200 hover:bg-[#0a0a0f]',
  ghost: 'text-gray-200 hover:bg-[#111]',
  destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-black/10',
}

const sizeStyles: Record<string, string> = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'gold' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button }
