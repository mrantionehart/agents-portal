"use client";

import { useState, useEffect } from "react";
import {
  Bed,
  Bath,
  Maximize,
  Calendar,
  Home,
  Phone,
  Mail,
  Building2,
  FileText,
  Download,
  Play,
  Lock,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  MapPin,
  Calculator,
  Heart,
  MessageSquare,
  Share2,
  Copy,
  MessageCircle,
  Send,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface PortalMedia {
  id: string;
  type: "photo" | "video" | "tour" | "document";
  url: string;
  title?: string;
  description?: string;
}

interface PortalAgent {
  name: string;
  phone?: string;
  email?: string;
  brokerage_name?: string;
}

interface PortalData {
  property: {
    title: string;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    price?: number;
    bedrooms?: number;
    bathrooms?: number;
    sqft?: number;
    year_built?: number;
    property_type?: string;
    description?: string;
    features?: string[];
    panorama_url?: string;
  };
  media: PortalMedia[];
  agent: PortalAgent;
  deal_id?: string;
  existing_feedback?: PropertyFeedbackItem[];
}

interface PropertyFeedbackItem {
  property_title: string;
  is_favorite: boolean;
  comment: string;
}

interface ParsedPropertySection {
  category: string;
  address: string;
  fullText: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatAddress(property: PortalData["property"]): string {
  const parts = [property.address];
  if (property.city) parts.push(property.city);
  if (property.state) parts.push(property.state);
  if (property.zip) parts.push(property.zip);
  return parts.join(", ");
}

// ============================================================================
// Sub-Components
// ============================================================================

function BrandHeader() {
  return (
    <header className="w-full bg-gray-950 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hartfelt-logo.png"
          alt="HartFelt Real Estate"
          className="h-10 w-auto object-contain"
        />
        <p className="text-xs text-gray-500 tracking-widest uppercase hidden sm:block">
          Exclusive Property Presentation
        </p>
      </div>
    </header>
  );
}

function EmailGate({
  propertyTitle,
  propertyAddress,
  requiresPassword,
  requiresAuthorizedEmail,
  onSubmit,
  loading,
  error,
}: {
  propertyTitle?: string;
  propertyAddress?: string;
  requiresPassword?: boolean;
  requiresAuthorizedEmail?: boolean;
  onSubmit: (email: string, name: string, password: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    onSubmit(email.trim(), name.trim(), password);
  }

  const inputStyle = {
    "--tw-ring-color": "#C5A572",
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col">
      <BrandHeader />
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          {/* Property preview */}
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hartfelt-logo-tag.png"
              alt="HartFelt Real Estate"
              className="h-20 w-auto object-contain mx-auto mb-8"
            />
            {propertyTitle && (
              <h2 className="font-serif text-3xl font-bold text-white mb-2">
                {propertyTitle}
              </h2>
            )}
            {propertyAddress && (
              <p className="text-gray-400 text-sm">{propertyAddress}</p>
            )}
          </div>

          {/* Email form */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl shadow-lg border border-gray-700 p-8">
            <h3 className="font-serif text-xl font-semibold text-white mb-2">
              View This Exclusive Presentation
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {requiresAuthorizedEmail
                ? "Enter your authorized email to access this property presentation."
                : "Enter your email to unlock the full property details, photos, videos, and documents."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                  style={inputStyle}
                />
              </div>
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                  style={inputStyle}
                />
              </div>
              {requiresPassword && (
                <div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                    style={inputStyle}
                  />
                </div>
              )}

              {error && (
                <p className="text-red-500 text-sm text-left">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 rounded-lg text-white font-medium text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "#C5A572" }}
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    View Property <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-xs text-gray-600 mt-6">
            Your information is kept private and will not be shared.
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickFacts({ property }: { property: PortalData["property"] }) {
  const facts = [
    {
      icon: Bed,
      label: "Beds",
      value: property.bedrooms,
    },
    {
      icon: Bath,
      label: "Baths",
      value: property.bathrooms,
    },
    {
      icon: Maximize,
      label: "Sq Ft",
      value: property.sqft?.toLocaleString(),
    },
    {
      icon: Calendar,
      label: "Built",
      value: property.year_built,
    },
    {
      icon: Home,
      label: "Type",
      value: property.property_type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    },
  ].filter((f) => f.value != null && f.value !== "");

  if (facts.length === 0) return null;

  return (
    <div className="border-y border-gray-100 py-6">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-center gap-2 text-gray-600">
              <fact.icon className="w-5 h-5" style={{ color: "#C5A572" }} />
              <div>
                <span className="font-semibold text-gray-900">
                  {fact.value}
                </span>{" "}
                <span className="text-sm text-gray-500">{fact.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-serif text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
      <span
        className="w-1 h-7 rounded-full inline-block"
        style={{ backgroundColor: "#C5A572" }}
      />
      {children}
    </h3>
  );
}

function PropertyPanoramaEmbed({ url }: { url: string }) {
  const cleanUrl = url.split('#')[0];

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>Property Tools</SectionHeading>
      <p className="text-sm text-gray-500 mb-4">Virtual tour, internet providers, schools, calculator, and more</p>
      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
        <iframe
          src={cleanUrl}
          title="Property Panorama - Virtual Tour & Tools"
          allowFullScreen
          style={{
            width: "100%",
            height: "600px",
            border: "none",
          }}
        />
      </div>
    </section>
  );
}

function MortgageCalculator({ price }: { price: number }) {
  const [homePrice, setHomePrice] = useState(price);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [interestRate, setInterestRate] = useState(6.5);
  const [loanTerm, setLoanTerm] = useState<15 | 30>(30);

  const downPayment = homePrice * (downPaymentPct / 100);
  const loanAmount = homePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;

  let monthlyPI = 0;
  if (monthlyRate > 0 && loanAmount > 0) {
    monthlyPI =
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  } else if (loanAmount > 0) {
    monthlyPI = loanAmount / numPayments;
  }

  const monthlyTaxes = (homePrice * 0.012) / 12;
  const monthlyInsurance = (homePrice * 0.004) / 12;
  const totalMonthly = monthlyPI + monthlyTaxes + monthlyInsurance;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>Mortgage Calculator</SectionHeading>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <Calculator className="w-5 h-5" style={{ color: "#C5A572" }} />
          <span className="text-sm font-medium text-gray-600">Estimate your monthly payment</span>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Home Price
            </label>
            <input
              type="number"
              value={homePrice}
              onChange={(e) => setHomePrice(Number(e.target.value) || 0)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": "#C5A572" } as React.CSSProperties}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Down Payment
              </label>
              <span className="text-sm font-bold text-gray-900">
                {downPaymentPct}% &mdash; {fmt(downPayment)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={downPaymentPct}
              onChange={(e) => setDownPaymentPct(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: "#C5A572",
                background: `linear-gradient(to right, #C5A572 ${downPaymentPct * 2}%, #e5e7eb ${downPaymentPct * 2}%)`,
              }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Interest Rate (%)
            </label>
            <input
              type="number"
              step={0.125}
              min={0}
              max={15}
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": "#C5A572" } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Loan Term
            </label>
            <div className="flex gap-2">
              {([30, 15] as const).map((term) => (
                <button
                  key={term}
                  onClick={() => setLoanTerm(term)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={
                    loanTerm === term
                      ? { backgroundColor: "#C5A572", color: "#fff" }
                      : { backgroundColor: "#f3f4f6", color: "#374151" }
                  }
                >
                  {term} Years
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="text-center mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Estimated Monthly Payment
            </p>
            <p className="text-4xl font-bold" style={{ color: "#C5A572" }}>
              {fmt(totalMonthly)}
            </p>
            <p className="text-xs text-gray-400 mt-1">/month</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl bg-gray-50 py-3 px-2">
              <p className="text-xs text-gray-500 mb-1">Principal & Interest</p>
              <p className="text-sm font-semibold text-gray-900">{fmt(monthlyPI)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 py-3 px-2">
              <p className="text-xs text-gray-500 mb-1">Property Tax*</p>
              <p className="text-sm font-semibold text-gray-900">{fmt(monthlyTaxes)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 py-3 px-2">
              <p className="text-xs text-gray-500 mb-1">Insurance*</p>
              <p className="text-sm font-semibold text-gray-900">{fmt(monthlyInsurance)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">
            * Tax and insurance are estimates. Actual amounts may vary.
          </p>
        </div>
      </div>
    </section>
  );
}

function VideoSection({ media }: { media: PortalMedia[] }) {
  const videos = media.filter((m) => m.type === "video" || m.type === "tour");
  if (videos.length === 0) return null;

  const getVideoIcon = (url: string, type: string) => {
    if (type === "tour" || url.includes("zillow") || url.includes("3d")) return "3D Tour";
    if (url.includes("drone")) return "Drone";
    if (url.includes("cinematic")) return "Cinematic";
    if (url.includes("walkthrough")) return "Walkthrough";
    return "Video";
  };

  const isEmbeddable = (url: string) =>
    url.includes("youtube.com") || url.includes("youtu.be") ||
    url.includes("portal.exploreonemedia.com") ||
    (url.includes("zillow.com") && url.includes("view-imx"));

  const isDirectVideoFile = (url: string) => {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      return /\.(mp4|webm|mov|ogg)$/.test(pathname);
    } catch {
      return false;
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>Videos &amp; Tours</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {videos.map((video) => {
          if (isEmbeddable(video.url)) {
            let embedUrl = video.url;
            const ytMatch = video.url.match(
              /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
            );
            if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;

            return (
              <div key={video.id} className="space-y-2">
                <iframe
                  src={embedUrl}
                  title={video.title || "Property Video"}
                  allowFullScreen
                  style={{
                    width: "100%",
                    height: "400px",
                    border: "none",
                    borderRadius: "12px",
                    background: "#000",
                  }}
                />
                {video.title && (
                  <p className="text-sm text-gray-500 font-medium pl-1">
                    {video.title}
                  </p>
                )}
              </div>
            );
          }

          if (isDirectVideoFile(video.url)) {
            return (
              <div key={video.id} className="space-y-2">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  style={{
                    width: "100%",
                    height: "400px",
                    borderRadius: "12px",
                    background: "#000",
                    objectFit: "contain",
                  }}
                >
                  <source src={video.url} />
                  Your browser does not support the video tag.
                </video>
                {video.title && (
                  <p className="text-sm text-gray-500 font-medium pl-1">
                    {video.title}
                  </p>
                )}
              </div>
            );
          }

          const label = video.title || getVideoIcon(video.url, video.type);
          return (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all hover:shadow-lg bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center gap-4"
              style={{ height: "400px" }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ backgroundColor: "#C5A572" }}
              >
                <Play className="w-7 h-7 text-white ml-1" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-lg">{label}</p>
                <p className="text-gray-400 text-sm mt-1">Click to watch</p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PhotoGallery({ media }: { media: PortalMedia[] }) {
  const photos = media.filter((m) => m.type === "photo");
  if (photos.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>Photo Gallery</SectionHeading>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={photo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50 aspect-[4/3]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.title || "Property photo"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {photo.title && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-white text-sm">{photo.title}</p>
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}

function DocumentsSection({ media }: { media: PortalMedia[] }) {
  const docs = media.filter((m) => m.type === "document");
  if (docs.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>Documents</SectionHeading>
      <div className="space-y-3">
        {docs.map((doc) => (
          <a
            key={doc.id}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#C5A572" }}
            >
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {doc.title || "Document"}
              </p>
              {doc.description && (
                <p className="text-xs text-gray-500 truncate">
                  {doc.description}
                </p>
              )}
            </div>
            <Download className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
          </a>
        ))}
      </div>
    </section>
  );
}

function AgentContact({ agent }: { agent: PortalAgent }) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>Your Agent</SectionHeading>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center font-serif text-white text-xl font-bold flex-shrink-0"
            style={{ backgroundColor: "#C5A572" }}
          >
            {agent.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "A"}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">{agent.name}</p>
            {agent.brokerage_name && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {agent.brokerage_name}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
          {agent.phone && (
            <a
              href={`tel:${agent.phone}`}
              className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Phone className="w-4 h-4" style={{ color: "#C5A572" }} />
              {agent.phone}
            </a>
          )}
          {agent.email && (
            <a
              href={`mailto:${agent.email}`}
              className="flex items-center gap-3 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Mail className="w-4 h-4" style={{ color: "#C5A572" }} />
              {agent.email}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function PortalFooter() {
  return (
    <footer className="bg-gray-950 mt-12">
      <div className="max-w-6xl mx-auto px-6 py-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hartfelt-logo-tag.png"
          alt="HartFelt Real Estate - Because Choices Matter."
          className="h-16 w-auto object-contain mx-auto mb-6"
        />
        <p className="text-xs text-gray-500 max-w-lg mx-auto leading-relaxed">
          The information provided herein is deemed reliable but is not
          guaranteed and should be independently verified. This is not intended
          to solicit property already listed. All measurements are approximate.
        </p>
      </div>
    </footer>
  );
}

// ============================================================================
// STR Content Helpers
// ============================================================================

function parseDescription(description: string): {
  mainDescription: string;
  advisorNotes: string | null;
  buildingRecommendations: string[];
  complianceDisclaimer: string | null;
} {
  let mainDescription = description;
  let advisorNotes: string | null = null;
  let buildingRecommendations: string[] = [];
  let complianceDisclaimer: string | null = null;

  const disclaimerText =
    "Rental rules change frequently. This information is a starting point only and must be verified with the HOA, condo association, municipality, county, MLS remarks, condo docs, and current association rules before advising a client or submitting an offer.";
  if (mainDescription.includes(disclaimerText)) {
    complianceDisclaimer = disclaimerText;
    mainDescription = mainDescription.replace(disclaimerText, "").trim();
  }

  const notesMarker = "--- Advisor Notes ---";
  const notesIdx = mainDescription.indexOf(notesMarker);
  if (notesIdx !== -1) {
    const afterNotes = mainDescription.substring(notesIdx + notesMarker.length).trim();
    const nextMarker = afterNotes.indexOf("--- Airbnb Friendly Building Recommendations ---");
    if (nextMarker !== -1) {
      advisorNotes = afterNotes.substring(0, nextMarker).trim();
    } else {
      advisorNotes = afterNotes.trim();
    }
    mainDescription = mainDescription.substring(0, notesIdx).trim();
  }

  const buildingsMarker = "--- Airbnb Friendly Building Recommendations ---";
  const buildingsIdx = description.indexOf(buildingsMarker);
  if (buildingsIdx !== -1) {
    const buildingsText = description
      .substring(buildingsIdx + buildingsMarker.length)
      .replace(disclaimerText, "")
      .trim();
    buildingRecommendations = buildingsText
      .split("\n\n")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
    const mainBuildingsIdx = mainDescription.indexOf(buildingsMarker);
    if (mainBuildingsIdx !== -1) {
      mainDescription = mainDescription.substring(0, mainBuildingsIdx).trim();
    }
  }

  return { mainDescription, advisorNotes, buildingRecommendations, complianceDisclaimer };
}

function AdvisorNotesSection({ notes }: { notes: string }) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>From Your Advisor</SectionHeading>
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 max-w-3xl">
        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
          {notes}
        </p>
      </div>
    </section>
  );
}

function BuildingRecommendationsSection({
  buildings,
  idxMedia,
  agent,
}: {
  buildings: string[];
  idxMedia: PortalMedia[];
  agent: PortalAgent;
}) {
  if (buildings.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>Airbnb Friendly Building Recommendations</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {buildings.map((building, i) => {
          const lines = building.split("\n");
          const titleLine = lines[0] || "";
          const detailLines = lines.slice(1);
          const nameMatch = titleLine.split(" — ")[0]?.trim();
          const matchingMedia = idxMedia.find(
            (m) => m.title?.includes(nameMatch || "__nomatch__")
          );

          return (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: "#0891b210" }}
                >
                  <Building2 className="w-5 h-5" style={{ color: "#0891b2" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">
                    {titleLine}
                  </p>
                </div>
              </div>

              {detailLines.length > 0 && (
                <div className="space-y-1 ml-12 mb-3">
                  {detailLines.map((line, j) => (
                    <p key={j} className="text-xs text-gray-500 leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              )}

              {matchingMedia ? (
                <a
                  href={matchingMedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-12 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: "#0891b210",
                    color: "#0891b2",
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Active Listings
                </a>
              ) : agent?.email ? (
                <a
                  href={`mailto:${agent.email}?subject=${encodeURIComponent(`Request Current Units — ${nameMatch}`)}&body=${encodeURIComponent(`Hi ${agent.name || ""},\n\nI'm interested in current available units at ${nameMatch}. Could you send me the latest listings?\n\nThank you`)}`}
                  className="ml-12 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: "#C5A57215",
                    color: "#96793E",
                  }}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Request Current Units
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ComplianceDisclaimer() {
  return (
    <section className="max-w-6xl mx-auto px-6 pb-8">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 max-w-3xl">
        <AlertTriangle
          className="w-5 h-5 flex-shrink-0 mt-0.5"
          style={{ color: "#d97706" }}
        />
        <p className="text-xs text-amber-800 leading-relaxed">
          Rental rules change frequently. This information is a starting point
          only and must be verified with the HOA, condo association,
          municipality, county, MLS remarks, condo docs, and current association
          rules before advising a client or submitting an offer.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Property Sections Parser (for feedback poll)
// ============================================================================

function parsePropertySections(description: string): ParsedPropertySection[] {
  const separatorRegex = /━{5,}/;
  const sections = description.split(separatorRegex).map((s) => s.trim()).filter(Boolean);

  const results: ParsedPropertySection[] = [];

  for (const section of sections) {
    const categoryMatch = section.match(/★\s*(.+)/);
    const addressMatch = section.match(/📍\s*(.+)/);

    if (addressMatch) {
      results.push({
        category: categoryMatch ? categoryMatch[1].trim() : "",
        address: addressMatch[1].trim(),
        fullText: section,
      });
    }
  }

  return results;
}

// ============================================================================
// Share Bar
// ============================================================================

function ShareBar() {
  const [copied, setCopied] = useState(false);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareSubject = encodeURIComponent("Check out this property presentation");
  const shareBody = encodeURIComponent(`Take a look at this exclusive property presentation:\n\n${pageUrl}`);

  function handleCopyLink() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(pageUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div
      className="w-full border-b"
      style={{ backgroundColor: "#111827", borderColor: "#1f2937" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400 uppercase tracking-wide font-medium mr-2 flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" />
          Share
        </span>

        <button
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: copied ? "#16a34a" : "#C5A57220",
            color: copied ? "#fff" : "#C5A572",
            border: `1px solid ${copied ? "#16a34a" : "#C5A57240"}`,
          }}
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? "Copied!" : "Copy Link"}
        </button>

        <a
          href={`mailto:?subject=${shareSubject}&body=${shareBody}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: "#C5A57220",
            color: "#C5A572",
            border: "1px solid #C5A57240",
          }}
        >
          <Mail className="w-3.5 h-3.5" />
          Share via Email
        </a>

        <a
          href={`sms:?body=${shareBody}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: "#C5A57220",
            color: "#C5A572",
            border: "1px solid #C5A57240",
          }}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Share via Text
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// Client Feedback Poll
// ============================================================================

function ClientFeedbackSection({
  propertySections,
  token,
  clientEmail,
  clientName,
  existingFeedback,
}: {
  propertySections: ParsedPropertySection[];
  token: string;
  clientEmail: string;
  clientName: string;
  existingFeedback?: PropertyFeedbackItem[];
}) {
  const [name, setName] = useState(clientName);
  const [email, setEmail] = useState(clientEmail);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (existingFeedback && existingFeedback.length > 0) {
      const favs: Record<string, boolean> = {};
      const cmts: Record<string, string> = {};
      for (const fb of existingFeedback) {
        favs[fb.property_title] = fb.is_favorite;
        if (fb.comment) cmts[fb.property_title] = fb.comment;
      }
      setFavorites(favs);
      setComments(cmts);
    }
  }, [existingFeedback]);

  function toggleFavorite(address: string) {
    setFavorites((prev) => ({ ...prev, [address]: !prev[address] }));
  }

  function updateComment(address: string, value: string) {
    setComments((prev) => ({ ...prev, [address]: value }));
  }

  async function handleSubmit() {
    if (!email.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    const feedback = propertySections.map((ps) => ({
      property_title: ps.address,
      is_favorite: !!favorites[ps.address],
      comment: comments[ps.address] || "",
    }));

    try {
      const res = await fetch("/api/deal-portal/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          client_name: name,
          client_email: email,
          feedback,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit feedback.");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (propertySections.length === 0) return null;

  if (submitted) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-12">
        <SectionHeading>Client Feedback</SectionHeading>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 max-w-2xl text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "#16a34a" }} />
          <h4 className="font-serif text-xl font-bold text-gray-900 mb-2">
            Thank You for Your Feedback!
          </h4>
          <p className="text-gray-600 text-sm">
            Your selections and comments have been submitted to your agent.
            They will follow up with you shortly.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <SectionHeading>Client Feedback</SectionHeading>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Mark your favorite properties and leave comments for your agent.
        Your feedback helps us narrow down the best options for you.
      </p>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": "#C5A572" } as React.CSSProperties}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Your Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": "#C5A572" } as React.CSSProperties}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 max-w-2xl mb-8">
        {propertySections.map((ps, i) => (
          <div
            key={i}
            className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
            style={{
              borderColor: favorites[ps.address] ? "#C5A572" : "#e5e7eb",
            }}
          >
            <div className="flex items-start gap-3 mb-3">
              <button
                onClick={() => toggleFavorite(ps.address)}
                className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
                title={favorites[ps.address] ? "Remove from favorites" : "Mark as favorite"}
              >
                <Heart
                  className="w-6 h-6 transition-colors"
                  style={{
                    color: favorites[ps.address] ? "#C5A572" : "#d1d5db",
                    fill: favorites[ps.address] ? "#C5A572" : "none",
                  }}
                />
              </button>
              <div className="flex-1 min-w-0">
                {ps.category && (
                  <span
                    className="inline-block text-xs font-semibold uppercase tracking-wide mb-1 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "#C5A57215",
                      color: "#96793E",
                    }}
                  >
                    {ps.category}
                  </span>
                )}
                <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#C5A572" }} />
                  {ps.address}
                </p>
              </div>
            </div>

            <div className="ml-9">
              <div className="flex items-center gap-1.5 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Notes / Comments</span>
              </div>
              <textarea
                value={comments[ps.address] || ""}
                onChange={(e) => updateComment(ps.address, e.target.value)}
                placeholder="Share your thoughts on this property..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                style={{ "--tw-ring-color": "#C5A572" } as React.CSSProperties}
              />
            </div>
          </div>
        ))}
      </div>

      {submitError && (
        <p className="text-red-500 text-sm mb-3 max-w-2xl">{submitError}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={submitting || !email.trim()}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium text-sm transition-opacity disabled:opacity-50"
        style={{ backgroundColor: "#C5A572" }}
      >
        {submitting ? (
          <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit Feedback
          </>
        )}
      </button>
    </section>
  );
}

// ============================================================================
// Full Presentation View
// ============================================================================

function PropertyPresentation({
  data,
  token,
  clientEmail,
  clientName,
}: {
  data: PortalData;
  token: string;
  clientEmail: string;
  clientName: string;
}) {
  const { property, media, agent } = data;

  const {
    mainDescription,
    advisorNotes,
    buildingRecommendations,
    complianceDisclaimer,
  } = property.description
    ? parseDescription(property.description)
    : {
        mainDescription: "",
        advisorNotes: null,
        buildingRecommendations: [],
        complianceDisclaimer: null,
      };

  const propertySections = property.description
    ? parsePropertySections(property.description)
    : [];

  const idxMedia = media.filter(
    (m) =>
      m.type === "document" &&
      m.url?.includes("idxbroker.com")
  );
  const regularDocs = media.filter(
    (m) =>
      m.type === "document" &&
      !m.url?.includes("idxbroker.com")
  );
  const nonDocMedia = media.filter((m) => m.type !== "document");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <BrandHeader />
      <ShareBar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5" style={{ color: "#C5A572" }} />
            <span
              className="text-sm font-medium tracking-wide uppercase"
              style={{ color: "#C5A572" }}
            >
              {buildingRecommendations.length > 0
                ? "Investment Dashboard"
                : "Exclusive Listing"}
            </span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-3 leading-tight">
            {property.title}
          </h2>
          <p className="text-gray-300 text-lg mb-6">
            {formatAddress(property)}
          </p>
          {property.price != null && property.price > 0 && (
            <p className="text-4xl md:text-5xl font-bold" style={{ color: "#C5A572" }}>
              {formatPrice(property.price)}
            </p>
          )}
        </div>
      </section>

      {/* Quick Facts */}
      <QuickFacts property={property} />

      {/* Description */}
      {mainDescription && (
        <section className="max-w-6xl mx-auto px-6 py-12">
          <SectionHeading>About This Property</SectionHeading>
          <p className="text-gray-600 leading-relaxed whitespace-pre-line max-w-3xl">
            {mainDescription}
          </p>
        </section>
      )}

      {/* Advisor Notes */}
      {advisorNotes && <AdvisorNotesSection notes={advisorNotes} />}

      {/* Building Recommendations */}
      {buildingRecommendations.length > 0 && (
        <BuildingRecommendationsSection
          buildings={buildingRecommendations}
          idxMedia={idxMedia}
          agent={agent}
        />
      )}

      {/* Compliance Disclaimer */}
      {complianceDisclaimer && <ComplianceDisclaimer />}

      {/* Client Feedback Poll */}
      {propertySections.length > 0 && (
        <ClientFeedbackSection
          propertySections={propertySections}
          token={token}
          clientEmail={clientEmail}
          clientName={clientName}
          existingFeedback={data.existing_feedback}
        />
      )}

      {/* Features */}
      {property.features && property.features.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-12">
          <SectionHeading>Features</SectionHeading>
          <div className="flex flex-wrap gap-3">
            {property.features.map((feature, i) => (
              <span
                key={i}
                className="px-4 py-2 rounded-full text-sm font-medium border"
                style={{
                  borderColor: "#C5A572",
                  color: "#8B7340",
                  backgroundColor: "#C5A57210",
                }}
              >
                {feature}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Videos & Tours */}
      <VideoSection media={[...nonDocMedia]} />

      {/* Photo Gallery */}
      <PhotoGallery media={[...nonDocMedia]} />

      {/* IDX Listing Links */}
      {idxMedia.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-12">
          <SectionHeading>Active Listings</SectionHeading>
          <div className="space-y-3">
            {idxMedia.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-cyan-200 hover:border-cyan-300 bg-cyan-50/50 hover:bg-cyan-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-cyan-100">
                  <ExternalLink className="w-5 h-5 text-cyan-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.title || "View Active Listings"}
                  </p>
                  {doc.description && (
                    <p className="text-xs text-gray-500 truncate">
                      {doc.description}
                    </p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-600 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Regular Documents */}
      {regularDocs.length > 0 && (
        <DocumentsSection media={regularDocs} />
      )}

      {/* Agent Contact */}
      <AgentContact agent={agent} />

      {/* Property Panorama Tools */}
      {property.panorama_url && <PropertyPanoramaEmbed url={property.panorama_url} />}

      {/* Mortgage Calculator */}
      {property.price && property.price > 0 && <MortgageCalculator price={property.price} />}

      {/* Footer */}
      <PortalFooter />
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PortalPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");

  // Preview state — property info + gate requirements
  const [previewTitle, setPreviewTitle] = useState<string | undefined>();
  const [previewAddress, setPreviewAddress] = useState<string | undefined>();
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [requiresAuthorizedEmail, setRequiresAuthorizedEmail] = useState(false);

  // Fetch preview info on mount (title, address, gate flags)
  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch("/api/deal-portal/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, preview: true }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.preview) {
            setPreviewTitle(data.preview.title);
            setPreviewAddress(data.preview.address);
            setRequiresPassword(!!data.preview.requires_password);
            setRequiresAuthorizedEmail(!!data.preview.requires_authorized_email);
          }
        } else if (res.status === 404) {
          setNotFound(true);
        }
      } catch {
        // Preview fetch is optional
      }
    }
    fetchPreview();
  }, [token]);

  async function handleEmailSubmit(email: string, name: string, password: string) {
    setLoading(true);
    setError(null);
    setClientEmail(email);
    setClientName(name);

    try {
      const res = await fetch("/api/deal-portal/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          name: name || undefined,
          ...(password ? { password } : {}),
        }),
      });

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unable to access this portal.");
      }

      const raw = await res.json();
      const p = raw.portal;

      const data: PortalData = {
        property: {
          title: p.title,
          address: p.address,
          city: p.city,
          state: p.state,
          zip: p.zip,
          price: p.price,
          bedrooms: p.beds,
          bathrooms: p.baths,
          sqft: p.sqft,
          year_built: p.year_built,
          property_type: p.property_type,
          description: p.description,
          features: p.features,
          panorama_url: p.panorama_url || undefined,
        },
        media: (p.media || []).map((m: any) => ({
          id: m.id,
          type: m.type || m.media_type,
          url: m.url,
          title: m.title,
          description: m.description,
        })),
        agent: {
          name: p.agent_name,
          phone: p.agent_phone,
          email: p.agent_email,
          brokerage_name: p.brokerage_name,
        },
        existing_feedback: raw.existing_feedback || undefined,
      };

      setPortalData(data);
      setUnlocked(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // Not found state
  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <BrandHeader />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hartfelt-logo.png"
              alt="HartFelt Real Estate"
              className="h-14 w-auto object-contain mx-auto mb-8"
            />
            <h2 className="font-serif text-2xl font-bold text-white mb-2">
              Portal Not Found
            </h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              This property portal link is invalid or has expired. Please
              contact your agent for an updated link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Email gate
  if (!unlocked || !portalData) {
    return (
      <EmailGate
        propertyTitle={previewTitle}
        propertyAddress={previewAddress}
        requiresPassword={requiresPassword}
        requiresAuthorizedEmail={requiresAuthorizedEmail}
        onSubmit={handleEmailSubmit}
        loading={loading}
        error={error}
      />
    );
  }

  // Full presentation
  return (
    <PropertyPresentation
      data={portalData}
      token={token}
      clientEmail={clientEmail}
      clientName={clientName}
    />
  );
}
