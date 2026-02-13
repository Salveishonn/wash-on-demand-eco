import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

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

function fmtArs(n: number): string {
  return "$ " + n.toLocaleString("es-AR");
}

export async function generateInvoicePdfBytes(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  let y = height - 50;

  // ── Header ──
  page.drawText("WASHERO", { x: 50, y, size: 24, font: fontBold, color: rgb(0.49, 0.83, 0.34) });
  page.drawText(data.invoiceNumber, { x: width - 200, y, size: 16, font: fontBold });
  y -= 20;
  page.drawText(`Fecha: ${data.date}`, { x: width - 200, y, size: 10, font });
  y -= 15;
  const isPaid = data.status === "paid";
  page.drawText(isPaid ? "PAGADO" : "PENDIENTE", {
    x: width - 200, y, size: 10, font: fontBold,
    color: isPaid ? rgb(0.09, 0.39, 0.2) : rgb(0.57, 0.25, 0.05),
  });

  // ── Company info ──
  y -= 35;
  page.drawText("Washero - Lavado de autos a domicilio", { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 14;
  page.drawText("Email: info@washero.ar  |  Web: washero.ar", { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 14;
  page.drawText("Tel: +54 9 11 7624-7835", { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

  // ── Customer ──
  y -= 30;
  page.drawText("CLIENTE", { x: 50, y, size: 10, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  y -= 18;
  page.drawText(data.customerName || "Cliente", { x: 50, y, size: 12, font: fontBold });
  y -= 16;
  if (data.customerEmail) page.drawText(data.customerEmail, { x: 50, y, size: 10, font });
  y -= 16;
  if (data.customerPhone) page.drawText(data.customerPhone, { x: 50, y, size: 10, font });

  // ── Items table header ──
  y -= 30;
  page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 22, color: rgb(0.95, 0.95, 0.95) });
  page.drawText("Descripcion", { x: 55, y, size: 10, font: fontBold });
  page.drawText("Monto", { x: width - 140, y, size: 10, font: fontBold });

  // ── Line items ──
  y -= 28;
  for (const item of data.lineItems) {
    page.drawText(item.description || "", { x: 55, y, size: 10, font });
    page.drawText(fmtArs(item.amount), { x: width - 140, y, size: 10, font });
    y -= 20;
    page.drawLine({ start: { x: 50, y: y + 8 }, end: { x: width - 50, y: y + 8 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  }

  // ── Total ──
  y -= 8;
  page.drawLine({ start: { x: 50, y: y + 5 }, end: { x: width - 50, y: y + 5 }, thickness: 2, color: rgb(0.2, 0.2, 0.2) });
  y -= 8;
  page.drawText("TOTAL", { x: 55, y, size: 14, font: fontBold });
  page.drawText(fmtArs(data.totalAmount), { x: width - 140, y, size: 14, font: fontBold });

  // ── Footer ──
  page.drawText("WASHERO - Lavado de autos a domicilio", { x: 50, y: 60, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
  page.drawText("washero.ar  |  info@washero.ar  |  +54 9 11 7624-7835", { x: 50, y: 46, size: 9, font, color: rgb(0.6, 0.6, 0.6) });

  return await doc.save();
}
