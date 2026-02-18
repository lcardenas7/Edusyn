import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupabaseStorageService } from '../../storage/supabase-storage.service';
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
  constructor(
    private prisma: PrismaService,
    private storageService: SupabaseStorageService,
  ) {}

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

    // Generate QR for invoice verification
    let qrBuffer: Buffer | null = null;
    if (settings?.invoiceShowQR !== false) {
      const qrData = JSON.stringify({
        type: 'INVOICE',
        id: invoice.id,
        number: invoice.invoiceNumber,
        total: Number(invoice.total),
        date: invoice.issueDate.toISOString().split('T')[0],
      });
      qrBuffer = await this.generateQRBuffer(qrData);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: pc.size, margins: { top: pc.margin, bottom: 15, left: pc.margin, right: pc.margin }, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const m = pc.margin;
      const w = pc.contentWidth;
      const pageH = doc.page.height;
      const hl = pc.isHalfLetter;
      const fs = hl ? 0.85 : 1;

      // ── Top colored bar ──
      doc.rect(0, 0, doc.page.width, 4).fill(colors.primary);

      // ── Compact Header ──
      let y = m;
      const logoSize = pc.isHalfLetter ? 35 : 45;
      
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, m, y, { width: logoSize, height: logoSize });
        } catch { /* logo failed */ }
      }

      const textX = logoBuffer ? m + logoSize + 8 : m;
      const textW = logoBuffer ? w - logoSize - 8 : w;
      const align = logoBuffer ? undefined : 'center' as const;

      doc.fillColor(colors.primary).fontSize(12 * fs).font('Helvetica-Bold');
      doc.text(settings?.businessName || invoice.institution.name, textX, y, { width: textW, align });
      
      doc.fillColor(colors.text).fontSize(6.5 * fs).font('Helvetica');
      const infoLines: string[] = [];
      if (settings?.taxId) infoLines.push(`NIT: ${settings.taxId}`);
      if (settings?.taxRegime) infoLines.push(this.getTaxRegimeLabel(settings.taxRegime));
      if (settings?.invoiceAddress || invoice.institution.address) infoLines.push(settings?.invoiceAddress || invoice.institution.address || '');
      const contactParts: string[] = [];
      if (settings?.invoicePhone || invoice.institution.phone) contactParts.push(`Tel: ${settings?.invoicePhone || invoice.institution.phone}`);
      if (settings?.invoiceEmail || invoice.institution.email) contactParts.push(settings?.invoiceEmail || invoice.institution.email || '');
      if (contactParts.length) infoLines.push(contactParts.join(' | '));
      
      infoLines.forEach(line => {
        doc.text(line, textX, doc.y, { width: textW, align });
      });

      y = Math.max(doc.y, m + logoSize) + 4;
      doc.moveTo(m, y).lineTo(m + w, y).lineWidth(0.5).stroke(colors.primary);
      y += 4;

      // ── Title bar ──
      const titleH = pc.isHalfLetter ? 18 : 22;
      doc.rect(m, y, w, titleH).fill(colors.primary);
      doc.fillColor('#FFFFFF').fontSize(9 * fs).font('Helvetica-Bold');
      doc.text(invoice.type === 'INCOME' ? 'FACTURA DE VENTA' : 'FACTURA DE COMPRA', m + 8, y + (titleH - 9 * fs) / 2, { width: w / 2 - 8 });
      doc.text(`N° ${invoice.invoiceNumber}`, m + w / 2, y + (titleH - 9 * fs) / 2, { width: w / 2 - 8, align: 'right' });
      doc.fillColor(colors.text);
      y += titleH + 2;

      // ── DIAN Resolution (compact) ──
      if (settings?.invoiceResolution) {
        doc.fontSize(5.5 * fs).font('Helvetica').fillColor(colors.lightText);
        let resText = settings.invoiceResolution;
        if (settings.invoiceResolutionDate) resText += ` del ${new Date(settings.invoiceResolutionDate).toLocaleDateString('es-CO')}`;
        if (settings.invoiceResolutionPrefix) resText += ` Prefijo: ${settings.invoiceResolutionPrefix}`;
        if (settings.invoiceRangeFrom != null && settings.invoiceRangeTo != null) resText += ` Del ${settings.invoiceRangeFrom} al ${settings.invoiceRangeTo}`;
        doc.text(resText, m, y, { width: w, align: 'center' });
        doc.fillColor(colors.text);
        y += 10;
      } else {
        y += 4;
      }

      // ── Two-column: Client info (left) + Invoice meta + QR (right) ──
      const qrDrawSize = hl ? 40 : 48; // contained QR size
      const colGap = 8;
      const leftW = qrBuffer ? w * 0.55 : w * 0.5;
      const rightW = w - leftW - colGap;
      const boxH = hl ? 55 : 62;

      // Left: Client info
      doc.rect(m, y, leftW, boxH).lineWidth(0.5).stroke(colors.border);
      doc.rect(m, y, leftW, 11).fill(colors.secondary);
      doc.fillColor(colors.text).fontSize(6.5 * fs).font('Helvetica-Bold').text('DATOS DEL CLIENTE', m + 4, y + 2);
      
      let clientY = y + 14;
      const clientRowH = pc.isHalfLetter ? 8 : 9;
      doc.fontSize(6 * fs).font('Helvetica-Bold').text('Nombre:', m + 4, clientY);
      doc.font('Helvetica').text(invoice.thirdParty.name, m + 45, clientY, { width: leftW - 50 });
      clientY += clientRowH;
      if (invoice.thirdParty.document) {
        doc.font('Helvetica-Bold').text('Documento:', m + 4, clientY);
        doc.font('Helvetica').text(invoice.thirdParty.document, m + 45, clientY);
        clientY += clientRowH;
      }
      if (invoice.thirdParty.phone) {
        doc.font('Helvetica-Bold').text('Teléfono:', m + 4, clientY);
        doc.font('Helvetica').text(invoice.thirdParty.phone, m + 45, clientY);
        clientY += clientRowH;
      }
      if (invoice.thirdParty.email) {
        doc.font('Helvetica-Bold').text('Email:', m + 4, clientY);
        doc.font('Helvetica').text(invoice.thirdParty.email, m + 45, clientY, { width: leftW - 50 });
      }

      // Right: Invoice meta + QR
      const rightX = m + leftW + colGap;
      doc.rect(rightX, y, rightW, boxH).lineWidth(0.5).stroke(colors.border);
      doc.rect(rightX, y, rightW, 11).fill(colors.secondary);
      doc.fillColor(colors.text).fontSize(6.5 * fs).font('Helvetica-Bold').text('DATOS DE LA FACTURA', rightX + 4, y + 2);

      const metaW = qrBuffer ? rightW - qrDrawSize - 8 : rightW;
      let metaY = y + 14;
      doc.fontSize(6 * fs);
      doc.font('Helvetica-Bold').text('Fecha:', rightX + 4, metaY);
      doc.font('Helvetica').text(new Date(invoice.issueDate).toLocaleDateString('es-CO'), rightX + 35, metaY);
      metaY += clientRowH;
      if (invoice.dueDate) {
        doc.font('Helvetica-Bold').text('Vence:', rightX + 4, metaY);
        doc.font('Helvetica').text(new Date(invoice.dueDate).toLocaleDateString('es-CO'), rightX + 35, metaY);
        metaY += clientRowH;
      }
      doc.font('Helvetica-Bold').text('Estado:', rightX + 4, metaY);
      const statusColor = invoice.status === 'PAID' ? '#059669' : invoice.status === 'CANCELLED' ? '#DC2626' : colors.primary;
      doc.fillColor(statusColor).font('Helvetica-Bold').text(this.getStatusLabel(invoice.status), rightX + 35, metaY);
      doc.fillColor(colors.text);

      // QR in right box (contained within box boundaries)
      if (qrBuffer) {
        const qrX = rightX + rightW - qrDrawSize - 3;
        const qrY = y + 13;
        try {
          doc.image(qrBuffer, qrX, qrY, { width: qrDrawSize, height: qrDrawSize });
        } catch { /* QR failed */ }
      }

      y += boxH + 6;

      // ── Items Table ──
      doc.y = y;
      this.drawProfessionalItemsTable(doc, invoice.items, colors, m, w);

      // ── Totals ──
      this.drawProfessionalTotals(doc, {
        subtotal: Number(invoice.subtotal),
        discount: Number(invoice.discountTotal || 0),
        tax: Number(invoice.taxTotal || 0),
        total: Number(invoice.total),
      }, colors, m, w);

      // ── Bank accounts (compact) ──
      if (settings?.invoiceShowBankAccounts !== false && settings?.bankAccounts && doc.y < pageH - 80) {
        this.drawBankAccounts(doc, settings.bankAccounts, colors, m, w);
      }

      // ── Footer (fixed at bottom) ──
      const footerY = pageH - (pc.isHalfLetter ? 28 : 35);
      doc.moveTo(m, footerY - 4).lineTo(m + w, footerY - 4).lineWidth(0.3).stroke(colors.border);
      doc.fontSize(5).font('Helvetica').fillColor(colors.lightText);
      doc.text(
        `Documento generado el ${new Date().toLocaleString('es-CO')} | Documento interno - No constituye factura electrónica`,
        m, footerY, { width: w, align: 'center' },
      );
      if (settings?.billingMode === 'INTERNAL_ONLY') {
        doc.text('Para factura electrónica válida ante la DIAN, solicítela a su contador.', m, footerY + 8, { width: w, align: 'center' });
      }
      doc.fillColor(colors.text);

      // ── Bottom colored bar ──
      doc.rect(0, pageH - 4, doc.page.width, 4).fill(colors.primary);

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // RECEIPT PDF (Recibo de Pago) - Diseño profesional tipo factura
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

    // Calculate amounts
    const obligationAmount = payment.obligation ? Number(payment.obligation.originalAmount) : Number(payment.amount);
    const discountAmount = payment.obligation ? Number(payment.obligation.discountAmount || 0) : 0;
    const paidAmount = Number(payment.amount);

    return new Promise((resolve, reject) => {
      // Use small bottom margin to prevent footer from triggering auto page breaks
      const doc = new PDFDocument({ size: pc.size, margins: { top: pc.margin, bottom: 15, left: pc.margin, right: pc.margin }, autoFirstPage: true, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const m = pc.margin;
      const w = pc.contentWidth;
      const pageH = doc.page.height;
      const hl = pc.isHalfLetter;
      const fs = hl ? 0.85 : 1;

      // ── Top colored bar ──
      doc.rect(0, 0, doc.page.width, 4).fill(colors.primary);

      // ── Header with logo ──
      let y = m;
      const logoSize = hl ? 35 : 45;
      const hasLogo = !!logoBuffer;
      let textX = m;
      let textW = w;

      if (hasLogo) {
        try {
          doc.image(logoBuffer, m, y, { width: logoSize, height: logoSize });
        } catch { /* logo failed */ }
        textX = m + logoSize + 8;
        textW = w - logoSize - 8;
      }

      doc.fillColor(colors.primary).fontSize((hl ? 11 : 14) * fs).font('Helvetica-Bold');
      doc.text(settings?.businessName || payment.institution.name, textX, y, { width: textW, align: hasLogo ? undefined : 'center' });
      
      doc.fillColor(colors.text).fontSize((hl ? 6 : 7) * fs).font('Helvetica');
      const infoLines: string[] = [];
      if (settings?.taxId) infoLines.push(`NIT: ${settings.taxId}`);
      if (settings?.taxRegime) infoLines.push(this.getTaxRegimeLabel(settings.taxRegime));
      if (settings?.invoiceAddress || payment.institution.address) infoLines.push(settings?.invoiceAddress || payment.institution.address || '');
      const contactParts: string[] = [];
      if (settings?.invoicePhone || payment.institution.phone) contactParts.push(`Tel: ${settings?.invoicePhone || payment.institution.phone}`);
      if (settings?.invoiceEmail || payment.institution.email) contactParts.push(settings?.invoiceEmail || payment.institution.email || '');
      if (contactParts.length) infoLines.push(contactParts.join(' | '));
      
      infoLines.forEach(line => {
        doc.text(line, textX, doc.y, { width: textW, align: hasLogo ? undefined : 'center' });
      });

      y = Math.max(doc.y, m + logoSize) + 4;
      doc.moveTo(m, y).lineTo(m + w, y).lineWidth(0.5).stroke(colors.primary);
      y += 4;

      // ── Title bar with receipt number ──
      const titleH = hl ? 16 : 20;
      doc.rect(m, y, w, titleH).fill(colors.primary);
      doc.fillColor('#FFFFFF').fontSize((hl ? 8 : 10) * fs).font('Helvetica-Bold');
      doc.text('RECIBO DE PAGO', m + 8, y + (titleH - 10 * fs) / 2, { width: w / 2 - 8 });
      doc.text(`N° ${payment.receiptNumber || 'S/N'}`, m + w / 2, y + (titleH - 10 * fs) / 2, { width: w / 2 - 8, align: 'right' });
      doc.fillColor(colors.text);
      y += titleH + 6;

      // ── Two-column: Client info (left) + Receipt meta + QR (right) ──
      const qrDrawSize = hl ? 42 : 50; // actual QR image size
      const colGap = 8;
      const leftW = w * 0.55;
      const rightW = w - leftW - colGap;
      const rowH = hl ? 10 : 11;
      const boxH = hl ? 55 : 62;

      // Left: Client info
      doc.rect(m, y, leftW, boxH).lineWidth(0.5).stroke(colors.border);
      doc.rect(m, y, leftW, 12).fill(colors.secondary);
      doc.fillColor(colors.text).fontSize((hl ? 6 : 7) * fs).font('Helvetica-Bold').text('RECIBIDO DE', m + 4, y + 2.5);
      
      let clientY = y + 15;
      const labelCol = hl ? 48 : 55;
      doc.fontSize((hl ? 6 : 7) * fs);
      
      doc.font('Helvetica-Bold').text('Nombre:', m + 4, clientY);
      doc.font('Helvetica').text(payment.thirdParty.name, m + labelCol, clientY, { width: leftW - labelCol - 4 });
      clientY += rowH;
      
      if (payment.thirdParty.document) {
        doc.font('Helvetica-Bold').text('Documento:', m + 4, clientY);
        doc.font('Helvetica').text(payment.thirdParty.document, m + labelCol, clientY);
        clientY += rowH;
      }
      if (payment.thirdParty.email) {
        doc.font('Helvetica-Bold').text('Email:', m + 4, clientY);
        doc.font('Helvetica').text(payment.thirdParty.email, m + labelCol, clientY, { width: leftW - labelCol - 4 });
      }

      // Right: Receipt meta + QR
      const rightX = m + leftW + colGap;
      doc.rect(rightX, y, rightW, boxH).lineWidth(0.5).stroke(colors.border);
      doc.rect(rightX, y, rightW, 12).fill(colors.secondary);
      doc.fillColor(colors.text).fontSize((hl ? 6 : 7) * fs).font('Helvetica-Bold').text('DATOS DEL RECIBO', rightX + 4, y + 2.5);

      let metaY = y + 15;
      doc.fontSize((hl ? 6 : 7) * fs);
      const metaLabelCol = hl ? 38 : 42;
      
      doc.font('Helvetica-Bold').text('Fecha:', rightX + 4, metaY);
      doc.font('Helvetica').text(new Date(payment.paymentDate).toLocaleDateString('es-CO'), rightX + metaLabelCol, metaY);
      metaY += rowH;
      
      doc.font('Helvetica-Bold').text('Método:', rightX + 4, metaY);
      doc.font('Helvetica').text(this.getPaymentMethodLabel(payment.paymentMethod), rightX + metaLabelCol, metaY);
      metaY += rowH;
      
      if (payment.transactionRef) {
        doc.font('Helvetica-Bold').text('Ref:', rightX + 4, metaY);
        doc.font('Helvetica').text(payment.transactionRef, rightX + metaLabelCol, metaY, { width: rightW - metaLabelCol - qrDrawSize - 8 });
      }

      // QR in right box (contained within box)
      if (qrBuffer) {
        const qrX = rightX + rightW - qrDrawSize - 3;
        const qrY = y + 14;
        try {
          doc.image(qrBuffer, qrX, qrY, { width: qrDrawSize, height: qrDrawSize });
        } catch { /* QR failed */ }
      }

      y += boxH + 8;

      // ── Items Table: DESCRIPCIÓN | CANT. | V. UNITARIO | TOTAL ──
      const tableTop = y;
      // Column widths differ by page size
      const descW = hl ? (w - 150) : (w - 210);
      const cantW = hl ? 35 : 45;
      const unitW = hl ? 55 : 80;
      const totalW = hl ? 60 : 85;
      const tblRowH = hl ? 18 : 22;
      const tblFontSize = (hl ? 7 : 8) * fs;
      const tblHeaderH = hl ? 16 : 20;

      // Header row
      doc.rect(m, tableTop, w, tblHeaderH).fill(colors.primary);
      doc.fillColor('#FFFFFF').fontSize(tblFontSize).font('Helvetica-Bold');
      let cx = m + 6;
      doc.text('DESCRIPCIÓN', cx, tableTop + (tblHeaderH - tblFontSize) / 2, { width: descW - 12 });
      cx += descW;
      doc.text('CANT.', cx, tableTop + (tblHeaderH - tblFontSize) / 2, { width: cantW, align: 'center' });
      cx += cantW;
      doc.text('V. UNITARIO', cx, tableTop + (tblHeaderH - tblFontSize) / 2, { width: unitW, align: 'right' });
      cx += unitW;
      doc.text('TOTAL', cx, tableTop + (tblHeaderH - tblFontSize) / 2, { width: totalW - 6, align: 'right' });

      // Data row
      doc.fillColor(colors.text).font('Helvetica').fontSize(tblFontSize);
      let cy = tableTop + tblHeaderH + 2;
      doc.rect(m, cy - 1, w, tblRowH).fill(colors.secondary);
      doc.fillColor(colors.text);
      cx = m + 6;
      doc.text(payment.obligation?.concept?.name || 'Pago general', cx, cy + (tblRowH - tblFontSize) / 2 - 1, { width: descW - 12 });
      cx += descW;
      doc.text('1', cx, cy + (tblRowH - tblFontSize) / 2 - 1, { width: cantW, align: 'center' });
      cx += cantW;
      doc.text(this.formatCurrency(obligationAmount), cx, cy + (tblRowH - tblFontSize) / 2 - 1, { width: unitW, align: 'right' });
      cx += unitW;
      doc.text(this.formatCurrency(obligationAmount), cx, cy + (tblRowH - tblFontSize) / 2 - 1, { width: totalW - 6, align: 'right' });
      cy += tblRowH;

      // Add empty rows to fill product area (more for letter, fewer for half-letter)
      const emptyRows = hl ? 2 : 5;
      for (let i = 0; i < emptyRows; i++) {
        const bgColor = i % 2 === 0 ? '#FFFFFF' : colors.secondary;
        doc.rect(m, cy - 1, w, tblRowH).fill(bgColor);
        cy += tblRowH;
      }

      // Bottom border of table
      doc.moveTo(m, cy).lineTo(m + w, cy).lineWidth(0.5).stroke(colors.border);
      y = cy + 8;

      // ── Totals section (right-aligned) ──
      const totalsW = hl ? 170 : 220;
      const totalsX = m + w - totalsW;
      const totalsValW = hl ? 80 : 100;
      const totalsLabelW = totalsW - totalsValW;
      doc.fontSize((hl ? 7 : 8) * fs);

      // Subtotal
      doc.font('Helvetica').text('Subtotal:', totalsX, y, { width: totalsLabelW, align: 'right' });
      doc.text(this.formatCurrency(obligationAmount), totalsX + totalsLabelW, y, { width: totalsValW, align: 'right' });
      y += hl ? 12 : 16;

      // Descuento (if any)
      if (discountAmount > 0) {
        doc.text('Descuento:', totalsX, y, { width: totalsLabelW, align: 'right' });
        doc.fillColor('#059669').text(`-${this.formatCurrency(discountAmount)}`, totalsX + totalsLabelW, y, { width: totalsValW, align: 'right' });
        doc.fillColor(colors.text);
        y += hl ? 12 : 16;
      }

      // Total box
      const totalBoxH = hl ? 20 : 24;
      doc.rect(totalsX - 4, y, totalsW + 4, totalBoxH).fill(colors.primary);
      doc.fillColor('#FFFFFF').fontSize((hl ? 8 : 10) * fs).font('Helvetica-Bold');
      doc.text('TOTAL RECIBIDO:', totalsX, y + (totalBoxH - 10 * fs) / 2, { width: totalsLabelW, align: 'right' });
      doc.text(this.formatCurrency(paidAmount), totalsX + totalsLabelW, y + (totalBoxH - 10 * fs) / 2, { width: totalsValW, align: 'right' });
      doc.fillColor(colors.text);
      y += totalBoxH + (hl ? 15 : 25);

      // ── Signature line ──
      const sigLineW = hl ? 140 : 180;
      const sigX = m + w - sigLineW;
      doc.fontSize((hl ? 6 : 7) * fs).font('Helvetica').fillColor(colors.lightText);
      doc.moveTo(sigX, y).lineTo(sigX + sigLineW, y).lineWidth(0.5).stroke(colors.border);
      doc.text(`Recibido por: ${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`, sigX, y + 3, { width: sigLineW, align: 'center' });
      doc.fillColor(colors.text);

      // ── Footer (fixed at bottom, single block to avoid page overflow) ──
      const footerY = pageH - (hl ? 18 : 22);
      doc.moveTo(m, footerY - 3).lineTo(m + w, footerY - 3).lineWidth(0.3).stroke(colors.border);
      let footerText = `Documento generado el ${new Date().toLocaleString('es-CO')} | Documento interno - No constituye factura electrónica`;
      if (settings?.billingMode === 'INTERNAL_ONLY') {
        footerText += ' | Para factura electrónica válida ante la DIAN, solicítela a su contador.';
      }
      doc.fontSize(hl ? 4.5 : 5).font('Helvetica').fillColor(colors.lightText);
      doc.text(footerText, m, footerY, { width: w, align: 'center', lineBreak: false });
      doc.fillColor(colors.text);

      // ── Bottom colored bar ──
      doc.rect(0, pageH - 4, doc.page.width, 4).fill(colors.primary);

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SHARED DRAWING HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async resolveLogoBuffer(settings: any, institution: any): Promise<Buffer | null> {
    // Try invoice logo from settings
    if (settings?.invoiceLogoUrl) {
      const url = await this.resolveStorageUrl(settings.invoiceLogoUrl);
      if (url) {
        const buf = await this.fetchImage(url);
        if (buf) return buf;
      }
    }
    // Fallback to institution logo
    if (institution?.logoUrl) {
      const url = await this.resolveStorageUrl(institution.logoUrl);
      if (url) {
        const buf = await this.fetchImage(url);
        if (buf) return buf;
      }
    }
    return null;
  }

  private async resolveStorageUrl(storedValue: string): Promise<string | null> {
    if (!storedValue) return null;
    try {
      return await this.storageService.resolveFileUrl(storedValue, 600);
    } catch {
      return storedValue.startsWith('http') ? storedValue : null;
    }
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
