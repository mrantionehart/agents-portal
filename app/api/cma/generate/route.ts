// ============================================================================
// POST /api/cma/generate — Generate branded CMA PDF (Agents Portal)
// Same PDF logic as Vault — agents use manual entry
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface CMAComp {
  address: string;
  soldDate: string;
  salePrice: number;
  beds: string;
  baths: string;
  sqft: number;
  pricePerSqft: number;
  notes: string;
}

interface PricingStep {
  step: string;
  price: number;
  strategy: string;
  indicator: string;
}

interface CMARequest {
  subject: {
    address: string;
    city: string;
    state: string;
    zip: string;
    currentList: number;
    dom: number;
    beds: number;
    baths: number;
    sqft: number;
    lotSize: string;
    yearBuilt: number;
    features: string;
    mlsNumber?: string;
  };
  narrative: string;
  comps: CMAComp[];
  pricing: {
    baselineLabel: string;
    baselineValue: number;
    adjustments: { label: string; value: string }[];
    engagementRange: string;
    currentVsRange: string;
  };
  pricingLadder: PricingStep[];
  recommendation: string;
  preparedBy?: string;
  preparedDate?: string;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function generateCMAPdf(data: CMARequest): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - margin * 2;
  let y = margin;

  const navy = [20, 40, 80] as [number, number, number];
  const gold = [180, 150, 80] as [number, number, number];
  const darkGray = [60, 60, 60] as [number, number, number];
  const medGray = [120, 120, 120] as [number, number, number];
  const lightBg = [245, 245, 250] as [number, number, number];
  const white = [255, 255, 255] as [number, number, number];

  // Header bar
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...white);
  doc.text("HARTFELT", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("REAL ESTATE", margin, 48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...gold);
  doc.text("CONFIDENTIAL MARKET ANALYSIS", pageW - margin, 32, { align: "right" });
  const prepDate = data.preparedDate || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 210);
  doc.text(`Prepared ${prepDate}`, pageW - margin, 48, { align: "right" });

  y = 90;

  // Subject property
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...navy);
  doc.text(data.subject.address, margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...medGray);
  const subjectLine = `Current List: ${formatCurrency(data.subject.currentList)}  |  ${data.subject.dom} Days on Market  |  ${data.subject.beds} BD / ${data.subject.baths} BA / ${data.subject.sqft.toLocaleString()} SF  |  ${data.subject.lotSize}  |  Built ${data.subject.yearBuilt}`;
  doc.text(subjectLine, margin, y);
  y += 10;
  if (data.subject.features) { doc.text(data.subject.features, margin, y); y += 10; }
  if (data.subject.mlsNumber) { doc.setFontSize(8); doc.text(`MLS# ${data.subject.mlsNumber}`, margin, y); y += 10; }

  y += 5;
  doc.setDrawColor(...gold);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 15;

  // Narrative
  if (data.narrative) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...darkGray);
    const narrativeLines = doc.splitTextToSize(data.narrative, contentW);
    doc.text(narrativeLines, margin, y);
    y += narrativeLines.length * 13 + 10;
  }

  // Comps table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  doc.text("RECENT SOLD COMPS", margin, y);
  y += 8;
  const compRows = data.comps.map((c) => [c.address, c.soldDate, formatCurrency(c.salePrice), c.beds + " / " + c.baths, c.sqft.toLocaleString(), "$" + c.pricePerSqft.toLocaleString(), c.notes]);
  autoTable(doc, {
    startY: y,
    head: [["Address", "Sold", "Sale Price", "Beds/Baths", "SF", "$/SF", "Notes"]],
    body: compRows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: darkGray, lineColor: [200, 200, 210], lineWidth: 0.5 },
    headStyles: { fillColor: navy, textColor: white, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: lightBg },
    columnStyles: { 0: { cellWidth: 120 }, 2: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  if (data.subject.mlsNumber) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...medGray);
    doc.text(`Sources: MARMLS #${data.subject.mlsNumber}, public record. Preliminary.`, margin, y);
    y += 16;
  } else { y += 8; }

  // Pricing math
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  doc.text("PRICING MATH", margin, y);
  y += 8;
  const pricingRows: string[][] = [];
  pricingRows.push([data.pricing.baselineLabel, formatCurrency(data.pricing.baselineValue)]);
  data.pricing.adjustments.forEach((adj) => pricingRows.push([adj.label, adj.value]));
  pricingRows.push(["Likely buyer engagement range", data.pricing.engagementRange]);
  pricingRows.push(["Current list vs. likely engagement range", data.pricing.currentVsRange]);
  autoTable(doc, {
    startY: y,
    body: pricingRows,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 8, right: 8 }, textColor: darkGray },
    columnStyles: { 0: { cellWidth: contentW * 0.65 }, 1: { cellWidth: contentW * 0.35, halign: "right", fontStyle: "bold" } },
    didParseCell: (hookData: any) => {
      const rowIdx = hookData.row.index;
      if (rowIdx >= pricingRows.length - 2) {
        hookData.cell.styles.fontStyle = "bold";
        if (rowIdx === pricingRows.length - 2) hookData.cell.styles.fillColor = [230, 240, 250];
      }
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 15;

  if (y + 180 > pageH) { doc.addPage(); y = margin; }

  // Pricing ladder
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  doc.text("RECOMMENDED PRICING LADDER", margin, y);
  y += 8;
  const ladderRows = data.pricingLadder.map((step) => [step.step, formatCurrency(step.price), step.strategy, step.indicator]);
  autoTable(doc, {
    startY: y,
    head: [["Step", "Price", "Strategy", "Indicator to Act"]],
    body: ladderRows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 6, textColor: darkGray, lineColor: [200, 200, 210], lineWidth: 0.5 },
    headStyles: { fillColor: navy, textColor: white, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: lightBg },
    columnStyles: { 0: { cellWidth: 90, fontStyle: "bold" }, 1: { cellWidth: 80, halign: "right", fontStyle: "bold" }, 2: { cellWidth: 180 }, 3: { cellWidth: contentW - 350 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // Recommendation box
  if (data.recommendation) {
    if (y + 80 > pageH) { doc.addPage(); y = margin; }
    doc.setFillColor(240, 245, 255);
    doc.setDrawColor(...navy);
    doc.setLineWidth(1.5);
    const recLines = doc.splitTextToSize(data.recommendation, contentW - 24);
    const recH = recLines.length * 13 + 24;
    doc.roundedRect(margin, y, contentW, recH, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...navy);
    doc.text("RECOMMENDATION:", margin + 12, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text(recLines, margin + 12, y + 30);
    y += recH + 10;
  }

  // Footer
  const footerY = pageH - 30;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 10, pageW - margin, footerY - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...medGray);
  doc.text("HartFelt Real Estate  |  HartfeltRealEstate.com  |  Prepared for seller review — preliminary.", pageW / 2, footerY, { align: "center" });

  const pageCount = doc.getNumberOfPages();
  if (pageCount > 1) {
    doc.setPage(2);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 10, pageW - margin, footerY - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...medGray);
    doc.text("HartFelt Real Estate  |  HartfeltRealEstate.com  |  Prepared for seller review — preliminary.", pageW / 2, footerY, { align: "center" });
  }

  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}

export async function POST(req: NextRequest) {
  try {
    const body: CMARequest = await req.json();
    if (!body.subject?.address || !body.comps?.length) {
      return NextResponse.json({ error: "Subject address and at least one comp required" }, { status: 400 });
    }
    const pdfBytes = generateCMAPdf(body);
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CMA_${body.subject.address.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("CMA generation error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate CMA" }, { status: 500 });
  }
}
