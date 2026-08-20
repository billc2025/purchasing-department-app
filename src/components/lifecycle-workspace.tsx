"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

const field = "mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm";
const area =
  "mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm";

function localDateTimeNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function LifecycleWorkspace({ orderId }: { orderId: string }) {
  const { language, statusLabel, formatDate } = useLanguage();
  const c = {
    en: {
      title: "Receiving and confirmation",
      loading: "Loading receiving workflow…",
      receive: "Record item received",
      receiveHelp:
        "Record only the quantity physically received at this location.",
      qty: "Quantity received",
      outstanding: "Outstanding",
      date: "Received date and time",
      location: "Receiving location",
      notes: "Receiving notes",
      evidence: "Add optional delivery evidence",
      evidenceReady: "Evidence ready",
      saveReceipt: "Save receipt",
      confirmation: "Your confirmation is required",
      confirmationHelp: "Confirm the delivery or report exactly what is wrong.",
      outcome: "Delivery outcome",
      correct: "Everything was received correctly",
      missing: "Items are missing",
      incorrect: "Incorrect items were delivered",
      damaged: "Items arrived damaged",
      incomplete: "The order is incomplete",
      details: "Issue details",
      confirm: "Submit confirmation",
      override: "Privileged completion",
      overrideReason: "Required override reason",
      change: "Request a material change",
      changeHelp:
        "After assignment, approved changes preserve the original values and history.",
      newPurpose: "Requested purpose (optional)",
      newDate: "Requested needed-by date (optional)",
      reason: "Required reason",
      requestChange: "Submit change request",
      cancel: "Request cancellation",
      cancelHelp:
        "Purchased items will require a recorded financial outcome before approval.",
      requestCancel: "Submit cancellation request",
      decisions: "Pending approvals",
      approve: "Approve",
      reject: "Reject",
      late: "Late-request exception",
      budget: "Budget exception",
      changeRequest: "Material change request",
      cancellation: "Cancellation request",
      decisionReason: "Decision reason",
      outcomeFor: "Cancellation outcome for",
      returned: "Returned",
      refunded: "Refunded",
      retained: "Retained",
      nonRefundable: "Non-refundable",
      resume: "Resume issue resolution",
      resumeHelp:
        "Return the order to delivery handling after documenting the resolution plan.",
      saved: "Saved successfully.",
      failed: "The action could not be completed. Refresh and try again.",
      history: "Receiving history",
      noHistory: "No receiving events yet.",
    },
    es: {
      title: "Recepción y confirmación",
      loading: "Cargando el flujo de recepción…",
      receive: "Registrar artículo recibido",
      receiveHelp:
        "Registre solo la cantidad recibida físicamente en esta ubicación.",
      qty: "Cantidad recibida",
      outstanding: "Pendiente",
      date: "Fecha y hora de recepción",
      location: "Ubicación de recepción",
      notes: "Notas de recepción",
      evidence: "Agregar evidencia opcional de entrega",
      evidenceReady: "Evidencia lista",
      saveReceipt: "Guardar recepción",
      confirmation: "Se requiere su confirmación",
      confirmationHelp:
        "Confirme la entrega o indique exactamente qué salió mal.",
      outcome: "Resultado de la entrega",
      correct: "Todo se recibió correctamente",
      missing: "Faltan artículos",
      incorrect: "Se entregaron artículos incorrectos",
      damaged: "Los artículos llegaron dañados",
      incomplete: "El pedido está incompleto",
      details: "Detalles del problema",
      confirm: "Enviar confirmación",
      override: "Finalización privilegiada",
      overrideReason: "Motivo obligatorio de la anulación",
      change: "Solicitar un cambio material",
      changeHelp:
        "Después de la asignación, los cambios aprobados conservan los valores originales y el historial.",
      newPurpose: "Nuevo propósito solicitado (opcional)",
      newDate: "Nueva fecha requerida (opcional)",
      reason: "Motivo obligatorio",
      requestChange: "Enviar solicitud de cambio",
      cancel: "Solicitar cancelación",
      cancelHelp:
        "Los artículos comprados requieren un resultado financiero antes de aprobar.",
      requestCancel: "Enviar solicitud de cancelación",
      decisions: "Aprobaciones pendientes",
      approve: "Aprobar",
      reject: "Rechazar",
      late: "Excepción por solicitud tardía",
      budget: "Excepción de presupuesto",
      changeRequest: "Solicitud de cambio material",
      cancellation: "Solicitud de cancelación",
      decisionReason: "Motivo de la decisión",
      outcomeFor: "Resultado de cancelación para",
      returned: "Devuelto",
      refunded: "Reembolsado",
      retained: "Retenido",
      nonRefundable: "No reembolsable",
      resume: "Reanudar resolución del problema",
      resumeHelp:
        "Devuelva el pedido al manejo de entrega después de documentar el plan.",
      saved: "Guardado correctamente.",
      failed:
        "No se pudo completar la acción. Actualice e inténtelo nuevamente.",
      history: "Historial de recepción",
      noHistory: "Aún no hay recepciones.",
    },
  }[language];

  const workspace = useQuery(api.lifecycle.workspace, {
    orderId: orderId as never,
  });
  const recordReceipt = useMutation(api.lifecycle.recordReceipt);
  const generateUploadUrl = useMutation(
    api.lifecycle.generateEvidenceUploadUrl,
  );
  const confirmReceipt = useMutation(api.lifecycle.confirmReceipt);
  const resumeIssue = useMutation(api.lifecycle.resumeIssue);
  const requestChange = useMutation(api.lifecycle.requestChange);
  const decideChange = useMutation(api.lifecycle.decideChange);
  const decideLateException = useMutation(api.lifecycle.decideLateException);
  const decideBudgetException = useMutation(
    api.lifecycle.decideBudgetException,
  );
  const requestCancellation = useMutation(api.lifecycle.requestCancellation);
  const decideCancellation = useMutation(api.lifecycle.decideCancellation);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [receiveItemId, setReceiveItemId] = useState<string>();
  const [receipt, setReceipt] = useState({
    quantity: "",
    receivedAt: localDateTimeNow(),
    locationId: "",
    notes: "",
  });
  const [evidence, setEvidence] = useState<{
    storageId: string;
    fileName: string;
  }>();
  const [confirmation, setConfirmation] = useState({
    outcome: "correct",
    details: "",
    overrideReason: "",
  });
  const [change, setChange] = useState({
    purpose: "",
    requiredAt: "",
    reason: "",
  });
  const [cancelReason, setCancelReason] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [resumeReason, setResumeReason] = useState("");
  const [cancelOutcomes, setCancelOutcomes] = useState<Record<string, string>>(
    {},
  );

  if (workspace === undefined)
    return <p className="mx-auto mt-6 max-w-4xl">{c.loading}</p>;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(c.saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.failed);
    } finally {
      setBusy(false);
    }
  }

  async function uploadEvidence(file: File) {
    await run(async () => {
      const url = await generateUploadUrl();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(c.failed);
      const result = (await response.json()) as { storageId: string };
      setEvidence({ storageId: result.storageId, fileName: file.name });
    });
  }

  const pendingChanges = workspace.changeRequests.filter(
    (request) => request.status === "pending",
  );
  const pendingCancellations = workspace.cancellationRequests.filter(
    (request) => request.status === "pending",
  );
  const pendingBudgets = workspace.exceptionRequests.filter(
    (request) => request.type === "budget" && request.status === "pending",
  );
  const purchasedItems = workspace.items.filter(
    (item) => (item.purchasedQuantity ?? 0) > 0,
  );

  return (
    <section className="mx-auto mt-6 max-w-4xl space-y-6">
      {(workspace.permissions.canReceive ||
        workspace.confirmationRequired ||
        workspace.permissions.canOverrideCompletion) && (
        <div className="rounded-2xl border bg-card p-5 sm:p-8">
          <h2 className="text-xl font-semibold">{c.title}</h2>
          {workspace.confirmationRequired && (
            <div className="mt-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              <h3 className="font-semibold">{c.confirmation}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.confirmationHelp}
              </p>
              <label className="mt-4 block text-sm">
                {c.outcome}
                <select
                  className={field}
                  value={confirmation.outcome}
                  onChange={(event) =>
                    setConfirmation({
                      ...confirmation,
                      outcome: event.target.value,
                    })
                  }
                >
                  <option value="correct">{c.correct}</option>
                  <option value="missing">{c.missing}</option>
                  <option value="incorrect">{c.incorrect}</option>
                  <option value="damaged">{c.damaged}</option>
                  <option value="incomplete">{c.incomplete}</option>
                </select>
              </label>
              {confirmation.outcome !== "correct" && (
                <label className="mt-3 block text-sm">
                  {c.details}
                  <textarea
                    className={area}
                    value={confirmation.details}
                    onChange={(event) =>
                      setConfirmation({
                        ...confirmation,
                        details: event.target.value,
                      })
                    }
                  />
                </label>
              )}
              <Button
                className="mt-3 h-11 w-full sm:w-auto"
                disabled={
                  busy ||
                  (confirmation.outcome !== "correct" &&
                    !confirmation.details.trim())
                }
                onClick={() =>
                  void run(() =>
                    confirmReceipt({
                      orderId: orderId as never,
                      outcome: confirmation.outcome as never,
                      details: confirmation.details || undefined,
                    }),
                  )
                }
              >
                {c.confirm}
              </Button>
            </div>
          )}
          {workspace.permissions.canOverrideCompletion &&
            workspace.order.status === "received" &&
            !workspace.confirmationRequired && (
              <div className="mt-4 rounded-xl border p-4">
                <h3 className="font-semibold">{c.override}</h3>
                <label className="mt-3 block text-sm">
                  {c.overrideReason}
                  <textarea
                    className={area}
                    value={confirmation.overrideReason}
                    onChange={(event) =>
                      setConfirmation({
                        ...confirmation,
                        overrideReason: event.target.value,
                      })
                    }
                  />
                </label>
                <Button
                  className="mt-3"
                  disabled={busy || !confirmation.overrideReason.trim()}
                  onClick={() =>
                    void run(() =>
                      confirmReceipt({
                        orderId: orderId as never,
                        outcome: "correct",
                        overrideReason: confirmation.overrideReason,
                      }),
                    )
                  }
                >
                  {c.confirm}
                </Button>
              </div>
            )}
          {workspace.permissions.canReceive &&
            [
              "purchasing",
              "purchased",
              "in_transit",
              "partially_fulfilled",
            ].includes(workspace.order.status) && (
              <div className="mt-5 space-y-4">
                {workspace.items
                  .filter(
                    (item) =>
                      [
                        "purchased",
                        "in_transit",
                        "substituted",
                        "partially_fulfilled",
                      ].includes(item.status) &&
                      (item.receivedQuantity ?? 0) <
                        (item.purchasedQuantity ?? 0),
                  )
                  .map((item) => {
                    const outstanding =
                      (item.purchasedQuantity ?? 0) -
                      (item.receivedQuantity ?? 0);
                    return (
                      <article key={item._id} className="rounded-xl border p-4">
                        <div className="flex justify-between gap-3">
                          <div>
                            <h3 className="font-medium">{item.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {c.outstanding}: {outstanding} {item.unit}
                            </p>
                          </div>
                          <span className="text-xs">
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        {receiveItemId !== item._id ? (
                          <Button
                            className="mt-3 h-11 w-full sm:w-auto"
                            onClick={() => {
                              setReceiveItemId(item._id);
                              setReceipt({
                                quantity: String(outstanding),
                                receivedAt: localDateTimeNow(),
                                locationId: String(workspace.order.locationId),
                                notes: "",
                              });
                            }}
                          >
                            {c.receive}
                          </Button>
                        ) : (
                          <div className="mt-4 rounded-xl bg-muted p-4">
                            <p className="text-sm">{c.receiveHelp}</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="text-sm">
                                {c.qty}
                                <input
                                  className={field}
                                  type="number"
                                  min="0"
                                  max={outstanding}
                                  step="any"
                                  value={receipt.quantity}
                                  onChange={(event) =>
                                    setReceipt({
                                      ...receipt,
                                      quantity: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="text-sm">
                                {c.date}
                                <input
                                  className={field}
                                  type="datetime-local"
                                  value={receipt.receivedAt}
                                  onChange={(event) =>
                                    setReceipt({
                                      ...receipt,
                                      receivedAt: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="text-sm">
                                {c.location}
                                <select
                                  className={field}
                                  value={receipt.locationId}
                                  onChange={(event) =>
                                    setReceipt({
                                      ...receipt,
                                      locationId: event.target.value,
                                    })
                                  }
                                >
                                  {workspace.locations.map((location) => (
                                    <option
                                      key={location.id}
                                      value={location.id}
                                    >
                                      {location.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-sm sm:col-span-2">
                                {c.notes}
                                <textarea
                                  className={area}
                                  value={receipt.notes}
                                  onChange={(event) =>
                                    setReceipt({
                                      ...receipt,
                                      notes: event.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <label className="mt-3 inline-flex cursor-pointer rounded-md border bg-background px-4 py-2 text-sm">
                              <input
                                className="sr-only"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) void uploadEvidence(file);
                                }}
                              />
                              {evidence
                                ? `${c.evidenceReady}: ${evidence.fileName}`
                                : c.evidence}
                            </label>
                            <div className="mt-3 flex gap-2">
                              <Button
                                disabled={
                                  busy ||
                                  Number(receipt.quantity) <= 0 ||
                                  !receipt.locationId
                                }
                                onClick={() =>
                                  void run(async () => {
                                    await recordReceipt({
                                      orderId: orderId as never,
                                      itemId: item._id,
                                      quantity: Number(receipt.quantity),
                                      receivedAt: new Date(
                                        receipt.receivedAt,
                                      ).getTime(),
                                      locationId: receipt.locationId as never,
                                      notes: receipt.notes || undefined,
                                      evidenceStorageId:
                                        evidence?.storageId as never,
                                      evidenceFileName: evidence?.fileName,
                                    });
                                    setReceiveItemId(undefined);
                                    setEvidence(undefined);
                                  })
                                }
                              >
                                {c.saveReceipt}
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => setReceiveItemId(undefined)}
                              >
                                Close
                              </Button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
              </div>
            )}
        </div>
      )}

      {workspace.permissions.canResumeIssue &&
        workspace.order.status === "receipt_issue_reported" && (
          <div className="rounded-2xl border bg-card p-5 sm:p-8">
            <h2 className="font-semibold">{c.resume}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.resumeHelp}</p>
            <textarea
              className={area}
              value={resumeReason}
              onChange={(event) => setResumeReason(event.target.value)}
            />
            <Button
              className="mt-3"
              disabled={busy || !resumeReason.trim()}
              onClick={() =>
                void run(() =>
                  resumeIssue({
                    orderId: orderId as never,
                    reason: resumeReason,
                  }),
                )
              }
            >
              {c.resume}
            </Button>
          </div>
        )}

      {workspace.permissions.canRequestChange && (
        <details className="rounded-2xl border bg-card p-5 sm:p-8">
          <summary className="cursor-pointer font-semibold">{c.change}</summary>
          <p className="mt-2 text-sm text-muted-foreground">{c.changeHelp}</p>
          <label className="mt-3 block text-sm">
            {c.newPurpose}
            <input
              className={field}
              value={change.purpose}
              onChange={(event) =>
                setChange({ ...change, purpose: event.target.value })
              }
            />
          </label>
          <label className="mt-3 block text-sm">
            {c.newDate}
            <input
              className={field}
              type="datetime-local"
              value={change.requiredAt}
              onChange={(event) =>
                setChange({ ...change, requiredAt: event.target.value })
              }
            />
          </label>
          <label className="mt-3 block text-sm">
            {c.reason}
            <textarea
              className={area}
              value={change.reason}
              onChange={(event) =>
                setChange({ ...change, reason: event.target.value })
              }
            />
          </label>
          <Button
            className="mt-3"
            disabled={
              busy ||
              !change.reason.trim() ||
              (!change.purpose.trim() && !change.requiredAt)
            }
            onClick={() =>
              void run(() =>
                requestChange({
                  orderId: orderId as never,
                  purpose: change.purpose || undefined,
                  requiredAt: change.requiredAt
                    ? new Date(change.requiredAt).getTime()
                    : undefined,
                  reason: change.reason,
                }),
              )
            }
          >
            {c.requestChange}
          </Button>
        </details>
      )}

      {workspace.permissions.canRequestCancellation && (
        <details className="rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-8">
          <summary className="cursor-pointer font-semibold text-red-900">
            {c.cancel}
          </summary>
          <p className="mt-2 text-sm text-red-800">{c.cancelHelp}</p>
          <label className="mt-3 block text-sm text-red-950">
            {c.reason}
            <textarea
              className={area}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </label>
          <Button
            className="mt-3"
            variant="destructive"
            disabled={busy || !cancelReason.trim()}
            onClick={() =>
              void run(() =>
                requestCancellation({
                  orderId: orderId as never,
                  reason: cancelReason,
                }),
              )
            }
          >
            {c.requestCancel}
          </Button>
        </details>
      )}

      {(workspace.permissions.canDecideChange ||
        workspace.permissions.canDecideException ||
        workspace.permissions.canDecideCancellation) &&
        (pendingChanges.length > 0 ||
          pendingBudgets.length > 0 ||
          pendingCancellations.length > 0 ||
          workspace.order.status === "exception_pending") && (
          <div className="rounded-2xl border bg-card p-5 sm:p-8">
            <h2 className="text-xl font-semibold">{c.decisions}</h2>
            <label className="mt-4 block text-sm">
              {c.decisionReason}
              <textarea
                className={area}
                value={decisionReason}
                onChange={(event) => setDecisionReason(event.target.value)}
              />
            </label>
            {workspace.order.status === "exception_pending" && (
              <Decision
                title={c.late}
                busy={busy || !decisionReason.trim()}
                approve={() =>
                  run(() =>
                    decideLateException({
                      orderId: orderId as never,
                      approve: true,
                      reason: decisionReason,
                    }),
                  )
                }
                reject={() =>
                  run(() =>
                    decideLateException({
                      orderId: orderId as never,
                      approve: false,
                      reason: decisionReason,
                    }),
                  )
                }
                c={c}
              />
            )}
            {pendingChanges.map((request) => (
              <Decision
                key={request._id}
                title={`${c.changeRequest}: ${request.reason}`}
                busy={busy || !decisionReason.trim()}
                approve={() =>
                  run(() =>
                    decideChange({
                      changeRequestId: request._id,
                      approve: true,
                      reason: decisionReason,
                    }),
                  )
                }
                reject={() =>
                  run(() =>
                    decideChange({
                      changeRequestId: request._id,
                      approve: false,
                      reason: decisionReason,
                    }),
                  )
                }
                c={c}
              />
            ))}
            {pendingBudgets.map((request) => (
              <Decision
                key={request._id}
                title={c.budget}
                busy={busy || !decisionReason.trim()}
                approve={() =>
                  run(() =>
                    decideBudgetException({
                      exceptionRequestId: request._id,
                      approve: true,
                      reason: decisionReason,
                    }),
                  )
                }
                reject={() =>
                  run(() =>
                    decideBudgetException({
                      exceptionRequestId: request._id,
                      approve: false,
                      reason: decisionReason,
                    }),
                  )
                }
                c={c}
              />
            ))}
            {pendingCancellations.map((request) => (
              <div key={request._id} className="mt-4 rounded-xl border p-4">
                <h3 className="font-medium">
                  {c.cancellation}: {request.reason}
                </h3>
                {purchasedItems.map((item) => (
                  <label key={item._id} className="mt-3 block text-sm">
                    {c.outcomeFor} {item.name}
                    <select
                      className={field}
                      value={cancelOutcomes[item._id] ?? ""}
                      onChange={(event) =>
                        setCancelOutcomes({
                          ...cancelOutcomes,
                          [item._id]: event.target.value,
                        })
                      }
                    >
                      <option value="">—</option>
                      <option value="returned">{c.returned}</option>
                      <option value="refunded">{c.refunded}</option>
                      <option value="retained">{c.retained}</option>
                      <option value="non_refundable">{c.nonRefundable}</option>
                    </select>
                  </label>
                ))}
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={
                      busy ||
                      !decisionReason.trim() ||
                      purchasedItems.some((item) => !cancelOutcomes[item._id])
                    }
                    onClick={() =>
                      void run(() =>
                        decideCancellation({
                          cancellationRequestId: request._id,
                          approve: true,
                          reason: decisionReason,
                          outcomes: purchasedItems.map((item) => ({
                            itemId: item._id,
                            outcome: cancelOutcomes[item._id] as never,
                          })),
                        }),
                      )
                    }
                  >
                    {c.approve}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !decisionReason.trim()}
                    onClick={() =>
                      void run(() =>
                        decideCancellation({
                          cancellationRequestId: request._id,
                          approve: false,
                          reason: decisionReason,
                          outcomes: [],
                        }),
                      )
                    }
                  >
                    {c.reject}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

      <details className="rounded-2xl border bg-card p-5 sm:p-8">
        <summary className="cursor-pointer font-semibold">{c.history}</summary>
        <div className="mt-3 space-y-2">
          {workspace.receivingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{c.noHistory}</p>
          ) : (
            workspace.receivingEvents.map((event) => {
              const item = workspace.items.find(
                (candidate) => candidate._id === event.itemId,
              );
              return (
                <p key={event._id} className="rounded-lg bg-muted p-3 text-sm">
                  {item?.name}: {event.quantity} {item?.unit} ·{" "}
                  {formatDate(event.receivedAt)}
                </p>
              );
            })
          )}
        </div>
      </details>
      {message && (
        <p className="rounded-md border bg-card p-3 text-sm" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function Decision({
  title,
  busy,
  approve,
  reject,
  c,
}: {
  title: string;
  busy: boolean;
  approve: () => Promise<unknown>;
  reject: () => Promise<unknown>;
  c: { approve: string; reject: string };
}) {
  return (
    <div className="mt-4 rounded-xl border p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="mt-3 flex gap-2">
        <Button disabled={busy} onClick={() => void approve()}>
          {c.approve}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void reject()}>
          {c.reject}
        </Button>
      </div>
    </div>
  );
}
