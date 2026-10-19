"use client";
import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
export default function DeleteAccount({
  onClose,
  onDelete,
}: {
  onClose: () => void;
  onDelete: (password: string, confirmation: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="record-dialog"
      aria-labelledby="delete-account-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onDelete(password, confirmation);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Não foi possível apagar.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="dialog-head">
          <h2 id="delete-account-title">Apagar minha conta</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar exclusão"
          >
            <X size={20} />
          </button>
        </div>
        <div className="dialog-fields">
          <p>
            Isso apaga seu acesso, lançamentos, contas, metas, aportes,
            investimentos, recorrências e contratos. A ação não pode ser
            desfeita.
          </p>
          <label className="form-field">
            <span>Sua senha atual</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={128}
            />
          </label>
          <label className="form-field">
            <span>Digite APAGAR para confirmar</span>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              required
              pattern="APAGAR"
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-foot">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Manter minha conta
          </button>
          <button
            type="submit"
            className="button destructive"
            disabled={busy || confirmation !== "APAGAR"}
          >
            <Trash2 size={17} />
            {busy ? "Apagando…" : "Apagar tudo"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
