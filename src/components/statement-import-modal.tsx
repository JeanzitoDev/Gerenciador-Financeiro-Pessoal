"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Plus,
  Sparkles,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import type { Account, Entity, FinanceData } from "@/lib/types";
import { formatDate, monthLabel, today } from "@/lib/finance/dates";
import { formatMoney } from "@/lib/finance/money";
import { isCreditWalletAccount } from "@/lib/finance/credit-cards";
import {
  buildImportBatchPayload,
  computeImportSummary,
  detectStatementDocumentType,
  prepareImportPreview,
  sampleBankStatementText,
  sampleCreditCardInvoiceText,
  type StatementPreviewItem,
} from "@/lib/finance/statement-import";
import { PdfImportError, readBankPdf } from "@/lib/finance/pdf-reader";
import SelectControl from "./select-control";
import { MonthControl } from "./date-control";

export const STATEMENT_MAX_PDF_BYTES = 10 * 1024 * 1024;
export const STATEMENT_MAX_TEXT_BYTES = 5 * 1024 * 1024;
export const STATEMENT_IMPORT_CHUNK_SIZE = 75;

export const STATEMENT_FILE_ACCEPT =
  "image/*,application/pdf,text/csv,text/plain,application/vnd.ms-excel,application/x-ofx,.ofx,.qfx,.csv,.tsv,.txt,.pdf,*/*";

const DEFAULT_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Assinaturas",
  "Educação",
  "Lazer",
  "Compras",
  "Salário",
  "Benefícios",
  "Investimentos",
  "Empréstimos e financiamentos",
  "Fatura de cartão",
  "Outros",
];

const FALLBACK_CHECKING_ACCOUNT: Account = {
  id: "__fallback_checking__",
  user_id: "fallback",
  name: "Conta principal",
  kind: "checking",
  opening_cents: 0,
  opening_date: "2026-01-01",
};

const FALLBACK_CARD_ACCOUNT: Account = {
  id: "__fallback_credit_card__",
  user_id: "fallback",
  name: "Cartão principal",
  kind: "credit_card",
  opening_cents: 0,
  opening_date: "2026-01-01",
  due_day: 10,
  closing_day: 3,
  credit_limit_cents: 200000,
};

export interface StatementImportModalProps {
  data: FinanceData;
  initialAccountId?: string;
  initialMonth?: string;
  initialFile?: File | null;
  onClose: () => void;
  onSubmit: (
    entity: Entity,
    method: "POST" | "PUT",
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onSuccess?: (message: string) => void;
}

export default function StatementImportModal({
  data,
  initialAccountId,
  initialMonth,
  initialFile,
  onClose,
  onSubmit,
  onSuccess,
}: StatementImportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfPasswordInputRef = useRef<HTMLInputElement>(null);
  const fileReadSequenceRef = useRef(0);

  const defaultAccount =
    data.accounts.find((a) => a.id === initialAccountId) ??
    data.accounts.find((a) => a.kind !== "investment") ??
    data.accounts[0];

  const [accountId, setAccountId] = useState<string>(
    defaultAccount?.id ?? FALLBACK_CHECKING_ACCOUNT.id,
  );
  const [invoiceMonth, setInvoiceMonth] = useState<string>(
    initialMonth || today().slice(0, 7),
  );
  const [invoiceStatus, setInvoiceStatus] = useState<"planned" | "posted">(
    "planned",
  );
  const [projectFutureInstallments, setProjectFutureInstallments] =
    useState<boolean>(true);
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [fileName, setFileName] = useState<string>("");
  const [protectedPdf, setProtectedPdf] = useState<File | null>(null);
  const [unlockingPdf, setUnlockingPdf] = useState(false);
  const [readingPdf, setReadingPdf] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [items, setItems] = useState<StatementPreviewItem[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "selected" | "ignored">(
    "all",
  );
  const [busy, setBusy] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }
  }, []);

  // When a real account is created while the modal is open, switch from fallback to the real account
  useEffect(() => {
    if (
      data.accounts.length > 0 &&
      (accountId === FALLBACK_CHECKING_ACCOUNT.id ||
        accountId === FALLBACK_CARD_ACCOUNT.id ||
        !data.accounts.some((a) => a.id === accountId))
    ) {
      const preferred =
        accountId === FALLBACK_CARD_ACCOUNT.id
          ? (data.accounts.find((a) => a.kind === "credit_card") ??
            data.accounts[0])
          : (data.accounts.find((a) => a.kind !== "credit_card") ??
            data.accounts[0]);
      if (preferred) setAccountId(preferred.id);
    }
  }, [data.accounts, accountId]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const targetAccount: Account = useMemo(() => {
    const existing = data.accounts.find((a) => a.id === accountId);
    if (existing) return existing;
    if (accountId === FALLBACK_CARD_ACCOUNT.id) return FALLBACK_CARD_ACCOUNT;
    if (data.accounts[0]) return data.accounts[0];
    return FALLBACK_CHECKING_ACCOUNT;
  }, [data.accounts, accountId]);

  const isFallbackAccount =
    targetAccount.id === FALLBACK_CHECKING_ACCOUNT.id ||
    targetAccount.id === FALLBACK_CARD_ACCOUNT.id;
  const isCreditCard = targetAccount.kind === "credit_card";
  const sourceType = useMemo(() => detectStatementDocumentType(rawText), [rawText]);
  const sourceMismatch =
    (sourceType === "bank" && isCreditCard) ||
    (sourceType === "invoice" && !isCreditCard);
  const isWallet = isCreditWalletAccount(targetAccount);

  const availableCategories = useMemo(() => {
    const userCats = data.transactions
      .map((t) => t.category)
      .filter((c): c is string => Boolean(c && c.trim()));
    return [...new Set([...DEFAULT_CATEGORIES, ...userCats])];
  }, [data.transactions]);

  const handleFileUpload = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    const sequence = ++fileReadSequenceRef.current;
    setReadingPdf(false);
    setError("");
    setProtectedPdf(null);
    if (pdfPasswordInputRef.current) pdfPasswordInputRef.current.value = "";
    setRawText("");
    setItems([]);
    setImagePreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|webp|heic|gif)$/i.test(lower);
    const isPdf =
      file.type === "application/pdf" || lower.endsWith(".pdf");
    const maxBytes = isPdf || isImage
      ? STATEMENT_MAX_PDF_BYTES : STATEMENT_MAX_TEXT_BYTES;
    if (file.size > maxBytes) {
      setError(`Arquivo muito grande. O limite é ${Math.round(maxBytes / 1048576)} MB para este formato. Exporte um período menor e tente novamente.`);
      return;
    }
    if (file.size === 0) {
      setError("Este arquivo está vazio.");
      return;
    }
    if (!isPdf && !isImage && !/\.(ofx|qfx|csv|tsv|txt)$/i.test(lower)) {
      setError("Formato não reconhecido. Use OFX, QFX, CSV, TSV, TXT ou PDF.");
      return;
    }

    if (isImage) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setInputMode("paste");
      return;
    }

    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });

    try {
      const buffer = await file.arrayBuffer();
      if (isPdf) {
        setReadingPdf(true);
        try {
          const pdfText = await readBankPdf(buffer);
          if (sequence !== fileReadSequenceRef.current) return;
          if (pdfText.trim()) {
            setRawText(pdfText);
          } else {
            setInputMode("paste");
            setError("O PDF não contém texto selecionável. Para documentos escaneados, exporte OFX/CSV ou cole o texto do banco.");
          }
        } catch (pdfError) {
          if (sequence !== fileReadSequenceRef.current) return;
          if (pdfError instanceof PdfImportError && pdfError.code === "password-required") {
            setProtectedPdf(file);
            setInputMode("file");
            setError("");
          } else {
            setError(pdfError instanceof Error ? pdfError.message : "Não foi possível abrir o PDF.");
          }
        } finally {
          if (sequence === fileReadSequenceRef.current) setReadingPdf(false);
        }
        return;
      }

      // Try UTF-8 first; if replacement characters appear (common in ISO-8859-1 / Windows-1252 Brazilian bank OFX/CSV), decode as latin1
      let text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("\uFFFD")) {
        text = new TextDecoder("iso-8859-1").decode(buffer);
      }
      if (sequence === fileReadSequenceRef.current) setRawText(text);
    } catch {
      if (sequence === fileReadSequenceRef.current) {
        setError("Não foi possível ler o arquivo selecionado.");
        setReadingPdf(false);
      }
    }
  }, []);

  const handlePdfUnlock = useCallback(async () => {
    if (!protectedPdf || unlockingPdf) return;
    const password = pdfPasswordInputRef.current?.value ?? "";
    if (!password) {
      setError("Informe a senha que você usa para abrir o PDF.");
      pdfPasswordInputRef.current?.focus();
      return;
    }
    // Esqueça o valor do campo imediatamente; a senha é usada apenas nesta leitura local.
    if (pdfPasswordInputRef.current) pdfPasswordInputRef.current.value = "";
    setError("");
    setUnlockingPdf(true);
    const sequence = fileReadSequenceRef.current;
    try {
      const text = await readBankPdf(await protectedPdf.arrayBuffer(), password);
      if (sequence !== fileReadSequenceRef.current) return;
      if (!text.trim()) {
        setInputMode("paste");
        setError("O PDF foi desbloqueado, mas não contém texto selecionável. Tente OFX/CSV ou cole o extrato.");
      } else {
        setRawText(text);
      }
      setProtectedPdf(null);
    } catch (pdfError) {
      if (sequence !== fileReadSequenceRef.current) return;
      setError(pdfError instanceof Error ? pdfError.message : "Não foi possível desbloquear o PDF.");
      if (!(pdfError instanceof PdfImportError && pdfError.code === "password-incorrect")) {
        setProtectedPdf(null);
      }
    } finally {
      setUnlockingPdf(false);
    }
  }, [protectedPdf, unlockingPdf]);

  useEffect(() => {
    if (initialFile) {
      void handleFileUpload(initialFile);
    }
  }, [initialFile, handleFileUpload]);

  // Re-run preview whenever rawText, targetAccount, or invoiceMonth changes
  useEffect(() => {
    if (!rawText.trim() || !targetAccount || sourceMismatch || rawText.length > STATEMENT_MAX_TEXT_BYTES) {
      setItems([]);
      return;
    }
    const preview = prepareImportPreview({
      rawText,
      fileName,
      targetAccount,
      invoiceMonth: isCreditCard ? invoiceMonth : undefined,
      existingEntries: data.transactions,
      recurrences: data.recurrences,
    });
    setItems(preview.items);
    setError(preview.error ?? "");
  }, [
    rawText,
    fileName,
    targetAccount,
    isCreditCard,
    sourceMismatch,
    invoiceMonth,
    data.transactions,
    data.recurrences,
  ]);

  const summary = useMemo(() => computeImportSummary(items), [items]);

  const filteredItems = useMemo(() => {
    if (filterTab === "selected") return items.filter((i) => i.selected);
    if (filterTab === "ignored") return items.filter((i) => !i.selected);
    return items;
  }, [items, filterTab]);

  async function handleQuickCreateAccount(kind: "checking" | "credit_card") {
    setCreatingAccount(true);
    setError("");
    try {
      const payload: Record<string, unknown> =
        kind === "credit_card"
          ? {
              name: "Cartão principal",
              kind: "credit_card",
              opening_cents: 0,
              opening_date: "2026-01-01",
              due_day: 10,
              closing_day: 3,
              credit_limit_cents: 200000,
              institution: "Cartão",
            }
          : {
              name: "Conta principal",
              kind: "checking",
              opening_cents: 0,
              opening_date: "2026-01-01",
            };
      await onSubmit("accounts", "POST", payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar a conta padrão.",
      );
    } finally {
      setCreatingAccount(false);
    }
  }

  function handleLoadSample() {
    const sample = isCreditCard
      ? sampleCreditCardInvoiceText(invoiceMonth)
      : sampleBankStatementText(invoiceMonth);
    setFileName(
      isCreditCard
        ? `fatura-exemplo-${invoiceMonth}.csv`
        : `extrato-exemplo-${invoiceMonth}.csv`,
    );
    setRawText(sample);
    setInputMode("paste");
  }

  function updateItem(
    id: string,
    patch: Partial<
      Pick<
        StatementPreviewItem,
        "selected" | "description" | "category" | "kind" | "transferAccountId"
      >
    >,
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const reviewed = item.duplicateStatus === "review_required" &&
          (patch.kind !== undefined || patch.selected === true);
        return {
          ...item,
          ...patch,
          ...(reviewed ? { duplicateStatus: "new" as const, reviewReason: undefined } : {}),
        };
      }),
    );
  }

  function toggleAllNew(select: boolean) {
    setItems((prev) =>
      prev.map((item) =>
        item.duplicateStatus === "new" ? { ...item, selected: select } : item,
      ),
    );
  }

  async function handleConfirmImport() {
    if (isFallbackAccount) {
      setError(
        "Clique no botão acima para criar sua conta ou cartão de destino antes de confirmar a importação.",
      );
      return;
    }
    if (sourceMismatch) {
      setError("O arquivo e a conta escolhida são de tipos diferentes. Selecione uma conta corrente para extratos ou um cartão para faturas.");
      return;
    }
    const chosen = items.filter((item) => item.selected);
    if (chosen.some((item) => item.date < targetAccount.opening_date)) {
      setError(`Há lançamentos anteriores à abertura de ${targetAccount.name} (${formatDate(targetAccount.opening_date)}). Antes de importar, revise a data e o saldo inicial no cadastro dessa conta. O Meu Norte não alterará esse saldo automaticamente.`);
      return;
    }
    if (chosen.some((item) => item.transferAccountId && !data.accounts.some((a) =>
      a.id === item.transferAccountId && a.id !== targetAccount.id &&
      a.kind !== "credit_card" && a.kind !== "benefit" &&
      a.opening_date <= item.date))) {
      setError("A outra conta da transferência também precisa existir na data do movimento. Revise as datas de abertura das contas.");
      return;
    }
    const batch = buildImportBatchPayload({
      items,
      targetAccount,
      invoiceStatus,
      projectFutureInstallments,
      existingEntries: data.transactions,
    });
    if (batch.length === 0) {
      setError("Selecione pelo menos um lançamento para importar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let saved = 0;
      for (let offset = 0; offset < batch.length; offset += STATEMENT_IMPORT_CHUNK_SIZE) {
        const part = batch.slice(offset, offset + STATEMENT_IMPORT_CHUNK_SIZE);
        try {
          await onSubmit("transactions", "POST", {
            is_statement_import: true,
            batch_entries: part,
          });
          saved += part.length;
        } catch (err) {
          throw new Error(saved > 0
            ? `${saved} lançamentos foram salvos, mas o lote seguinte falhou. Reabra o extrato para verificar os itens já importados antes de tentar novamente. ${err instanceof Error ? err.message : ""}`
            : (err instanceof Error ? err.message : "Não foi possível importar."));
        }
      }
      const futureCount = batch.length - summary.selectedCount;
      const msg =
        futureCount > 0
          ? `${summary.selectedCount} lançamentos importados (+${futureCount} parcelas futuras projetadas)!`
          : `${summary.selectedCount} ${summary.selectedCount === 1 ? "lançamento importado" : "lançamentos importados"} com sucesso!`;
      onSuccess?.(msg);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a importação.",
      );
      setBusy(false);
    }
  }

  const accountOptions: [string, string][] =
    data.accounts.length > 0
      ? data.accounts.map((a) => {
          const typeLabel =
            a.kind === "credit_card"
              ? isCreditWalletAccount(a)
                ? "Carteira / Loja"
                : "Cartão de crédito"
              : a.kind === "checking"
                ? "Conta corrente"
                : a.kind === "benefit"
                  ? "Benefício VA/VR"
                  : a.kind === "investment"
                    ? "Investimento"
                    : "Dinheiro";
          return [a.id, `${a.name} (${typeLabel})`];
        })
      : [
          [
            FALLBACK_CHECKING_ACCOUNT.id,
            "Conta principal (Conta corrente - criar agora)",
          ],
          [
            FALLBACK_CARD_ACCOUNT.id,
            "Cartão principal (Cartão de crédito - criar agora)",
          ],
        ];

  return (
    <dialog
      ref={dialogRef}
      className={`record-dialog statement-import-modal ${items.length > 0 ? "has-preview" : ""}`}
      aria-label="Importar extrato ou fatura"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          <p className="eyebrow">Importação inteligente · v3.0.4</p>
          <h2>Importar extrato ou fatura</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <div
        className={`dialog-fields statement-import-body ${items.length > 0 ? "has-preview" : ""}`}
      >
        <div className="import-setup-column">
          {data.accounts.length === 0 && (
            <div className="info-box import-empty-accounts-banner" role="status">
              <Info size={16} />
              <div>
                <strong>Você ainda não cadastrou uma conta ou cartão.</strong>{" "}
                Crie com 1 clique abaixo para vincular seus lançamentos
                importados:
                <div className="button-row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button secondary small-btn"
                    disabled={creatingAccount}
                    onClick={() => void handleQuickCreateAccount("checking")}
                  >
                    <Plus size={14} />
                    Criar Conta Principal
                  </button>
                  <button
                    type="button"
                    className="button secondary small-btn"
                    disabled={creatingAccount}
                    onClick={() => void handleQuickCreateAccount("credit_card")}
                  >
                    <Plus size={14} />
                    Criar Cartão Principal
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="import-config-grid">
            <label className="form-field">
              <span>Onde deseja importar os lançamentos?</span>
              <SelectControl
                label="Conta ou cartão de destino"
                allowEmpty={false}
                value={accountId}
                onChange={setAccountId}
                options={accountOptions}
              />
              <small>
                {isCreditCard
                  ? `Os itens entrarão na fatura ${isWallet ? "da carteira" : "do cartão"} sem misturar com o saldo da conta corrente.`
                  : "As entradas e saídas atualizarão o saldo desta conta e serão conciliadas com o que você já lançou."}
              </small>
            </label>

            {isCreditCard && (
              <div className="import-cc-options">
                <div className="form-field">
                  <span>Mês de referência da fatura</span>
                  <MonthControl
                    value={invoiceMonth}
                    onChange={setInvoiceMonth}
                  />
                </div>
                <label className="form-field">
                  <span>Situação desta fatura</span>
                  <SelectControl
                    label="Situação da fatura importada"
                    allowEmpty={false}
                    value={invoiceStatus}
                    onChange={(v) => setInvoiceStatus(v as "planned" | "posted")}
                    options={[
                      ["planned", "Fatura aberta (a pagar)"],
                      ["posted", "Fatura já paga"],
                    ]}
                  />
                </label>
                <label className="checkbox-row import-project-check">
                  <input
                    type="checkbox"
                    checked={projectFutureInstallments}
                    onChange={(e) =>
                      setProjectFutureInstallments(e.target.checked)
                    }
                  />
                  <span>
                    Projetar automaticamente as parcelas restantes nos próximos
                    meses (ex.: se a fatura traz <code>1/3</code>, gera{" "}
                    <code>2/3</code> e <code>3/3</code> nas faturas seguintes).
                  </span>
                </label>
              </div>
            )}
          </div>

          {sourceMismatch && (
            <div className="info-box" role="alert">
              <Info size={18} />
              <div>
                <strong>Confira o destino do arquivo.</strong>{" "}
                {sourceType === "bank"
                  ? "Este arquivo parece ser um extrato de conta, mas você escolheu um cartão. Selecione a conta bancária correta para preservar entradas e saídas."
                  : "Este arquivo parece ser uma fatura de cartão. Selecione o cartão correto para evitar alterar seu saldo bancário."}
              </div>
            </div>
          )}
          <div className="import-source-tabs">
            <div className="segmented">
              <button
                type="button"
                className={inputMode === "file" ? "selected" : ""}
                onClick={() => setInputMode("file")}
              >
                <Upload size={16} />
                Escolher arquivo ou foto
              </button>
              <button
                type="button"
                className={inputMode === "paste" ? "selected" : ""}
                onClick={() => setInputMode("paste")}
              >
                <FileText size={16} />
                Colar texto (PDF / App do banco)
              </button>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="button secondary small-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <FolderOpen size={15} />
                Abrir explorador / Galeria
              </button>
              <button
                type="button"
                className="button ghost small-btn"
                onClick={handleLoadSample}
              >
                <Sparkles size={15} />
                Carregar exemplo de teste
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={STATEMENT_FILE_ACCEPT}
            aria-label="Selecionar arquivo de extrato ou fatura"
            style={{ display: "none" }}
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void handleFileUpload(picked);
              e.target.value = "";
            }}
          />

          {inputMode === "file" ? (
            <div className="import-file-area">
              <div
                className="import-dropzone"
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFileUpload(e.dataTransfer.files?.[0]);
              }}
            >
              <span className="square-icon">
                <FileSpreadsheet size={24} />
              </span>
              <div>
                <strong>
                  {fileName
                    ? `Arquivo carregado: ${fileName}`
                    : "Toque para abrir seus arquivos ou fotos (ou arraste aqui)"}
                </strong>
                <p className="muted">
                  No computador abre o explorador de arquivos; no celular abre a
                  opção de <strong>Fotos ou Arquivos</strong> para escolher{" "}
                  <strong>.OFX</strong>, <strong>.CSV</strong>,{" "}
                  <strong>.PDF</strong> ou <strong>print/foto</strong> de qualquer
                  banco. Limites: PDFs e imagens até 10 MB; OFX, CSV e TXT até 5 MB.
                  PDFs com senha podem ser desbloqueados aqui no aparelho. Arquivos escaneados podem exigir texto colado ou exportação OFX/CSV.
                </p>
              </div>
            </div>
            {readingPdf && <p className="muted" role="status">Lendo o PDF no seu aparelho...</p>}
            {protectedPdf && (
              <div className="import-password-panel" role="group" aria-label="Desbloquear PDF">
                <strong>Este PDF está protegido por senha</strong>
                <p className="muted">Digite a senha usada para abrir o extrato no banco (em alguns bancos, é o CPF). Ela será usada somente neste aparelho, para esta leitura, sem envio ao servidor nem armazenamento.</p>
                <label className="form-field">
                  <span>Senha do PDF</span>
                  <input
                    ref={pdfPasswordInputRef}
                    type="password"
                    aria-label="Senha do PDF protegido"
                    autoComplete="off"
                    spellCheck={false}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handlePdfUnlock();
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="button primary"
                  disabled={unlockingPdf}
                  onClick={() => void handlePdfUnlock()}
                >
                  {unlockingPdf ? "Desbloqueando no aparelho..." : "Desbloquear e ler PDF"}
                </button>
              </div>
            )}
            </div>
          ) : (
            <div className="import-paste-container">
              {imagePreviewUrl && (
                <div className="import-image-preview-card">
                  <div className="import-image-preview-head">
                    <span>
                      <ImageIcon size={15} /> Imagem anexada ({fileName})
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Trocar imagem/arquivo
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Comprovante ou print da fatura anexado"
                    className="import-image-preview-img"
                  />
                  <small className="muted">
                    Visualize os valores no print acima ou copie o texto da imagem
                    no seu celular e cole no campo abaixo (1 lançamento por
                    linha).
                  </small>
                </div>
              )}
              <label className="form-field">
                <span>
                  Cole ou digite abaixo as linhas do extrato, fatura, PDF ou
                  print
                </span>
                <textarea
                  rows={items.length > 0 ? 4 : 5}
                  className="import-textarea"
                  aria-label="Texto do extrato ou fatura"
                  placeholder={
                    isCreditCard
                      ? "Exemplo:\n12/10 UBER *TRIP R$ 24,90\n15/10 Shopee *Kit Casa 01/03 R$ 89,90\n18/10 Netflix.com R$ 55,90"
                      : "Exemplo:\n05/10/2026 SALARIO LIQUIDO +4.200,00\n09/10/2026 PIX ENVIADO - SUPERMERCADO -184,50\n12/10/2026 UBER *TRIP -29,80"
                  }
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                  }}
                />
                <small>
                  Textos sem sinal precisam de revisão. PDFs até 10 MB; OFX, CSV e TXT até 5 MB.
                  {" "}Reconhece datas (<code>DD/MM/AAAA</code>, <code>DD/MM</code>,{" "}
                  <code>12 OUT</code> ou <code>AAAA-MM-DD</code>), parcelas (
                  <code>01/03</code>), valores em R$ e categoriza cada item
                  automaticamente.
                </small>
              </label>
            </div>
          )}

          {rawText.length > STATEMENT_MAX_TEXT_BYTES && (
            <div className="info-box" role="alert">
              <Info size={16} />
              O texto extraído ultrapassou 5 MB. Divida o extrato por períodos menores antes de importar.
            </div>
          )}

          {rawText.trim() && items.length === 0 && rawText.length <= STATEMENT_MAX_TEXT_BYTES && !sourceMismatch && !error && (
            <div className="info-box" role="status">
              <Info size={16} />
              Nenhum lançamento reconhecido neste formato. Verifique se cada
              linha possui data, descrição e valor (ex.:{" "}
              <code>12/10 Uber 24,90</code>) ou clique em{" "}
              <strong>Carregar exemplo de teste</strong>.
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="import-preview-section">
            {!isCreditCard && (
              <div className="info-box" role="status">
                <Info size={16} />
                <span>
                  <strong>Importação retroativa:</strong> o saldo inicial da conta deve ser o valor que havia no dia da abertura, antes dos movimentos importados. Importar períodos já incluídos nesse saldo pode contá-los duas vezes. O app não modifica a abertura automaticamente.
                  {items.some((item) => item.selected && item.date < targetAccount.opening_date) && (
                    <strong> Há itens anteriores à abertura ({formatDate(targetAccount.opening_date)}): ajuste a conta antes de confirmar.</strong>
                  )}
                </span>
              </div>
            )}
            <div className="import-summary-bar">
              <div className="import-summary-badges">
                <span className="badge success">
                  {summary.selectedCount} selecionados para importar
                </span>
                {summary.reviewRequiredCount > 0 && (
                  <span className="badge warning">
                    {summary.reviewRequiredCount} lançamento(s) com sentido a conferir
                  </span>
                )}
                {summary.transferCount > 0 && (
                  <span className="badge">{summary.transferCount} transferência(s) entre suas contas</span>
                )}
                {summary.manualMatchCount > 0 && (
                  <span className="badge warning">
                    {summary.manualMatchCount}{" "}
                    {summary.manualMatchCount === 1
                      ? "possível duplicata manual desmarcada"
                      : "possíveis duplicatas manuais desmarcadas"}
                  </span>
                )}
                {summary.exactDuplicateCount > 0 && (
                  <span className="badge">
                    {summary.exactDuplicateCount} já importados antes
                  </span>
                )}
                {summary.invoicePaymentCount > 0 && (
                  <span className="badge">
                    {summary.invoicePaymentCount} pagamento(s) de fatura
                    ignorado(s)
                  </span>
                )}
              </div>
              <div className="import-summary-totals">
                {summary.selectedIncomeCents > 0 && (
                  <span className="positive">
                    Entradas: +{formatMoney(summary.selectedIncomeCents)}
                  </span>
                )}
                {summary.selectedExpenseCents > 0 && (
                  <span className="negative">
                    Saídas/Gastos: -{formatMoney(summary.selectedExpenseCents)}
                  </span>
                )}
              </div>
            </div>

            {(summary.manualMatchCount > 0 ||
              summary.exactDuplicateCount > 0) && (
              <div className="info-box import-dedup-notice">
                <Info size={16} />
                <span>
                  <strong>Proteção anti-duplicidade ativa:</strong> os itens
                  que coincidem com gastos que você já registrou manualmente
                  (mesmo valor e data próxima) ou que já foram importados
                  antes vieram <strong>desmarcados por segurança</strong>. Se
                  algum deles for realmente outra compra, basta marcar a
                  caixinha correspondente.
                </span>
              </div>
            )}

            <div className="import-filter-bar">
              <div className="segmented">
                <button
                  type="button"
                  className={filterTab === "all" ? "selected" : ""}
                  onClick={() => setFilterTab("all")}
                >
                  Todos ({items.length})
                </button>
                <button
                  type="button"
                  className={filterTab === "selected" ? "selected" : ""}
                  onClick={() => setFilterTab("selected")}
                >
                  Selecionados ({summary.selectedCount})
                </button>
                <button
                  type="button"
                  className={filterTab === "ignored" ? "selected" : ""}
                  onClick={() => setFilterTab("ignored")}
                >
                  Desmarcados ({items.length - summary.selectedCount})
                </button>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => toggleAllNew(true)}
                >
                  Marcar todos os novos
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => toggleAllNew(false)}
                >
                  Desmarcar todos
                </button>
              </div>
            </div>

            <div
              className={`import-preview-list ${filteredItems.length <= 4 ? "is-compact-list" : ""}`}
              role="region"
              aria-label="Prévia dos lançamentos para importação"
            >
              {filteredItems.map((item) => {
                const matchedTransfer = item.matchedEntry?.kind === "transfer";
                const statusLabel =
                  matchedTransfer
                    ? "Possível transferência já registrada"
                    : item.duplicateStatus === "new"
                      ? "Novo"
                      : item.duplicateStatus === "review_required"
                        ? "Conferir entrada/saída"
                        : item.duplicateStatus === "manual_match"
                          ? "Já lançado manualmente?"
                          : item.duplicateStatus === "exact_duplicate"
                            ? "Já importado"
                            : "Pagamento de fatura";
                const statusClass =
                  item.duplicateStatus === "new"
                    ? "success"
                    : item.duplicateStatus === "review_required"
                      ? "warning"
                    : item.duplicateStatus === "manual_match"
                      ? "warning"
                      : "";

                return (
                  <div
                    key={item.id}
                    className={`import-preview-row ${item.selected ? "is-selected" : "is-ignored"}`}
                  >
                    <label className="import-row-check">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        aria-label={`Selecionar ${item.description}`}
                        onChange={(e) =>
                          updateItem(item.id, { selected: e.target.checked })
                        }
                      />
                    </label>

                    <div className="import-row-main">
                      <div className="import-row-top">
                        <span className="import-row-date">
                          {formatDate(item.purchaseDate)}
                          {isCreditCard &&
                            item.date !== item.purchaseDate && (
                              <small className="muted">
                                {" "}
                                → Fatura {monthLabel(item.date.slice(0, 7)).split(" ")[0]}
                              </small>
                            )}
                        </span>
                        <span className={`badge ${statusClass}`}>
                          {statusLabel}
                        </span>
                        {item.totalInstallments > 1 && (
                          <span className="badge">
                            Parcela {item.installmentNumber}/
                            {item.totalInstallments}
                          </span>
                        )}
                      </div>

                      <div className="import-row-fields">
                        <input
                          type="text"
                          className="import-desc-input"
                          aria-label={`Descrição de ${item.description}`}
                          value={item.description}
                          maxLength={80}
                          onChange={(e) =>
                            updateItem(item.id, {
                              description: e.target.value,
                            })
                          }
                        />
                        <div className="import-cat-select">
                          <SelectControl
                            label={`Categoria de ${item.description}`}
                            allowEmpty={false}
                            value={item.category}
                            onChange={(v) =>
                              updateItem(item.id, { category: v })
                            }
                            options={availableCategories.map((c) => [c, c])}
                          />
                        </div>
                        {!isCreditCard && (
                          <div className="import-kind-select">
                            <SelectControl
                              label={`Tipo de ${item.description}`}
                              allowEmpty={false}
                              value={item.kind}
                              onChange={(v) =>
                                updateItem(item.id, {
                                  kind: v as "income" | "expense",
                                })
                              }
                              options={[
                                ["expense", "Saída (-)"],
                                ["income", "Entrada (+)"],
                              ]}
                            />
                          </div>
                        )}
                      </div>

                      {item.reviewReason && (
                        <small className="import-match-hint" role="status">
                          {item.reviewReason} Escolha o tipo correto e marque o lançamento para importar.
                        </small>
                      )}
                      {!isCreditCard && targetAccount.kind !== "benefit" &&
                        (item.transferSuggestion || item.transferAccountId) && (
                        <div className="import-transfer-options">
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={Boolean(item.transferAccountId)}
                              onChange={(e) => updateItem(item.id, {
                                transferAccountId: e.target.checked
                                  ? (data.accounts.find((a) =>
                                      a.id !== targetAccount.id &&
                                      a.kind !== "credit_card" && a.kind !== "benefit")?.id ?? "")
                                  : "",
                              })}
                            />
                            <span>É uma transferência entre minhas contas (não contar como receita/despesa)</span>
                          </label>
                          {item.transferAccountId && (
                            <SelectControl
                              label="Outra conta envolvida na transferência"
                              allowEmpty={false}
                              value={item.transferAccountId}
                              onChange={(v) => updateItem(item.id, { transferAccountId: v })}
                              options={data.accounts
                                .filter((a) => a.id !== targetAccount.id && a.kind !== "credit_card" && a.kind !== "benefit")
                                .map((a) => [a.id, a.name])}
                            />
                          )}
                        </div>
                      )}
                      {(item.duplicateStatus === "manual_match" || matchedTransfer) &&
                        item.matchedEntry && (
                          <small className="import-match-hint">
                            {matchedTransfer
                              ? "Confira a transferência já registrada: "
                              : "Coincide com lançamento já existente: "}
                            <strong>{item.matchedEntry.description}</strong> (
                            {formatMoney(item.matchedEntry.amount_cents)} em{" "}
                            {formatDate(item.matchedEntry.date)}). Desmarcado
                            para não duplicar.
                          </small>
                        )}
                    </div>

                    <div className="import-row-amount">
                      <strong
                        className={
                          item.kind === "income" ? "positive" : "negative"
                        }
                      >
                        {item.kind === "income" ? "+" : "-"}
                        {formatMoney(item.amountCents)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
      </div>

      <div className="dialog-foot">
        <button
          type="button"
          className="button ghost"
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy || summary.selectedCount === 0 || sourceMismatch || items.some((item) => item.selected && item.date < targetAccount.opening_date)}
          onClick={() => void handleConfirmImport()}
        >
          {isCreditCard ? (
            <CreditCard size={16} />
          ) : (
            <Wallet size={16} />
          )}
          {busy
            ? "Importando…"
            : summary.selectedCount > 0
              ? `Importar ${summary.selectedCount} ${summary.selectedCount === 1 ? "lançamento" : "lançamentos"}`
              : "Selecione itens para importar"}
          {summary.selectedCount > 0 && <Check size={16} />}
        </button>
      </div>
    </dialog>
  );
}

