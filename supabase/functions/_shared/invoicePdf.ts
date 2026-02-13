import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "npm:pdf-lib@1.17.1";

export interface InvoicePdfData {
  invoiceNumber: string;
  date: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  lineItems: { description: string; amount: number }[];
  totalAmount: number;
}

// Brand colors
const GOLD = rgb(0.91, 0.64, 0.09);        // #E8A317 — Washero primary
const DARK = rgb(0.1, 0.1, 0.1);            // #1A1A1A
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT_GRAY = rgb(0.6, 0.6, 0.6);
const VERY_LIGHT = rgb(0.96, 0.96, 0.96);   // #F5F5F5
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.13, 0.55, 0.13);
const GREEN_BG = rgb(0.86, 0.97, 0.86);
const AMBER = rgb(0.6, 0.35, 0.05);
const AMBER_BG = rgb(0.99, 0.95, 0.78);
const RED = rgb(0.7, 0.15, 0.15);
const RED_BG = rgb(0.98, 0.88, 0.88);

function fmtArs(n: number): string {
  const formatted = Math.abs(n).toLocaleString("es-AR");
  return `$ ${formatted}`;
}

function rightAlignText(page: PDFPage, text: string, font: PDFFont, size: number, rightX: number, y: number, color = DARK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

export async function generateInvoicePdfBytes(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const { width, height } = page.getSize();

  const marginL = 50;
  const marginR = width - 50;
  const contentW = marginR - marginL;

  // ═══════════════════════════════════════════════
  // HEADER BAR — gold accent strip at very top
  // ═══════════════════════════════════════════════
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: GOLD });

  let y = height - 55;

  // ── Logo wordmark ──
  page.drawText("WASHERO", { x: marginL, y, size: 28, font: fontBold, color: GOLD });
  y -= 16;
  page.drawText("Lavado de autos a domicilio", { x: marginL, y, size: 9, font: fontOblique, color: GRAY });

  // ── Invoice number block (right side) ──
  const invY = height - 50;
  rightAlignText(page, "FACTURA", fontBold, 9, marginR, invY + 5, GRAY);
  rightAlignText(page, data.invoiceNumber, fontBold, 20, marginR, invY - 16, DARK);
  rightAlignText(page, `Fecha: ${data.date}`, font, 9, marginR, invY - 32, GRAY);

  // ── Status badge (right side) ──
  const statusText = data.status === "paid" ? "PAGADO" : data.status === "void" ? "ANULADO" : "PENDIENTE";
  const badgeBg = data.status === "paid" ? GREEN_BG : data.status === "void" ? RED_BG : AMBER_BG;
  const badgeColor = data.status === "paid" ? GREEN : data.status === "void" ? RED : AMBER;
  const badgeW = fontBold.widthOfTextAtSize(statusText, 9) + 20;
  const badgeX = marginR - badgeW;
  const badgeY = invY - 48;
  page.drawRectangle({ x: badgeX, y: badgeY - 4, width: badgeW, height: 18, color: badgeBg, borderColor: badgeColor, borderWidth: 0.5 });
  rightAlignText(page, statusText, fontBold, 9, marginR - 10, badgeY + 1, badgeColor);

  // ═══════════════════════════════════════════════
  // DIVIDER after header
  // ═══════════════════════════════════════════════
  y -= 35;
  page.drawLine({ start: { x: marginL, y }, end: { x: marginR, y }, thickness: 1, color: VERY_LIGHT });

  // ═══════════════════════════════════════════════
  // TWO-COLUMN: Company info (left) + Client (right)
  // ═══════════════════════════════════════════════
  y -= 25;
  const colMid = marginL + contentW / 2 + 20;

  // Company
  page.drawText("EMISOR", { x: marginL, y, size: 8, font: fontBold, color: GRAY });
  y -= 15;
  page.drawText("Washero", { x: marginL, y, size: 11, font: fontBold, color: DARK });
  y -= 14;
  page.drawText("info@washero.ar", { x: marginL, y, size: 9, font, color: GRAY });
  y -= 13;
  page.drawText("washero.ar", { x: marginL, y, size: 9, font, color: GRAY });
  y -= 13;
  page.drawText("+54 9 11 7624-7835", { x: marginL, y, size: 9, font, color: GRAY });

  // Client (right column, same vertical position)
  let cy = y + 55; // align with EMISOR
  page.drawText("CLIENTE", { x: colMid, y: cy, size: 8, font: fontBold, color: GRAY });
  cy -= 15;
  page.drawText(data.customerName || "Cliente", { x: colMid, y: cy, size: 11, font: fontBold, color: DARK });
  cy -= 14;
  if (data.customerEmail) {
    page.drawText(data.customerEmail, { x: colMid, y: cy, size: 9, font, color: GRAY });
    cy -= 13;
  }
  if (data.customerPhone) {
    page.drawText(data.customerPhone, { x: colMid, y: cy, size: 9, font, color: GRAY });
  }

  // ═══════════════════════════════════════════════
  // ITEMS TABLE
  // ═══════════════════════════════════════════════
  y -= 40;
  page.drawLine({ start: { x: marginL, y: y + 5 }, end: { x: marginR, y: y + 5 }, thickness: 0.5, color: VERY_LIGHT });

  // Table header
  y -= 5;
  page.drawRectangle({ x: marginL, y: y - 8, width: contentW, height: 24, color: VERY_LIGHT });
  page.drawText("DESCRIPCION", { x: marginL + 10, y: y - 2, size: 8, font: fontBold, color: GRAY });
  rightAlignText(page, "MONTO", fontBold, 8, marginR - 10, y - 2, GRAY);

  // Rows
  y -= 28;
  for (let i = 0; i < data.lineItems.length; i++) {
    const item = data.lineItems[i];

    // Alternating subtle stripe
    if (i % 2 === 1) {
      page.drawRectangle({ x: marginL, y: y - 8, width: contentW, height: 24, color: rgb(0.985, 0.985, 0.985) });
    }

    page.drawText(item.description || "", { x: marginL + 10, y: y - 1, size: 10, font, color: DARK });
    rightAlignText(page, fmtArs(item.amount), font, 10, marginR - 10, y - 1, DARK);
    y -= 26;
  }

  // ═══════════════════════════════════════════════
  // TOTALS BOX (right-aligned)
  // ═══════════════════════════════════════════════
  y -= 10;
  page.drawLine({ start: { x: marginL, y: y + 5 }, end: { x: marginR, y: y + 5 }, thickness: 1, color: VERY_LIGHT });

  const totalsBoxW = 200;
  const totalsBoxX = marginR - totalsBoxW;

  // Subtotal
  y -= 8;
  page.drawText("Subtotal", { x: totalsBoxX, y, size: 9, font, color: GRAY });
  rightAlignText(page, fmtArs(data.totalAmount), font, 9, marginR - 10, y, GRAY);

  // Discount (placeholder for future)
  y -= 18;
  page.drawText("Descuento", { x: totalsBoxX, y, size: 9, font, color: GRAY });
  rightAlignText(page, "$ 0", font, 9, marginR - 10, y, GRAY);

  // Total box
  y -= 25;
  page.drawRectangle({ x: totalsBoxX - 5, y: y - 10, width: totalsBoxW + 5, height: 34, color: GOLD });
  page.drawText("TOTAL", { x: totalsBoxX + 5, y: y - 1, size: 12, font: fontBold, color: WHITE });
  rightAlignText(page, fmtArs(data.totalAmount), fontBold, 14, marginR - 10, y - 2, WHITE);

  // ═══════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════
  const footerY = 75;
  page.drawLine({ start: { x: marginL, y: footerY + 15 }, end: { x: marginR, y: footerY + 15 }, thickness: 0.5, color: VERY_LIGHT });

  page.drawText("Gracias por elegir Washero", { x: marginL, y: footerY, size: 9, font: fontOblique, color: GOLD });

  page.drawText("Factura / Comprobante interno — No valido como factura AFIP", {
    x: marginL, y: footerY - 16, size: 7, font, color: LIGHT_GRAY,
  });

  page.drawText("washero.ar  |  info@washero.ar  |  +54 9 11 7624-7835", {
    x: marginL, y: footerY - 30, size: 7, font, color: LIGHT_GRAY,
  });

  // Bottom gold strip
  page.drawRectangle({ x: 0, y: 0, width, height: 4, color: GOLD });

  return await doc.save();
}
