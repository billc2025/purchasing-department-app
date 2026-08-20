"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

const field = "h-11 w-full rounded-md border bg-background px-3";
const receiving = [
  "purchasing",
  "purchased",
  "in_transit",
  "partially_fulfilled",
];
const outcomes = ["returned", "refunded", "retained", "non_refundable"];

export function ConfigurationWorkspace() {
  const data = useQuery(api.configuration.adminWorkspace);
  const savePolicies = useMutation(api.configuration.savePolicies);
  const saveDepartment = useMutation(api.configuration.saveDepartment);
  const saveLocation = useMutation(api.configuration.saveLocation);
  const saveCategory = useMutation(api.configuration.saveCategory);
  const saveAllocation = useMutation(api.configuration.saveBudgetAllocation);
  const { language } = useLanguage();
  const es = language === "es";
  const [message, setMessage] = useState("");
  if (data === undefined)
    return <p>{es ? "Cargando configuración…" : "Loading configuration…"}</p>;
  const run = async (work: () => Promise<unknown>, form?: HTMLFormElement) => {
    setMessage("");
    try {
      await work();
      form?.reset();
      setMessage(es ? "Configuración guardada." : "Configuration saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    }
  };
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold">
          {es ? "Configuración" : "Configuration"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {es
            ? "Las modificaciones se validan y quedan en el registro de auditoría."
            : "Changes are validated and recorded in the audit trail."}
        </p>
      </div>
      {message && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          {message}
        </p>
      )}
      <section className="rounded-xl border p-5">
        <h3 className="font-semibold">
          {es ? "Políticas operativas" : "Operational policies"}
        </h3>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run(() =>
              savePolicies({
                editCutoffMinutes: Number(form.get("cutoff")),
                receptionistStatuses: receiving.filter((x) => form.get(x)),
                cancellationOutcomes: outcomes.filter((x) => form.get(x)),
              }),
            );
          }}
        >
          <label className="text-sm">
            {es
              ? "Límite de edición (minutos)"
              : "Material edit cutoff (minutes)"}
            <input
              className={`${field} mt-1`}
              name="cutoff"
              type="number"
              min="0"
              max="10080"
              defaultValue={data.policies.editCutoffMinutes}
              required
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">
              {es
                ? "Estados donde recepción puede registrar entrega"
                : "Statuses where reception may record delivery"}
            </legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {receiving.map((value) => (
                <label key={value} className="text-sm">
                  <input
                    type="checkbox"
                    name={value}
                    defaultChecked={data.policies.receptionistStatuses.includes(
                      value,
                    )}
                  />{" "}
                  {value.replaceAll("_", " ")}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">
              {es
                ? "Resultados permitidos de cancelación"
                : "Permitted cancellation outcomes"}
            </legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {outcomes.map((value) => (
                <label key={value} className="text-sm">
                  <input
                    type="checkbox"
                    name={value}
                    defaultChecked={data.policies.cancellationOutcomes.includes(
                      value,
                    )}
                  />{" "}
                  {value.replaceAll("_", " ")}
                </label>
              ))}
            </div>
          </fieldset>
          <Button className="w-fit" type="submit">
            {es ? "Guardar políticas" : "Save policies"}
          </Button>
        </form>
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <SimpleForm
          title={es ? "Nueva categoría" : "New category"}
          onSubmit={(f, form) =>
            run(
              () =>
                saveCategory({
                  name: String(f.get("name")),
                  description: String(f.get("description")) || undefined,
                  leadTimeValue: Number(f.get("lead")),
                  leadTimeUnit: String(f.get("unit")) as
                    "minutes" | "hours" | "days",
                }),
              form,
            )
          }
        >
          <Input name="name" label={es ? "Nombre" : "Name"} />
          <Input
            name="description"
            label={es ? "Descripción" : "Description"}
          />
          <Input
            name="lead"
            label={es ? "Tiempo anticipado" : "Lead time"}
            type="number"
          />
          <label className="text-sm">
            {es ? "Unidad" : "Unit"}
            <select className={`${field} mt-1`} name="unit">
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </label>
        </SimpleForm>
        <SimpleForm
          title={es ? "Nuevo departamento" : "New department"}
          onSubmit={(f, form) =>
            run(
              () =>
                saveDepartment({
                  name: String(f.get("name")),
                  code: String(f.get("code")),
                  costCenterReference: String(f.get("cost")) || undefined,
                }),
              form,
            )
          }
        >
          <Input name="name" label={es ? "Nombre" : "Name"} />
          <Input name="code" label={es ? "Código" : "Code"} />
          <Input
            name="cost"
            label={es ? "Centro de costo (opcional)" : "Cost center (optional)"}
          />
        </SimpleForm>
        <SimpleForm
          title={es ? "Nueva ubicación" : "New location"}
          onSubmit={(f, form) =>
            run(
              () =>
                saveLocation({
                  name: String(f.get("name")),
                  timezone: String(f.get("timezone")),
                  address: String(f.get("address")) || undefined,
                }),
              form,
            )
          }
        >
          <Input name="name" label={es ? "Nombre" : "Name"} />
          <Input
            name="timezone"
            label={es ? "Zona horaria" : "Timezone"}
            value="America/Panama"
          />
          <Input name="address" label={es ? "Dirección" : "Address"} />
        </SimpleForm>
      </div>
      <section className="grid gap-4 rounded-xl border p-5 md:grid-cols-3">
        <div>
          <h3 className="font-semibold">
            {es ? "Categorías actuales" : "Current categories"}
          </h3>
          {data.categories.map((item) => (
            <p className="mt-2 text-sm" key={item._id}>
              {item.name} · {item.rule?.leadTimeValue ?? "—"}{" "}
              {item.rule?.leadTimeUnit ?? ""}
            </p>
          ))}
        </div>
        <div>
          <h3 className="font-semibold">
            {es ? "Departamentos actuales" : "Current departments"}
          </h3>
          {data.departments.map((item) => (
            <p className="mt-2 text-sm" key={item._id}>
              {item.name} · {item.code}
              {item.costCenterReference ? ` · ${item.costCenterReference}` : ""}
            </p>
          ))}
        </div>
        <div>
          <h3 className="font-semibold">
            {es ? "Ubicaciones actuales" : "Current locations"}
          </h3>
          {data.locations.map((item) => (
            <p className="mt-2 text-sm" key={item._id}>
              {item.name} · {item.timezone}
            </p>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <h3 className="font-semibold">
          {es
            ? "Asignaciones presupuestarias — solo planificación"
            : "Budget allocations — planning only"}
        </h3>
        <p className="mt-1 text-sm font-medium">
          {es
            ? "La aplicación no consume ni aplica estos montos."
            : "Enforcement is inactive. Orders do not consume or enforce these amounts."}
        </p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            run(
              () =>
                saveAllocation({
                  scopeType: String(f.get("scope")) as "general",
                  name: String(f.get("name")),
                  amountMinor: Math.round(Number(f.get("amount")) * 100),
                  currency: String(f.get("currency")),
                  eventReference: String(f.get("event")) || undefined,
                }),
              event.currentTarget,
            );
          }}
        >
          <label className="text-sm">
            {es ? "Alcance" : "Scope"}
            <select name="scope" className={`${field} mt-1`}>
              <option value="general">General</option>
              <option value="event">Event</option>
            </select>
          </label>
          <Input name="name" label={es ? "Nombre" : "Name"} />
          <Input name="amount" label={es ? "Monto" : "Amount"} type="number" />
          <Input
            name="currency"
            label={es ? "Moneda" : "Currency"}
            value="USD"
          />
          <Input
            name="event"
            label={
              es
                ? "Referencia de evento (si aplica)"
                : "Event reference (if applicable)"
            }
          />
          <Button className="w-fit md:self-end" type="submit">
            {es ? "Agregar planificación" : "Add planning allocation"}
          </Button>
        </form>
        <div className="mt-4 grid gap-2">
          {data.budgetAllocations.map((a) => (
            <div
              key={a._id}
              className="rounded-md border border-amber-200 bg-white p-3 text-sm"
            >
              <strong>{a.name}</strong> ·{" "}
              {(a.amountMinor / 100).toLocaleString(undefined, {
                style: "currency",
                currency: a.currency,
              })}{" "}
              · {a.scopeType} · {es ? "Sin aplicación" : "Not enforced"}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SimpleForm({
  title,
  children,
  onSubmit,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: (data: FormData, form: HTMLFormElement) => void;
}) {
  return (
    <form
      className="grid content-start gap-3 rounded-xl border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget), event.currentTarget);
      }}
    >
      <h3 className="font-semibold">{title}</h3>
      {children}
      <Button className="w-fit" type="submit">
        Save
      </Button>
    </form>
  );
}
function Input({
  name,
  label,
  type = "text",
  value,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        className={`${field} mt-1`}
        name={name}
        type={type}
        defaultValue={value}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        required={
          !label.toLowerCase().includes("optional") &&
          !label.toLowerCase().includes("opcional")
        }
      />
    </label>
  );
}
