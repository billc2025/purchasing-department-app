"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

const field = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";

function localDateTimeNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

type ItemAction = "information" | "unavailable" | "substitution";

export function ProcessingWorkspace({ orderId }: { orderId: string }) {
  const { language, formatCurrency, formatDate, statusLabel } = useLanguage();
  const c = {
    en: {
      title: "Processing workspace",
      loading: "Loading processing workspace…",
      subtitle: "Complete the highlighted next step below.",
      nextStep: "Next step",
      itemsRemaining: "items still need review",
      readyToApprove:
        "All items are resolved and ready for purchasing approval.",
      waitingForRequester:
        "Waiting for the requester to answer an information request.",
      recordPurchaseNext: "Record the purchase and attach the receipt below.",
      dispatchNext:
        "Mark purchased items in transit when the vendor ships them.",
      billing: "Billing responsibility",
      client: "Client",
      internal: "Internal cost",
      budget: "Order budget",
      actual: "Actual purchased",
      variance: "Variance",
      items: "Item progress",
      qty: "Requested",
      purchased: "Purchased",
      startReview: "Start review",
      beginReview: "Begin item review",
      approve: "Approve item",
      resumeReview: "Resume review",
      requestInfo: "Request information",
      unavailable: "Mark unavailable",
      substitute: "Record substitution",
      moreActions: "Other item action…",
      dispatch: "Mark in transit",
      question: "Question for the requester",
      reason: "Reason",
      replacement: "Replacement details",
      confirm: "Confirm",
      close: "Close",
      approvePurchasing: "Approve for purchasing",
      beginPurchasing: "Begin purchasing",
      discussions: "Order discussions",
      discussionsHelp: "Open comments and internal notes",
      shared: "Shared comments",
      sharedHelp:
        "Visible to the requester, reception, purchasing, and administrators.",
      internalNotes: "Internal notes",
      internalHelp:
        "Visible only to reception, purchasing, and administrators—not the requester.",
      writeComment: "Write a comment",
      addComment: "Add comment",
      noComments: "No messages yet.",
      purchase: "Record purchase transaction",
      vendor: "Vendor",
      purchaseDate: "Purchase date and time",
      receiptNumber: "Receipt number",
      notes: "Transaction notes",
      receipt: "Upload receipt proof",
      receiptHelp: "Required: JPEG, PNG, WebP, or PDF up to 8 MB.",
      receiptReady: "Receipt ready",
      allocation: "Item allocations",
      amount: "Allocated amount",
      total: "Transaction total",
      proofException: "Finalize without receipt proof",
      proofReason: "Required proof-exception reason",
      finalize: "Finalize purchase",
      transactions: "Purchase history",
      transactionsHelp: "Open previous purchase records",
      proofAttached: "Receipt attached",
      exceptionUsed: "Proof exception used",
      noTransactions: "No purchase transactions yet.",
      saved: "Saved successfully.",
      failed: "The action could not be completed. Refresh and try again.",
      uploadFailed: "The receipt could not be uploaded.",
      chooseAllocation:
        "Enter a positive quantity and amount for at least one item.",
      receiptRequired: "Upload receipt proof before finalizing the purchase.",
      exceptionReasonRequired:
        "Enter the reason for the receipt-proof exception.",
    },
    es: {
      title: "Espacio de procesamiento",
      loading: "Cargando espacio de procesamiento…",
      subtitle: "Complete el siguiente paso resaltado abajo.",
      nextStep: "Siguiente paso",
      itemsRemaining: "artículos aún necesitan revisión",
      readyToApprove:
        "Todos los artículos están resueltos y listos para aprobar la compra.",
      waitingForRequester:
        "Esperando la respuesta del solicitante a una solicitud de información.",
      recordPurchaseNext: "Registre la compra y adjunte el recibo abajo.",
      dispatchNext:
        "Marque los artículos comprados en tránsito cuando el proveedor los envíe.",
      billing: "Responsabilidad de facturación",
      client: "Cliente",
      internal: "Costo interno",
      budget: "Presupuesto del pedido",
      actual: "Total comprado",
      variance: "Variación",
      items: "Progreso de artículos",
      qty: "Solicitado",
      purchased: "Comprado",
      startReview: "Iniciar revisión",
      beginReview: "Iniciar revisión del artículo",
      approve: "Aprobar artículo",
      resumeReview: "Reanudar revisión",
      requestInfo: "Solicitar información",
      unavailable: "Marcar no disponible",
      substitute: "Registrar sustitución",
      moreActions: "Otra acción del artículo…",
      dispatch: "Marcar en tránsito",
      question: "Pregunta para el solicitante",
      reason: "Motivo",
      replacement: "Detalles del reemplazo",
      confirm: "Confirmar",
      close: "Cerrar",
      approvePurchasing: "Aprobar para compra",
      beginPurchasing: "Iniciar compra",
      discussions: "Conversaciones del pedido",
      discussionsHelp: "Abrir comentarios y notas internas",
      shared: "Comentarios compartidos",
      sharedHelp:
        "Visibles para el solicitante, recepción, compras y administradores.",
      internalNotes: "Notas internas",
      internalHelp:
        "Visibles solo para recepción, compras y administradores; no para el solicitante.",
      writeComment: "Escriba un comentario",
      addComment: "Agregar comentario",
      noComments: "Aún no hay mensajes.",
      purchase: "Registrar transacción de compra",
      vendor: "Proveedor",
      purchaseDate: "Fecha y hora de compra",
      receiptNumber: "Número de recibo",
      notes: "Notas de la transacción",
      receipt: "Subir comprobante",
      receiptHelp: "Obligatorio: JPEG, PNG, WebP o PDF de hasta 8 MB.",
      receiptReady: "Comprobante listo",
      allocation: "Asignaciones por artículo",
      amount: "Monto asignado",
      total: "Total de la transacción",
      proofException: "Finalizar sin comprobante",
      proofReason: "Motivo obligatorio de la excepción",
      finalize: "Finalizar compra",
      transactions: "Historial de compras",
      transactionsHelp: "Abrir registros de compras anteriores",
      proofAttached: "Comprobante adjunto",
      exceptionUsed: "Se usó una excepción de comprobante",
      noTransactions: "Aún no hay transacciones de compra.",
      saved: "Guardado correctamente.",
      failed:
        "No se pudo completar la acción. Actualice e inténtelo nuevamente.",
      uploadFailed: "No se pudo subir el comprobante.",
      chooseAllocation:
        "Ingrese una cantidad y un monto positivos para al menos un artículo.",
      receiptRequired: "Suba el comprobante antes de finalizar la compra.",
      exceptionReasonRequired:
        "Ingrese el motivo de la excepción del comprobante.",
    },
  }[language];

  const workspace = useQuery(api.processing.workspace, {
    orderId: orderId as never,
  });
  const startReview = useMutation(api.processing.startReview);
  const beginItemReview = useMutation(api.processing.beginItemReview);
  const approveItem = useMutation(api.processing.approveItem);
  const resumeItemReview = useMutation(api.processing.resumeItemReview);
  const requestInformation = useMutation(api.processing.requestItemInformation);
  const markUnavailable = useMutation(api.processing.markUnavailable);
  const recordSubstitution = useMutation(api.processing.recordSubstitution);
  const dispatchItem = useMutation(api.processing.dispatchItem);
  const approveForPurchase = useMutation(api.processing.approveForPurchase);
  const beginPurchasing = useMutation(api.processing.beginPurchasing);
  const addComment = useMutation(api.processing.addComment);
  const generateReceiptUploadUrl = useMutation(
    api.processing.generateReceiptUploadUrl,
  );
  const recordPurchase = useMutation(api.processing.recordPurchase);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [itemAction, setItemAction] = useState<{
    itemId: string;
    action: ItemAction;
  }>();
  const [actionReason, setActionReason] = useState("");
  const [replacement, setReplacement] = useState("");
  const [sharedBody, setSharedBody] = useState("");
  const [internalBody, setInternalBody] = useState("");
  const [purchase, setPurchase] = useState({
    vendor: "",
    purchasedAt: localDateTimeNow(),
    receiptNumber: "",
    notes: "",
    proofException: false,
    proofExceptionReason: "",
  });
  const [receipt, setReceipt] = useState<{
    storageId: string;
    fileName: string;
  }>();
  const [allocations, setAllocations] = useState<
    Record<string, { quantity: string; amount: string }>
  >({});

  const allocationRows = useMemo(
    () =>
      workspace?.items
        .map((item) => {
          const entry = allocations[item._id] ?? { quantity: "", amount: "" };
          return {
            itemId: item._id,
            quantity: Number(entry.quantity),
            amountMinor: Math.round(Number(entry.amount) * 100),
          };
        })
        .filter(
          (entry) =>
            Number.isFinite(entry.quantity) &&
            entry.quantity > 0 &&
            Number.isSafeInteger(entry.amountMinor) &&
            entry.amountMinor >= 0,
        ) ?? [],
    [allocations, workspace?.items],
  );
  const transactionTotal = allocationRows.reduce(
    (sum, allocation) => sum + allocation.amountMinor,
    0,
  );

  if (workspace === undefined)
    return (
      <p className="mx-auto mt-6 max-w-4xl" aria-live="polite">
        {c.loading}
      </p>
    );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(c.saved);
    } catch {
      setMessage(c.failed);
    } finally {
      setBusy(false);
    }
  }

  async function submitItemAction() {
    if (!itemAction) return;
    await run(async () => {
      if (itemAction.action === "information") {
        await requestInformation({
          itemId: itemAction.itemId as never,
          question: actionReason,
        });
      } else if (itemAction.action === "unavailable") {
        await markUnavailable({
          itemId: itemAction.itemId as never,
          reason: actionReason,
        });
      } else {
        await recordSubstitution({
          itemId: itemAction.itemId as never,
          description: replacement,
          reason: actionReason,
        });
      }
      setItemAction(undefined);
      setActionReason("");
      setReplacement("");
    });
  }

  async function postComment(channel: "shared" | "internal", body: string) {
    if (!body.trim()) return;
    await run(async () => {
      await addComment({ orderId: orderId as never, channel, body });
      if (channel === "shared") setSharedBody("");
      else setInternalBody("");
    });
  }

  async function uploadReceipt(file: File) {
    setBusy(true);
    setMessage("");
    try {
      const uploadUrl = await generateReceiptUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("upload failed");
      const { storageId } = (await response.json()) as { storageId: string };
      setReceipt({ storageId, fileName: file.name });
      setMessage(c.receiptReady);
    } catch {
      setMessage(c.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  async function finalizePurchase() {
    if (!allocationRows.length) {
      setMessage(c.chooseAllocation);
      return;
    }
    if (!receipt && !purchase.proofException) {
      setMessage(c.receiptRequired);
      return;
    }
    if (purchase.proofException && !purchase.proofExceptionReason.trim()) {
      setMessage(c.exceptionReasonRequired);
      return;
    }
    await run(async () => {
      await recordPurchase({
        orderId: orderId as never,
        vendor: purchase.vendor,
        purchasedAt: new Date(purchase.purchasedAt).getTime(),
        amountMinor: transactionTotal,
        currency: workspace!.order.currency,
        receiptStorageId: receipt?.storageId as never,
        receiptFileName: receipt?.fileName,
        receiptNumber: purchase.receiptNumber || undefined,
        notes: purchase.notes || undefined,
        proofExceptionReason: purchase.proofException
          ? purchase.proofExceptionReason
          : undefined,
        allocations: allocationRows as never,
      });
      setPurchase({
        vendor: "",
        purchasedAt: localDateTimeNow(),
        receiptNumber: "",
        notes: "",
        proofException: false,
        proofExceptionReason: "",
      });
      setReceipt(undefined);
      setAllocations({});
    });
  }

  const order = workspace.order;
  const canRecordPurchase =
    ["purchasing", "partially_fulfilled"].includes(order.status) &&
    (workspace.permissions.canProcess ||
      workspace.permissions.canUseProofException);
  const unresolvedItems = workspace.items.filter(
    (item) => !["approved", "substituted", "unavailable"].includes(item.status),
  );
  const reviewComplete = unresolvedItems.length === 0;

  return (
    <section className="mx-auto mt-6 max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-card p-5 sm:p-8">
        <h2 className="text-xl font-semibold">{c.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{c.billing}</dt>
            <dd>
              {order.billingResponsibility === "client"
                ? `${c.client} — ${order.clientBillingReference}`
                : c.internal}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{c.budget}</dt>
            <dd>
              {formatCurrency(order.estimatedAmountMinor, order.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{c.actual}</dt>
            <dd>
              {formatCurrency(
                workspace.summary.actualAmountMinor,
                order.currency,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{c.variance}</dt>
            <dd>
              {formatCurrency(workspace.summary.varianceMinor, order.currency)}
            </dd>
          </div>
        </dl>

        {workspace.permissions.canProcess &&
          [
            "assigned",
            "in_review",
            "waiting_for_requester",
            "approved_to_purchase",
            "purchasing",
            "partially_fulfilled",
            "purchased",
          ].includes(order.status) && (
            <div className="mt-5 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {c.nextStep}
              </p>
              {order.status === "assigned" && (
                <Button
                  className="mt-2 h-11 w-full sm:w-auto"
                  disabled={busy}
                  onClick={() =>
                    void run(() => startReview({ orderId: orderId as never }))
                  }
                >
                  {c.startReview}
                </Button>
              )}
              {order.status === "in_review" && !reviewComplete && (
                <p className="mt-2 font-medium">
                  {unresolvedItems.length} {c.itemsRemaining}
                </p>
              )}
              {order.status === "in_review" && reviewComplete && (
                <>
                  <p className="mt-2 text-sm">{c.readyToApprove}</p>
                  <Button
                    className="mt-3 h-11 w-full sm:w-auto"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        approveForPurchase({ orderId: orderId as never }),
                      )
                    }
                  >
                    {c.approvePurchasing}
                  </Button>
                </>
              )}
              {order.status === "waiting_for_requester" && (
                <p className="mt-2 font-medium">{c.waitingForRequester}</p>
              )}
              {order.status === "approved_to_purchase" && (
                <Button
                  className="mt-2 h-11 w-full sm:w-auto"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      beginPurchasing({ orderId: orderId as never }),
                    )
                  }
                >
                  {c.beginPurchasing}
                </Button>
              )}
              {["purchasing", "partially_fulfilled"].includes(order.status) && (
                <p className="mt-2 font-medium">{c.recordPurchaseNext}</p>
              )}
              {order.status === "purchased" && (
                <p className="mt-2 font-medium">{c.dispatchNext}</p>
              )}
            </div>
          )}
      </div>

      <div className="rounded-2xl border bg-card p-5 sm:p-8">
        <h3 className="font-semibold">{c.items}</h3>
        <div className="mt-4 space-y-4">
          {workspace.items.map((item) => (
            <article key={item._id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium">{item.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {item.specification}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.qty}: {item.quantity} {item.unit} · {c.purchased}:{" "}
                    {item.purchasedQuantity ?? 0}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {statusLabel(item.status)}
                </span>
              </div>
              {item.substitutionDescription && (
                <p className="mt-3 text-sm">{item.substitutionDescription}</p>
              )}
              {item.unavailableReason && (
                <p className="mt-3 text-sm text-red-700">
                  {item.unavailableReason}
                </p>
              )}
              {workspace.permissions.canProcess && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status === "in_review" &&
                    item.status === "requested" && (
                      <Button
                        className="h-10 w-full sm:w-auto"
                        disabled={busy}
                        onClick={() =>
                          void run(() => beginItemReview({ itemId: item._id }))
                        }
                      >
                        {c.beginReview}
                      </Button>
                    )}
                  {order.status === "in_review" &&
                    item.status === "under_review" && (
                      <>
                        <Button
                          className="h-10 flex-1 sm:flex-none"
                          disabled={busy}
                          onClick={() =>
                            void run(() => approveItem({ itemId: item._id }))
                          }
                        >
                          {c.approve}
                        </Button>
                        <label className="flex-1 sm:flex-none">
                          <span className="sr-only">{c.moreActions}</span>
                          <select
                            aria-label={c.moreActions}
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-auto"
                            value=""
                            onChange={(event) => {
                              if (!event.target.value) return;
                              setItemAction({
                                itemId: item._id,
                                action: event.target.value as ItemAction,
                              });
                            }}
                          >
                            <option value="">{c.moreActions}</option>
                            <option value="information">{c.requestInfo}</option>
                            <option value="unavailable">{c.unavailable}</option>
                            <option value="substitution">{c.substitute}</option>
                          </select>
                        </label>
                      </>
                    )}
                  {order.status === "waiting_for_requester" &&
                    item.status === "information_needed" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void run(() => resumeItemReview({ itemId: item._id }))
                        }
                      >
                        {c.resumeReview}
                      </Button>
                    )}
                  {["purchased", "partially_fulfilled"].includes(
                    order.status,
                  ) &&
                    ["purchased", "substituted"].includes(item.status) &&
                    (item.purchasedQuantity ?? 0) > 0 && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void run(() => dispatchItem({ itemId: item._id }))
                        }
                      >
                        {c.dispatch}
                      </Button>
                    )}
                </div>
              )}
              {itemAction?.itemId === item._id && (
                <div className="mt-4 rounded-lg bg-muted p-4">
                  {itemAction!.action === "substitution" && (
                    <label className="text-sm">
                      {c.replacement}
                      <textarea
                        className={field}
                        value={replacement}
                        onChange={(event) => setReplacement(event.target.value)}
                      />
                    </label>
                  )}
                  <label className="mt-3 block text-sm">
                    {itemAction!.action === "information"
                      ? c.question
                      : c.reason}
                    <textarea
                      className={field}
                      value={actionReason}
                      onChange={(event) => setActionReason(event.target.value)}
                    />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        busy ||
                        !actionReason.trim() ||
                        (itemAction!.action === "substitution" &&
                          !replacement.trim())
                      }
                      onClick={() => void submitItemAction()}
                    >
                      {c.confirm}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setItemAction(undefined)}
                    >
                      {c.close}
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <details className="rounded-2xl border bg-card p-5 sm:p-8">
        <summary className="cursor-pointer list-none">
          <span className="font-semibold">{c.discussions}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {c.discussionsHelp}
          </span>
        </summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {(["shared", "internal"] as const).map((channel) => {
            if (
              channel === "internal" &&
              !workspace.permissions.canCommentInternal
            )
              return null;
            const body = channel === "shared" ? sharedBody : internalBody;
            const setBody =
              channel === "shared" ? setSharedBody : setInternalBody;
            return (
              <section key={channel} className="rounded-xl border p-4">
                <h4 className="font-medium">
                  {channel === "shared" ? c.shared : c.internalNotes}
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {channel === "shared" ? c.sharedHelp : c.internalHelp}
                </p>
                <div className="mt-4 space-y-3">
                  {workspace.comments.filter(
                    (comment) => comment.channel === channel,
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {c.noComments}
                    </p>
                  )}
                  {workspace.comments
                    .filter((comment) => comment.channel === channel)
                    .map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-lg bg-muted p-3 text-sm"
                      >
                        <p>{comment.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {comment.author} · {formatDate(comment.createdAt)}
                        </p>
                      </div>
                    ))}
                </div>
                <label className="mt-4 block text-sm">
                  {c.writeComment}
                  <textarea
                    className={field}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                  />
                </label>
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={busy || !body.trim()}
                  onClick={() => void postComment(channel, body)}
                >
                  {c.addComment}
                </Button>
              </section>
            );
          })}
        </div>
      </details>

      {canRecordPurchase && (
        <div className="rounded-2xl border bg-card p-5 sm:p-8">
          <h3 className="font-semibold">{c.purchase}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              {c.vendor}
              <input
                className={field}
                value={purchase.vendor}
                onChange={(event) =>
                  setPurchase({ ...purchase, vendor: event.target.value })
                }
              />
            </label>
            <label className="text-sm">
              {c.purchaseDate}
              <input
                type="datetime-local"
                className={field}
                value={purchase.purchasedAt}
                onChange={(event) =>
                  setPurchase({ ...purchase, purchasedAt: event.target.value })
                }
              />
            </label>
            <label className="text-sm">
              {c.receiptNumber}
              <input
                className={field}
                value={purchase.receiptNumber}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    receiptNumber: event.target.value,
                  })
                }
              />
            </label>
            <label className="text-sm sm:col-span-2">
              {c.notes}
              <textarea
                className={field}
                value={purchase.notes}
                onChange={(event) =>
                  setPurchase({ ...purchase, notes: event.target.value })
                }
              />
            </label>
          </div>
          <div className="mt-5 rounded-xl border border-dashed p-4">
            <p className="font-medium">{c.receipt}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.receiptHelp}
            </p>
            <label
              className="mt-3 inline-flex cursor-pointer rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              htmlFor={`receipt-${orderId}`}
            >
              {receipt ? `${c.receiptReady}: ${receipt.fileName}` : c.receipt}
            </label>
            <input
              id={`receipt-${orderId}`}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadReceipt(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <div className="mt-5">
            <h4 className="font-medium">{c.allocation}</h4>
            <div className="mt-3 space-y-3">
              {workspace.items
                .filter((item) =>
                  ["ordered", "approved", "substituted"].includes(item.status),
                )
                .map((item) => {
                  const entry = allocations[item._id] ?? {
                    quantity: "",
                    amount: "",
                  };
                  return (
                    <div
                      key={item._id}
                      className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_8rem_10rem] sm:items-end"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.qty}: {item.quantity} {item.unit}
                        </p>
                      </div>
                      <label className="text-sm">
                        {c.qty}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={field}
                          value={entry.quantity}
                          onChange={(event) =>
                            setAllocations({
                              ...allocations,
                              [item._id]: {
                                ...entry,
                                quantity: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="text-sm">
                        {c.amount}
                        <input
                          inputMode="decimal"
                          className={field}
                          value={entry.amount}
                          onChange={(event) =>
                            setAllocations({
                              ...allocations,
                              [item._id]: {
                                ...entry,
                                amount: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  );
                })}
            </div>
            <p className="mt-3 font-medium">
              {c.total}: {formatCurrency(transactionTotal, order.currency)}
            </p>
          </div>
          {workspace.permissions.canUseProofException && (
            <div className="mt-5 rounded-xl border p-4">
              <label className="text-sm font-medium">
                <input
                  type="checkbox"
                  checked={purchase.proofException}
                  onChange={(event) =>
                    setPurchase({
                      ...purchase,
                      proofException: event.target.checked,
                    })
                  }
                />{" "}
                {c.proofException}
              </label>
              {purchase.proofException && (
                <label className="mt-3 block text-sm">
                  {c.proofReason}
                  <textarea
                    className={field}
                    value={purchase.proofExceptionReason}
                    onChange={(event) =>
                      setPurchase({
                        ...purchase,
                        proofExceptionReason: event.target.value,
                      })
                    }
                  />
                </label>
              )}
            </div>
          )}
          <Button
            className="mt-5"
            disabled={busy || !purchase.vendor.trim()}
            onClick={() => void finalizePurchase()}
          >
            {c.finalize}
          </Button>
        </div>
      )}

      <details className="rounded-2xl border bg-card p-5 sm:p-8">
        <summary className="cursor-pointer list-none">
          <span className="font-semibold">{c.transactions}</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {c.transactionsHelp}
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          {workspace.transactions.length === 0 && (
            <p className="text-sm text-muted-foreground">{c.noTransactions}</p>
          )}
          {workspace.transactions.map((transaction) => (
            <article
              key={transaction.id}
              className="rounded-xl border p-4 text-sm"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-medium">{transaction.vendor}</p>
                  <p className="text-muted-foreground">
                    {formatDate(transaction.purchasedAt)} ·{" "}
                    {transaction.purchasingAgent}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatCurrency(
                    transaction.amountMinor,
                    transaction.currency,
                  )}
                </p>
              </div>
              <ul className="mt-3 space-y-1">
                {transaction.allocations.map((allocation) => (
                  <li key={allocation.itemId}>
                    {allocation.itemName}: {allocation.quantity} ·{" "}
                    {formatCurrency(
                      allocation.amountMinor,
                      transaction.currency,
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {transaction.hasReceipt ? c.proofAttached : c.exceptionUsed}
                {transaction.receiptNumber
                  ? ` · #${transaction.receiptNumber}`
                  : ""}
              </p>
              {transaction.receiptUrl && (
                <a
                  className="mt-2 inline-block text-sm underline"
                  href={transaction.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {c.receipt}
                </a>
              )}
            </article>
          ))}
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
