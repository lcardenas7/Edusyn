import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import https from 'https';
import http from 'http';

interface PageConfig {
  size: any;
  margin: number;
  contentWidth: number;
  isHalfLetter: boolean;
}

interface DocColors {
  primary: string;
  secondary: string;
  text: string;
  lightText: string;
  border: string;
}

@Injectable()
export class PdfGeneratorService {
  constructor(private prisma: PrismaService) {}

  private async fetchImage(url: string): Promise<Buffer | null> {
    try {
      return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
          if (res.statusCode !== 200) { resolve(null); return; }
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', () => resolve(null));
        }).on('error', () => resolve(null));
      });
    } catch {
      return null;
    }
  }

  private getPageConfig(settings: any): PageConfig {
    const isHalfLetter = settings?.invoicePageSize === 'HALF_LETTER';
    return {
      size: isHalfLetter ? [396, 612] as any : 'LETTER',
      margin: isHalfLetter ? 28 : 40,
      contentWidth: isHalfLetter ? 340 : 532,
      isHalfLetter,
    };
  }

  private getColors(settings: any): DocColors {
    return {
      primary: settings?.invoicePrimaryColor || '#1E40AF',
      secondary: settings?.invoiceSecondaryColor || '#F0F9FF',
      text: '#1F2937',
      lightText: '#6B7280',
      border: '#D1D5DB',
    };
  }

  private generateVerificationHash(paymentId: string, amount: string, date: string): string {
    return crypto.createHash('sha256').update(`${paymentId}:${amount}:${date}`).digest('hex').substring(0, 16);
  }

  private async generateQRBuffer(data: string): Promise<Buffer | null> {
    try {
      const dataUrl = await QRCode.toDataURL(data, { width: 100, margin: 1, errorCorrectionLevel: 'M' });
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      return Buffer.from(base64, 'base64');
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INVOICE PDF
  // ═══════════════════════════════════════════════════════════════

  async generateInvoicePdf(invoiceId: string, institutionId: string): Promise<Buffer> {
    const invoice = await this.prisma.financialInvoice.findFirst({
      where: { id: invoiceId, institutionId },
      include: {
        thirdParty: true,
        items: true,
        institution: true,
      },
    });

    if (!invoice) throw new Error('Factura no encontrada');

    const settings = await this.prisma.financialSettings.findUnique({ where: { institutionId } });
    const pc = this.getPageConfig(settings);
    const colors = this.getColors(settings);
    const logoBuffer = await this.resolveLogoBuffer(settings, invoice.institution);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: pc.size, margin: pc.margin, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const m = pc.margin;
      const w = pc.contentWidth;

      // ── Top colored bar ──
      doc.rect(0, 0, doc.page.width, 6).fill(colors.primary);
      doc.y = m + 6;

      // ── Header ──
      this.drawProfessionalHeader(doc, invoice.institution, settings, logoBuffer, colors, m, w);

      // ── Document title bar ──
      const titleY = doc.y;
      doc.rect(m, titleY, w, 28).fill(colors.primary);
      doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold');
      doc.text(
        invoice.type === 'INCOME' ? 'FACTURA DE VENTA' : 'FACTURA DE COMPRA',
        m + 10, titleY + 7, { width: w / 2 - 10 },
      );
      doc.text(`N° ${invoice.invoiceNumber}`, m + w / 2, titleY + 7, { width: w / 2 - 10, align: 'right' });
      doc.fillColor(colors.text);
      doc.y = titleY + 34;

      // ── DIAN Resolution ──
      if (settings?.invoiceResolution) {
        doc.fontSize(7).font('Helvetica').fillColor(colors.lightText);
        let resText = settings.invoiceResolution;
        if (settings.invoiceResolutionDate) resText += ` del ${new Date(settings.invoiceResolutionDate).toLocaleDateString('es-CO')}`;
        if (settings.invoiceResolutionPrefix) resText += ` Prefijo: ${settings.invoiceResolutionPrefix}`;
        if (settings.invoiceRangeFrom != null && settings.invoiceRangeTo != null) resText += ` Del ${settings.invoiceRangeFrom} al ${settings.invoiceRangeTo}`;
        doc.text(resText, m, doc.y, { width: w, align: 'center' });
        doc.fillColor(colors.text);
      }
      doc.y += 6;

      // ── Invoice meta + client info (two columns) ──
      const metaY = doc.y;
      const halfW = (w - 10) / 2;

      // Left: Invoice info
      doc.rect(m, metaY, halfW, 60).lineWidth(0.5).stroke(colors.border);
      doc.fontSize(8).font('Helvetica-Bold').text('Fecha emisión:', m + 6, metaY + 6);
      doc.font('Helvetica').text(new Date(invoice.issueDate).toLocaleDateString('es-CO'), m + 80, metaY + 6);
      if (invoice.dueDate) {
        doc.font('Helvetica-Bold').text('Vencimiento:', m + 6, metaY + 20);
        doc.font('Helvetica').text(new Date(invoice.dueDate).toLocaleDateString('es-CO'), m + 80, metaY + 20);
      }
      doc.font('Helvetica-Bold').text('Estado:', m + 6, metaY + 34);
      const statusColor = invoice.status === 'PAID' ? '#059669' : invoice.status === 'CANCELLED' ? '#DC2626' : colors.primary;
      doc.fillColor(statusColor).font('Helvetica-Bold').text(this.getStatusLabel(invoice.status), m + 80, metaY + 34);
      doc.fillColor(colors.text);

      // Right: Client info
      const rightX = m + halfW + 10;
      doc.rect(rightX, metaY, halfW, 60).lineWidth(0.5).stroke(colors.border);
      doc.rect(rightX, metaY, halfW, 14).fill(colors.secondary);
      doc.fillColor(colors.text).fontSize(8).font('Helvetica-Bold').text('DATOS DEL CLIENTE', rightX + 6, metaY + 3);
      doc.font('Helvetica').fontSize(7);
      let clientY = metaY + 18;
      doc.text(invoice.thirdParty.name, rightX + 6, clientY, { width: halfW - 12 });
      clientY += 10;
      if (invoice.thirdParty.document) { doc.text(`Doc: ${invoice.thirdParty.document}`, rightX + 6, clientY); clientY += 10; }
      if (invoice.thirdParty.phone) { doc.text(`Tel: ${invoice.thirdParty.phone}`, rightX + 6, clientY); clientY += 10; }
      if (invoice.thirdParty.email) { doc.text(invoice.thirdParty.email, rightX + 6, clientY); }

      doc.y = metaY + 68;

      // ── Items Table ──
      this.drawProfessionalItemsTable(doc, invoice.items, colors, m, w);

      // ── Totals ──
      this.drawProfessionalTotals(doc, {
        subtotal: Number(invoice.subtotal),
        discount: Number(invoice.discountTotal || 0),
        tax: Number(invoice.taxTotal || 0),
        total: Number(invoice.total),
      }, colors, m, w);

      // ── Bank accounts ──
      if (settings?.invoiceShowBankAccounts !== false && settings?.bankAccounts) {
        this.drawBankAccounts(doc, settings.bankAccounts, colors, m, w);
      }

      // ── Footer ──
      this.drawProfessionalFooter(doc, invoice.institution, settings, colors, m, w, null);

      // ── Bottom colored bar ──
      doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(colors.primary);

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // RECEIPT PDF (Recibo de Pago)
  // ═══════════════════════════════════════════════════════════════

  async generateReceiptPdf(paymentId: string, institutionId: string): Promise<Buffer> {
    const payment = await this.prisma.financialPayment.findFirst({
      where: { id: paymentId, institutionId },
      include: {
        thirdParty: true,
        obligation: { include: { concept: true } },
        institution: true,
        receivedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!payment) throw new Error('Pago no encontrado');

    const settings = await this.prisma.financialSettings.findUnique({ where: { institutionId } });
    const pc = this.getPageConfig(settings);
    const colors = this.getColors(settings);
    const logoBuffer = await this.resolveLogoBuffer(settings, payment.institution);

    // Generate verification hash and QR
    const hash = this.generateVerificationHash(
      payment.id,
      String(payment.amount),
      payment.paymentDate.toISOString(),
    );

    let qrBuffer: Buffer | null = null;
    if (settings?.invoiceShowQR !== false) {
      const qrData = JSON.stringify({
        type: 'RECEIPT',
        id: payment.id,
        receipt: payment.receiptNumber,
        amount: Number(payment.amount),
        date: payment.paymentDate.toISOString().split('T')[0],
        hash,
      });
      qrBuffer = await this.generateQRBuffer(qrData);
    }

    // Save hash to payment if not already set
    if (!payment.verificationHash) {
      await this.prisma.financialPayment.update({
        where: { id: payment.id },
        data: { verificationHash: hash },
      }).catch(() => {});
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: pc.size, margin: pc.margin, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const m = pc.margin;
      const w = pc.contentWidth;
      const fs = pc.isHalfLetter ? 0.85 : 1; // font scale

      // ── Top colored bar ──
      doc.rect(0, 0, doc.page.width, 6).fill(colors.primary);
      doc.y = m + 6;

      // ── Header ──
      this.drawProfessionalHeader(doc, payment.institution, settings, logoBuffer, colors, m, w);

      // ── Document title bar ──
      const titleY = doc.y;
      doc.rect(m, titleY, w, 26).fill(colors.primary);
      doc.fillColor('#FFFFFF').fontSize(11 * fs).font('Helvetica-Bold');
      doc.text('RECIBO DE PAGO', m + 10, titleY + 7, { width: w / 2 - 10 });
      doc.text(`N° ${payment.receiptNumber || 'S/N'}`, m + w / 2, titleY + 7, { width: w / 2 - 10, align: 'right' });
      doc.fillColor(colors.text);
      doc.y = titleY + 32;

      // ── Payment details box ──
      const detailY = doc.y;
      doc.rect(m, detailY, w, pc.isHalfLetter ? 100 : 110).lineWidth(0.5).stroke(colors.border);
      doc.rect(m, detailY, w, 14).fill(colors.secondary);
      doc.fillColor(colors.text).fontSize(8 * fs).font('Helvetica-Bold').text('INFORMACIÓN DEL PAGO', m + 6, detailY + 3);

      const labelW = pc.isHalfLetter ? 85 : 110;
      const col1X = m + 6;
      const col1ValX = m + 6 + labelW;
      const col2X = m + w / 2 + 6;
      const col2ValX = m + w / 2 + 6 + labelW;
      let rowY = detailY + 20;
      const rowH = pc.isHalfLetter ? 12 : 14;

      doc.fontSize(7.5 * fs);

      // Row 1
      doc.font('Helvetica-Bold').text('Fecha:', col1X, rowY);
      doc.font('Helvetica').text(new Date(payment.paymentDate).toLocaleDateString('es-CO'), col1ValX, rowY);
      doc.font('Helvetica-Bold').text('Método:', col2X, rowY);
      doc.font('Helvetica').text(this.getPaymentMethodLabel(payment.paymentMethod), col2ValX, rowY);
      rowY += rowH;

      // Row 2
      doc.font('Helvetica-Bold').text('Recibido de:', col1X, rowY);
      doc.font('Helvetica').text(payment.thirdParty.name, col1ValX, rowY, { width: w / 2 - labelW - 12 });
      if (payment.thirdParty.document) {
        doc.font('Helvetica-Bold').text('Documento:', col2X, rowY);
        doc.font('Helvetica').text(payment.thirdParty.document, col2ValX, rowY);
      }
      rowY += rowH;

      // Row 3
      doc.font('Helvetica-Bold').text('Concepto:', col1X, rowY);
      doc.font('Helvetica').text(payment.obligation?.concept?.name || 'Pago general', col1ValX, rowY, { width: w - labelW - 12 });
      rowY += rowH;

      // Row 4
      if (payment.transactionRef) {
        doc.font('Helvetica-Bold').text('Referencia:', col1X, rowY);
        doc.font('Helvetica').text(payment.transactionRef, col1ValX, rowY);
        rowY += rowH;
      }
      if (payment.notes) {
        doc.font('Helvetica-Bold').text('Observaciones:', col1X, rowY);
        doc.font('Helvetica').text(payment.notes, col1ValX, rowY, { width: w - labelW - 12 });
        rowY += rowH;
      }

      doc.y = detailY + (pc.isHalfLetter ? 106 : 116);

      // ── Amount box ──
      const amtY = doc.y;
      doc.rect(m, amtY, w, pc.isHalfLetter ? 36 : 44).fill(colors.secondary);
      doc.rect(m, amtY, w, pc.isHalfLetter ? 36 : 44).lineWidth(1).stroke(colors.primary);
      doc.fillColor(colors.text).fontSize(9 * fs).font('Helvetica-Bold').text('VALOR RECIBIDO:', m + 10, amtY + (pc.isHalfLetter ? 4 : 6));
      doc.fillColor(colors.primary).fontSize(pc.isHalfLetter ? 16 : 20).font('Helvetica-Bold');
      doc.text(this.formatCurrency(Number(payment.amount)), m + 10, amtY + (pc.isHalfLetter ? 16 : 20));
      doc.fillColor(colors.text);

      doc.y = amtY + (pc.isHalfLetter ? 42 : 52);

      // ── QR + Signature area ──
      const bottomY = doc.y;
      const sigWidth = qrBuffer ? w - 110 : w;

      // QR Code (left)
      if (qrBuffer) {
        try {
          doc.image(qrBuffer, m, bottomY, { width: 80, height: 80 });
          doc.fontSize(5.5).font('Helvetica').fillColor(colors.lightText);
          doc.text(`Hash: ${hash}`, m, bottomY + 82, { width: 90, align: 'center' });
          doc.fillColor(colors.text);
        } catch { /* QR failed, skip */ }
      }

      // Signature (right)
      const sigX = qrBuffer ? m + 110 : m;
      const sigY = bottomY + (pc.isHalfLetter ? 30 : 40);
      doc.fontSize(8 * fs).font('Helvetica').fillColor(colors.lightText);
      doc.text('_'.repeat(35), sigX + sigWidth - 220, sigY, { width: 200, align: 'center' });
      doc.text(
        `Recibido por: ${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`,
        sigX + sigWidth - 220, sigY + 10, { width: 200, align: 'center' },
      );
      doc.fillColor(colors.text);

      // ── Bank accounts ──
      if (settings?.invoiceShowBankAccounts !== false && settings?.bankAccounts) {
        doc.y = bottomY + (pc.isHalfLetter ? 70 : 90);
        this.drawBankAccounts(doc, settings.bankAccounts, colors, m, w);
      }

      // ── Footer ──
      this.drawProfessionalFooter(doc, payment.institution, settings, colors, m, w, qrBuffer ? null : null);

      // ── Bottom colored bar ──
      doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(colors.primary);

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARED DRAWING HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async resolveLogoBuffer(settings: any, institution: any): Promise<Buffer | null> {
    if (settings?.invoiceLogoUrl) return this.fetchImage(settings.invoiceLogoUrl);
    if (institution?.logoUrl) return this.fetchImage(institution.logoUrl);
    return null;
  }

  private drawProfessionalHeader(
    doc: PDFKit.PDFDocument, institution: any, settings: any,
    logoBuffer: Buffer | null, colors: DocColors, m: number, w: number,
  ) {
    const startY = doc.y;
    const logoSize = 50;

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, m, startY, { width: logoSize, height: logoSize });
      } catch { /* logo failed */ }
    }

    const textX = logoBuffer ? m + logoSize + 10 : m;
    const textW = logoBuffer ? w - logoSize - 10 : w;
    const align = logoBuffer ? undefined : 'center' as const;

    // Institution name
    doc.fillColor(colors.primary).fontSize(14).font('Helvetica-Bold');
    doc.text(settings?.businessName || institution.name, textX, startY, { width: textW, align });

    // Sub-info
    doc.fillColor(colors.text).fontSize(7.5).font('Helvetica');
    const lines: string[] = [];
    if (settings?.taxId) lines.push(`NIT: ${settings.taxId}`);
    if (settings?.taxRegime) lines.push(this.getTaxRegimeLabel(settings.taxRegime));
    if (settings?.invoiceAddress || institution.address) lines.push(settings?.invoiceAddress || institution.address);
    if (settings?.invoiceCity) lines.push(settings.invoiceCity);
    if (settings?.ciiu) lines.push(`CIIU: ${settings.ciiu} - ${settings.economicActivity || ''}`);
    else if (settings?.economicActivity) lines.push(settings.economicActivity);

    const contactParts: string[] = [];
    if (settings?.invoicePhone || institution.phone) contactParts.push(`Tel: ${settings?.invoicePhone || institution.phone}`);
    if (settings?.invoiceEmail || institution.email) contactParts.push(settings?.invoiceEmail || institution.email);
    if (contactParts.length) lines.push(contactParts.join(' | '));

    lines.forEach(line => {
      doc.text(line, textX, doc.y, { width: textW, align });
    });

    doc.y = Math.max(doc.y, startY + logoSize) + 8;

    // Separator line
    doc.moveTo(m, doc.y).lineTo(m + w, doc.y).lineWidth(1).stroke(colors.primary);
    doc.y += 6;
  }

  private drawProfessionalItemsTable(
    doc: PDFKit.PDFDocument, items: any[], colors: DocColors, m: number, w: number,
  ) {
    const tableTop = doc.y;
    const descW = w - 170;
    const colWidths = [descW, 40, 65, 65];
    const headers = ['Descripción', 'Cant.', 'V. Unitario', 'Total'];

    // Header row
    doc.rect(m, tableTop, w, 16).fill(colors.primary);
    doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
    let cx = m + 4;
    headers.forEach((h, i) => {
      const align = i >= 2 ? 'right' : (i === 1 ? 'center' : undefined);
      doc.text(h, cx, tableTop + 4, { width: colWidths[i] - 8, align: align as any });
      cx += colWidths[i];
    });

    // Data rows
    doc.fillColor(colors.text).font('Helvetica').fontSize(7.5);
    let cy = tableTop + 20;

    items.forEach((item, idx) => {
      if (idx % 2 === 0) {
        doc.rect(m, cy - 2, w, 16).fill(colors.secondary);
        doc.fillColor(colors.text);
      }
      cx = m + 4;
      doc.text(item.description, cx, cy, { width: colWidths[0] - 8 });
      cx += colWidths[0];
      doc.text(String(item.quantity), cx, cy, { width: colWidths[1] - 8, align: 'center' });
      cx += colWidths[1];
      doc.text(this.formatCurrency(Number(item.unitPrice)), cx, cy, { width: colWidths[2] - 8, align: 'right' });
      cx += colWidths[2];
      doc.text(this.formatCurrency(Number(item.total)), cx, cy, { width: colWidths[3] - 8, align: 'right' });
      cy += 16;
    });

    // Bottom border
    doc.moveTo(m, cy).lineTo(m + w, cy).lineWidth(0.5).stroke(colors.border);
    doc.y = cy + 6;
  }

  private drawProfessionalTotals(
    doc: PDFKit.PDFDocument,
    totals: { subtotal: number; discount: number; tax: number; total: number },
    colors: DocColors, m: number, w: number,
  ) {
    const boxW = 180;
    const boxX = m + w - boxW;
    const startY = doc.y;

    doc.fontSize(8).font('Helvetica');
    let ty = startY;

    doc.text('Subtotal:', boxX, ty);
    doc.text(this.formatCurrency(totals.subtotal), boxX + 80, ty, { width: 90, align: 'right' });
    ty += 14;

    if (totals.discount > 0) {
      doc.text('Descuento:', boxX, ty);
      doc.text(`-${this.formatCurrency(totals.discount)}`, boxX + 80, ty, { width: 90, align: 'right' });
      ty += 14;
    }

    if (totals.tax > 0) {
      doc.text('IVA:', boxX, ty);
      doc.text(this.formatCurrency(totals.tax), boxX + 80, ty, { width: 90, align: 'right' });
      ty += 14;
    }

    // Total box
    doc.rect(boxX - 4, ty, boxW + 4, 22).fill(colors.primary);
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
    doc.text('TOTAL:', boxX, ty + 5);
    doc.text(this.formatCurrency(totals.total), boxX + 80, ty + 5, { width: 90, align: 'right' });
    doc.fillColor(colors.text);

    doc.y = ty + 30;
  }

  private drawBankAccounts(doc: PDFKit.PDFDocument, bankAccounts: any, colors: DocColors, m: number, w: number) {
    let accounts: any[] = [];
    try {
      accounts = typeof bankAccounts === 'string' ? JSON.parse(bankAccounts) : bankAccounts;
    } catch { return; }
    if (!Array.isArray(accounts) || accounts.length === 0) return;

    const startY = doc.y;
    doc.rect(m, startY, w, 12).fill(colors.secondary);
    doc.fillColor(colors.text).fontSize(7).font('Helvetica-Bold').text('CUENTAS BANCARIAS PARA PAGO', m + 6, startY + 2);
    doc.font('Helvetica').fontSize(6.5);
    let ay = startY + 14;
    accounts.forEach((acc: any) => {
      const parts = [acc.bankName, acc.accountType, acc.accountNumber].filter(Boolean);
      if (parts.length) {
        doc.text(`• ${parts.join(' - ')}`, m + 6, ay, { width: w - 12 });
        ay += 10;
      }
    });
    doc.y = ay + 4;
  }

  private drawProfessionalFooter(
    doc: PDFKit.PDFDocument, institution: any, settings: any,
    colors: DocColors, m: number, w: number, _qrBuffer: Buffer | null,
  ) {
    const pageH = doc.page.height;
    const footerTextHeight = settings?.invoiceFooterText ? 30 : 0;
    const footerY = pageH - 50 - footerTextHeight;

    // Separator
    doc.moveTo(m, footerY).lineTo(m + w, footerY).lineWidth(0.5).stroke(colors.border);

    // Legal text
    if (settings?.invoiceFooterText) {
      doc.fontSize(6).font('Helvetica').fillColor(colors.lightText);
      doc.text(settings.invoiceFooterText, m, footerY + 4, { width: w, align: 'center' });
    }

    // Generation timestamp
    doc.fontSize(6).font('Helvetica').fillColor(colors.lightText);
    doc.text(
      `Documento generado el ${new Date().toLocaleString('es-CO')} | Documento interno - No constituye factura electrónica`,
      m, pageH - 26, { width: w, align: 'center' },
    );

    if (settings?.billingMode === 'INTERNAL_ONLY') {
      doc.text('Para factura electrónica válida ante la DIAN, solicítela a su contador.', m, pageH - 18, { width: w, align: 'center' });
    }

    doc.fillColor(colors.text);
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  }

  private getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      CASH: 'Efectivo',
      TRANSFER: 'Transferencia bancaria',
      CARD: 'Tarjeta débito/crédito',
      PSE: 'PSE',
      NEQUI: 'Nequi',
      DAVIPLATA: 'Daviplata',
      OTHER: 'Otro',
    };
    return labels[method] || method;
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      ISSUED: 'Emitida',
      PAID: 'Pagada',
      CANCELLED: 'Anulada',
    };
    return labels[status] || status;
  }

  private getTaxRegimeLabel(regime: string): string {
    const labels: Record<string, string> = {
      RESPONSABLE_IVA: 'Responsable de IVA',
      NO_RESPONSABLE: 'No Responsable de IVA',
      REGIMEN_SIMPLE: 'Régimen Simple de Tributación',
    };
    return labels[regime] || regime;
  }
}
