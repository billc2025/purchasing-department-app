"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

const field = "mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm";
const statuses = [
  "draft",
  "exception_pending",
  "unassigned",
  "assigned",
  "in_review",
  "waiting_for_requester",
  "approved_to_purchase",
  "purchasing",
  "partially_fulfilled",
  "purchased",
  "in_transit",
  "ready_for_reception",
  "received",
  "receipt_issue_reported",
  "cancellation_requested",
  "completed",
  "rejected",
  "cancelled",
] as const;

type Filters = {
  from: string;
  to: string;
  dateType:
    | "created"
    | "required"
    | "assigned"
    | "purchased"
    | "received"
    | "confirmed"
    | "completed";
  requesterId: string;
  departmentId: string;
  costCenter: string;
  agentId: string;
  categoryId: string;
  status: string;
  locationId: string;
  assignment: "all" | "assigned" | "unassigned";
  exception: "all" | "has_exception" | "none";
  timeliness: "all" | "on_time" | "late" | "overdue";
  minEstimated: string;
  maxEstimated: string;
  minActual: string;
  maxActual: string;
};

const initialFilters: Filters = {
  from: "",
  to: "",
  dateType: "created",
  requesterId: "",
  departmentId: "",
  costCenter: "",
  agentId: "",
  categoryId: "",
  status: "",
  locationId: "",
  assignment: "all",
  exception: "all",
  timeliness: "all",
  minEstimated: "",
  maxEstimated: "",
  minActual: "",
  maxActual: "",
};

function dateValue(value: string, end = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  return date.getTime();
}

function moneyMinor(value: string) {
  if (!value.trim()) return undefined;
  const result = Math.round(Number(value) * 100);
  return Number.isSafeInteger(result) ? result : undefined;
}

function duration(value: number | null, language: "en" | "es") {
  if (value === null) return "—";
  const hours = value / 3_600_000;
  if (hours < 24)
    return `${hours.toFixed(1)} ${language === "es" ? "h" : "hr"}`;
  return `${(hours / 24).toFixed(1)} ${language === "es" ? "días" : "days"}`;
}

export function ReportsDashboard() {
  const { language, formatCurrency, formatDate, statusLabel } = useLanguage();
  const c = {
    en: {
      title: "Administrative reports",
      subtitle:
        "Authoritative operational and financial reporting. Choose which date drives the report.",
      filters: "Report filters",
      dateType: "Date used",
      from: "From",
      to: "To",
      requester: "Requester",
      department: "Department / cost center",
      costCenter: "Cost center contains",
      agent: "Purchasing agent",
      category: "Category",
      status: "Status",
      location: "Location",
      assignment: "Assignment",
      exception: "Exception",
      timeliness: "Timeliness",
      minEstimated: "Minimum estimated cost",
      maxEstimated: "Maximum estimated cost",
      minActual: "Minimum actual cost",
      maxActual: "Maximum actual cost",
      all: "All",
      assigned: "Assigned",
      assignedDate: "Assignment date",
      myProtected: "My protected account",
      unassigned: "Unassigned",
      hasException: "Has exception",
      none: "None",
      onTime: "On time",
      late: "Late request",
      overdue: "Overdue",
      reset: "Reset filters",
      detailCsv: "Export detail CSV",
      summaryCsv: "Export summary CSV",
      loading: "Loading report…",
      noRows: "No orders match these filters.",
      total: "Total orders",
      estimated: "Estimated total",
      actual: "Actual total",
      variance: "Variance",
      onTimeRate: "On-time rate",
      receiptRate: "Receipt completeness",
      overdueOrders: "Overdue",
      exceptions: "Exceptions",
      partial: "Partially fulfilled",
      substitutions: "Substitutions",
      unavailable: "Unavailable items",
      cancellations: "Cancellations",
      refund: "Recorded refunds",
      nonRefundable: "Non-refundable cost",
      assignmentTime: "Average assignment time",
      processingTime: "Average processing time",
      completionTime: "Average completion time",
      confirmationTime: "Average confirmation time",
      breakdowns: "Breakdowns",
      byCategory: "Orders by category",
      byDepartment: "Orders by department",
      byRequester: "Orders by requester",
      workload: "Active agent workload",
      vendors: "Vendor spending",
      details: "Filtered order details",
      order: "Order",
      dates: "Operational dates",
      costs: "Costs",
      exportFailed: "The export could not be generated.",
      rows: "rows",
      created: "Creation date",
      required: "Needed-by date",
      purchased: "First purchase date",
      received: "Final receipt date",
      confirmed: "Confirmation date",
      completed: "Completion date",
    },
    es: {
      title: "Reportes administrativos",
      subtitle:
        "Reportes operativos y financieros autoritativos. Elija qué fecha controla el reporte.",
      filters: "Filtros del reporte",
      dateType: "Fecha utilizada",
      from: "Desde",
      to: "Hasta",
      requester: "Solicitante",
      department: "Departamento / centro de costo",
      costCenter: "Centro de costo contiene",
      agent: "Agente de compras",
      category: "Categoría",
      status: "Estado",
      location: "Ubicación",
      assignment: "Asignación",
      exception: "Excepción",
      timeliness: "Puntualidad",
      minEstimated: "Costo estimado mínimo",
      maxEstimated: "Costo estimado máximo",
      minActual: "Costo real mínimo",
      maxActual: "Costo real máximo",
      all: "Todos",
      assigned: "Asignados",
      assignedDate: "Fecha de asignación",
      myProtected: "Mi cuenta protegida",
      unassigned: "Sin asignar",
      hasException: "Con excepción",
      none: "Ninguna",
      onTime: "A tiempo",
      late: "Solicitud tardía",
      overdue: "Vencidos",
      reset: "Restablecer filtros",
      detailCsv: "Exportar detalle CSV",
      summaryCsv: "Exportar resumen CSV",
      loading: "Cargando reporte…",
      noRows: "Ningún pedido coincide con estos filtros.",
      total: "Total de pedidos",
      estimated: "Total estimado",
      actual: "Total real",
      variance: "Variación",
      onTimeRate: "Porcentaje a tiempo",
      receiptRate: "Comprobantes completos",
      overdueOrders: "Vencidos",
      exceptions: "Excepciones",
      partial: "Cumplimiento parcial",
      substitutions: "Sustituciones",
      unavailable: "Artículos no disponibles",
      cancellations: "Cancelaciones",
      refund: "Reembolsos registrados",
      nonRefundable: "Costo no reembolsable",
      assignmentTime: "Tiempo promedio de asignación",
      processingTime: "Tiempo promedio de compra",
      completionTime: "Tiempo promedio de finalización",
      confirmationTime: "Tiempo promedio de confirmación",
      breakdowns: "Desgloses",
      byCategory: "Pedidos por categoría",
      byDepartment: "Pedidos por departamento",
      byRequester: "Pedidos por solicitante",
      workload: "Carga activa por agente",
      vendors: "Gasto por proveedor",
      details: "Detalle de pedidos filtrados",
      order: "Pedido",
      dates: "Fechas operativas",
      costs: "Costos",
      exportFailed: "No se pudo generar la exportación.",
      rows: "filas",
      created: "Fecha de creación",
      required: "Fecha requerida",
      purchased: "Fecha de primera compra",
      received: "Fecha de recepción final",
      confirmed: "Fecha de confirmación",
      completed: "Fecha de finalización",
    },
  }[language];
  const [filters, setFilters] = useState(initialFilters);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const options = useQuery(api.reports.options);
  const args = {
    from: dateValue(filters.from),
    to: dateValue(filters.to, true),
    dateType: filters.dateType,
    requesterId: filters.requesterId
      ? (filters.requesterId as never)
      : undefined,
    departmentId: filters.departmentId
      ? (filters.departmentId as never)
      : undefined,
    costCenter: filters.costCenter || undefined,
    agentId: filters.agentId ? (filters.agentId as never) : undefined,
    categoryId: filters.categoryId ? (filters.categoryId as never) : undefined,
    status: filters.status ? (filters.status as never) : undefined,
    locationId: filters.locationId ? (filters.locationId as never) : undefined,
    assignment: filters.assignment,
    exception: filters.exception,
    timeliness: filters.timeliness,
    minEstimatedMinor: moneyMinor(filters.minEstimated),
    maxEstimatedMinor: moneyMinor(filters.maxEstimated),
    minActualMinor: moneyMinor(filters.minActual),
    maxActualMinor: moneyMinor(filters.maxActual),
  };
  const report = useQuery(api.reports.dashboard, args);
  const exportCsv = useMutation(api.reports.exportCsv);

  async function download(kind: "detail" | "summary") {
    setExporting(true);
    setMessage("");
    try {
      const result = await exportCsv({ ...args, kind });
      const url = URL.createObjectURL(
        new Blob([result.csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `purchasing-${kind}-${new Date(result.generatedAt).toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`${result.rowCount} ${c.rows}`);
    } catch {
      setMessage(c.exportFailed);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold">{c.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p>
      </section>
      <details open className="rounded-2xl border bg-card p-5">
        <summary className="cursor-pointer font-semibold">{c.filters}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label={c.dateType}
            value={filters.dateType}
            set={(value) =>
              setFilters({ ...filters, dateType: value as Filters["dateType"] })
            }
            options={[
              { value: "created", label: c.created },
              { value: "required", label: c.required },
              { value: "assigned", label: c.assignedDate },
              { value: "purchased", label: c.purchased },
              { value: "received", label: c.received },
              { value: "confirmed", label: c.confirmed },
              { value: "completed", label: c.completed },
            ]}
          />
          <Input
            label={c.from}
            type="date"
            value={filters.from}
            set={(value) => setFilters({ ...filters, from: value })}
          />
          <Input
            label={c.to}
            type="date"
            value={filters.to}
            set={(value) => setFilters({ ...filters, to: value })}
          />
          <Select
            label={c.requester}
            value={filters.requesterId}
            set={(value) => setFilters({ ...filters, requesterId: value })}
            options={(options?.requesters ?? []).map((row) => ({
              value: row.id,
              label:
                row.name === "My protected account" ? c.myProtected : row.name,
            }))}
            all={c.all}
          />
          <Input
            label={c.costCenter}
            value={filters.costCenter}
            set={(value) => setFilters({ ...filters, costCenter: value })}
          />
          <Select
            label={c.department}
            value={filters.departmentId}
            set={(value) => setFilters({ ...filters, departmentId: value })}
            options={(options?.departments ?? []).map((row) => ({
              value: row.id,
              label: row.name,
            }))}
            all={c.all}
          />
          <Select
            label={c.agent}
            value={filters.agentId}
            set={(value) => setFilters({ ...filters, agentId: value })}
            options={(options?.agents ?? []).map((row) => ({
              value: row.id,
              label:
                row.name === "My protected account" ? c.myProtected : row.name,
            }))}
            all={c.all}
          />
          <Select
            label={c.category}
            value={filters.categoryId}
            set={(value) => setFilters({ ...filters, categoryId: value })}
            options={(options?.categories ?? []).map((row) => ({
              value: row.id,
              label: row.name,
            }))}
            all={c.all}
          />
          <Select
            label={c.status}
            value={filters.status}
            set={(value) => setFilters({ ...filters, status: value })}
            options={statuses.map((value) => ({
              value,
              label: statusLabel(value),
            }))}
            all={c.all}
          />
          <Select
            label={c.location}
            value={filters.locationId}
            set={(value) => setFilters({ ...filters, locationId: value })}
            options={(options?.locations ?? []).map((row) => ({
              value: row.id,
              label: row.name,
            }))}
            all={c.all}
          />
          <Select
            label={c.assignment}
            value={filters.assignment}
            set={(value) =>
              setFilters({
                ...filters,
                assignment: value as Filters["assignment"],
              })
            }
            options={[
              { value: "all", label: c.all },
              { value: "assigned", label: c.assigned },
              { value: "unassigned", label: c.unassigned },
            ]}
          />
          <Select
            label={c.exception}
            value={filters.exception}
            set={(value) =>
              setFilters({
                ...filters,
                exception: value as Filters["exception"],
              })
            }
            options={[
              { value: "all", label: c.all },
              { value: "has_exception", label: c.hasException },
              { value: "none", label: c.none },
            ]}
          />
          <Select
            label={c.timeliness}
            value={filters.timeliness}
            set={(value) =>
              setFilters({
                ...filters,
                timeliness: value as Filters["timeliness"],
              })
            }
            options={[
              { value: "all", label: c.all },
              { value: "on_time", label: c.onTime },
              { value: "late", label: c.late },
              { value: "overdue", label: c.overdue },
            ]}
          />
          <Input
            label={c.minEstimated}
            inputMode="decimal"
            value={filters.minEstimated}
            set={(value) => setFilters({ ...filters, minEstimated: value })}
          />
          <Input
            label={c.maxEstimated}
            inputMode="decimal"
            value={filters.maxEstimated}
            set={(value) => setFilters({ ...filters, maxEstimated: value })}
          />
          <Input
            label={c.minActual}
            inputMode="decimal"
            value={filters.minActual}
            set={(value) => setFilters({ ...filters, minActual: value })}
          />
          <Input
            label={c.maxActual}
            inputMode="decimal"
            value={filters.maxActual}
            set={(value) => setFilters({ ...filters, maxActual: value })}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setFilters(initialFilters)}>
            {c.reset}
          </Button>
          <Button disabled={exporting} onClick={() => void download("detail")}>
            {c.detailCsv}
          </Button>
          <Button
            disabled={exporting}
            variant="secondary"
            onClick={() => void download("summary")}
          >
            {c.summaryCsv}
          </Button>
        </div>
        {message && (
          <p className="mt-2 text-sm" role="status">
            {message}
          </p>
        )}
      </details>
      {report === undefined ? (
        <p>{c.loading}</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label={c.total}
              value={String(report.metrics.totalOrders)}
            />
            <Metric
              label={c.estimated}
              value={formatCurrency(report.metrics.estimatedTotalMinor, "USD")}
            />
            <Metric
              label={c.actual}
              value={formatCurrency(report.metrics.actualTotalMinor, "USD")}
            />
            <Metric
              label={c.variance}
              value={formatCurrency(report.metrics.varianceMinor, "USD")}
            />
            <Metric
              label={c.onTimeRate}
              value={
                report.metrics.onTimePercentage === null
                  ? "—"
                  : `${report.metrics.onTimePercentage}% (${report.metrics.onTimeDenominator})`
              }
            />
            <Metric
              label={c.receiptRate}
              value={
                report.metrics.receiptCompletenessPercentage === null
                  ? "—"
                  : `${report.metrics.receiptCompletenessPercentage}% (${report.metrics.receiptDenominator})`
              }
            />
            <Metric
              label={c.overdueOrders}
              value={String(report.metrics.overdueOrders)}
            />
            <Metric
              label={c.exceptions}
              value={String(report.metrics.exceptions)}
            />
            <Metric
              label={c.partial}
              value={String(report.metrics.partialFulfillment)}
            />
            <Metric
              label={c.substitutions}
              value={String(report.metrics.substitutions)}
            />
            <Metric
              label={c.unavailable}
              value={String(report.metrics.unavailableItems)}
            />
            <Metric
              label={c.cancellations}
              value={String(report.metrics.cancellations)}
            />
            <Metric
              label={c.assignmentTime}
              value={duration(report.metrics.averageAssignmentMs, language)}
            />
            <Metric
              label={c.processingTime}
              value={duration(report.metrics.averageProcessingMs, language)}
            />
            <Metric
              label={c.completionTime}
              value={duration(report.metrics.averageCompletionMs, language)}
            />
            <Metric
              label={c.confirmationTime}
              value={duration(report.metrics.averageConfirmationMs, language)}
            />
            <Metric
              label={c.refund}
              value={formatCurrency(report.metrics.refundedMinor, "USD")}
            />
            <Metric
              label={c.nonRefundable}
              value={formatCurrency(report.metrics.nonRefundableMinor, "USD")}
            />
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold">{c.breakdowns}</h3>
            <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              <Breakdown
                title={c.byCategory}
                rows={report.breakdowns.byCategory}
              />
              <Breakdown
                title={c.byDepartment}
                rows={report.breakdowns.byDepartment}
              />
              <Breakdown
                title={c.byRequester}
                rows={report.breakdowns.byRequester}
              />
              <Breakdown
                title={c.workload}
                rows={report.breakdowns.agentWorkload}
              />
              <Breakdown
                title={c.vendors}
                rows={report.breakdowns.vendorSpending.map((row) => ({
                  label: row.label,
                  value: formatCurrency(row.valueMinor, "USD"),
                }))}
              />
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold">{c.details}</h3>
            {report.rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{c.noRows}</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">{c.order}</th>
                      <th className="p-2">{c.requester}</th>
                      <th className="p-2">{c.agent}</th>
                      <th className="p-2">{c.status}</th>
                      <th className="p-2">{c.dates}</th>
                      <th className="p-2 text-right">{c.costs}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map(
                      (row: NonNullable<typeof report>["rows"][number]) => (
                        <tr key={row.id} className="border-b align-top">
                          <td className="p-2">
                            <a
                              className="font-medium underline"
                              href={`/app/orders/${row.id}`}
                            >
                              {row.orderNumber}
                            </a>
                            <span className="block text-xs text-muted-foreground">
                              {row.purpose}
                              <br />
                              {row.category} · {row.department}
                            </span>
                          </td>
                          <td className="p-2">{row.requester}</td>
                          <td className="p-2">{row.agent}</td>
                          <td className="p-2">{statusLabel(row.status)}</td>
                          <td className="p-2 text-xs">
                            {c.created}: {formatDate(row.createdAt)}
                            <br />
                            {c.required}: {formatDate(row.requiredAt)}
                            {row.completedAt ? (
                              <>
                                <br />
                                {c.completed}: {formatDate(row.completedAt)}
                              </>
                            ) : null}
                          </td>
                          <td className="p-2 text-right">
                            {formatCurrency(
                              row.estimatedAmountMinor,
                              row.currency,
                            )}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(
                                row.actualAmountMinor,
                                row.currency,
                              )}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </article>
  );
}
function Input({
  label,
  value,
  set,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  inputMode?: "decimal";
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        className={field}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );
}
function Select({
  label,
  value,
  set,
  options,
  all,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  all?: string;
}) {
  return (
    <label className="text-sm">
      {label}
      <select
        className={field}
        value={value}
        onChange={(event) => set(event.target.value)}
      >
        {all !== undefined && <option value="">{all}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number | string }>;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.length === 0 ? (
          <li className="text-muted-foreground">—</li>
        ) : (
          rows.slice(0, 10).map((row) => (
            <li key={row.label} className="flex justify-between gap-3">
              <span className="truncate">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
