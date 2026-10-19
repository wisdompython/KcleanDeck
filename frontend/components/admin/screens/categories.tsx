"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useIsOwner } from "@/components/admin/auth";
import { SaveBar } from "@/components/admin/guidance";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { BackLink } from "@/components/admin/screens/booking-editor";
import {
  Button,
  buttonClass,
  Chip,
  EmptyState,
  ErrorNote,
  Field,
  inputClass,
  PageHeader,
  Panel,
  Spinner,
  Switch,
  useToast,
} from "@/components/admin/ui";
import { api } from "@/lib/admin/api";
import type { AdminCategory, AdminService } from "@/lib/admin/types";

function ReadOnlyBanner() {
  return (
    <p className="mb-5 flex items-center gap-2 rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
      <Lock className="size-4" /> Only owners can change categories.
    </p>
  );
}

export function CategoriesScreen() {
  const isOwner = useIsOwner();
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: () => api<AdminCategory[]>("categories/") });
  const services = useQuery({ queryKey: ["admin-services"], queryFn: () => api<AdminService[]>("services/") });
  const serviceName = (id: number) => services.data?.find((s) => s.id === id)?.name;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Homepage"
        title="Homepage categories"
        description="The kinds of business you serve, shown as cards on the homepage. Each card opens the service that fits."
        actions={
          isOwner && (
            <Link href="/admin/categories/new" className={buttonClass("accent")}>
              <Plus className="size-4" /> New category
            </Link>
          )
        }
      />
      {!isOwner && <ReadOnlyBanner />}
      <ErrorNote error={categories.error} />
      {categories.isPending ? (
        <Spinner />
      ) : categories.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {categories.data.map((c) => (
            <Link
              key={c.id}
              href={`/admin/categories/${c.id}`}
              className={`group overflow-hidden rounded-2xl border border-surface-container bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-tertiary hover:shadow-pop ${c.is_active ? "" : "opacity-60"}`}
            >
              <div className="relative aspect-[4/3] bg-surface-container">
                {c.photo_card_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo_card_url} alt="" className="absolute inset-0 size-full object-cover" />
                )}
                <span className="absolute top-3 right-3">
                  {c.is_active ? (
                    <Chip className="bg-white/95 text-on-secondary-container">
                      <Eye className="size-3" /> Live
                    </Chip>
                  ) : (
                    <Chip className="bg-white/95 text-on-surface-variant">
                      <EyeOff className="size-3" /> Hidden
                    </Chip>
                  )}
                </span>
              </div>
              <div className="p-4">
                <p className="font-display font-semibold">{c.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                  {c.services.map(serviceName).filter(Boolean).join(" · ") || "No services yet"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No categories yet" body="Create one for each kind of business you serve." />
      )}
    </div>
  );
}

type Draft = Omit<AdminCategory, "id"> & { id?: number };

const emptyCategory: Draft = {
  name: "",
  slug: "",
  buyer: "",
  description: "",
  cta_label: "",
  services: [],
  primary_service: null,
  image: "",
  sort_order: 0,
  is_active: true,
  photo_url: "",
  photo_card_url: "",
  photo_width: 0,
  has_photo: false,
};

const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function CategoryEditorScreen() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const category = useQuery({
    queryKey: ["admin-category", id],
    queryFn: () => api<AdminCategory>(`categories/${id}/`),
    enabled: !isNew,
  });
  const services = useQuery({ queryKey: ["admin-services"], queryFn: () => api<AdminService[]>("services/") });

  if ((!isNew && category.isPending) || services.isPending) return <Spinner />;
  if (category.error) return <ErrorNote error={category.error} />;
  return <CategoryEditor key={id} initial={isNew ? { ...emptyCategory } : category.data!} services={services.data ?? []} />;
}

function CategoryEditor({ initial, services }: { initial: Draft; services: AdminService[] }) {
  const isOwner = useIsOwner();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [baseline, setBaseline] = useState<Draft>(initial);
  const dirty = JSON.stringify(d) !== JSON.stringify(baseline);
  const isNew = !d.id;
  const ro = !isOwner;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const toggleService = (id: number) => {
    const on = d.services.includes(id);
    const next = on ? d.services.filter((x) => x !== id) : [...d.services, id];
    setD((x) => ({
      ...x,
      services: next,
      // Keep the button pointing at a service that's still in the category.
      primary_service: x.primary_service && next.includes(x.primary_service) ? x.primary_service : (next[0] ?? null),
    }));
  };

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? api<AdminCategory>("categories/", { method: "POST", body: d })
        : api<AdminCategory>(`categories/${d.id}/`, { method: "PATCH", body: d }),
    onSuccess: (saved) => {
      client.invalidateQueries({ queryKey: ["admin-categories"] });
      client.setQueryData(["admin-category", String(saved.id)], saved);
      toast(isNew ? "Category created" : "Category saved");
      if (isNew) router.replace(`/admin/categories/${saved.id}`);
      else {
        setD(saved);
        setBaseline(saved);
      }
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`categories/${d.id}/`, { method: "DELETE" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-categories"] });
      toast("Category deleted");
      router.replace("/admin/categories");
    },
    onError: (e) => toast(e.message, "error"),
  });
  const err = (k: string) =>
    save.error && "fields" in save.error ? (save.error as { fields: Record<string, string> }).fields[k] : undefined;
  const inCategory = services.filter((s) => d.services.includes(s.id));

  return (
    <div className="animate-fade-up pb-20">
      <BackLink href="/admin/categories" label="Homepage categories" />
      <PageHeader
        eyebrow={isNew ? "New category" : "Edit category"}
        title={d.name || "Untitled category"}
        actions={
          isOwner && (
            <>
              {!isNew && (
                <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              )}
              <Button variant="accent" loading={save.isPending} onClick={() => save.mutate()}>
                Save category
              </Button>
            </>
          )
        }
      />
      {ro && <ReadOnlyBanner />}
      <div className="mb-5">
        <ErrorNote error={save.error} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={ro} className="min-w-0 space-y-5">
          <Panel title="Card">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={err("name")}>
                {(id) => (
                  <input
                    id={id}
                    value={d.name}
                    onChange={(e) => setD((x) => ({ ...x, name: e.target.value, slug: isNew ? slugify(e.target.value) : x.slug }))}
                    placeholder="e.g. Schools"
                    className={inputClass}
                  />
                )}
              </Field>
              <Field label="Short name" hint="Used in links; letters, numbers and dashes" error={err("slug")}>
                {(id) => <input id={id} value={d.slug} onChange={(e) => set("slug", slugify(e.target.value))} className={inputClass} />}
              </Field>
              <Field label="Who it's for" hint="Small heading above the name" className="sm:col-span-2">
                {(id) => (
                  <input id={id} value={d.buyer} onChange={(e) => set("buyer", e.target.value)} placeholder="e.g. School bursars and administrators" className={inputClass} />
                )}
              </Field>
              <Field label="Description" className="sm:col-span-2">
                {(id) => (
                  <textarea id={id} rows={3} value={d.description} onChange={(e) => set("description", e.target.value)} className={`${inputClass} h-auto py-2.5`} />
                )}
              </Field>
              <Field label="Button text" hint='e.g. "Price a school clean"'>
                {(id) => <input id={id} value={d.cta_label} onChange={(e) => set("cta_label", e.target.value)} className={inputClass} />}
              </Field>
              <Field label="Order on the homepage" hint="Lower numbers show first">
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    min={0}
                    value={d.sort_order}
                    onChange={(e) => set("sort_order", Number(e.target.value))}
                    className={`${inputClass} tabular`}
                  />
                )}
              </Field>
            </div>
          </Panel>

          <Panel title="Services in this category" description="Tick the services this kind of business usually books">
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => {
                const on = d.services.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${on ? "border-secondary bg-secondary-container/50" : "border-surface-container-high"}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleService(s.id)} className="size-4 accent-secondary" />
                    <span className="flex-1">{s.name}</span>
                    {!s.is_active && <span className="text-xs text-outline">Hidden</span>}
                  </label>
                );
              })}
            </div>
            <Field label="The card's button opens" className="mt-5 max-w-sm" error={err("primary_service")}>
              {(id) => (
                <select
                  id={id}
                  value={d.primary_service ?? ""}
                  onChange={(e) => set("primary_service", e.target.value ? Number(e.target.value) : null)}
                  className={inputClass}
                >
                  <option value="">First live service</option>
                  {inCategory.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </Panel>
        </fieldset>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <Panel title="Photo" bodyClassName="p-5">
            <PhotoUploader
              endpoint={d.id ? `categories/${d.id}/photo/` : undefined}
              entity={d}
              disabled={ro}
              aspect="aspect-[4/3]"
              onSaved={(updated) => {
                const merge = (x: Draft) => ({
                  ...x,
                  photo_url: updated.photo_url,
                  photo_card_url: updated.photo_card_url,
                  photo_width: updated.photo_width,
                  has_photo: updated.has_photo,
                });
                setD(merge);
                setBaseline(merge);
                client.invalidateQueries({ queryKey: ["admin-categories"] });
              }}
            />
          </Panel>
          <Panel bodyClassName="p-5">
            <Switch
              checked={d.is_active}
              disabled={ro}
              onChange={(v) => set("is_active", v)}
              label="Show on the homepage"
            />
          </Panel>
        </aside>
      </div>
      {isOwner && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          onSave={() => save.mutate()}
          onDiscard={() => setD(baseline)}
          saveLabel={isNew ? "Create category" : "Save category"}
        />
      )}
    </div>
  );
}
