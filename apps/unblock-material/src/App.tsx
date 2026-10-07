import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Boxes,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Factory,
  FileText,
  Hash,
  Inbox,
  Info,
  Loader2,
  Moon,
  PackageCheck,
  RefreshCw,
  Search,
  Sun,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import type { UnblockMaterialRead } from "./generated/models/UnblockMaterialModel";
import type { UnblockMaterialTicketRead } from "./generated/models/UnblockMaterialTicketModel";
import { UnblockMaterialService, UnblockMaterialTicketService } from "./generated";
import { getPowerAppsErrorMessage, withPowerAppsTimeout } from "./powerAppsData";
import { SHAREPOINT_LISTS } from "./sharepointConfig";

type LoadState = "idle" | "loading" | "success" | "error";
type ChildLoadState = "idle" | "loading" | "success" | "error";

const ticketPageSize = 6;
const materialPageSize = 6;
const ticketBatchSize = 100;
const searchResultLimit = 200;

const ticketColumns = [
  "ID",
  "Title",
  "Created",
  "Status",
  "RequestBy",
  "Review",
  "Reviewdate",
  "Approvedby",
  "Approveddate",
  "Executeby",
  "Executecompletiondate",
  "ReviewerComment",
  "ApproverComment",
  "ExecutorComment",
];

const materialColumns = [
  "ID",
  "Title",
  "Created",
  "MaterialCode",
  "MaterialDescription",
  "NotesofUnblocking",
  "Quantity",
  "UOM",
  "PlantSite",
  "IDTICKET",
  "Status",
  "Review",
  "Approvedby",
  "Executeby",
];

const materialCountColumns = ["ID", "IDTICKET"];

type StatusTone = "approved" | "waiting" | "rejected" | "closed" | "other";

function getStatusTone(status?: string): StatusTone {
  const normalizedStatus = status?.toLowerCase() ?? "";

  if (["reject", "cancel", "delete"].some((value) => normalizedStatus.includes(value))) {
    return "rejected";
  }

  if (["close", "complete", "released", "done"].some((value) => normalizedStatus.includes(value))) {
    return "closed";
  }

  if (normalizedStatus.includes("approve")) {
    return "approved";
  }

  if (["waiting", "review", "pending"].some((value) => normalizedStatus.includes(value))) {
    return "waiting";
  }

  return "other";
}

const statusPillClass: Record<StatusTone, string> = {
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  waiting:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  rejected: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  closed: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  other: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
};

/** Rail warna status di tepi kartu ticket — bahasa visual utama app ini. */
const statusRailClass: Record<StatusTone, string> = {
  approved: "bg-emerald-500",
  waiting: "bg-amber-400",
  rejected: "bg-red-500",
  closed: "bg-sky-500",
  other: "bg-slate-400",
};

/** Dot kecil untuk chip filter status. */
const statusDotClass: Record<StatusTone, string> = statusRailClass;

const STATUS_FILTERS: Array<{ label: string; value: string; tone: StatusTone }> = [
  { label: "Approved", value: "Approve", tone: "approved" },
  { label: "Waiting Review", value: "Waiting Review", tone: "waiting" },
  { label: "Rejected", value: "Reject", tone: "rejected" },
  { label: "Closed", value: "CLOSE", tone: "closed" },
];

function statusMatchesFilter(status: string | undefined, filterValue: string) {
  const filterTone = STATUS_FILTERS.find((item) => item.value === filterValue)?.tone;
  return filterTone !== undefined && getStatusTone(status) === filterTone;
}

function StatusPill({ status }: { status?: string }) {
  const tone = getStatusTone(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass[tone]}`}
    >
      {tone === "waiting" ? <span className="status-dot-pulse h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {status || "No status"}
    </span>
  );
}

const themeStorageKey = "um-theme";

function getInitialThemeMode(): "light" | "dark" {
  try {
    return localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function TicketListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="h-[92px] animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/40"
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </div>
  );
}

function MaterialRowsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <tr key={index}>
          <td className="px-3 py-3" colSpan={4}>
            <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700/60" />
          </td>
        </tr>
      ))}
    </>
  );
}

function normalize(value?: string | number | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function describeOperationError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);

    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // fallthrough
  }

  return "Unknown error";
}

/**
 * Ambil SELURUH baris index (ID + IDTICKET) dengan paging `ID gt <lastId>`.
 * ID selalu indexed, jadi pola ini aman dari list view threshold dan tidak
 * terpotong cap 5000 seperti fetch tunggal.
 */
async function fetchAllMaterialIndexRows(): Promise<UnblockMaterialRead[]> {
  const pageSize = 5000;
  const maxPages = 8;
  const rows: UnblockMaterialRead[] = [];
  let lastId = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await withPowerAppsTimeout(
      UnblockMaterialService.getAll({
        select: materialCountColumns,
        filter: `ID gt ${lastId}`,
        top: pageSize,
        orderBy: ["ID asc"],
      }),
      30000,
    );

    if (!result.success) {
      throw new Error(`Gagal membaca index Unblock Material: ${describeOperationError(result.error)}`);
    }

    const batch = result.data ?? [];
    rows.push(...batch);

    const batchLastId = batch[batch.length - 1]?.ID;

    if (batch.length < pageSize || !batchLastId) {
      break;
    }

    lastId = batchLastId;
  }

  return rows;
}

/** Resolve baris ticket dari daftar nilai IDTICKET (reverse lookup material → ticket). */
async function fetchTicketsByTitles(titles: string[]): Promise<UnblockMaterialTicketRead[]> {
  const chunkSize = 15;
  const rows: UnblockMaterialTicketRead[] = [];

  for (let index = 0; index < titles.length; index += chunkSize) {
    const chunk = titles.slice(index, index + chunkSize);
    const result = await withPowerAppsTimeout(
      UnblockMaterialTicketService.getAll({
        select: ticketColumns,
        filter: chunk.map((title) => `Title eq '${escapeODataValue(title)}'`).join(" or "),
        top: chunkSize * 2,
        orderBy: ["ID desc"],
      }),
    );

    if (!result.success) {
      throw new Error(describeOperationError(result.error));
    }

    rows.push(...(result.data ?? []));
  }

  return rows;
}

/** Fetch detail material per ID (indexed → selalu bisa), dalam potongan kecil. */
async function fetchMaterialsByIds(ids: number[]): Promise<UnblockMaterialRead[]> {
  const chunkSize = 25;
  const rows: UnblockMaterialRead[] = [];

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const result = await withPowerAppsTimeout(
      UnblockMaterialService.getAll({
        select: materialColumns,
        filter: chunk.map((id) => `ID eq ${id}`).join(" or "),
        top: chunkSize,
        orderBy: ["ID asc"],
      }),
    );

    if (!result.success) {
      throw new Error(`Gagal mengambil material per ID: ${describeOperationError(result.error)}`);
    }

    rows.push(...(result.data ?? []));
  }

  return rows;
}

function getTicketNo(ticketRow: Partial<UnblockMaterialTicketRead>) {
  return ticketRow.Title ?? "";
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  // Selalu 2 karakter: inisial dua kata pertama, atau 2 huruf pertama
  // untuk nama satu kata.
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isEmailLike(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

/**
 * Info requester — kolom 'Request By' berisi EMAIL requester; nama tampilan
 * diturunkan dari prefix email.
 *
 * CATATAN foto: badge sementara memakai inisial saja. UserPhoto.aspx butuh
 * cookie login SharePoint dan me-redirect ke afdcache bertanda tangan —
 * dari dalam iframe player (lintas situs) auth-nya tidak terbawa sehingga
 * gambar rusak. Kembalikan <img> bila masalah cookie/auth sudah terpecahkan.
 */
function getRequesterInfo(ticketRow: Partial<UnblockMaterialTicketRead>) {
  const requestBy = (ticketRow.RequestBy ?? "").trim();
  const email = isEmailLike(requestBy) ? requestBy.toLowerCase() : "";
  const name = email
    ? email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : requestBy;

  return { name: name || "No requester", email };
}

function RequesterAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs";

  return (
    <span
      className={`flex ${sizeClass} flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-[#dbeafe] font-bold text-[#1d4ed8] dark:border-slate-600 dark:bg-[#60a5fa]/20 dark:text-[#93c5fd]`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function escapeODataValue(value: string) {
  return value.replace(/'/g, "''");
}

function ApprovalInfoModal({ ticket, onClose }: { ticket: UnblockMaterialTicketRead; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const steps = [
    { title: "Review", person: ticket.Review, date: ticket.Reviewdate, comment: ticket.ReviewerComment },
    { title: "Approval", person: ticket.Approvedby, date: ticket.Approveddate, comment: ticket.ApproverComment },
    { title: "Eksekusi", person: ticket.Executeby, date: ticket.Executecompletiondate, comment: ticket.ExecutorComment },
  ];

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Riwayat persetujuan ticket"
      onClick={onClose}
    >
      <div
        className="animate-card-in w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#131a23]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Riwayat persetujuan
            </p>
            <p className="font-mono text-lg font-extrabold tabular-nums text-[#2563eb] dark:text-[#60a5fa]">
              {ticket.Title || `ID ${ticket.ID}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={ticket.Status} />
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800"
              type="button"
              aria-label="Tutup"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          <ol className="relative space-y-5 border-l-2 border-slate-200 pl-5 dark:border-slate-700">
            {steps.map((step) => {
              const isDone = Boolean(step.person?.trim() || step.date);

              return (
                <li key={step.title} className="relative">
                  <span
                    className={`absolute -left-[27px] top-0.5 h-4 w-4 rounded-full border-2 ${
                      isDone
                        ? "border-[#2563eb] bg-[#2563eb] dark:border-[#60a5fa] dark:bg-[#60a5fa]"
                        : "border-slate-300 bg-white dark:border-slate-600 dark:bg-[#131a23]"
                    }`}
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {step.title}
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      isDone ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {step.person?.trim() || "Belum diproses"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{step.date ? formatDate(step.date) : "-"}</p>
                  {step.comment?.trim() ? (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                      &ldquo;{step.comment.trim()}&rdquo;
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button
            className="min-h-[40px] rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white transition-all hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 dark:hover:bg-[#1d4ed8]"
            type="button"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<UnblockMaterialTicketRead[] | null>(null);
  const [searchNotice, setSearchNotice] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [hasMoreTickets, setHasMoreTickets] = useState(false);
  const [isLoadingMoreTickets, setIsLoadingMoreTickets] = useState(false);
  const [tickets, setTickets] = useState<UnblockMaterialTicketRead[]>([]);
  const [materials, setMaterials] = useState<UnblockMaterialRead[]>([]);
  const [materialIdIndex, setMaterialIdIndex] = useState<Record<string, number[]>>({});
  const [themeMode, setThemeMode] = useState<"light" | "dark">(getInitialThemeMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");

    try {
      localStorage.setItem(themeStorageKey, themeMode);
    } catch {
      // localStorage bisa diblokir host — cukup untuk sesi ini
    }
  }, [themeMode]);
  const [selectedTicketNo, setSelectedTicketNo] = useState("");
  const [ticketPage, setTicketPage] = useState(1);
  const [materialPage, setMaterialPage] = useState(1);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [childLoadState, setChildLoadState] = useState<ChildLoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [childErrorMessage, setChildErrorMessage] = useState("");

  const loadSharePointData = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const [ticketResult, materialIndexRows] = await Promise.all([
        withPowerAppsTimeout(
          UnblockMaterialTicketService.getAll({
            select: ticketColumns,
            top: ticketBatchSize,
            // ID desc = urutan pembuatan terbaru dulu, dan bisa dipaging aman
            // dengan keyset `ID lt <terkecil>` (kolom ID selalu indexed).
            orderBy: ["ID desc"],
          }),
        ),
        fetchAllMaterialIndexRows(),
      ]);

      // PENTING: getAll TIDAK melempar exception saat gagal — success wajib dicek.
      if (!ticketResult.success) {
        throw new Error(`Gagal membaca list ticket: ${describeOperationError(ticketResult.error)}`);
      }

      const nextTickets = ticketResult.data ?? [];
      const nextIndex = materialIndexRows.reduce<Record<string, number[]>>((summary, materialRow) => {
        const key = normalize(materialRow.IDTICKET);

        if (key && typeof materialRow.ID === "number") {
          (summary[key] ??= []).push(materialRow.ID);
        }

        return summary;
      }, {});

      console.info(
        `Index Unblock Material: ${materialIndexRows.length} baris, ${Object.keys(nextIndex).length} ticket unik.`,
      );

      setTickets(nextTickets);
      setMaterialIdIndex(nextIndex);
      setHasMoreTickets(nextTickets.length === ticketBatchSize);
      setSearchResults(null);
      setSearchNotice("");
      setStatusFilter(null);
      setTicketPage(1);
      setSelectedTicketNo((currentTicketNo) => currentTicketNo || getTicketNo(nextTickets[0] ?? {}));
      setLoadState("success");
    } catch (error) {
      setLoadState("error");
      setErrorMessage(getPowerAppsErrorMessage(error, "Gagal load SharePoint list"));
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadSharePointData();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadSharePointData]);

  const materialCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const [key, ids] of Object.entries(materialIdIndex)) {
      counts[key] = ids.length;
    }

    return counts;
  }, [materialIdIndex]);

  const totalIndexedMaterials = useMemo(
    () => Object.values(materialIdIndex).reduce((sum, ids) => sum + ids.length, 0),
    [materialIdIndex],
  );

  const loadMoreTickets = useCallback(async () => {
    if (isLoadingMoreTickets || tickets.length === 0) {
      return;
    }

    const lastId = tickets.reduce<number>(
      (smallest, ticketRow) =>
        typeof ticketRow.ID === "number" && ticketRow.ID < smallest ? ticketRow.ID : smallest,
      Number.MAX_SAFE_INTEGER,
    );

    if (lastId === Number.MAX_SAFE_INTEGER) {
      setHasMoreTickets(false);
      return;
    }

    setIsLoadingMoreTickets(true);

    try {
      const result = await withPowerAppsTimeout(
        UnblockMaterialTicketService.getAll({
          select: ticketColumns,
          filter: `ID lt ${lastId}`,
          top: ticketBatchSize,
          orderBy: ["ID desc"],
        }),
      );

      if (!result.success) {
        throw new Error(describeOperationError(result.error));
      }

      const batch = result.data ?? [];
      setTickets((currentTickets) => [...currentTickets, ...batch]);
      setHasMoreTickets(batch.length === ticketBatchSize);
    } catch (error) {
      setErrorMessage(getPowerAppsErrorMessage(error, "Gagal memuat ticket berikutnya"));
    } finally {
      setIsLoadingMoreTickets(false);
    }
  }, [isLoadingMoreTickets, tickets]);

  const runTicketSearch = useCallback(
    async (rawNeedle: string, status: string | null) => {
      const needle = rawNeedle.trim();

      if (!needle && !status) {
        setSearchResults(null);
        setSearchNotice("");
        setTicketPage(1);
        return;
      }

      setIsSearching(true);
      setSearchNotice("");

      try {
        // Query server-side gabungan: teks (Title/RequestBy + material) dan/atau
        // filter status — menjangkau SELURUH list, bukan hanya batch termuat.
        const escaped = escapeODataValue(needle);
        const notices: string[] = [];

        const filterParts: string[] = [];

        if (needle) {
          filterParts.push(`(substringof('${escaped}', Title) or substringof('${escaped}', RequestBy))`);
        }

        if (status) {
          filterParts.push(`Status eq '${escapeODataValue(status)}'`);
        }

        const [ticketResult, materialResult] = await Promise.all([
          withPowerAppsTimeout(
            UnblockMaterialTicketService.getAll({
              select: ticketColumns,
              filter: filterParts.join(" and "),
              top: searchResultLimit,
              orderBy: ["ID desc"],
            }),
          ),
          needle
            ? withPowerAppsTimeout(
                UnblockMaterialService.getAll({
                  select: ["ID", "IDTICKET", "MaterialCode"],
                  filter: `substringof('${escaped}', MaterialCode) or substringof('${escaped}', MaterialDescription)`,
                  top: 1000,
                  orderBy: ["ID desc"],
                }),
              )
            : Promise.resolve(null),
        ]);

        // 1. Ticket yang cocok langsung (no ticket / requester / status).
        let directRows: UnblockMaterialTicketRead[] = [];

        if (ticketResult.success) {
          directRows = ticketResult.data ?? [];
        } else {
          console.info(`Pencarian ticket server gagal (${describeOperationError(ticketResult.error)}) — fallback lokal.`);
          const localNeedle = normalize(needle);
          directRows = tickets.filter((ticketRow) => {
            const matchesNeedle =
              !localNeedle ||
              [getTicketNo(ticketRow), ticketRow.Status, ticketRow.RequestBy, ticketRow.Review, ticketRow.Approvedby, ticketRow.Executeby]
                .map(normalize)
                .some((value) => value.includes(localNeedle));
            const matchesStatus = !status || statusMatchesFilter(ticketRow.Status, status);
            return matchesNeedle && matchesStatus;
          });
          notices.push(`Query server gagal — hasil hanya dari ${tickets.length} ticket yang sudah dimuat.`);
        }

        // 2. Ticket yang MENGANDUNG material yang cocok (reverse lookup IDTICKET).
        let materialTicketRows: UnblockMaterialTicketRead[] = [];

        if (materialResult && materialResult.success) {
          const materialRows = materialResult.data ?? [];
          const rawTicketNos = new Map<string, string>();

          for (const materialRow of materialRows) {
            const key = normalize(materialRow.IDTICKET);

            if (key && !rawTicketNos.has(key)) {
              rawTicketNos.set(key, String(materialRow.IDTICKET ?? "").trim());
            }
          }

          if (rawTicketNos.size > 0) {
            notices.push(`${rawTicketNos.size} ticket mengandung material cocok.`);

            // Pakai baris ticket yang sudah ada di memori dulu.
            const resolved = new Map<string, UnblockMaterialTicketRead>();

            for (const ticketRow of [...tickets, ...directRows]) {
              const key = normalize(getTicketNo(ticketRow));

              if (rawTicketNos.has(key) && !resolved.has(key)) {
                resolved.set(key, ticketRow);
              }
            }

            // Sisanya diambil dari server berdasarkan Title (nilai IDTICKET).
            const unresolvedTitles = [...rawTicketNos.entries()]
              .filter(([key]) => !resolved.has(key))
              .map(([, rawTitle]) => rawTitle)
              .filter(Boolean);

            if (unresolvedTitles.length > 0) {
              try {
                for (const ticketRow of await fetchTicketsByTitles(unresolvedTitles)) {
                  const key = normalize(getTicketNo(ticketRow));

                  if (!resolved.has(key)) {
                    resolved.set(key, ticketRow);
                  }
                }
              } catch (err) {
                console.info("Resolve ticket dari material gagal:", err);
                notices.push("Sebagian ticket pemilik material tidak bisa diambil dari server.");
              }
            }

            materialTicketRows = [...resolved.values()];
          }

          if (materialRows.length === 1000) {
            notices.push("Hasil material dibatasi 1000 baris — persempit kata kunci.");
          }
        } else if (materialResult && !materialResult.success) {
          console.info(`Pencarian material server gagal (${describeOperationError(materialResult.error)}).`);
          notices.push("Pencarian di kolom material gagal — hasil hanya dari pencarian ticket.");
        }

        // Gabungkan + dedupe (ticket cocok langsung didahulukan), urut terbaru.
        // Filter status juga diterapkan lokal — ticket hasil reverse lookup
        // material belum tentu lolos filter status server.
        const merged = new Map<string, UnblockMaterialTicketRead>();

        for (const ticketRow of [...directRows, ...materialTicketRows]) {
          if (status && !statusMatchesFilter(ticketRow.Status, status)) {
            continue;
          }

          const key = normalize(getTicketNo(ticketRow)) || `id-${ticketRow.ID}`;

          if (!merged.has(key)) {
            merged.set(key, ticketRow);
          }
        }

        const mergedRows = [...merged.values()].sort((a, b) => (b.ID ?? 0) - (a.ID ?? 0));

        if (directRows.length === searchResultLimit) {
          notices.push(`Hasil ticket dibatasi ${searchResultLimit} — persempit kata kunci.`);
        }

        setSearchResults(mergedRows);
        setSearchNotice(notices.join(" · "));
        setTicketPage(1);
      } catch (error) {
        setSearchResults([]);
        setSearchNotice(getPowerAppsErrorMessage(error, "Pencarian gagal"));
      } finally {
        setIsSearching(false);
      }
    },
    [tickets],
  );

  const displayedTickets = searchResults ?? tickets;
  const isSearchMode = searchResults !== null;

  const totalTicketPages = Math.max(1, Math.ceil(displayedTickets.length / ticketPageSize));
  const activeTicketPage = Math.min(ticketPage, totalTicketPages);
  const pagedTickets = displayedTickets.slice((activeTicketPage - 1) * ticketPageSize, activeTicketPage * ticketPageSize);

  const selectedTicket = useMemo(
    () =>
      tickets.find((ticketRow) => getTicketNo(ticketRow) === selectedTicketNo) ??
      (searchResults ?? []).find((ticketRow) => getTicketNo(ticketRow) === selectedTicketNo) ??
      displayedTickets.find((ticketRow) => Boolean(getTicketNo(ticketRow))),
    [displayedTickets, searchResults, selectedTicketNo, tickets],
  );

  const activeTicketNo = getTicketNo(selectedTicket ?? {});
  const selectedRequester = selectedTicket ? getRequesterInfo(selectedTicket) : null;

  const selectedMaterials = useMemo(() => {
    if (!activeTicketNo) {
      return [];
    }

    return materials.filter((materialRow) => normalize(materialRow.IDTICKET) === normalize(activeTicketNo));
  }, [activeTicketNo, materials]);

  const isLoading = loadState === "loading";
  const isChildLoading = childLoadState === "loading";
  const totalMaterialPages = Math.max(1, Math.ceil(selectedMaterials.length / materialPageSize));
  const activeMaterialPage = Math.min(materialPage, totalMaterialPages);
  const pagedMaterials = selectedMaterials.slice((activeMaterialPage - 1) * materialPageSize, activeMaterialPage * materialPageSize);

  const loadMaterialsForTicket = useCallback(
    async (ticketNo: string) => {
      const trimmedTicketNo = ticketNo.trim();

      if (!trimmedTicketNo) {
        setMaterials([]);
        setChildLoadState("idle");
        setChildErrorMessage("");
        return;
      }

      setChildLoadState("loading");
      setChildErrorMessage("");

      try {
        // Daftar ID child menurut index lengkap — sumber kebenaran yang sama
        // dengan badge jumlah material.
        const expectedIds = materialIdIndex[normalize(trimmedTicketNo)] ?? [];

        // Jalur cepat: filter server-side (exact match).
        let rows: UnblockMaterialRead[] = [];
        const filteredResult = await withPowerAppsTimeout(
          UnblockMaterialService.getAll({
            select: materialColumns,
            filter: `IDTICKET eq '${escapeODataValue(trimmedTicketNo)}'`,
            top: 2000,
            orderBy: ["ID asc"],
          }),
        );

        if (filteredResult.success) {
          rows = filteredResult.data ?? [];
        } else {
          // Jangan diam-diam kosong: catat, lalu ambil semua lewat ID.
          console.info(
            `Filter IDTICKET gagal (${describeOperationError(filteredResult.error)}) — mengambil semua child per ID.`,
          );
        }

        // Ambil child yang lolos dari filter exact match (mis. IDTICKET dengan
        // spasi/format berbeda) per ID — supaya tabel selalu selengkap badge.
        const fetchedIds = new Set(rows.map((materialRow) => materialRow.ID));
        const missingIds = expectedIds.filter((id) => !fetchedIds.has(id));

        if (missingIds.length > 0) {
          console.info(
            `Ticket '${trimmedTicketNo}': ${expectedIds.length} child di index, ${rows.length} dari filter, ${missingIds.length} diambil ulang per ID.`,
          );
          rows = [...rows, ...(await fetchMaterialsByIds(missingIds))];
        }

        rows.sort((a, b) => (a.ID ?? 0) - (b.ID ?? 0));
        setMaterials(rows);
        setChildLoadState("success");
      } catch (error) {
        setMaterials([]);
        setChildLoadState("error");
        setChildErrorMessage(getPowerAppsErrorMessage(error, "Material untuk ticket ini belum bisa dimuat"));
      }
    },
    [materialIdIndex],
  );

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadMaterialsForTicket(activeTicketNo);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [activeTicketNo, loadMaterialsForTicket]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f7f8fa] text-slate-800 transition-colors duration-300 dark:bg-[#0b1017] dark:text-slate-100">
      <header className="animate-rise flex-shrink-0 border-b border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-[#131a23]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white">
              <PackageCheck size={18} />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Supply Chain
              </p>
              <h1 className="text-base font-semibold leading-tight text-slate-900 dark:text-slate-100">
                Unblock Material
              </h1>
            </div>
            <div className="ml-2 hidden gap-2 lg:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <Ticket size={12} className="text-[#2563eb] dark:text-[#60a5fa]" />
                <span className="font-mono tabular-nums">{tickets.length}</span> ticket termuat
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <Boxes size={12} className="text-[#2563eb] dark:text-[#60a5fa]" />
                <span className="font-mono tabular-nums">{totalIndexedMaterials}</span> material terindeks
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all duration-150 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800"
              type="button"
              aria-label={themeMode === "light" ? "Ganti ke mode gelap" : "Ganti ke mode terang"}
              onClick={() => setThemeMode((mode) => (mode === "light" ? "dark" : "light"))}
            >
              {themeMode === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#1d4ed8]"
              type="button"
              disabled={isLoading}
              onClick={() => void loadSharePointData()}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Refresh
            </button>
            <a
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
              href={SHAREPOINT_LISTS[1].url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              Buka List
            </a>
          </div>
        </div>
      </header>

      {loadState === "error" ? (
        <div className="animate-rise mx-auto mt-4 flex w-full max-w-7xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold">SharePoint data belum bisa dibaca.</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      ) : null}

      <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-4 overflow-hidden px-4 py-4 md:grid-cols-[390px_1fr] md:px-6">
        <section
          className="animate-rise flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-[#131a23]"
          style={{ animationDelay: "60ms" }}
        >
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Ticket size={18} className="text-[#2563eb] dark:text-[#60a5fa]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tickets</h2>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                {displayedTickets.length} {isSearchMode ? "hasil" : "tiket"}
              </span>
            </div>

            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void runTicketSearch(searchInput, statusFilter);
              }}
            >
              <label className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#3b82f6] dark:border-slate-700 dark:bg-slate-800/60">
                <Search size={16} className="text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Cari no ticket / requester / material..."
                />
              </label>
              <button
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#1d4ed8]"
                type="submit"
                disabled={isSearching}
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Cari"}
              </button>
              {isSearchMode ? (
                <button
                  className="flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setStatusFilter(null);
                    setSearchResults(null);
                    setSearchNotice("");
                    setTicketPage(1);
                  }}
                >
                  Reset
                </button>
              ) : null}
            </form>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((item) => {
                const isActiveFilter = statusFilter === item.value;

                return (
                  <button
                    key={item.value}
                    className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActiveFilter
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                    type="button"
                    disabled={isSearching}
                    onClick={() => {
                      const next = isActiveFilter ? null : item.value;
                      setStatusFilter(next);
                      void runTicketSearch(searchInput, next);
                    }}
                  >
                    <span className={`h-2 w-2 rounded-full ${statusDotClass[item.tone]}`} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {searchNotice ? (
              <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">{searchNotice}</p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f8fa] p-3 transition-colors duration-300 dark:bg-[#0f141b]">
            {isLoading && tickets.length === 0 ? (
              <TicketListSkeleton />
            ) : displayedTickets.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  <Inbox size={22} />
                </span>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {isSearchMode ? "Tidak ada ticket yang cocok" : "Belum ada ticket"}
                </p>
                <p className="max-w-[240px] text-xs text-slate-500 dark:text-slate-400">
                  {isSearchMode
                    ? "Coba kata kunci lain, atau tekan Reset untuk kembali ke daftar."
                    : "Tekan Refresh untuk memuat ulang data dari SharePoint."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pagedTickets.map((ticketRow, cardIndex) => {
                  const ticketNo = getTicketNo(ticketRow);
                  const isActive = ticketNo === activeTicketNo;
                  const childCount = materialCounts[normalize(ticketNo)] ?? 0;
                  const requester = getRequesterInfo(ticketRow);
                  const tone = getStatusTone(ticketRow.Status);

                  return (
                    <button
                      key={ticketRow.ID ?? ticketNo}
                      className={`animate-card-in group relative min-h-[76px] w-full overflow-hidden rounded-xl border bg-white p-3 pl-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-[0.99] dark:bg-slate-800/50 ${
                        isActive
                          ? "border-[#2563eb] ring-1 ring-[#3b82f6] dark:border-[#60a5fa]"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                      }`}
                      style={{ animationDelay: `${cardIndex * 45}ms` }}
                      type="button"
                      onClick={() => {
                        setSelectedTicketNo(ticketNo);
                        setMaterialPage(1);
                      }}
                    >
                      <span
                        className={`absolute inset-y-0 left-0 w-1 transition-all duration-150 group-hover:w-1.5 ${statusRailClass[tone]}`}
                        aria-hidden="true"
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <RequesterAvatar name={requester.name} />
                          <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-1.5">
                              <Hash size={14} className="text-[#2563eb] dark:text-[#60a5fa]" />
                              <span className="font-mono text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                                {ticketNo || `ID ${ticketRow.ID}`}
                              </span>
                            </div>
                            <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{requester.name}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(ticketRow.Created)}</p>
                          </div>
                        </div>
                        <ChevronRight
                          size={18}
                          className={`transition-transform duration-150 group-hover:translate-x-0.5 ${
                            isActive ? "text-[#2563eb] dark:text-[#60a5fa]" : "text-slate-400 dark:text-slate-500"
                          }`}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusPill status={ticketRow.Status} />
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                          <span className="font-mono tabular-nums">{childCount}</span> material
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {!isSearchMode && hasMoreTickets ? (
            <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-[#131a23]">
              <button
                className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#2563eb]/40 bg-white text-xs font-semibold text-[#2563eb] transition-all hover:bg-[#2563eb]/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#60a5fa]/30 dark:bg-transparent dark:text-[#60a5fa] dark:hover:bg-[#60a5fa]/10"
                type="button"
                disabled={isLoadingMoreTickets}
                onClick={() => void loadMoreTickets()}
              >
                {isLoadingMoreTickets ? <Loader2 size={14} className="animate-spin" /> : null}
                {isLoadingMoreTickets ? "Memuat..." : `Muat ${ticketBatchSize} ticket berikutnya (${tickets.length} termuat)`}
              </button>
            </div>
          ) : null}
          <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-[#131a23] dark:text-slate-300">
            <span className="font-mono tabular-nums">
              Page {activeTicketPage} / {totalTicketPages}
            </span>
            <div className="flex gap-2">
              <button
                className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                type="button"
                disabled={activeTicketPage <= 1}
                onClick={() => setTicketPage((page) => Math.max(1, page - 1))}
              >
                Prev
              </button>
              <button
                className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                type="button"
                disabled={activeTicketPage >= totalTicketPages}
                onClick={() => setTicketPage((page) => Math.min(totalTicketPages, page + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section
          className="animate-rise min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-[#131a23]"
          style={{ animationDelay: "120ms" }}
        >
          {selectedTicket ? (
            <div key={activeTicketNo || selectedTicket.ID} className="animate-detail-in flex h-full flex-col">
              <div className="px-4 pb-1 pt-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Ticket
                    </p>
                    <p className="font-mono text-xl font-extrabold tabular-nums text-[#2563eb] dark:text-[#60a5fa]">
                      {activeTicketNo || `ID ${selectedTicket.ID}`}
                    </p>
                    <h2 className="mt-2 flex items-center gap-2.5 text-lg font-extrabold text-slate-800 dark:text-slate-100">
                      <RequesterAvatar name={selectedRequester?.name ?? ""} size="md" />
                      {selectedRequester?.name || "Unblock Material Request"}
                    </h2>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <StatusPill status={selectedTicket.Status} />
                    <button
                      className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] active:scale-95 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                      type="button"
                      onClick={() => setIsInfoOpen(true)}
                    >
                      <Info size={14} className="text-[#2563eb] dark:text-[#60a5fa]" />
                      Info
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <UserRound size={14} className="text-[#2563eb] dark:text-[#60a5fa]" />
                    {selectedRequester?.email || selectedTicket.RequestBy || "-"}
                  </span>
                  <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <FileText size={14} className="text-[#2563eb] dark:text-[#60a5fa]" />
                    {selectedTicket.Review || "-"}
                  </span>
                  <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <CalendarDays size={14} className="text-[#2563eb] dark:text-[#60a5fa]" />
                    {formatDate(selectedTicket.Created)}
                  </span>
                </div>

                {/* Perforasi slip — pembatas manifest (signature) */}
                <div className="perforation" aria-hidden="true" />
              </div>

              <div className="flex min-h-0 flex-1 flex-col p-4 pt-1">
                <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <Boxes size={18} className="text-[#2563eb] dark:text-[#60a5fa]" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Unblock Material
                    </h3>
                  </div>
                  <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    <span className="font-mono tabular-nums">
                      {materialCounts[normalize(activeTicketNo)] ?? selectedMaterials.length}
                    </span>{" "}
                    material
                  </span>
                </div>
                {childLoadState === "error" ? (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{childErrorMessage}</span>
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="h-full overflow-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-[#eff6ff] dark:bg-slate-800">
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Material</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Description</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Plant</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {isChildLoading ? (
                          <MaterialRowsSkeleton />
                        ) : pagedMaterials.length > 0 ? (
                          pagedMaterials.map((materialRow, rowIndex) => (
                            <tr
                              key={materialRow.ID ?? materialRow.MaterialCode}
                              className="animate-row-in transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30"
                              style={{ animationDelay: `${rowIndex * 30}ms` }}
                            >
                              <td className="px-3 py-2 font-mono text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                                {materialRow.MaterialCode || materialRow.Title || "-"}
                              </td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                                {materialRow.MaterialDescription || materialRow.NotesofUnblocking || "-"}
                              </td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                                <span className="inline-flex items-center gap-1.5">
                                  <Factory size={14} className="text-slate-400 dark:text-slate-500" />
                                  {materialRow.PlantSite || "-"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                {(materialRow.Quantity ?? 0).toLocaleString("en-US")}{" "}
                                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{materialRow.UOM || ""}</span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-3 py-10 text-center" colSpan={4}>
                              <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                <Inbox size={20} />
                              </span>
                              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Tidak ada material di ticket ini</p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Tidak ditemukan baris dengan IDTICKET yang cocok di list Unblock Material.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3 flex flex-shrink-0 items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="font-mono tabular-nums">
                    Page {activeMaterialPage} / {totalMaterialPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                      type="button"
                      disabled={activeMaterialPage <= 1}
                      onClick={() => setMaterialPage((page) => Math.max(1, page - 1))}
                    >
                      Prev
                    </button>
                    <button
                      className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                      type="button"
                      disabled={activeMaterialPage >= totalMaterialPages}
                      onClick={() => setMaterialPage((page) => Math.min(totalMaterialPages, page + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <PackageCheck size={18} />
              </span>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {isLoading ? "Memuat ticket..." : "Pilih ticket untuk melihat material"}
              </p>
              {!isLoading ? (
                <p className="max-w-[260px] text-xs text-slate-500 dark:text-slate-400">
                  Klik salah satu ticket di panel kiri — detail dan daftar materialnya tampil di sini.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </main>

      {isInfoOpen && selectedTicket ? (
        <ApprovalInfoModal ticket={selectedTicket} onClose={() => setIsInfoOpen(false)} />
      ) : null}
    </div>
  );
}

export default App;
