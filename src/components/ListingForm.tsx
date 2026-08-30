import { useState } from "react";
import { toast } from "sonner";

import { useStore } from "@/lib/store";
import type { AudienceType } from "@/lib/types";

const CATEGORIES = [
  "Specialty food supply",
  "Distribution & channel access",
  "Logistics & compliance",
  "Brand & packaging design",
  "Manufacturing & sourcing",
  "Professional services",
  "Technology & software",
  "Finance & investment",
];

const INDUSTRIES = [
  "Food & Beverage",
  "Design & Marketing",
  "Logistics & Trade",
  "Manufacturing",
  "Technology",
  "Professional Services",
  "Fashion & Textiles",
];

const field =
  "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/25";

export function ListingForm({
  kind,
  onDone,
}: {
  kind: "offer" | "request";
  onDone: () => void;
}) {
  const { addOffer, addRequest } = useStore();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: CATEGORIES[0],
    industry: INDUSTRIES[0],
    geography: "",
    product_service: "service" as "product" | "service" | "both",
    audience: "b2b" as AudienceType,
    keywords: "",
    expires_at: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="surface-card grid gap-5 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const draft = {
          title: form.title,
          description: form.description,
          category: form.category,
          industry: form.industry,
          geography: form.geography,
          product_service: form.product_service,
          audience: form.audience,
          keywords: form.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          status: "active" as const,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        };
        if (kind === "offer") addOffer(draft);
        else addRequest(draft);
        toast.success(
          kind === "offer" ? "Offer published to the network" : "Request published — matching now",
        );
        onDone();
      }}
    >
      <div className="grid gap-2">
        <label className="text-eyebrow">Title</label>
        <input
          required
          className={field}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={
            kind === "offer"
              ? "What you can provide to other members"
              : "What you are looking for"
          }
        />
      </div>

      <div className="grid gap-2">
        <label className="text-eyebrow">Detailed description</label>
        <textarea
          required
          rows={5}
          className={field}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe scope, capacity, certifications, ideal partner profile and commercial terms. Richer text produces better semantic matches."
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-eyebrow">Category</label>
          <select className={field} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-eyebrow">Industry</label>
          <select className={field} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
            {INDUSTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-eyebrow">Geography</label>
          <input
            required
            className={field}
            value={form.geography}
            onChange={(e) => set("geography", e.target.value)}
            placeholder="e.g. California, United States"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-eyebrow">Product or service</label>
          <select
            className={field}
            value={form.product_service}
            onChange={(e) => set("product_service", e.target.value)}
          >
            <option value="product">Product</option>
            <option value="service">Service</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-eyebrow">Audience</label>
          <select className={field} value={form.audience} onChange={(e) => set("audience", e.target.value)}>
            <option value="b2b">B2B</option>
            <option value="b2c">B2C</option>
            <option value="both">B2B and B2C</option>
          </select>
        </div>
        {kind === "request" && (
          <div className="grid gap-2">
            <label className="text-eyebrow">Expiration date (optional)</label>
            <input
              type="date"
              className={field}
              value={form.expires_at}
              onChange={(e) => set("expires_at", e.target.value)}
            />
          </div>
        )}
        <div className="grid gap-2 sm:col-span-2">
          <label className="text-eyebrow">Keywords (comma separated)</label>
          <input
            className={field}
            value={form.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="distribution, california, specialty food"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-5">
        <button
          type="submit"
          className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Publish {kind}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-sm border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
