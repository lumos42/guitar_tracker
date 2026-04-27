import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl',
          'transition-all duration-150 ease-out',
          'active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
          'font-display select-none',
          {
            // Primary: warm gold fill
            'bg-[--accent] text-[--bg-base] hover:bg-[--accent-hover] shadow-[0_4px_20px_var(--accent-dim)]':
              variant === 'primary',
            // Secondary: subtle surface
            'bg-[--bg-elevated] text-[--text-primary] hover:bg-[--bg-overlay] border border-[--border-base]':
              variant === 'secondary',
            // Ghost: no background
            'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-surface]':
              variant === 'ghost',
            // Danger
            'bg-[--danger-dim] text-[--danger] hover:brightness-110 border border-[oklch(0.65_0.20_25_/_0.25)]':
              variant === 'danger',
          },
          {
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-5 text-sm tracking-wide': size === 'md',
            'h-13 px-6 text-base tracking-wide': size === 'lg',
            'h-10 w-10 rounded-xl': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
