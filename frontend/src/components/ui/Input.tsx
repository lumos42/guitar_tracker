import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={id}
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)' }}
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          style={{
            background: 'var(--bg-surface)',
            borderColor: error ? 'var(--danger)' : 'var(--border-base)',
            color: 'var(--text-primary)',
          }}
          className={cn(
            'w-full h-12 px-4 border rounded-xl text-[15px]',
            'placeholder:text-[--text-tertiary]',
            'focus:outline-none transition-colors duration-150',
            'focus:border-[--accent]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
