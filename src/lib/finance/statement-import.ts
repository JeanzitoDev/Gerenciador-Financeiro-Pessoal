import type { Account, Entry, Recurrence } from "../types";
import {
  buildDateWithDay,
  calculateFirstDueDate,
  clampDay,
  defaultClosingDay,
  formatCreditCardExternalId,
  getEntryInvoiceMonth,
  parseCreditCardMeta,
} from "./credit-cards";
import { addMonths, today } from "./dates";
import { sumCents } from "./money";

export type ImportFormat = "ofx" | "csv" | "text";

export type DuplicateStatus =
  | "new"
  | "exact_duplicate"
  | "manual_match"
  | "invoice_payment"
  | "review_required";

export interface RawImportedRow {
  rawDate: string;
  date: string;
  rawDescription: string;
  description: string;
  amountCents: number;
  kind: "income" | "expense";
  fitId?: string;
  categoryHint?: string;
  reviewReason?: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

export interface StatementPreviewItem {
  id: string;
  date: string;
  purchaseDate: string;
  description: string;
  rawDescription: string;
  amountCents: number;
  kind: "income" | "expense";
  category: string;
  installmentNumber: number;
  totalInstallments: number;
  externalId: string;
  groupId: string;
  duplicateStatus: DuplicateStatus;
  reviewReason?: string;
  transferSuggestion?: boolean;
  transferAccountId?: string;
  matchedEntry?: {
    id: string;
    description: string;
    date: string;
    amount_cents: number;
    kind?: Entry["kind"];
  };
  selected: boolean;
}

export interface StatementImportPreview {
  format: ImportFormat;
  items: StatementPreviewItem[];
  error?: string;
  summary: {
    totalParsed: number;
    selectedCount: number;
    selectedExpenseCents: number;
    selectedIncomeCents: number;
    exactDuplicateCount: number;
    manualMatchCount: number;
    invoicePaymentCount: number;
    reviewRequiredCount: number;
    transferCount: number;
  };
}

const NOISE_PREFIXES = [
  /^compra\s+(?:no\s+)?cart[aã]o\s+(?:de\s+)?(?:d[eé]bito|cr[eé]dito)\s*[-–:•*]?\s*/i,
  /^compra\s+(?:d[eé]bito|cr[eé]dito|elo|visa|master(?:card)?)\s*[-–:•*]?\s*/i,
  /^pix\s+(?:enviado|recebido|transf(?:er[eê]ncia)?)\s*[-–:•*]?\s*/i,
  /^transfer[eê]ncia\s+pix\s+(?:enviada|recebida|rem|des)?\s*[-–:•*]?\s*/i,
  /^pagamento\s+pix\s*[-–:•*]?\s*/i,
  /^pagto\s+eletron(?:ico)?\s*[-–:•*]?\s*/i,
  /^sispag\s*[-–:•*]?\s*/i,
  /^ted\s+(?:enviada|recebida)?\s*[-–:•*]?\s*/i,
  /^doc\s+(?:enviado|recebido)?\s*[-–:•*]?\s*/i,
  /^deb(?:ito)?\s+aut(?:omatico)?\s*[-–:•*]?\s*/i,
  /^pgto\s+t[ií]tulo\s*[-–:•*]?\s*/i,
];

const INVOICE_PAYMENT_PATTERNS = [
  /pagamento\s+recebido/i,
  /pagamento\s+(?:de\s+)?fatura/i,
  /pagto\s+(?:de\s+)?fatura/i,
  /pgto\s+(?:de\s+)?fatura/i,
  /debito\s+automatico\s+(?:de\s+)?fatura/i,
  /cr[eé]dito\s+de\s+pagamento/i,
  /^pagamento\s+efetuado$/i,
];

const CATEGORY_KEYWORDS: {
  category: string;
  kind?: "income" | "expense";
  keywords: string[];
}[] = [
  {
    category: "Salário",
    kind: "income",
    keywords: [
      "salario",
      "pagamento folha",
      "folha de pagamento",
      "adiantamento salarial",
      "pro-labore",
      "prolabore",
      "remuneracao",
      "13 salario",
      "decimo terceiro",
      "ferias",
    ],
  },
  {
    category: "Benefícios",
    keywords: [
      "vale alimentacao",
      "vale refeicao",
      "alelo",
      "sodexo",
      "pluxee",
      "ticket",
      "flash beneficios",
      "caju",
      "swile",
    ],
  },
  {
    category: "Assinaturas",
    keywords: [
      "netflix",
      "spotify",
      "amazon prime",
      "prime video",
      "disney",
      "hbo",
      "max.com",
      "globoplay",
      "youtube",
      "apple.com/bill",
      "icloud",
      "google one",
      "google play",
      "chatgpt",
      "openai",
      "claude",
      "microsoft",
      "xbox",
      "playstation",
      "sony playstation",
      "steam",
      "nintendo",
      "crunchyroll",
      "deezer",
      "audible",
      "canva",
      "adobe",
      "github",
      "vercel",
      "supabase",
    ],
  },
  {
    category: "Transporte",
    keywords: [
      "uber",
      "99app",
      "99 pop",
      "99*",
      "99 tecnologia",
      "99 taxi",
      "99pay corrida",
      "cabify",
      "indriver",
      "posto ",
      "combustivel",
      "auto posto",
      "shell",
      "ipiranga",
      "petrobras",
      "sem parar",
      "veloe",
      "conectcar",
      "zul ",
      "estacionamento",
      "indigo",
      "estapar",
      "metro",
      "bilhete unico",
      "sptrans",
      "top sp",
      "buser",
      "clickbus",
      "pedagio",
      "oficina",
      "pneus",
      "auto pecas",
      "lava rapido",
      "lavacar",
    ],
  },
  {
    category: "Alimentação",
    keywords: [
      "ifood",
      "ifd*",
      "rappi",
      "ze delivery",
      "aiqfome",
      "padaria",
      "panificadora",
      "supermercado",
      "mercado ",
      "mercadinho",
      "atacadao",
      "assai",
      "carrefour",
      "pao de acucar",
      "extra hiper",
      "obahortifruti",
      "hortifruti",
      "sacolao",
      "restaurante",
      "lanchonete",
      "burger",
      "mcdonalds",
      "mc donalds",
      "bk ",
      "burger king",
      "outback",
      "madero",
      "habibs",
      "subway",
      "kfc",
      "acougue",
      "swift",
      "cafeteria",
      "starbucks",
      "pizzaria",
      "sushi",
      "sorveteria",
      "doceria",
      "confeitaria",
      "churrascaria",
    ],
  },
  {
    category: "Moradia",
    keywords: [
      "aluguel",
      "condominio",
      "quintoandar",
      "quinto andar",
      "sabesp",
      "copasa",
      "sanepar",
      "cedae",
      "cagece",
      "enel",
      "cpfl",
      "cemig",
      "light",
      "neoenergia",
      "coelba",
      "celesc",
      "copel",
      "energisa",
      "equatorial",
      "comgas",
      "ultragaz",
      "consigaz",
      "iptu",
      "vivo",
      "telefonica",
      "claro",
      "tim ",
      "oi fibra",
      "algar",
      "brisanet",
      "internet",
      "leroy merlin",
      "telhanorte",
      "sodimac",
    ],
  },
  {
    category: "Saúde",
    keywords: [
      "droga",
      "drogasil",
      "drogaria",
      "raia",
      "pacheco",
      "pague menos",
      "panvel",
      "ultrafarma",
      "araujo",
      "farmacia",
      "farma",
      "unimed",
      "amil",
      "bradesco saude",
      "sulamerica",
      "hapvida",
      "notredame",
      "prevent senior",
      "hospital",
      "clinica",
      "laboratorio",
      "fleury",
      "delboni",
      "lavoisier",
      "dasa",
      "consulta",
      "odonto",
      "dentista",
      "psicolog",
      "fisioterap",
      "smartfit",
      "smart fit",
      "bluefit",
      "bodytech",
      "gympass",
      "wellhub",
      "totalpass",
      "academia",
    ],
  },
  {
    category: "Educação",
    keywords: [
      "faculdade",
      "universidade",
      "escola",
      "colegio",
      "curso",
      "alura",
      "udemy",
      "rocketseat",
      "coursera",
      "hotmart",
      "kiwify",
      "eduzz",
      "livraria",
      "saraiva",
      "kalunga",
      "mensalidade",
      "idiomas",
      "ingles",
    ],
  },
  {
    category: "Compras",
    keywords: [
      "shopee",
      "shpp",
      "mercadolivre",
      "mercado livre",
      "meli",
      "mp *",
      "mercadopago",
      "mercado pago",
      "amazon",
      "magalu",
      "magazine luiza",
      "casas bahia",
      "ponto frio",
      "fast shop",
      "kabum",
      "pichau",
      "terabyte",
      "aliexpress",
      "shein",
      "renner",
      "riachuelo",
      "c&a",
      "cea ",
      "marisa",
      "zara",
      "hering",
      "centauro",
      "netshoes",
      "decathlon",
      "nike",
      "adidas",
      "torra",
      "havan",
      "americanas",
      "boticario",
      "natura",
      "sephora",
      "petz",
      "cobasi",
      "petlove",
    ],
  },
  {
    category: "Lazer",
    keywords: [
      "cinema",
      "cinemark",
      "kinoplex",
      "uci ",
      "ingresso",
      "sympla",
      "eventim",
      "ticketmaster",
      "bar ",
      "pub ",
      "cervejaria",
      "show",
      "teatro",
      "viagem",
      "airbnb",
      "booking",
      "decolar",
      "cvc ",
      "latam",
      "gol linhas",
      "azul linhas",
      "hotel",
      "pousada",
    ],
  },
  {
    category: "Empréstimos e financiamentos",
    keywords: [
      "emprestimo",
      "financiamento",
      "parcela contrato",
      "consignado",
      "crediario",
    ],
  },
  {
    category: "Fatura de cartão",
    keywords: [
      "fatura",
      "pagamento cartao",
      "pgto cartao",
      "pagto fatura",
    ],
  },
  {
    category: "Investimentos",
    keywords: [
      "aporte",
      "tesouro",
      "cdb",
      "lci",
      "lca",
      "fii",
      "corretora",
      "xp inv",
      "btg",
      "nu invest",
      "aplicacao",
    ],
  },
];

const CSV_CATEGORY_MAP: Record<string, string> = {
  transporte: "Transporte",
  restaurante: "Alimentação",
  supermercado: "Alimentação",
  alimentacao: "Alimentação",
  comida: "Alimentação",
  saude: "Saúde",
  farmacia: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  entretenimento: "Lazer",
  viagem: "Lazer",
  casa: "Moradia",
  moradia: "Moradia",
  servicos: "Assinaturas",
  assinaturas: "Assinaturas",
  eletronicos: "Compras",
  vestuario: "Compras",
  roupas: "Compras",
  compras: "Compras",
  outros: "Outros",
  salario: "Salário",
};

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Detects credit card installment markers in a transaction description, such as:
 * - "Shopee *Kit Casa 02/06"
 * - "Notebook Trabalho (3/10)"
 * - "Torra Torra - Parcela 1 de 2"
 * - "Mercado Livre PARC 04/12"
 */
export function detectInstallmentInText(raw: string): {
  cleanBase: string;
  installmentNumber: number;
  totalInstallments: number;
} | null {
  const text = raw.trim();
  const patterns: RegExp[] = [
    /\bparcela\s+(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})\b/i,
    /\bparc\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/i,
    /\((\d{1,2})\s*\/\s*(\d{1,2})\)\s*$/,
    /(?:^|\s|-)\b(\d{1,2})\s*\/\s*(\d{1,2})\s*$/,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (!match) continue;
    const current = Number(match[1]);
    const total = Number(match[2]);
    if (
      Number.isInteger(current) &&
      Number.isInteger(total) &&
      current >= 1 &&
      total >= 2 &&
      total <= 72 &&
      current <= total
    ) {
      const cleanBase = text
        .replace(match[0], " ")
        .replace(/\s*[-–•:]\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      return {
        cleanBase: cleanBase || text,
        installmentNumber: current,
        totalInstallments: total,
      };
    }
  }
  return null;
}

export function cleanImportedDescription(raw: string): {
  description: string;
  installmentNumber: number;
  totalInstallments: number;
} {
  let cleaned = raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const prefix of NOISE_PREFIXES) {
    cleaned = cleaned.replace(prefix, "").trim();
  }

  // Clean trailing date/hour stamps like "15/10 14:22" at the very end if preceded by merchant name
  cleaned = cleaned.replace(/\s+\d{2}\/\d{2}\s+\d{2}:\d{2}$/, "").trim();

  const installment = detectInstallmentInText(cleaned);
  if (installment) {
    const base = installment.cleanBase || cleaned;
    return {
      description: `${base} (${installment.installmentNumber}/${installment.totalInstallments})`.slice(
        0,
        80,
      ),
      installmentNumber: installment.installmentNumber,
      totalInstallments: installment.totalInstallments,
    };
  }

  return {
    description: (cleaned || raw.trim() || "Lançamento importado").slice(0, 80),
    installmentNumber: 1,
    totalInstallments: 1,
  };
}

export function isInvoicePaymentDescription(description: string): boolean {
  const norm = normalizeSearchText(description);
  return INVOICE_PAYMENT_PATTERNS.some((re) => re.test(norm));
}

/**
 * 3-Layer Category Inference:
 * 1. User's own historical transactions & recurrences
 * 2. CSV category hint or Brazilian merchant keyword dictionary
 * 3. Default fallback ("Salário" / "Outros")
 */
export function inferCategory(
  description: string,
  kind: "income" | "expense",
  existingEntries: Entry[] = [],
  recurrences: Recurrence[] = [],
  categoryHint?: string,
): string {
  const stripInstallment = description.replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, "");
  const normDesc = normalizeSearchText(stripInstallment);
  const merchantKey = normDesc
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Layer 1: Learn from user's own history
  if (merchantKey.length >= 3) {
    for (const r of recurrences) {
      if (r.kind !== kind || !r.category || r.category === "Outros") continue;
      const rKey = normalizeSearchText(r.description)
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (
        rKey.length >= 3 &&
        (merchantKey.includes(rKey) || rKey.includes(merchantKey))
      ) {
        return r.category;
      }
    }
    for (const e of existingEntries) {
      if (
        e.status === "cancelled" ||
        e.kind !== kind ||
        !e.category ||
        e.category === "Outros"
      )
        continue;
      const eBase = e.description.replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, "");
      const eKey = normalizeSearchText(eBase)
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\b\d+\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (
        eKey.length >= 4 &&
        (merchantKey.includes(eKey) || eKey.includes(merchantKey))
      ) {
        return e.category;
      }
    }
  }

  // Layer 2A: CSV Category Hint
  if (categoryHint) {
    const normHint = normalizeSearchText(categoryHint);
    if (CSV_CATEGORY_MAP[normHint]) {
      return CSV_CATEGORY_MAP[normHint];
    }
  }

  // Itaú shortens 99 rides to "PAY DL 99 26/10". Match a standalone
  // merchant token, never the digits inside a reference/amount (e.g. 199).
  if (kind === "expense" && /(?:^|\s)(?:99(?:app|pop)?|pay\s+(?:dl\s+)?99)(?=\s|\*|$)/.test(normDesc)) {
    return "Transporte";
  }

  // Layer 2B: Built-in Brazilian Merchant & Banking Dictionary
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.kind && rule.kind !== kind) continue;
    for (const kw of rule.keywords) {
      if (normDesc.includes(kw)) {
        return rule.category;
      }
    }
  }

  // Layer 3: Fallback
  return kind === "income" ? "Outros" : "Outros";
}

export function parseFlexibleDate(
  raw: string,
  referenceMonth?: string,
): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO YYYY-MM-DD or YYYY/MM/DD (with optional timestamp)
  const isoMatch = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // OFX YYYYMMDD (e.g. 20261015120000[-3:BRT])
  const ofxMatch = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    const [, y, m, d] = ofxMatch;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // Brazilian DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (4-digit or 2-digit year)
  const brFullMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (brFullMatch) {
    const day = Number(brFullMatch[1]);
    const month = Number(brFullMatch[2]);
    let year = Number(brFullMatch[3]);
    if (year < 100) year += 2000;
    if (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31 &&
      year >= 2000 &&
      year <= 2100
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Short Brazilian DD/MM (infers year from referenceMonth or current year)
  const brShortMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (brShortMatch) {
    const day = Number(brShortMatch[1]);
    const month = Number(brShortMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const ref = referenceMonth ?? today().slice(0, 7);
      const [refYear, refMonth] = ref.split("-").map(Number);
      let year = refYear || new Date().getFullYear();
      // If importing a Jan invoice (month 1) and purchase was in Dec (month 12), use previous year
      if (refMonth === 1 && month === 12) {
        year -= 1;
      }
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Brazilian DD MMM or DD MMM YYYY (e.g. "12 OUT", "05 NOV 2026", "14/OUT/2026")
  const ptMonthMap: Record<string, number> = {
    jan: 1,
    fev: 2,
    feb: 2,
    mar: 3,
    abr: 4,
    apr: 4,
    mai: 5,
    may: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    aug: 8,
    set: 9,
    sep: 9,
    out: 10,
    oct: 10,
    nov: 11,
    dez: 12,
    dec: 12,
  };
  const brNamedMonthMatch = s.match(
    /^(\d{1,2})(?:\s+|[/.-])([a-zç]{3})(?:(?:\s+|[/.-])(\d{2,4}))?$/i,
  );
  if (brNamedMonthMatch) {
    const day = Number(brNamedMonthMatch[1]);
    const monthKey = brNamedMonthMatch[2].toLowerCase();
    const month = ptMonthMap[monthKey];
    if (month && day >= 1 && day <= 31) {
      const ref = referenceMonth ?? today().slice(0, 7);
      const [refYear, refMonth] = ref.split("-").map(Number);
      let year = brNamedMonthMatch[3]
        ? Number(brNamedMonthMatch[3])
        : refYear || new Date().getFullYear();
      if (year < 100) year += 2000;
      if (!brNamedMonthMatch[3] && refMonth === 1 && month === 12) {
        year -= 1;
      }
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Parses monetary strings in either Brazilian ("1.234,56", "-R$ 45,90", "149,90 D")
 * or International/OFX ("1234.56", "-45.90") format into signed cents.
 */
export function parseSignedAmountCents(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;

  let sign = 1;
  if (
    s.includes("-") ||
    /^\(.*\)$/.test(s) ||
    /\bD$/i.test(s) ||
    /\bDEB(?:ITO)?$/i.test(s)
  ) {
    sign = -1;
  }

  s = s
    .replace(/[R$\s()A-Za-z+_-]/g, "")
    .trim();
  if (!s || !/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let normalized = s;
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // 1.234,56 -> 1234.56
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 -> 1234.56
      normalized = s.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    // 1234,56 -> 1234.56
    normalized = s.replace(",", ".");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  const cents = Math.round(Math.abs(num) * 100);
  if (cents === 0) return 0;
  return sign * cents;
}

function extractOfxTag(block: string, tag: string): string {
  const closedRe = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const closedMatch = block.match(closedRe);
  if (closedMatch) return closedMatch[1].trim();

  const openRe = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
  const openMatch = block.match(openRe);
  return openMatch ? openMatch[1].trim() : "";
}

export function parseOfxStatement(
  rawText: string,
  referenceMonth?: string,
  isCreditCardTarget = false,
): RawImportedRow[] {
  const isCreditCardOfx =
    isCreditCardTarget || /<CREDITCARDMSGSRSV1>/i.test(rawText);
  const blocks = rawText.split(/<STMTTRN>/i).slice(1);
  const rows: RawImportedRow[] = [];

  for (const rawBlock of blocks) {
    const block = rawBlock.split(/<\/STMTTRN>/i)[0] ?? rawBlock;
    const dtPosted = extractOfxTag(block, "DTPOSTED");
    const trnAmt = extractOfxTag(block, "TRNAMT");
    const fitId = extractOfxTag(block, "FITID");
    const memo = extractOfxTag(block, "MEMO");
    const name = extractOfxTag(block, "NAME");
    const trnType = extractOfxTag(block, "TRNTYPE").toUpperCase();

    const date = parseFlexibleDate(dtPosted, referenceMonth);
    const signedCents = parseSignedAmountCents(trnAmt);
    if (!date || signedCents === null || signedCents === 0) continue;

    const rawDesc =
      memo && name && !memo.toLowerCase().includes(name.toLowerCase())
        ? `${name} - ${memo}`
        : memo || name || "Lançamento OFX";

    const cleaned = cleanImportedDescription(rawDesc);

    let kind: "income" | "expense";
    if (isCreditCardOfx) {
      // In credit card OFX, purchases are expenses; positive amounts or payment descriptions are payments/credits
      if (isInvoicePaymentDescription(rawDesc)) {
        kind = "income";
      } else {
        kind = "expense";
      }
    } else {
      kind =
        signedCents < 0 || trnType === "DEBIT" || trnType === "PAYMENT"
          ? "expense"
          : "income";
    }

    rows.push({
      rawDate: dtPosted,
      date,
      rawDescription: rawDesc,
      description: cleaned.description,
      amountCents: Math.abs(signedCents),
      kind,
      fitId: fitId || undefined,
      installmentNumber: cleaned.installmentNumber,
      totalInstallments: cleaned.totalInstallments,
    });
  }

  return rows;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cols.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function detectDelimiter(lines: string[]): string {
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestScore = -1;
  const sample = lines.slice(0, 5);
  for (const delim of candidates) {
    const counts = sample.map((l) => splitCsvLine(l, delim).length);
    const minCols = Math.min(...counts);
    const maxCols = Math.max(...counts);
    if (minCols >= 2 && minCols === maxCols && minCols > bestScore) {
      bestScore = minCols;
      best = delim;
    } else if (minCols >= 3 && bestScore < 2) {
      best = delim;
    }
  }
  return best;
}

export function parseCsvStatement(
  rawText: string,
  referenceMonth?: string,
  isCreditCardTarget = false,
): RawImportedRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines);
  const firstCols = splitCsvLine(lines[0], delimiter).map(normalizeSearchText);

  const dateIdx = firstCols.findIndex((c) =>
    /^(data|date|dt|dia|data lancamento|data da compra)$/.test(c),
  );
  const descIdx = firstCols.findIndex((c) =>
    /^(descricao|historico|title|titulo|estabelecimento|lancamento|memo|nome|detalhe)$/.test(
      c,
    ),
  );
  const amountIdx = firstCols.findIndex((c) =>
    /^(valor|amount|quantia|total|valor \(r\$\)|valor r\$)$/.test(c),
  );
  const creditIdx = firstCols.findIndex((c) =>
    /^(credito|entrada|receita)$/.test(c),
  );
  const debitIdx = firstCols.findIndex((c) =>
    /^(debito|saida|despesa)$/.test(c),
  );
  const directionIdx = firstCols.findIndex((c) =>
    /^(tipo|natureza|operacao|movimento|dc|d c|credito debito)$/.test(c),
  );
  const catIdx = firstCols.findIndex((c) => /^(categoria|category)$/.test(c));
  const idIdx = firstCols.findIndex((c) =>
    /^(identificador|id|fitid|codigo|documento)$/.test(c),
  );

  const hasHeader =
    dateIdx !== -1 &&
    (amountIdx !== -1 || creditIdx !== -1 || debitIdx !== -1);

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: RawImportedRow[] = [];

  for (const line of dataLines) {
    const cols = splitCsvLine(line, delimiter);
    if (cols.length < 2) continue;

    let rawDate = "";
    let rawDesc = "";
    let signedCents: number | null = null;
    let categoryHint: string | undefined;
    let fitId: string | undefined;

    if (hasHeader) {
      rawDate = cols[dateIdx] ?? "";
      rawDesc =
        (descIdx !== -1 ? cols[descIdx] : "") ||
        cols.find((_, idx) => idx !== dateIdx && idx !== amountIdx) ||
        "";
      if (amountIdx !== -1) {
        signedCents = parseSignedAmountCents(cols[amountIdx] ?? "");
      } else {
        const creditVal =
          creditIdx !== -1 ? parseSignedAmountCents(cols[creditIdx] ?? "") : null;
        const debitVal =
          debitIdx !== -1 ? parseSignedAmountCents(cols[debitIdx] ?? "") : null;
        if (debitVal && debitVal !== 0) {
          signedCents = -Math.abs(debitVal);
        } else if (creditVal && creditVal !== 0) {
          signedCents = Math.abs(creditVal);
        }
      }
      if (amountIdx !== -1 && signedCents !== null && directionIdx !== -1) {
        const direction = normalizeSearchText(cols[directionIdx] || "");
        if (/^(d|debito|saida|despesa)$/.test(direction)) signedCents = -Math.abs(signedCents);
        if (/^(c|credito|entrada|receita)$/.test(direction)) signedCents = Math.abs(signedCents);
      }
      if (catIdx !== -1 && cols[catIdx]) categoryHint = cols[catIdx];
      if (idIdx !== -1 && cols[idIdx]) fitId = cols[idIdx];
    } else {
      // Heuristic column detection for headerless CSV
      const dCol = cols.findIndex(
        (c) => parseFlexibleDate(c, referenceMonth) !== null,
      );
      if (dCol === -1) continue;
      rawDate = cols[dCol];

      // Find the rightmost column that parses strictly as a currency amount
      let aCol = -1;
      for (let i = cols.length - 1; i >= 0; i--) {
        if (i === dCol) continue;
        if (
          /^[-+]?\s*(?:R\$\s*)?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\s*[DC]?$/i.test(
            cols[i].trim(),
          )
        ) {
          aCol = i;
          break;
        }
      }
      if (aCol === -1) continue;
      signedCents = parseSignedAmountCents(cols[aCol]);
      rawDesc = cols
        .filter((_, idx) => idx !== dCol && idx !== aCol)
        .join(" · ");
    }

    const date = parseFlexibleDate(rawDate, referenceMonth);
    if (!date || signedCents === null || signedCents === 0) continue;

    // Ignore "SALDO ANTERIOR", "SALDO DO DIA", "SALDO FINAL"
    if (/^saldo\s+(anterior|do\s+dia|final|atual|parcial)/i.test(rawDesc.trim())) {
      continue;
    }

    const cleaned = cleanImportedDescription(rawDesc);

    let kind: "income" | "expense";
    if (isCreditCardTarget) {
      if (isInvoicePaymentDescription(rawDesc) || signedCents < 0) {
        // Wait: in Nubank credit card CSV, purchases are positive (e.g. 24.90) and payments are negative (-850.00).
        // What if a bank exports credit card CSV with negative purchases? We check if almost all rows are negative below, or if description is payment!
        kind = isInvoicePaymentDescription(rawDesc) ? "income" : "expense";
      } else {
        kind = "expense";
      }
    } else {
      kind = signedCents < 0 ? "expense" : "income";
    }

    rows.push({
      rawDate,
      date,
      rawDescription: rawDesc,
      description: cleaned.description,
      amountCents: Math.abs(signedCents),
      kind,
      fitId,
      categoryHint,
      installmentNumber: cleaned.installmentNumber,
      totalInstallments: cleaned.totalInstallments,
    });
  }

  return rows;
}

export function parsePlainTextStatement(
  rawText: string,
  referenceMonth?: string,
  isCreditCardTarget = false,
  documentType: StatementDocumentType = "unknown",
): RawImportedRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const rows: RawImportedRow[] = [];

  // Pattern: starts with date (DD/MM/YYYY, DD/MM, DD MMM, YYYY-MM-DD) + description + amount at the end
  const lineRegex =
    /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s+[A-Za-zçÇ]{3}(?:\s+\d{2,4})?|\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\s*(?:R\$\s*)?[-+]?\s*(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2})?))\s*([DCdc+-])?$/;
  // PDF bank table can include the informative balance column after Valor.
  // Use the FIRST amount as the movement; the second must never be imported.
  const lineWithBalance =
    /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\s*(?:R\$\s*)?[-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*([DCdc])?\s+([-+]?\s*(?:R\$\s*)?[-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2})$/;

  for (const line of lines) {
    const match = (documentType === "bank" ? line.match(lineWithBalance) : null)
      ?? line.match(lineRegex);
    if (!match) continue;
    const [, rawDate, rawDesc, rawAmount, trailingSign] = match;
    if (/^saldo\s+(anterior|do\s+dia|final|atual|parcial)/i.test(rawDesc.trim())) {
      continue;
    }
    const date = parseFlexibleDate(rawDate, referenceMonth);
    const amountWithSign = trailingSign
      ? `${rawAmount} ${trailingSign}`
      : rawAmount;
    const signedCents = parseSignedAmountCents(amountWithSign);
    if (!date || signedCents === null || signedCents === 0) continue;

    const cleaned = cleanImportedDescription(rawDesc);

    let kind: "income" | "expense";
    let reviewReason: string | undefined;
    if (isCreditCardTarget) {
      kind = isInvoicePaymentDescription(rawDesc) ? "income" : "expense";
    } else if (signedCents < 0) {
      kind = "expense";
    } else if (
      rawAmount.includes("+") ||
      trailingSign?.toUpperCase() === "C" ||
      documentType === "bank"
    ) {
      // Itaú bank statements use a signed single Valor column: no minus = credit.
      kind = "income";
    } else {
      // A photo transcription without a bank header may omit minus signs.
      // Do not invent certainty from a merchant name alone.
      kind = /\b(salario|recebido|deposito|credito)\b/i.test(
        normalizeSearchText(rawDesc),
      ) ? "income" : "expense";
      reviewReason = "Valor sem sinal em texto sem identificação de extrato bancário. Confirme se é entrada ou saída.";
    }

    rows.push({
      rawDate,
      date,
      rawDescription: rawDesc,
      description: cleaned.description,
      amountCents: Math.abs(signedCents),
      kind,
      reviewReason,
      installmentNumber: cleaned.installmentNumber,
      totalInstallments: cleaned.totalInstallments,
    });
  }

  return rows;
}

const DATED_MOVEMENT_GROUP =
  /^[^\S\r\n]*\d{1,2}[^\S\r\n]+[a-z]{3}[^\S\r\n]+\d{4}[^\S\r\n]+total de (?:entradas|sa[ií]das)\b/im;
const MOVEMENT_GROUP_HEADER =
  /^(?:(\d{1,2}\s+[a-z]{3}\s+\d{4})\s+)?total de (entradas|sa[ií]das)\b\s*(.*)$/i;
const MOVEMENT_WITH_AMOUNT =
  /^(.+?)\s+([+-]?\s*(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})$/;

function parseGroupedBankStatement(rawText: string): {
  rows: RawImportedRow[];
  error?: string;
} {
  const rows: RawImportedRow[] = [];
  let group: {
    rawDate: string;
    date: string;
    kind: RawImportedRow["kind"];
    expectedCents: number;
    parsedCents: number;
  } | undefined;

  function groupMismatch(rawDate: string) {
    return {
      rows: [],
      error: `Não foi possível conferir os lançamentos de ${rawDate} com o subtotal do extrato. Tente exportar esse período em OFX ou CSV.`,
    };
  }

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/\s+/g, " ");
    const header = line.match(MOVEMENT_GROUP_HEADER);
    if (header) {
      const rawDate = header[1] ?? group?.rawDate;
      if (!rawDate) continue; // Totais do período, antes das movimentações.
      if (group && group.parsedCents !== group.expectedCents) {
        return groupMismatch(group.rawDate);
      }

      const date = parseFlexibleDate(rawDate);
      const subtotal = parseSignedAmountCents(header[3]);
      if (!date || subtotal === null || !Number.isSafeInteger(subtotal)) {
        return groupMismatch(rawDate);
      }
      group = {
        rawDate,
        date,
        kind: header[2].toLowerCase() === "entradas" ? "income" : "expense",
        expectedCents: Math.abs(subtotal),
        parsedCents: 0,
      };
      continue;
    }

    if (!group) continue;
    const movement = line.match(MOVEMENT_WITH_AMOUNT);
    if (!movement) continue;
    const signedCents = parseSignedAmountCents(movement[2]);
    if (!signedCents || !Number.isSafeInteger(signedCents)) continue;
    const amountCents = Math.abs(signedCents);
    // Preserve the counterparty name, leaving masked identifiers and banking details out.
    const rawDescription = movement[1].replace(/\s+-\s+[•*].*$/, "");
    rows.push({
      rawDate: group.rawDate,
      date: group.date,
      rawDescription,
      description: cleanImportedDescription(rawDescription).description,
      amountCents,
      kind: group.kind,
    });
    group.parsedCents += amountCents;
  }

  if (group && group.parsedCents !== group.expectedCents) {
    return groupMismatch(group.rawDate);
  }
  return { rows };
}

export type StatementDocumentType = "bank" | "invoice" | "unknown";

/** Detect source independently of the destination selected by the user. */
export function detectStatementDocumentType(
  rawText: string,
): StatementDocumentType {
  const text = normalizeSearchText(rawText.slice(0, 180_000));
  if (
    /<bankmsgsrsv1>|<stmtrs>/i.test(rawText.slice(0, 3000)) ||
    DATED_MOVEMENT_GROUP.test(rawText) ||
    /\bextrato\s+(?:de\s+)?conta\b/.test(text) ||
    /\bsaldo\s+do\s+dia\b/.test(text) ||
    /\blimite\s+da\s+conta\b/.test(text) ||
    /\bperiodo\s+de\s+visualizacao\b/.test(text)
  ) return "bank";
  if (
    /<creditcardmsgsrsv1>/i.test(rawText.slice(0, 3000)) ||
    /\bfatura\s+(?:do|de)\s+cartao\b/.test(text) ||
    /\bresumo\s+da\s+fatura\b/.test(text)
  ) return "invoice";
  return "unknown";
}

export function isPossibleOwnTransfer(description: string): boolean {
  const text = normalizeSearchText(description);
  return /\b(?:pix\s+transf|transf(?:erencia)?\s+pix|transferencia|ted\s+(?:enviada|recebida)|doc\s+(?:enviado|recebido))\b/.test(text);
}

/** Do not match unrelated purchases merely because date and amount coincide. */
export function reconciliationDescription(description: string): string {
  return normalizeSearchText(description)
    .replace(/\b(?:pay\s+dl|pay|compra\s+(?:cartao\s+)?(?:debito|credito)|pix\s+(?:enviado|recebido)|transf(?:erencia)?\s+pix)\b/g, " ")
    .replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function descriptionsMatchForImport(first: string, second: string): boolean {
  const a = reconciliationDescription(first);
  const b = reconciliationDescription(second);
  if (a.length < 2 || b.length < 2) return false;
  if (a === b) return true;
  // Allow a merchant and its bank suffix, but not generic substrings.
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  return short.length >= 4 && long.startsWith(`${short} `);
}

export function parseStatementInput(
  rawText: string,
  options?: {
    fileName?: string;
    referenceMonth?: string;
    isCreditCardTarget?: boolean;
  },
): { format: ImportFormat; rows: RawImportedRow[]; error?: string } {
  // PDF/clipboard exports may contain typographic minus signs or NBSP.
  // Normalize before detecting signed values so credits and debits are not inverted.
  const trimmed = rawText.replace(/[−–—﹣]/g, "-").replace(/\u00a0/g, " ").trim();
  const lowerName = (options?.fileName ?? "").toLowerCase();
  const refMonth = options?.referenceMonth;
  const isCC = Boolean(options?.isCreditCardTarget);
  const sourceType = detectStatementDocumentType(trimmed);

  if (
    lowerName.endsWith(".ofx") ||
    lowerName.endsWith(".qfx") ||
    /<OFX>/i.test(trimmed) ||
    /<STMTTRN>/i.test(trimmed)
  ) {
    return {
      format: "ofx",
      rows: parseOfxStatement(trimmed, refMonth, isCC),
    };
  }

  // Try plain text first if it doesn't look like delimited CSV, or try CSV first
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")) {
    const csvRows = parseCsvStatement(trimmed, refMonth, isCC);
    if (csvRows.length > 0) return { format: "csv", rows: csvRows };
  }

  if (DATED_MOVEMENT_GROUP.test(trimmed)) {
    return { format: "text", ...parseGroupedBankStatement(trimmed) };
  }

  const csvRows = parseCsvStatement(trimmed, refMonth, isCC);
  const textRows = parsePlainTextStatement(trimmed, refMonth, isCC, sourceType);

  if (csvRows.length >= textRows.length && csvRows.length > 0) {
    return { format: "csv", rows: csvRows };
  }
  return { format: "text", rows: textRows };
}

function daysBetween(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split("-").map(Number);
  const [y2, m2, d2] = dateB.split("-").map(Number);
  const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
}

const TRANSFER_PREFIX =
  /^(?:pix (?:transf(?:erencia)?|enviado|recebido)|transferencia(?: (?:enviada|recebida)(?: pelo pix)?| pix)?|ted(?: enviada| recebida)?|doc(?: enviado| recebido)?)\b/;
const TRANSFER_DATE_SUFFIX = /\s*\(?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\)?$/;

function transferDescription(description: string) {
  const originalDate = description.match(TRANSFER_DATE_SUFFIX);
  const counterparty = reconciliationDescription(
    normalizeSearchText(description)
      .replace(TRANSFER_DATE_SUFFIX, "")
      .replace(TRANSFER_PREFIX, ""),
  );
  return { originalDate, words: counterparty ? counterparty.split(" ") : [] };
}

function matchesExistingTransfer(entry: Entry, row: RawImportedRow, accountId: string): boolean {
  const isCredit = row.kind === "income";
  const sameSide = isCredit ? entry.target_account_id === accountId : entry.source_account_id === accountId;
  if (!sameSide || !TRANSFER_PREFIX.test(normalizeSearchText(row.rawDescription))) return false;

  const debitDate = isCredit ? entry.date : row.date;
  const creditDate = isCredit ? row.date : entry.date;
  const delay = daysBetween(creditDate, debitDate);
  const debitWeekday = new Date(`${debitDate}T00:00:00Z`).getUTCDay();
  const crossesWeekend = (debitWeekday === 5 && delay === 3) || (debitWeekday === 6 && delay === 2);
  if (Math.abs(delay) > 1 && !crossesWeekend) return false;

  const credit = transferDescription(isCredit ? row.rawDescription : entry.description);
  const debit = transferDescription(isCredit ? entry.description : row.rawDescription);
  const [year, month, day] = debitDate.split("-");
  const statedDate = credit.originalDate;
  if (statedDate && (
    Number(statedDate[1]) !== Number(day) ||
    Number(statedDate[2]) !== Number(month) ||
    (statedDate[3] && statedDate[3] !== year)
  )) {
    return false;
  }

  const [shorter, longer] = credit.words.length <= debit.words.length
    ? [credit.words, debit.words]
    : [debit.words, credit.words];
  if (shorter.length === 0) return false;
  if (shorter.join(" ") === longer.join(" ")) return true;
  // An abbreviated last word is stronger evidence when the credit quotes the debit date.
  return shorter.length >= 2 && shorter.every((word, index) =>
    word === longer[index] || (
      index === shorter.length - 1 &&
      word.length >= (statedDate ? 2 : 4) &&
      longer[index].startsWith(word)
    ),
  );
}

export function prepareImportPreview(params: {
  rawText: string;
  fileName?: string;
  targetAccount: Account;
  invoiceMonth?: string;
  existingEntries: Entry[];
  recurrences?: Recurrence[];
}): StatementImportPreview {
  const isCC = params.targetAccount.kind === "credit_card";
  const targetInvoiceMonth = params.invoiceMonth || today().slice(0, 7);
  const dueDay = clampDay(params.targetAccount.due_day ?? 10, 10);
  const closingDay = clampDay(
    params.targetAccount.closing_day ?? defaultClosingDay(dueDay),
    defaultClosingDay(dueDay),
  );

  const { format, rows, error } = parseStatementInput(params.rawText, {
    fileName: params.fileName,
    referenceMonth: targetInvoiceMonth,
    isCreditCardTarget: isCC,
  });

  const activeExisting = params.existingEntries.filter(
    (e) => e.status !== "cancelled",
  );
  const accountExisting = activeExisting.filter(
    (e) =>
      e.source_account_id === params.targetAccount.id ||
      e.target_account_id === params.targetAccount.id,
  );
  const existingExternalIds = new Set(
    activeExisting
      .map((e) => e.external_id)
      .filter((id): id is string => Boolean(id)),
  );

  const claimedManualIds = new Set<string>();
  const seenInFileExternalIds = new Set<string>();
  const occurrenceCounters = new Map<string, number>();

  const items: StatementPreviewItem[] = rows.map((row, idx) => {
    const installNum = row.installmentNumber ?? 1;
    const installTotal = row.totalInstallments ?? 1;
    const purchaseDate = row.date;

    const effectiveDate = isCC
      ? params.invoiceMonth
        ? buildDateWithDay(params.invoiceMonth, dueDay)
        : calculateFirstDueDate(purchaseDate, dueDay, closingDay)
      : purchaseDate;

    const baseDesc = row.description.replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, "");
    const sigKey = `${params.targetAccount.id.slice(0, 8)}:${purchaseDate}:${row.amountCents}:${normalizeSearchText(baseDesc)}`;
    const occ = (occurrenceCounters.get(sigKey) ?? 0) + 1;
    occurrenceCounters.set(sigKey, occ);

    const hashToken = simpleHash(
      row.fitId ? `${params.targetAccount.id}:${row.fitId}` : `${sigKey}:${occ}`,
    );
    const groupId = `imp_${hashToken}`;
    const externalId = isCC
      ? formatCreditCardExternalId({
          groupId,
          installmentNumber: installNum,
          totalInstallments: installTotal,
          purchaseDate,
          dueDate: effectiveDate,
        })
      : `imp:${params.targetAccount.id.slice(0, 8)}:${purchaseDate}:${row.amountCents}:${hashToken}`;

    const category = inferCategory(
      row.description,
      row.kind,
      params.existingEntries,
      params.recurrences ?? [],
      row.categoryHint,
    );

    // 1. Invoice Payment filter on Credit Cards
    if (
      isCC &&
      (row.kind === "income" || isInvoicePaymentDescription(row.rawDescription))
    ) {
      return {
        id: `preview-${idx}-${hashToken}`,
        date: effectiveDate,
        purchaseDate,
        description: row.description,
        rawDescription: row.rawDescription,
        amountCents: row.amountCents,
        kind: "expense",
        category: "Fatura de cartão",
        installmentNumber: installNum,
        totalInstallments: installTotal,
        externalId,
        groupId,
        duplicateStatus: "invoice_payment",
        selected: false,
      };
    }

    // 2. Exact duplicate: stored transactions OR repeated FITIDs in this file.
    const repeatedInFile = seenInFileExternalIds.has(externalId);
    seenInFileExternalIds.add(externalId);
    if (existingExternalIds.has(externalId) || repeatedInFile) {
      return {
        id: `preview-${idx}-${hashToken}`,
        date: effectiveDate,
        purchaseDate,
        description: row.description,
        rawDescription: row.rawDescription,
        amountCents: row.amountCents,
        kind: row.kind,
        category,
        installmentNumber: installNum,
        totalInstallments: installTotal,
        externalId,
        groupId,
        duplicateStatus: "exact_duplicate",
        selected: false,
      };
    }

    // 3. Manual / Partial Entry Reconciliation Check
    const manualCandidate = accountExisting.find((e) => {
      if (claimedManualIds.has(e.id)) return false;
      if (e.amount_cents !== row.amountCents) return false;
      // Importing the statement of the other side of an already registered
      // own-account transfer must not create a second transfer or income.
      if (!isCC && e.kind === "transfer") {
        return matchesExistingTransfer(e, row, params.targetAccount.id);
      }
      if (e.kind !== row.kind) return false;
      if (!descriptionsMatchForImport(e.description, row.description) &&
          !descriptionsMatchForImport(e.description, row.rawDescription)) return false;

      if (isCC) {
        const meta = parseCreditCardMeta(e.external_id);
        const sameInvoice =
          getEntryInvoiceMonth(e) === effectiveDate.slice(0, 7);
        const closePurchaseDate =
          meta?.purchaseDate &&
          Math.abs(daysBetween(meta.purchaseDate, purchaseDate)) <= 5;
        return Boolean(sameInvoice || closePurchaseDate);
      }

      return Math.abs(daysBetween(e.date, effectiveDate)) <= 4;
    });

    if (manualCandidate) {
      claimedManualIds.add(manualCandidate.id);
      const isAlreadyImported = manualCandidate.source === "import";
      return {
        id: `preview-${idx}-${hashToken}`,
        date: effectiveDate,
        purchaseDate,
        description: row.description,
        rawDescription: row.rawDescription,
        amountCents: row.amountCents,
        kind: row.kind,
        category: manualCandidate.category || category,
        installmentNumber: installNum,
        totalInstallments: installTotal,
        externalId,
        groupId,
        duplicateStatus: isAlreadyImported ? "exact_duplicate" : "manual_match",
        matchedEntry: {
          id: manualCandidate.id,
          description: manualCandidate.description,
          date: manualCandidate.date,
          amount_cents: manualCandidate.amount_cents,
          kind: manualCandidate.kind,
        },
        selected: false,
      };
    }

    return {
      id: `preview-${idx}-${hashToken}`,
      date: effectiveDate,
      purchaseDate,
      description: row.description,
      rawDescription: row.rawDescription,
      amountCents: row.amountCents,
      kind: row.kind,
      category,
      installmentNumber: installNum,
      totalInstallments: installTotal,
      externalId,
      groupId,
      duplicateStatus: row.reviewReason ? "review_required" : "new",
      reviewReason: row.reviewReason,
      transferSuggestion: !isCC && isPossibleOwnTransfer(row.rawDescription),
      selected: !row.reviewReason,
    };
  });

  return {
    format,
    items,
    ...(error ? { error } : {}),
    summary: computeImportSummary(items),
  };
}

export function computeImportSummary(items: StatementPreviewItem[]) {
  const selected = items.filter((i) => i.selected);
  return {
    totalParsed: items.length,
    selectedCount: selected.length,
    selectedExpenseCents: sumCents(
      selected.filter((i) => i.kind === "expense" && !i.transferAccountId).map((i) => i.amountCents),
    ),
    selectedIncomeCents: sumCents(
      selected.filter((i) => i.kind === "income" && !i.transferAccountId).map((i) => i.amountCents),
    ),
    exactDuplicateCount: items.filter(
      (i) => i.duplicateStatus === "exact_duplicate",
    ).length,
    manualMatchCount: items.filter((i) => i.duplicateStatus === "manual_match")
      .length,
    invoicePaymentCount: items.filter(
      (i) => i.duplicateStatus === "invoice_payment",
    ).length,
    reviewRequiredCount: items.filter(
      (i) => i.duplicateStatus === "review_required",
    ).length,
    transferCount: selected.filter((i) => Boolean(i.transferAccountId)).length,
  };
}

export function buildImportBatchPayload(params: {
  items: StatementPreviewItem[];
  targetAccount: Account;
  invoiceStatus?: "planned" | "posted";
  projectFutureInstallments?: boolean;
  existingEntries?: Entry[];
}): Record<string, unknown>[] {
  const isCC = params.targetAccount.kind === "credit_card";
  const dueDay = clampDay(params.targetAccount.due_day ?? 10, 10);
  const now = today();
  const selected = params.items.filter((i) => i.selected);
  const existingExt = new Set(
    (params.existingEntries ?? [])
      .filter((e) => e.status !== "cancelled" && e.external_id)
      .map((e) => e.external_id as string),
  );

  const payload: Record<string, unknown>[] = [];

  for (const item of selected) {
    if (isCC) {
      const status =
        params.invoiceStatus === "posted" && item.date <= now
          ? "posted"
          : "planned";

      payload.push({
        kind: "expense",
        description: item.description.slice(0, 80),
        amount_cents: item.amountCents,
        date: item.date,
        category: item.category || "Outros",
        status,
        source_account_id: params.targetAccount.id,
        target_account_id: null,
        recurrence_id: null,
        occurrence_date: null,
        source: "import",
        external_id: item.externalId,
      });

      // Project remaining future installments (e.g. if current is 2/6, generate 3/6..6/6)
      if (
        params.projectFutureInstallments &&
        item.totalInstallments > 1 &&
        item.installmentNumber < item.totalInstallments
      ) {
        const baseDesc = item.description
          .replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, "")
          .trim();
        const baseInvoiceStart = `${item.date.slice(0, 7)}-01`;
        for (
          let nextNum = item.installmentNumber + 1;
          nextNum <= item.totalInstallments;
          nextNum++
        ) {
          const offset = nextNum - item.installmentNumber;
          const futureMonth = addMonths(baseInvoiceStart, offset).slice(0, 7);
          const futureDueDate = buildDateWithDay(futureMonth, dueDay);
          const futureExtId = formatCreditCardExternalId({
            groupId: item.groupId,
            installmentNumber: nextNum,
            totalInstallments: item.totalInstallments,
            purchaseDate: item.purchaseDate,
            dueDate: futureDueDate,
          });
          if (existingExt.has(futureExtId)) continue;
          payload.push({
            kind: "expense",
            description:
              `${baseDesc} (${nextNum}/${item.totalInstallments})`.slice(0, 80),
            amount_cents: item.amountCents,
            date: futureDueDate,
            category: item.category || "Outros",
            status: "planned",
            source_account_id: params.targetAccount.id,
            target_account_id: null,
            recurrence_id: null,
            occurrence_date: null,
            source: "import",
            external_id: futureExtId,
          });
        }
      }
    } else {
      const status = item.date > now ? "planned" : "posted";
      const counterpart = item.transferAccountId;
      if (counterpart && counterpart === params.targetAccount.id) {
        throw new Error("A transferência precisa de outra conta de destino ou origem.");
      }
      payload.push({
        kind: counterpart ? "transfer" : item.kind,
        description: item.description.slice(0, 80),
        amount_cents: item.amountCents,
        date: item.date,
        category: counterpart ? "Transferência" : (item.category || "Outros"),
        status,
        source_account_id: counterpart
          ? (item.kind === "income" ? counterpart : params.targetAccount.id)
          : (item.kind === "expense" ? params.targetAccount.id : null),
        target_account_id: counterpart
          ? (item.kind === "income" ? params.targetAccount.id : counterpart)
          : (item.kind === "income" ? params.targetAccount.id : null),
        recurrence_id: null,
        occurrence_date: null,
        source: "import",
        external_id: item.externalId,
      });
    }
  }

  return payload;
}

export function sampleBankStatementText(month: string): string {
  const m = month || today().slice(0, 7);
  const now = today();
  const maxDay = m === now.slice(0, 7) ? Math.max(1, Number(now.slice(8, 10))) : 25;
  const d = (day: number) =>
    `${m}-${String(Math.min(day, maxDay)).padStart(2, "0")}`;
  return [
    "Data;Descrição;Valor;Identificador",
    `${d(5)};Salário líquido;4200,00;fit-${m}-sal`,
    `${d(8)};PIX ENVIADO - IFOOD *IFOOD;-68,90;fit-${m}-ifood`,
    `${d(9)};COMPRA CARTAO DEBITO SUPERMERCADO CARREFOUR;-184,50;fit-${m}-mkt`,
    `${d(11)};UBER *TRIP;-29,80;fit-${m}-uber`,
    `${d(12)};DROGASIL FARMACIA;-54,20;fit-${m}-drogasil`,
    `${d(14)};PIX RECEBIDO - REEMBOLSO AMIGO;95,00;fit-${m}-reemb`,
  ].join("\n");
}

export function sampleCreditCardInvoiceText(month: string): string {
  const m = month || today().slice(0, 7);
  return [
    "date,category,title,amount",
    `${m}-02,transporte,Uber *Trip,34.90`,
    `${m}-03,saúde,Farmácia e bem-estar,89.50`,
    `${m}-04,serviços,Netflix.com,55.90`,
    `${m}-06,compras,Shopee *Fone Bluetooth 01/03,79.90`,
    `${m}-07,restaurante,iFood *Restaurante Sabor,64.00`,
    `${m}-08,pagamento,Pagamento recebido,-450.00`,
  ].join("\n");
}

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function extractTextOperatorsFromPdfStream(streamText: string): string[] {
  const lines: string[] = [];
  const btBlocks = streamText.match(/\bBT\b[\s\S]*?\bET\b/g) ?? [streamText];

  for (const block of btBlocks) {
    let currentLine = "";
    const tokenRegex =
      /(\((?:\\.|[^\\()])*\)\s*Tj|\[(?:\\.|[^[\]])*\]\s*Tj|\[(?:\\.|[^[\]])*\]\s*TJ|\((?:\\.|[^\\()])*\)\s*'|(?:\bT\*|\b(?:Td|TD|Tm)\b))/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(block)) !== null) {
      const token = match[1];
      if (/^(T\*|Td|TD|Tm)$/.test(token)) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = "";
        }
        continue;
      }
      const strMatches = token.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
      const textChunk = strMatches
        .map((s) => decodePdfLiteralString(s.slice(1, -1)))
        .join(" ");
      if (textChunk.trim()) {
        currentLine = currentLine
          ? `${currentLine} ${textChunk.trim()}`
          : textChunk.trim();
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  }
  return lines;
}

/**
 * PDF tables often draw each cell in its own BT/Tm/Tj block. Reconstruct rows
 * by their PDF coordinates instead of treating each cell as an independent line.
 * This is best effort for text-based PDFs; embedded custom encodings/scans may
 * still require OFX/CSV or manual review.
 */
function extractPositionedPdfLines(streamText: string): string[] {
  type Cell = { x: number; y: number; value: string };
  const cells: Cell[] = [];
  const objects = streamText.match(/\bBT\b[\s\S]*?\bET\b/g) ?? [];
  for (const object of objects) {
    let x = 0;
    let y = 0;
    let positioned = false;
    // Text positions and actual PDF literal/array show operators.
    const operations = /(-?(?:\d+\.?\d*|\.\d+)\s+-?(?:\d+\.?\d*|\.\d+)\s+-?(?:\d+\.?\d*|\.\d+)\s+-?(?:\d+\.?\d*|\.\d+)\s+(-?(?:\d+\.?\d*|\.\d+))\s+(-?(?:\d+\.?\d*|\.\d+))\s+Tm)|(-?(?:\d+\.?\d*|\.\d+))\s+(-?(?:\d+\.?\d*|\.\d+))\s+(Td|TD)|((?:\((?:\\.|[^\\()])*\)|\[(?:\\.|[^\[\]])*\])\s*(?:Tj|TJ|'))/g;
    let result: RegExpExecArray | null;
    while ((result = operations.exec(object)) !== null) {
      if (result[1]) {
        x = Number(result[2]);
        y = Number(result[3]);
        positioned = true;
      } else if (result[4]) {
        x += Number(result[4]);
        y += Number(result[5]);
        positioned = true;
      } else if (result[7] && positioned) {
        const text = (result[7].match(/\((?:\\.|[^\\()])*\)/g) ?? [])
          .map((v) => decodePdfLiteralString(v.slice(1, -1)))
          .join("").trim();
        if (text) cells.push({ x, y, value: text });
      }
    }
  }
  if (cells.length < 3) return [];
  const rows: { y: number; cells: Cell[] }[] = [];
  for (const cell of cells) {
    const row = rows.find((r) => Math.abs(r.y - cell.y) <= 2.3);
    if (row) row.cells.push(cell);
    else rows.push({ y: cell.y, cells: [cell] });
  }
  // PDF coordinate origin is bottom left. The source order is page/stream order.
  const lines = rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.cells.sort((a, b) => a.x - b.x)
      .map((c) => c.value).join(" ").replace(/\s+/g, " ").trim());
  // Prefer coordinates only when they produced plausible complete statement rows.
  return lines.some((l) => /^\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\s+\S+/.test(l))
    ? lines
    : [];
}

async function tryInflateBytes(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === "undefined") return null;
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      writer.write(bytes as unknown as BufferSource).catch(() => {});
      writer.close().catch(() => {});
      const resp = new Response(ds.readable);
      const buf = await resp.arrayBuffer();
      return new TextDecoder("latin1").decode(buf);
    } catch {
      // try next format
    }
  }
  return null;
}

export async function extractTextFromPdfBuffer(
  buffer: ArrayBuffer,
): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const rawLatin1 = new TextDecoder("latin1").decode(bytes);
  const extractedLines: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    const content = match[1];
    if (content.includes("Tj") || content.includes("TJ")) {
      const positioned = extractPositionedPdfLines(content);
      extractedLines.push(...(positioned.length ? positioned : extractTextOperatorsFromPdfStream(content)));
      continue;
    }
    // Attempt FlateDecode decompression
    const streamByteSlice = new Uint8Array(content.length);
    for (let i = 0; i < content.length; i++) {
      streamByteSlice[i] = content.charCodeAt(i) & 0xff;
    }
    const inflated = await tryInflateBytes(streamByteSlice);
    if (inflated && (inflated.includes("Tj") || inflated.includes("TJ"))) {
      const positioned = extractPositionedPdfLines(inflated);
      extractedLines.push(...(positioned.length ? positioned : extractTextOperatorsFromPdfStream(inflated)));
    }
  }

  if (extractedLines.length === 0) {
    extractedLines.push(...extractTextOperatorsFromPdfStream(rawLatin1));
  }

  // Re-stitch adjacent lines if a date line, description line, and amount line were split across PDF text blocks
  const normalized: string[] = [];
  for (let i = 0; i < extractedLines.length; i++) {
    const cur = extractedLines[i].replace(/\s+/g, " ").trim();
    if (!cur) continue;
    const next1 = (extractedLines[i + 1] ?? "").replace(/\s+/g, " ").trim();
    const next2 = (extractedLines[i + 2] ?? "").replace(/\s+/g, " ").trim();
    const isDateOnly =
      /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s+[A-Za-zçÇ]{3}(?:\s+\d{2,4})?|\d{4}-\d{2}-\d{2})$/.test(
        cur,
      );
    const isAmountOnly =
      /^[-+]?\s*(?:R\$\s*)?[-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*[DCdc+-]?$/.test(
        next2,
      );
    if (isDateOnly && next1 && isAmountOnly) {
      normalized.push(`${cur} ${next1} ${next2}`);
      i += 2;
      continue;
    }
    normalized.push(cur);
  }

  return normalized.join("\n");
}
