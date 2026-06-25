// ============================================================================
// AGENT PORTAL 2.1 — R5 — Static catalogs (Scripts + Resources)
// ============================================================================
// The legacy /scripts and /resources pages hold their content live —
// the hub is an INDEX layer that surfaces the same categories /
// resources and deep-links back to the legacy surfaces. No content is
// duplicated; we just surface the index so the agent can discover
// what's available without leaving /training.
//
// To add a script category or resource: edit the legacy page that
// owns the actual content, then add an index entry here so the hub
// surfaces it. Both stay in sync because the legacy page is still
// where the file / video / link actually lives.
// ============================================================================

import type { HubItem } from "./types";

// ── Script Library ──────────────────────────────────────────────────
// One index entry per category specified in the R5 brief. Each
// deep-links to /scripts?category=… which the legacy Scripts page
// already supports.

export const SCRIPT_CATALOG: ReadonlyArray<HubItem> = [
  {
    id: "scripts/buyer",
    tab: "scripts",
    title: "Buyer scripts",
    category: "Buyer",
    description: "Discovery calls, qualification, showings, offer presentation.",
    open_url: "/scripts?category=buyer",
  },
  {
    id: "scripts/seller",
    tab: "scripts",
    title: "Seller scripts",
    category: "Seller",
    description: "Listing presentation, pricing, counter-offers, expectation setting.",
    open_url: "/scripts?category=seller",
  },
  {
    id: "scripts/listing",
    tab: "scripts",
    title: "Listing scripts",
    category: "Listing",
    description: "Listing appointment language, photo + staging coordination, broker open.",
    open_url: "/scripts?category=listing",
  },
  {
    id: "scripts/investor",
    tab: "scripts",
    title: "Investor scripts",
    category: "Investor",
    description: "Cap-rate conversation, exit strategy, off-market opportunities, JV terms.",
    open_url: "/scripts?category=investor",
  },
  {
    id: "scripts/luxury",
    tab: "scripts",
    title: "Luxury scripts",
    category: "Luxury",
    description: "High-net-worth discovery, white-glove process, discretion + privacy.",
    open_url: "/scripts?category=luxury",
  },
  {
    id: "scripts/objection",
    tab: "scripts",
    title: "Objection handling",
    category: "Objection",
    description: "Common objections + tested re-frames across buyer, seller, and investor calls.",
    open_url: "/scripts?category=objection",
  },
  {
    id: "scripts/appointment",
    tab: "scripts",
    title: "Appointment setting",
    category: "Appointment",
    description: "Calendar-confirmation scripts, no-show recovery, follow-up cadence.",
    open_url: "/scripts?category=appointment",
  },
] as const;

// ── Resources ───────────────────────────────────────────────────────
// Mirrors the categorical structure of the legacy /resources page.
// Each entry deep-links to /resources#<anchor> so the legacy page can
// scroll to the right section.

export const RESOURCE_CATALOG: ReadonlyArray<HubItem> = [
  {
    id: "resources/pdfs",
    tab: "resources",
    title: "PDFs",
    category: "Document",
    description: "Reference PDFs for licensing, statutes, and brokerage policy.",
    open_url: "/resources#pdfs",
  },
  {
    id: "resources/manuals",
    tab: "resources",
    title: "Manuals",
    category: "Document",
    description: "Step-by-step operating manuals for transaction workflows.",
    open_url: "/resources#manuals",
  },
  {
    id: "resources/downloads",
    tab: "resources",
    title: "Downloads",
    category: "Document",
    description: "Tooling, branded templates, and shareable assets.",
    open_url: "/resources#downloads",
  },
  {
    id: "resources/checklists",
    tab: "resources",
    title: "Checklists",
    category: "Checklist",
    description: "Per-vertical buyer / seller / listing / closing checklists.",
    open_url: "/resources#checklists",
  },
  {
    id: "resources/brokerage",
    tab: "resources",
    title: "Brokerage documents",
    category: "Brokerage",
    description: "Independent-contractor docs, commission schedules, and broker policies.",
    open_url: "/resources#brokerage",
  },
  {
    id: "resources/marketing",
    tab: "resources",
    title: "Marketing resources that actually work",
    category: "Marketing",
    description: "Proven marketing assets — open-house collateral, social templates, follow-up flows.",
    open_url: "/resources#marketing",
  },
] as const;
