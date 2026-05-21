// ============================================================================
// AI CMA Generator Screen
// AI-powered Comparative Market Analysis generator for Hartfelt advisors.
// Supports Sale and Lease modes. Dark theme to match Portal UI.
// ============================================================================

"use client";

import React, { useState, useRef } from "react";

export default function CMAGeneratorScreen() {
  // ── Mode ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"sale" | "lease">("sale");

  // ── Property fields ────────────────────────────────────────────────
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("FL");
  const [zip, setZip] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [lotSize, setLotSize] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [features, setFeatures] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [dom, setDom] = useState("");
  // Lease-specific
  const [sellerFloor, setSellerFloor] = useState("");
  const [alsoForSale, setAlsoForSale] = useState(false);
  const [salePrice, setSalePrice] = useState("");

  // ── State ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultHtml, setResultHtml] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Generate ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!address.trim()) {
      setError("Property address is required");
      return;
    }
    if (!beds || !baths || !sqft) {
      setError("Beds, baths, and square footage are required");
      return;
    }

    setLoading(true);
    setError("");
    setResultHtml("");

    try {
      const payload: any = {
        mode,
        property: {
          address: address.trim(),
          city: city.trim() || undefined,
          state: state.trim() || "FL",
          zip: zip.trim() || undefined,
          beds: Number(beds),
          baths: Number(baths),
          sqft: Number(sqft.replace(/,/g, "")),
          lotSize: lotSize.trim() || undefined,
          yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
          features: features.trim() || undefined,
          currentPrice: currentPrice ? Number(currentPrice.replace(/[,$]/g, "")) : undefined,
          dom: dom ? Number(dom) : undefined,
        },
      };

      if (mode === "lease") {
        if (sellerFloor) payload.property.sellerFloor = Number(sellerFloor.replace(/[,$]/g, ""));
        payload.property.alsoForSale = alsoForSale;
        if (alsoForSale && salePrice) payload.property.salePrice = Number(salePrice.replace(/[,$]/g, ""));
      }

      const res = await fetch("/api/broker/cma/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      setResultHtml(data.html);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  // ── Print ──────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!iframeRef.current) return;
    const win = iframeRef.current.contentWindow;
    if (win) win.print();
  };

  const handleNewWindow = () => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(resultHtml);
      win.document.close();
    }
  };

  // ── Tailwind classes ──────────────────────────────────────────────
  const inputCls = "w-full bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none";
  const labelCls = "text-xs text-gray-400 font-medium mb-1 block";

  return (
    <div>
      {resultHtml ? (
        /* ── Result View ─────────────────────────────────────────── */
        <div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <button
              onClick={handlePrint}
              className="bg-[#0a0a0f] text-amber-400 border border-amber-500/50 rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-amber-500/10 transition"
            >
              Print / Save PDF
            </button>
            <button
              onClick={handleNewWindow}
              className="bg-[#0a0a0f] text-amber-400 border border-amber-500/50 rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-amber-500/10 transition"
            >
              Open in New Window
            </button>
            <button
              onClick={() => setResultHtml("")}
              className="ml-auto bg-[#0a0a0f] text-gray-400 border border-[#1a1a2e] rounded-lg px-5 py-2.5 text-sm font-semibold hover:text-white hover:border-gray-500 transition"
            >
              Generate Another
            </button>
          </div>
          <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] overflow-hidden">
            <iframe
              ref={iframeRef}
              srcDoc={resultHtml}
              title="CMA Preview"
              className="w-full border-none"
              style={{ height: 900 }}
            />
          </div>
        </div>
      ) : (
        /* ── Form View ───────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Mode Selector */}
          <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-4 flex gap-3">
            {(["sale", "lease"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-3 px-5 rounded-lg text-sm font-bold transition-all ${
                  mode === m
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                    : "bg-[#050507] text-gray-400 border border-[#1a1a2e] hover:text-white"
                }`}
              >
                {m === "sale" ? "Sale CMA" : "Lease CMA"}
                <div className="text-[11px] font-normal mt-1 opacity-70">
                  {m === "sale"
                    ? "Sold-comp anchored pricing analysis"
                    : "Property-history anchored rental positioning"}
                </div>
              </button>
            ))}
          </div>

          {/* Property Details */}
          <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6">
            <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">
              Property Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>Street Address *</label>
                <input
                  className={inputCls}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="13724 SW 92nd Ct"
                />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Miami" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>State</label>
                  <input className={inputCls} value={state} onChange={(e) => setState(e.target.value)} placeholder="FL" />
                </div>
                <div>
                  <label className={labelCls}>ZIP</label>
                  <input className={inputCls} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="33176" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Beds *</label>
                <input className={inputCls} type="number" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="6" />
              </div>
              <div>
                <label className={labelCls}>Baths *</label>
                <input className={inputCls} type="number" value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="4" />
              </div>
              <div>
                <label className={labelCls}>Living SF *</label>
                <input className={inputCls} value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="5,741" />
              </div>
              <div>
                <label className={labelCls}>Lot Size</label>
                <input className={inputCls} value={lotSize} onChange={(e) => setLotSize(e.target.value)} placeholder="0.5 acre" />
              </div>
              <div>
                <label className={labelCls}>Year Built</label>
                <input className={inputCls} type="number" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} placeholder="1982" />
              </div>
              <div>
                <label className={labelCls}>{mode === "sale" ? "Current List Price" : "Current Asking Rent"}</label>
                <input className={inputCls} value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder={mode === "sale" ? "4,195,000" : "20,000"} />
              </div>
              <div>
                <label className={labelCls}>Days on Market</label>
                <input className={inputCls} type="number" value={dom} onChange={(e) => setDom(e.target.value)} placeholder="69" />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Lifestyle Features</label>
                <input
                  className={inputCls}
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                  placeholder="Private E-Lake frontage (operable — boating/jet ski)"
                />
              </div>
            </div>
          </div>

          {/* Lease-specific fields */}
          {mode === "lease" && (
            <div className="bg-[#0a0a0f] rounded-xl border border-[#1a1a2e] p-6">
              <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wider mb-4">
                Lease-Specific Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Seller&apos;s Comfort Floor (Monthly)</label>
                  <input className={inputCls} value={sellerFloor} onChange={(e) => setSellerFloor(e.target.value)} placeholder="14,000" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    checked={alsoForSale}
                    onChange={(e) => setAlsoForSale(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-[#050507] text-amber-500 focus:ring-amber-500"
                  />
                  <label className="text-sm text-gray-300">Also listed for sale</label>
                </div>
                {alsoForSale && (
                  <div>
                    <label className={labelCls}>Sale List Price</label>
                    <input className={inputCls} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="4,195,000" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg text-sm tracking-wide transition"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  Generating {mode === "sale" ? "Sale" : "Lease"} CMA...
                  <span className="inline-block animate-spin">&#9696;</span>
                </span>
              ) : (
                `Generate ${mode === "sale" ? "Sale" : "Lease"} CMA`
              )}
            </button>
          </div>

          {/* Methodology note */}
          <p className="text-center text-xs text-gray-500 leading-relaxed">
            The AI uses Hartfelt&apos;s proprietary {mode === "sale" ? "sold-comp anchored" : "property-history anchored"} methodology.
            <br />
            All data should be verified via Miami MLS Matrix before presenting to a seller.
          </p>
        </div>
      )}
    </div>
  );
}
