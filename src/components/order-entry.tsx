"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

type Item = {
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  preferredVendor?: string;
  estimatedAmount: string;
  substitutionAllowed: boolean;
  notes?: string;
};
const emptyItem = (): Item => ({
  name: "",
  specification: "",
  quantity: 1,
  unit: "each",
  estimatedAmount: "0.00",
  substitutionAllowed: true,
});
const field = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";

export function OrderEntry() {
  const { language, formatDate, t } = useLanguage();
  const c = {
    en: {
      submittedException: "Submitted for exception review.",
      submitted: "Order submitted successfully.",
      draftSaved: "Draft saved.",
      unableSave: "Unable to save order",
      uploadFailed: "Image upload failed",
      unableUpload: "Unable to upload image",
      loading: "Loading order options…",
      setupTitle: "Order setup is not ready",
      setupHelp:
        "An administrator must add the editable Phase 2 sample data from the dashboard.",
      step: "Step",
      of: "of",
      title: "New purchasing order",
      orderDetails: "Order details",
      review: "Review",
      orderFor: "Order for",
      department: "Department",
      noDepartment: "No department",
      costBearer: "Who bears this cost?",
      billClient: "Bill a client",
      clientReference: "Client name or billing reference",
      category: "Category",
      selectCategory: "Select category",
      minimum: "Minimum",
      earliest: "Earliest compliant",
      needed: "Needed by date and time",
      purpose: "Purpose or event",
      location: "Delivery location",
      selectLocation: "Select location",
      budget: "Estimated budget",
      item: "Item",
      name: "Name",
      quantityUnit: "Quantity and unit",
      specification: "Description or specification",
      estimatedAmount: "Estimated amount",
      estimatedAria: "Estimated amount in dollars",
      substitutions: "Allow reasonable substitutions",
      removeItem: "Remove item",
      addItem: "Add another item",
      images: "Reference images",
      imageHelp:
        "JPEG, PNG, or WebP; maximum 8 MB. The server verifies the uploaded file.",
      attachedImages: "Attached images",
      remove: "Remove",
      reviewTitle: "Review before submitting",
      notSet: "Not set",
      orderComments: "Order comments",
      reviewHelp:
        "The server recalculates lead-time compliance at submission. Late requests go to exception review.",
      back: "Back",
      saveDraft: "Save draft",
      continue: "Continue",
      submitting: "Submitting…",
      submitOrder: "Submit order",
      myself: "Myself",
      orderProgress: "Order progress",
    },
    es: {
      submittedException: "Enviado para revisión de excepción.",
      submitted: "Pedido enviado correctamente.",
      draftSaved: "Borrador guardado.",
      unableSave: "No se pudo guardar el pedido",
      uploadFailed: "Falló la carga de la imagen",
      unableUpload: "No se pudo cargar la imagen",
      loading: "Cargando opciones del pedido…",
      setupTitle: "La configuración del pedido no está lista",
      setupHelp:
        "Un administrador debe agregar los datos de ejemplo editables de la Fase 2 desde el panel.",
      step: "Paso",
      of: "de",
      title: "Nuevo pedido de compra",
      orderDetails: "Detalles del pedido",
      review: "Revisión",
      orderFor: "Pedido para",
      department: "Departamento",
      noDepartment: "Sin departamento",
      costBearer: "¿Quién asume este costo?",
      billClient: "Facturar a un cliente",
      clientReference: "Nombre del cliente o referencia de facturación",
      category: "Categoría",
      selectCategory: "Seleccione una categoría",
      minimum: "Mínimo",
      earliest: "Primera fecha conforme",
      needed: "Fecha y hora en que se necesita",
      purpose: "Propósito o evento",
      location: "Lugar de entrega",
      selectLocation: "Seleccione una ubicación",
      budget: "Presupuesto estimado",
      item: "Artículo",
      name: "Nombre",
      quantityUnit: "Cantidad y unidad",
      specification: "Descripción o especificación",
      estimatedAmount: "Monto estimado",
      estimatedAria: "Monto estimado en dólares",
      substitutions: "Permitir sustituciones razonables",
      removeItem: "Eliminar artículo",
      addItem: "Agregar otro artículo",
      images: "Imágenes de referencia",
      imageHelp:
        "JPEG, PNG o WebP; máximo 8 MB. El servidor verifica el archivo cargado.",
      attachedImages: "Imágenes adjuntas",
      remove: "Quitar",
      reviewTitle: "Revisar antes de enviar",
      notSet: "Sin definir",
      orderComments: "Comentarios del pedido",
      reviewHelp:
        "El servidor vuelve a calcular el cumplimiento del plazo al enviar. Las solicitudes tardías pasan a revisión de excepción.",
      back: "Atrás",
      saveDraft: "Guardar borrador",
      continue: "Continuar",
      submitting: "Enviando…",
      submitOrder: "Enviar pedido",
      myself: "Yo",
      orderProgress: "Progreso del pedido",
    },
  }[language];
  const router = useRouter();
  const options = useQuery(api.configuration.listOrderOptions);
  const users = useQuery(api.orders.eligibleRequestedForUsers);
  const saveDraft = useMutation(api.orders.saveDraft);
  const submit = useMutation(api.orders.submit);
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const attachReferenceImage = useMutation(api.orders.attachReferenceImage);
  const removeAttachment = useMutation(api.orders.removeAttachment);
  const [step, setStep] = useState(1);
  const [orderId, setOrderId] = useState<string>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    requestedForUserId: "",
    departmentId: "",
    billingResponsibility: "internal" as "client" | "internal",
    clientBillingReference: "",
    billingNotes: "",
    categoryId: "",
    purpose: "",
    locationId: "",
    deliveryInstructions: "",
    requiredAt: "",
    displayTimezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Panama",
    estimatedBudget: "0.00",
    currency: "USD",
    comments: "",
  });
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [attachments, setAttachments] = useState<
    Array<{ id: string; fileName: string }>
  >([]);
  const leadTimePreview = useQuery(
    api.orders.leadTimePreview,
    form.categoryId ? { categoryId: form.categoryId as never } : "skip",
  );
  const selectedCategory = options?.categories.find(
    (category) => category.id === form.categoryId,
  );
  const earliest = leadTimePreview
    ? new Date(leadTimePreview.earliestCompliantAt)
    : null;
  const payload = useMemo(
    () => ({
      orderId: orderId as never,
      requestedForUserId: (form.requestedForUserId || users?.[0]?.id) as never,
      departmentId: (form.departmentId || undefined) as never,
      billingResponsibility: form.billingResponsibility,
      clientBillingReference: form.clientBillingReference || undefined,
      billingNotes: form.billingNotes || undefined,
      categoryId: form.categoryId as never,
      purpose: form.purpose,
      locationId: form.locationId as never,
      deliveryInstructions: form.deliveryInstructions || undefined,
      requiredAt: new Date(form.requiredAt).getTime(),
      displayTimezone: form.displayTimezone,
      estimatedAmountMinor: Math.round(Number(form.estimatedBudget) * 100),
      currency: form.currency,
      comments: form.comments || undefined,
      items: items.map(({ estimatedAmount, ...item }) => ({
        ...item,
        estimatedAmountMinor: Math.round(Number(estimatedAmount) * 100),
      })),
    }),
    [form, items, orderId, users],
  );
  async function persist(doSubmit = false) {
    setBusy(true);
    setMessage("");
    try {
      const id = await saveDraft(payload);
      setOrderId(id);
      if (doSubmit) {
        const result = await submit({ orderId: id });
        setMessage(result.isLate ? c.submittedException : c.submitted);
        router.push(`/app/orders/${id}`);
      } else setMessage(c.draftSaved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.unableSave);
    } finally {
      setBusy(false);
    }
  }
  async function uploadReference(file: File) {
    setBusy(true);
    setMessage("");
    try {
      const id = orderId ?? (await saveDraft(payload));
      setOrderId(id);
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(c.uploadFailed);
      const { storageId } = (await response.json()) as { storageId: string };
      const attachmentId = await attachReferenceImage({
        orderId: id as never,
        storageId: storageId as never,
        fileName: file.name,
      });
      setAttachments((current) => [
        ...current,
        { id: attachmentId, fileName: file.name },
      ]);
      setMessage(`${file.name} attached to the draft.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : c.unableUpload);
    } finally {
      setBusy(false);
    }
  }
  if (!options || !users) return <p aria-live="polite">{c.loading}</p>;
  if (!options.categories.length)
    return (
      <div className="rounded-xl border p-8">
        <h2 className="text-xl font-semibold">{c.setupTitle}</h2>
        <p className="mt-2 text-muted-foreground">{c.setupHelp}</p>
      </div>
    );
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-7">
        <p className="text-sm font-medium text-muted-foreground">
          {c.step} {step} {c.of} 3
        </p>
        <h2 className="text-2xl font-semibold">{c.title}</h2>
        <div
          className="mt-4 grid grid-cols-3 gap-2"
          aria-label={c.orderProgress}
        >
          {[c.orderDetails, t("items"), c.review].map((label, index) => (
            <div
              key={label}
              className={`rounded-md px-3 py-2 text-center text-xs ${step >= index + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void persist(step === 3);
        }}
        className="rounded-2xl border bg-card p-5 sm:p-8"
      >
        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              {c.orderFor}
              <select
                required
                className={field}
                value={form.requestedForUserId || users[0]?.id}
                onChange={(e) =>
                  setForm({ ...form, requestedForUserId: e.target.value })
                }
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName === "Myself"
                      ? c.myself
                      : user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.department}
              <select
                className={field}
                value={form.departmentId}
                onChange={(e) =>
                  setForm({ ...form, departmentId: e.target.value })
                }
              >
                <option value="">{c.noDepartment}</option>
                {options.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="font-medium">{c.costBearer}</legend>
              <div className="mt-2 flex gap-5">
                <label>
                  <input
                    type="radio"
                    checked={form.billingResponsibility === "internal"}
                    onChange={() =>
                      setForm({
                        ...form,
                        billingResponsibility: "internal",
                        clientBillingReference: "",
                      })
                    }
                  />{" "}
                  <span className="ml-1">{t("internalCost")}</span>
                </label>
                <label>
                  <input
                    type="radio"
                    checked={form.billingResponsibility === "client"}
                    onChange={() =>
                      setForm({ ...form, billingResponsibility: "client" })
                    }
                  />{" "}
                  <span className="ml-1">{c.billClient}</span>
                </label>
              </div>
            </fieldset>
            {form.billingResponsibility === "client" && (
              <label className="sm:col-span-2">
                {c.clientReference}
                <input
                  required
                  className={field}
                  value={form.clientBillingReference}
                  onChange={(e) =>
                    setForm({ ...form, clientBillingReference: e.target.value })
                  }
                />
              </label>
            )}
            <label>
              {c.category}
              <select
                required
                className={field}
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                <option value="">{c.selectCategory}</option>
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {selectedCategory && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {c.minimum}: {selectedCategory.leadTimeValue}{" "}
                  {selectedCategory.leadTimeUnit}. {c.earliest}:{" "}
                  {earliest ? formatDate(earliest.getTime()) : ""}.
                </span>
              )}
            </label>
            <label>
              {c.needed}
              <input
                required
                type="datetime-local"
                className={field}
                value={form.requiredAt}
                onChange={(e) =>
                  setForm({ ...form, requiredAt: e.target.value })
                }
              />
            </label>
            <label className="sm:col-span-2">
              {c.purpose}
              <textarea
                required
                className={field}
                rows={3}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </label>
            <label>
              {c.location}
              <select
                required
                className={field}
                value={form.locationId}
                onChange={(e) =>
                  setForm({ ...form, locationId: e.target.value })
                }
              >
                <option value="">{c.selectLocation}</option>
                {options.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {c.budget}
              <div className="flex gap-2">
                <input
                  required
                  inputMode="decimal"
                  className={field}
                  value={form.estimatedBudget}
                  onChange={(e) =>
                    setForm({ ...form, estimatedBudget: e.target.value })
                  }
                />
                <input
                  required
                  maxLength={3}
                  className={`${field} max-w-20 uppercase`}
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                />
              </div>
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            {items.map((item, index) => (
              <fieldset key={index} className="rounded-xl border p-4">
                <legend className="px-2 font-semibold">
                  {c.item} {index + 1}
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    {c.name}
                    <input
                      required
                      className={field}
                      value={item.name}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    {c.quantityUnit}
                    <div className="flex gap-2">
                      <input
                        required
                        min="0.01"
                        step="any"
                        type="number"
                        className={field}
                        value={item.quantity}
                        onChange={(e) =>
                          setItems(
                            items.map((x, i) =>
                              i === index
                                ? { ...x, quantity: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                      <input
                        required
                        className={field}
                        value={item.unit}
                        onChange={(e) =>
                          setItems(
                            items.map((x, i) =>
                              i === index ? { ...x, unit: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </div>
                  </label>
                  <label className="sm:col-span-2">
                    {c.specification}
                    <textarea
                      required
                      className={field}
                      value={item.specification}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index
                              ? { ...x, specification: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    {t("preferredVendor")}
                    <input
                      className={field}
                      value={item.preferredVendor ?? ""}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index
                              ? { ...x, preferredVendor: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    {c.estimatedAmount}
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                        $
                      </span>
                      <input
                        required
                        inputMode="decimal"
                        pattern="\d+(\.\d{0,2})?"
                        className={`${field} pl-7`}
                        value={item.estimatedAmount}
                        onFocus={(event) => event.currentTarget.select()}
                        onBlur={(event) => {
                          const amount = Number(event.currentTarget.value);
                          if (Number.isFinite(amount)) {
                            setItems(
                              items.map((x, i) =>
                                i === index
                                  ? { ...x, estimatedAmount: amount.toFixed(2) }
                                  : x,
                              ),
                            );
                          }
                        }}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (/^\d*(?:\.\d{0,2})?$/.test(value)) {
                            setItems(
                              items.map((x, i) =>
                                i === index
                                  ? { ...x, estimatedAmount: value }
                                  : x,
                              ),
                            );
                          }
                        }}
                        aria-label={c.estimatedAria}
                      />
                    </div>
                  </label>
                  <label className="sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={item.substitutionAllowed}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index
                              ? { ...x, substitutionAllowed: e.target.checked }
                              : x,
                          ),
                        )
                      }
                    />{" "}
                    <span className="ml-1">{c.substitutions}</span>
                  </label>
                </div>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3"
                    onClick={() =>
                      setItems(items.filter((_, i) => i !== index))
                    }
                  >
                    {c.removeItem}
                  </Button>
                )}
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setItems([...items, emptyItem()])}
            >
              {c.addItem}
            </Button>
            <div className="rounded-xl border border-dashed p-4">
              <label className="font-medium" htmlFor="reference-image">
                {c.images}
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.imageHelp}
              </p>
              <input
                id="reference-image"
                className="mt-3 block w-full text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadReference(file);
                  event.currentTarget.value = "";
                }}
              />
              {attachments.length > 0 && (
                <ul className="mt-3 space-y-2" aria-label={c.attachedImages}>
                  {attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm"
                    >
                      <span className="truncate">{attachment.fileName}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await removeAttachment({
                            attachmentId: attachment.id as never,
                          });
                          setAttachments((current) =>
                            current.filter(
                              (candidate) => candidate.id !== attachment.id,
                            ),
                          );
                          setMessage(`${attachment.fileName} removed.`);
                        }}
                      >
                        {c.remove}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-xl bg-muted p-5">
              <h3 className="font-semibold">{c.reviewTitle}</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{c.purpose}</dt>
                  <dd>{form.purpose}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("billing")}</dt>
                  <dd>
                    {form.billingResponsibility === "client"
                      ? `${t("client")} — ${form.clientBillingReference}`
                      : t("internalCost")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("items")}</dt>
                  <dd>{items.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("neededBy")}</dt>
                  <dd>
                    {form.requiredAt
                      ? formatDate(new Date(form.requiredAt).getTime())
                      : c.notSet}
                  </dd>
                </div>
              </dl>
            </div>
            <label>
              {c.orderComments}
              <textarea
                className={field}
                rows={4}
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
              />
            </label>
            <p className="text-sm text-muted-foreground">{c.reviewHelp}</p>
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-between gap-3">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
              >
                {c.back}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void persist(false)}
            >
              {c.saveDraft}
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                {c.continue}
              </Button>
            ) : (
              <Button type="submit" disabled={busy}>
                {busy ? c.submitting : c.submitOrder}
              </Button>
            )}
          </div>
        </div>
        {message && (
          <p className="mt-4 text-sm" role="status">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
