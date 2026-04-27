import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn('inline-block w-5 h-5 rounded-full animate-spin', className)}
      style={{
        border: '2px solid var(--border-base)',
        borderTopColor: 'var(--accent)',
      }}
    />
  )
}
