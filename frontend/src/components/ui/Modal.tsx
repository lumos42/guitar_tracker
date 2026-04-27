import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ background: 'oklch(0 0 0 / 0.7)' }}
          className="fixed inset-0 z-40 animate-fade-in backdrop-blur-[2px]"
        />
        <Dialog.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] p-6',
            'border-t border-x border-[--border-base]',
            'animate-sheet-up',
            'md:top-1/2 md:left-1/2 md:bottom-auto md:right-auto',
            'md:-translate-x-1/2 md:-translate-y-1/2',
            'md:rounded-2xl md:max-w-md md:w-full md:animate-scale-in',
            className
          )}
          style={{ background: 'var(--bg-elevated)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          {/* Drag handle */}
          <div
            className="w-10 h-1 rounded-full mx-auto mb-6 md:hidden"
            style={{ background: 'var(--border-strong)' }}
          />
          <div className="flex items-center justify-between mb-6">
            {title && (
              <Dialog.Title
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                className="text-lg font-bold"
              >
                {title}
              </Dialog.Title>
            )}
            <Dialog.Close asChild>
              <button
                style={{ color: 'var(--text-tertiary)' }}
                className="ml-auto hover:text-[--text-primary] transition-colors p-1"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
