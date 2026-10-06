import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useStore } from "@/lib/store";
import type { AudienceType, Offer, Request } from "@/lib/types";

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

type Listing = Offer | Request;

type Props = {
  kind: "offer" | "request";
  onDone: () => void;
  initial?: Listing | null;
};

export function ListingForm({
  kind,
  onDone,
  initial = null,
}: Props) {
  const {
    addOffer,
    addRequest,
    updateOffer,
    updateRequest,
  } = useStore();

  const editing = Boolean(initial);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "",
    industry: initial?.industry ?? "",
    geography: initial?.geography ?? "",
    product_service:
      initial?.product_service ??
      ("service" as "product" | "service" | "both"),
    audience: initial?.audience ?? ("b2b" as AudienceType),
    keywords: initial?.keywords?.join(", ") ?? "",
    expires_at:
      initial && "expires_at" in initial && initial.expires_at
        ? initial.expires_at.slice(0, 10)
        : "",
  });

  const set = (key: keyof typeof form, value: string) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    if (!form.category || !form.industry) {
      toast.error("Please select a category and industry.");
      return;
    }

    setSaving(true);

    const draft = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      industry: form.industry,
      geography: form.geography.trim(),
      product_service: form.product_service,
      audience: form.audience,
      keywords: form.keywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      status: initial?.status ?? ("active" as const),
      expires_at: form.expires_at
        ? new Date(`${form.expires_at}T12:00:00`).toISOString()
        : null,
    };

    try {
      if (editing && initial) {
        const updated =
          kind === "offer"
            ? await updateOffer(initial.id, draft)
            : await updateRequest(initial.id, draft);

        if (!updated) {
          toast.error("Could not save changes. Please try again.");
          return;
        }

        toast.success(
          kind === "offer"
            ? "Offer updated successfully"
            : "Request updated successfully",
        );
      } else {
        if (kind === "offer") {
          await addOffer(draft);
        } else {
          await addRequest(draft);
        }

        toast.success(
          kind === "offer"
            ? "Offer submitted"
            : "Request submitted",
        );
      }

      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the listing.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="surface-card grid gap-5 p-6"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">
          {editing ? "Edit" : "New"}{" "}
          {kind === "offer" ? "offer" : "request"}
        </h2>
      </div>

      <div className="grid gap-2">
        <label className="text-eyebrow">Title</label>
        <input
          required
          className={field}
          value={form.title}
          onChange={(event) =>
            set("title", event.target.value)
          }
          placeholder={
            kind === "offer"
              ? "What you can provide to other members"
              : "What you are looking for"
          }
        />
      </div>

      <div className="grid gap-2">
        <label className="text-eyebrow">
          Detailed description
        </label>
        <textarea
          required
          rows={5}
          className={field}
          value={form.description}
          onChange={(event) =>
            set("description", event.target.value)
          }
          placeholder="Describe your services, requirements, ideal partners and commercial terms."
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-eyebrow">
            Category
          </label>
          <select
            required
            className={field}
            value={form.category}
            onChange={(event) =>
              set("category", event.target.value)
            }
          >
            <option value="" disabled>
              Select category
            </option>
            {CATEGORIES.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-eyebrow">
            Industry
          </label>
          <select
            required
            className={field}
            value={form.industry}
            onChange={(event) =>
              set("industry", event.target.value)
            }
          >
            <option value="" disabled>
              Select industry
            </option>
            {INDUSTRIES.map((industry) => (
              <option
                key={industry}
                value={industry}
              >
                {industry}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-eyebrow">
            Geography
          </label>
          <input
            required
            className={field}
            value={form.geography}
            onChange={(event) =>
              set("geography", event.target.value)
            }
            placeholder="e.g. San Francisco Bay Area, CA"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-eyebrow">
            Product or service
          </label>
          <select
            className={field}
            value={form.product_service}
            onChange={(event) =>
              set("product_service", event.target.value)
            }
          >
            <option value="product">
              Product
            </option>
            <option value="service">
              Service
            </option>
            <option value="both">
              Both
            </option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-eyebrow">
            Audience
          </label>
          <select
            className={field}
            value={form.audience}
            onChange={(event) =>
              set("audience", event.target.value)
            }
          >
            <option value="b2b">
              B2B
            </option>
            <option value="b2c">
              B2C
            </option>
            <option value="both">
              B2B and B2C
            </option>
          </select>
        </div>

        {kind === "request" && (
          <div className="grid gap-2">
            <label className="text-eyebrow">
              Expiration date (optional)
            </label>
            <input
              type="date"
              className={field}
              value={form.expires_at}
              onChange={(event) =>
                set("expires_at", event.target.value)
              }
            />
          </div>
        )}

        <div className="grid gap-2 sm:col-span-2">
          <label className="text-eyebrow">
            Keywords (comma separated)
          </label>
          <input
            className={field}
            value={form.keywords}
            onChange={(event) =>
              set("keywords", event.target.value)
            }
            placeholder="marketing, business development, California"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-5">
        <button
          type="submit"
          disabled={saving}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : editing
              ? "Save changes"
              : `Publish ${kind}`}
        </button>

        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="rounded-sm border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
