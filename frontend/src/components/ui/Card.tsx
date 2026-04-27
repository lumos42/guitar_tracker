import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
}

export function Card({ className, elevated = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[--border-subtle]',
        elevated ? 'bg-[--bg-elevated]' : 'bg-[--bg-surface]',
        className
      )}
      {...props}
    />
  )
}
