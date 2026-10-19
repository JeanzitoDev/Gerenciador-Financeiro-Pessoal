"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export default function MobileSheet({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="record-dialog mobile-sheet"
      aria-labelledby="mobile-menu-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="section-head">
        <h2 id="mobile-menu-title">Seu espaço</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Fechar menu"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
