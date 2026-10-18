"use client";
import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
export default function ConfirmDialog({
  label,
  onClose,
  onConfirm,
}: {
  label: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="record-dialog confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="delete-title"
    >
      <div className="dialog-head">
        <span className="square-icon danger">
          <Trash2 size={22} />
        </span>
        <button
          className="icon-button"
          aria-label="Fechar"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="dialog-fields">
        <h2 id="delete-title">Excluir {label}?</h2>
        <p className="muted">
          O saldo e os relatórios serão recalculados. Vínculos com outros
          registros podem impedir a exclusão. Uma ocorrência recorrente excluída
          não será gerada novamente.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
      <div className="dialog-foot">
        <button className="button secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          className="button destructive"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Não foi possível excluir.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Excluindo…" : "Excluir"}
        </button>
      </div>
    </dialog>
  );
}
