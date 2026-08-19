"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";

type Item = {
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  preferredVendor?: string;
  estimatedAmountMinor: number;
  substitutionAllowed: boolean;
  notes?: string;
};
const emptyItem = (): Item => ({
  name: "",
  specification: "",
  quantity: 1,
  unit: "each",
  estimatedAmountMinor: 0,
  substitutionAllowed: true,
});
const field = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";

export function OrderEntry() {
  const router = useRouter();
  const options = useQuery(api.configuration.listOrderOptions);
  const users = useQuery(api.orders.eligibleRequestedForUsers);
  const saveDraft = useMutation(api.orders.saveDraft);
  const submit = useMutation(api.orders.submit);
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const attachReferenceImage = useMutation(api.orders.attachReferenceImage);
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
      items,
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
        setMessage(
          result.isLate
            ? "Submitted for exception review."
            : "Order submitted successfully.",
        );
        router.push(`/app/orders/${id}`);
      } else setMessage("Draft saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save order",
      );
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
      if (!response.ok) throw new Error("Image upload failed");
      const { storageId } = (await response.json()) as { storageId: string };
      await attachReferenceImage({
        orderId: id as never,
        storageId: storageId as never,
        fileName: file.name,
      });
      setMessage(`${file.name} attached to the draft.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to upload image",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!options || !users)
    return <p aria-live="polite">Loading order options…</p>;
  if (!options.categories.length)
    return (
      <div className="rounded-xl border p-8">
        <h2 className="text-xl font-semibold">Order setup is not ready</h2>
        <p className="mt-2 text-muted-foreground">
          An administrator must add the editable Phase 2 sample data from the
          dashboard.
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-7">
        <p className="text-sm font-medium text-muted-foreground">
          Step {step} of 3
        </p>
        <h2 className="text-2xl font-semibold">New purchasing order</h2>
        <div
          className="mt-4 grid grid-cols-3 gap-2"
          aria-label="Order progress"
        >
          {["Order details", "Items", "Review"].map((label, index) => (
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
              Order for
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
                    {user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Department
              <select
                className={field}
                value={form.departmentId}
                onChange={(e) =>
                  setForm({ ...form, departmentId: e.target.value })
                }
              >
                <option value="">No department</option>
                {options.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="font-medium">Who bears this cost?</legend>
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
                  <span className="ml-1">Internal cost</span>
                </label>
                <label>
                  <input
                    type="radio"
                    checked={form.billingResponsibility === "client"}
                    onChange={() =>
                      setForm({ ...form, billingResponsibility: "client" })
                    }
                  />{" "}
                  <span className="ml-1">Bill a client</span>
                </label>
              </div>
            </fieldset>
            {form.billingResponsibility === "client" && (
              <label className="sm:col-span-2">
                Client name or billing reference
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
              Category
              <select
                required
                className={field}
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                <option value="">Select category</option>
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {selectedCategory && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Minimum: {selectedCategory.leadTimeValue}{" "}
                  {selectedCategory.leadTimeUnit}. Earliest compliant:{" "}
                  {earliest?.toLocaleString()}.
                </span>
              )}
            </label>
            <label>
              Required date and time
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
              Purpose or event
              <textarea
                required
                className={field}
                rows={3}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </label>
            <label>
              Delivery location
              <select
                required
                className={field}
                value={form.locationId}
                onChange={(e) =>
                  setForm({ ...form, locationId: e.target.value })
                }
              >
                <option value="">Select location</option>
                {options.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estimated budget
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
                <legend className="px-2 font-semibold">Item {index + 1}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    Name
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
                    Quantity and unit
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
                    Description or specification
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
                    Preferred vendor
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
                    Estimated amount
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      className={field}
                      value={(item.estimatedAmountMinor / 100).toFixed(2)}
                      onChange={(e) =>
                        setItems(
                          items.map((x, i) =>
                            i === index
                              ? {
                                  ...x,
                                  estimatedAmountMinor: Math.round(
                                    Number(e.target.value) * 100,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
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
                    <span className="ml-1">Allow reasonable substitutions</span>
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
                    Remove item
                  </Button>
                )}
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setItems([...items, emptyItem()])}
            >
              Add another item
            </Button>
            <div className="rounded-xl border border-dashed p-4">
              <label className="font-medium" htmlFor="reference-image">
                Reference images
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                JPEG, PNG, or WebP; maximum 8 MB. The server verifies the
                uploaded file.
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
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-xl bg-muted p-5">
              <h3 className="font-semibold">Review before submitting</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Purpose</dt>
                  <dd>{form.purpose}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Billing</dt>
                  <dd>
                    {form.billingResponsibility === "client"
                      ? `Client — ${form.clientBillingReference}`
                      : "Internal cost"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Items</dt>
                  <dd>{items.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Required</dt>
                  <dd>
                    {form.requiredAt
                      ? new Date(form.requiredAt).toLocaleString()
                      : "Not set"}
                  </dd>
                </div>
              </dl>
            </div>
            <label>
              Order comments
              <textarea
                className={field}
                rows={4}
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
              />
            </label>
            <p className="text-sm text-muted-foreground">
              The server recalculates lead-time compliance at submission. Late
              requests go to exception review.
            </p>
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
                Back
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
              Save draft
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit order"}
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
