'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const modal = modalRef.current
    if (!modal) return
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    modal.addEventListener('keydown', handleKeyDown)
    return () => modal.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="modal modal-open modal-bottom sm:modal-middle"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div ref={modalRef} className={`modal-box ${sizeClasses[size]}`}>
        <div className="flex justify-between items-center mb-5">
          {title && (
            <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle ml-auto"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
    </div>
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
}

export function ConfirmModal({
  isOpen, onConfirm, onCancel, title, message,
  confirmText = 'Confirm', cancelText = 'Cancel', isDangerous = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="flex flex-col items-center text-center gap-4 pb-2">
        {isDangerous && (
          <div className="w-12 h-12 rounded-full bg-error/10 border border-error/20 flex items-center justify-center">
            <AlertTriangle className="text-error" size={22} />
          </div>
        )}
        <div>
          <p className="text-base-content/60 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3 w-full mt-2">
          <button onClick={onCancel} className="btn btn-neutral flex-1">{cancelText}</button>
          <button
            onClick={onConfirm}
            className={`flex-1 btn ${isDangerous ? 'btn-error' : 'btn-primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
