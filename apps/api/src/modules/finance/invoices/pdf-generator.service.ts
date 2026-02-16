import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';

@Injectable()
export class PdfGeneratorService {
  constructor(private prisma: PrismaService) {}

  private async fetchImage(url: string): Promise<Buffer | null> {
    try {
      return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
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

  private getPageConfig(settings: any): { size: string; margin: number; contentWidth: number } {
    const isHalfLetter = settings?.invoicePageSize === 'HALF_LETTER';
    return {
      size: isHalfLetter ? [396, 612] as any : 'LETTER',
      margin: isHalfLetter ? 30 : 50,
      contentWidth: isHalfLetter ? 336 : 512,
    };
  }

  async generateInvoicePdf(invoiceId: string, institutionId: string): Promise<Buffer> {
    const invoice = await this.prisma.financialInvoice.findFirst({
      where: { id: invoiceId, institutionId },
      include: {
        thirdParty: true,
        items: true,
        institution: true,
      },
    });

    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    const settings = await this.prisma.financialSettings.findUnique({
      where: { institutionId },
    });

    const pageConfig = this.getPageConfig(settings);
    let logoBuffer: Buffer | null = null;
    if (settings?.invoiceLogoUrl) {
      logoBuffer = await this.fetchImage(settings.invoiceLogoUrl);
    } else if ((invoice.institution as any).logoUrl) {
      logoBuffer = await this.fetchImage((invoice.institution as any).logoUrl);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: pageConfig.size, margin: pageConfig.margin });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const m = pageConfig.margin;
      const w = pageConfig.contentWidth;

      // Header with logo
      this.drawHeader(doc, invoice.institution, settings, logoBuffer, m, w);

      // DIAN Resolution
      this.drawResolution(doc, settings, m, w);

      // Invoice Info
      this.drawInvoiceInfo(doc, invoice, m, w);

      // Third Party Info
      this.drawThirdPartyInfo(doc, invoice.thirdParty, m, w);

      // Items Table
      this.drawItemsTable(doc, invoice.items, m, w);

      // Totals
      this.drawTotals(doc, invoice, m, w);

      // Footer
      this.drawFooter(doc, invoice.institution, settings, m, w);

      doc.end();
    });
  }

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

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    const settings = await this.prisma.financialSettings.findUnique({
      where: { institutionId },
    });

    const pageConfig = this.getPageConfig(settings);
    let logoBuffer: Buffer | null = null;
    if (settings?.invoiceLogoUrl) {
      logoBuffer = await this.fetchImage(settings.invoiceLogoUrl);
    } else if ((payment.institution as any).logoUrl) {
      logoBuffer = await this.fetchImage((payment.institution as any).logoUrl);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: pageConfig.size, margin: pageConfig.margin });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const m = pageConfig.margin;
      const w = pageConfig.contentWidth;

      // Header with logo
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, m, m, { width: 50, height: 50 });
          doc.fontSize(16).font('Helvetica-Bold').text(payment.institution.name, m + 60, m + 5, { width: w - 60 });
          doc.fontSize(9).font('Helvetica').text(payment.institution.address || '', m + 60, m + 25, { width: w - 60 });
          if (settings?.taxId) {
            doc.text(`NIT: ${settings.taxId}`, m + 60, doc.y, { width: w - 60 });
          }
          doc.y = m + 60;
        } catch {
          doc.fontSize(16).font('Helvetica-Bold').text(payment.institution.name, { align: 'center' });
          doc.fontSize(9).font('Helvetica').text(payment.institution.address || '', { align: 'center' });
        }
      } else {
        doc.fontSize(16).font('Helvetica-Bold').text(payment.institution.name, { align: 'center' });
        doc.fontSize(9).font('Helvetica').text(payment.institution.address || '', { align: 'center' });
        if (settings?.taxId) {
          doc.text(`NIT: ${settings.taxId}`, { align: 'center' });
        }
      }
      doc.moveDown(1.5);

      // Receipt Title
      doc.fontSize(14).font('Helvetica-Bold').text('RECIBO DE PAGO', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`N° ${payment.receiptNumber}`, { align: 'center' });
      doc.moveDown(1.5);

      // Payment Details
      const startY = doc.y;
      const labelX = m;
      const valueX = m + 110;
      doc.fontSize(9);

      doc.font('Helvetica-Bold').text('Fecha:', labelX, startY);
      doc.font('Helvetica').text(new Date(payment.paymentDate).toLocaleDateString('es-CO'), valueX, startY);

      doc.font('Helvetica-Bold').text('Recibido de:', labelX, startY + 18);
      doc.font('Helvetica').text(payment.thirdParty.name, valueX, startY + 18);

      let nextY = startY + 36;
      if (payment.thirdParty.document) {
        doc.font('Helvetica-Bold').text('Documento:', labelX, nextY);
        doc.font('Helvetica').text(payment.thirdParty.document, valueX, nextY);
        nextY += 18;
      }

      doc.font('Helvetica-Bold').text('Concepto:', labelX, nextY);
      doc.font('Helvetica').text(payment.obligation?.concept?.name || 'Pago general', valueX, nextY);
      nextY += 18;

      doc.font('Helvetica-Bold').text('Método de pago:', labelX, nextY);
      doc.font('Helvetica').text(this.getPaymentMethodLabel(payment.paymentMethod), valueX, nextY);
      nextY += 18;

      if (payment.transactionRef) {
        doc.font('Helvetica-Bold').text('Referencia:', labelX, nextY);
        doc.font('Helvetica').text(payment.transactionRef, valueX, nextY);
        nextY += 18;
      }

      doc.y = nextY + 15;

      // Amount Box
      const amountY = doc.y;
      doc.rect(m, amountY, w, 50).stroke();
      doc.fontSize(12).font('Helvetica-Bold').text('VALOR RECIBIDO:', m + 10, amountY + 8);
      doc.fontSize(18).text(this.formatCurrency(Number(payment.amount)), m + 10, amountY + 25);

      doc.y = amountY + 65;

      // Signature
      doc.fontSize(9).font('Helvetica');
      doc.text('_______________________________', m + w - 200, doc.y);
      doc.text(`Recibido por: ${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`, m + w - 200, doc.y + 3);

      // Footer
      this.drawFooter(doc, payment.institution, settings, m, w);

      doc.end();
    });
  }

  private drawHeader(doc: PDFKit.PDFDocument, institution: any, settings: any, logoBuffer: Buffer | null, m: number, w: number) {
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, m, m, { width: 55, height: 55 });
        doc.fontSize(16).font('Helvetica-Bold').text(institution.name, m + 65, m + 2, { width: w - 65 });
        const subLines: string[] = [];
        if (institution.address) subLines.push(institution.address);
        if (settings?.invoiceCity) subLines.push(settings.invoiceCity);
        if (settings?.taxId) subLines.push(`NIT: ${settings.taxId}`);
        if (settings?.economicActivity) subLines.push(settings.economicActivity);
        if (settings?.invoicePhone) subLines.push(`Tel: ${settings.invoicePhone}`);
        if (settings?.invoiceEmail) subLines.push(settings.invoiceEmail);
        doc.fontSize(8).font('Helvetica');
        subLines.forEach(line => {
          doc.text(line, m + 65, doc.y, { width: w - 65 });
        });
        doc.y = Math.max(doc.y, m + 60) + 10;
      } catch {
        this.drawHeaderText(doc, institution, settings, m, w);
      }
    } else {
      this.drawHeaderText(doc, institution, settings, m, w);
    }
  }

  private drawHeaderText(doc: PDFKit.PDFDocument, institution: any, settings: any, m: number, w: number) {
    doc.fontSize(16).font('Helvetica-Bold').text(institution.name, m, m, { width: w, align: 'center' });
    doc.fontSize(8).font('Helvetica');
    if (institution.address) doc.text(institution.address, { align: 'center' });
    if (settings?.invoiceCity) doc.text(settings.invoiceCity, { align: 'center' });
    if (settings?.taxId) doc.text(`NIT: ${settings.taxId}`, { align: 'center' });
    if (settings?.taxRegime) doc.text(`Régimen: ${settings.taxRegime}`, { align: 'center' });
    if (settings?.economicActivity) doc.text(settings.economicActivity, { align: 'center' });
    if (settings?.invoicePhone) doc.text(`Tel: ${settings.invoicePhone}`, { align: 'center' });
    if (settings?.invoiceEmail) doc.text(settings.invoiceEmail, { align: 'center' });
    doc.moveDown(1);
  }

  private drawResolution(doc: PDFKit.PDFDocument, settings: any, m: number, w: number) {
    if (!settings?.invoiceResolution) return;
    doc.fontSize(7).font('Helvetica');
    let resText = settings.invoiceResolution;
    if (settings.invoiceResolutionDate) {
      resText += ` del ${new Date(settings.invoiceResolutionDate).toLocaleDateString('es-CO')}`;
    }
    if (settings.invoiceRangeFrom != null && settings.invoiceRangeTo != null) {
      resText += `. Numeración autorizada del ${settings.invoiceRangeFrom} al ${settings.invoiceRangeTo}`;
    }
    doc.text(resText, m, doc.y, { width: w, align: 'center' });
    doc.moveDown(0.5);
  }

  private drawInvoiceInfo(doc: PDFKit.PDFDocument, invoice: any, m: number, w: number) {
    doc.fontSize(13).font('Helvetica-Bold').text(
      invoice.type === 'INCOME' ? 'FACTURA DE VENTA' : 'FACTURA DE COMPRA',
      m, doc.y, { width: w, align: 'center' },
    );
    doc.fontSize(11).font('Helvetica').text(`N° ${invoice.invoiceNumber}`, m, doc.y, { width: w, align: 'center' });
    doc.moveDown(0.8);

    const infoY = doc.y;
    doc.fontSize(9);
    
    doc.font('Helvetica-Bold').text('Fecha de emisión:', m, infoY);
    doc.font('Helvetica').text(
      invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('es-CO') : 'Pendiente',
      m + 110, infoY,
    );

    if (invoice.dueDate) {
      doc.font('Helvetica-Bold').text('Fecha de vencimiento:', m + w / 2, infoY);
      doc.font('Helvetica').text(new Date(invoice.dueDate).toLocaleDateString('es-CO'), m + w / 2 + 120, infoY);
    }

    doc.font('Helvetica-Bold').text('Estado:', m, infoY + 15);
    doc.font('Helvetica').text(this.getStatusLabel(invoice.status), m + 110, infoY + 15);

    doc.y = infoY + 35;
  }

  private drawThirdPartyInfo(doc: PDFKit.PDFDocument, thirdParty: any, m: number, w: number) {
    doc.fontSize(9).font('Helvetica-Bold').text('DATOS DEL CLIENTE:', m);
    doc.font('Helvetica');
    doc.text(`Nombre: ${thirdParty.name}`, m);
    if (thirdParty.document) doc.text(`Documento: ${thirdParty.documentType || ''} ${thirdParty.document}`, m);
    if (thirdParty.address) doc.text(`Dirección: ${thirdParty.address}`, m);
    if (thirdParty.phone) doc.text(`Teléfono: ${thirdParty.phone}`, m);
    if (thirdParty.email) doc.text(`Email: ${thirdParty.email}`, m);
    doc.moveDown(1);
  }

  private drawItemsTable(doc: PDFKit.PDFDocument, items: any[], m: number, w: number) {
    const tableTop = doc.y;
    const tableHeaders = ['Descripción', 'Cant.', 'Valor Unit.', 'Total'];
    const descW = w - 180;
    const columnWidths = [descW, 40, 70, 70];

    // Header row
    doc.rect(m, tableTop, w, 18).fill('#f3f4f6');
    doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');

    let currentX = m + 4;
    tableHeaders.forEach((header, i) => {
      doc.text(header, currentX, tableTop + 4, { width: columnWidths[i] - 6 });
      currentX += columnWidths[i];
    });

    // Data rows
    doc.font('Helvetica').fontSize(8);
    let currentY = tableTop + 22;

    items.forEach((item) => {
      currentX = m + 4;
      doc.text(item.description, currentX, currentY, { width: columnWidths[0] - 6 });
      currentX += columnWidths[0];
      doc.text(String(item.quantity), currentX, currentY, { width: columnWidths[1] - 6, align: 'center' });
      currentX += columnWidths[1];
      doc.text(this.formatCurrency(Number(item.unitPrice)), currentX, currentY, { width: columnWidths[2] - 6, align: 'right' });
      currentX += columnWidths[2];
      doc.text(this.formatCurrency(Number(item.total)), currentX, currentY, { width: columnWidths[3] - 6, align: 'right' });
      currentY += 18;
      doc.moveTo(m, currentY - 4).lineTo(m + w, currentY - 4).stroke('#e5e7eb');
    });

    doc.y = currentY + 8;
  }

  private drawTotals(doc: PDFKit.PDFDocument, invoice: any, m: number, w: number) {
    const totalsX = m + w - 170;
    const valueX = m + w - 80;
    const startY = doc.y;

    doc.fontSize(9);
    doc.font('Helvetica').text('Subtotal:', totalsX, startY);
    doc.text(this.formatCurrency(Number(invoice.subtotal)), valueX, startY, { align: 'right', width: 80 });

    if (invoice.taxTotal && Number(invoice.taxTotal) > 0) {
      doc.text('IVA:', totalsX, startY + 14);
      doc.text(this.formatCurrency(Number(invoice.taxTotal)), valueX, startY + 14, { align: 'right', width: 80 });
    }

    if (invoice.discountTotal && Number(invoice.discountTotal) > 0) {
      doc.text('Descuento:', totalsX, startY + 28);
      doc.text(`-${this.formatCurrency(Number(invoice.discountTotal))}`, valueX, startY + 28, { align: 'right', width: 80 });
    }

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', totalsX, startY + 45);
    doc.text(this.formatCurrency(Number(invoice.total)), valueX, startY + 45, { align: 'right', width: 80 });

    doc.moveDown(2);
  }

  private drawFooter(doc: PDFKit.PDFDocument, institution: any, settings: any, m: number, w: number) {
    const footerY = doc.page.height - (settings?.invoiceFooterText ? 90 : 60);
    
    doc.fontSize(7).font('Helvetica');

    if (settings?.invoiceFooterText) {
      doc.text(settings.invoiceFooterText, m, footerY, { width: w, align: 'center' });
    }

    const contactParts: string[] = [];
    if (settings?.invoicePhone || institution.phone) contactParts.push(`Tel: ${settings?.invoicePhone || institution.phone}`);
    if (settings?.invoiceEmail || institution.email) contactParts.push(settings?.invoiceEmail || institution.email);
    if (contactParts.length > 0) {
      doc.text(contactParts.join(' | '), m, doc.page.height - 45, { width: w, align: 'center' });
    }

    doc.text(
      `Documento generado el ${new Date().toLocaleString('es-CO')}`,
      m,
      doc.page.height - 30,
      { width: w, align: 'center' },
    );
  }

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
      TRANSFER: 'Transferencia',
      CARD: 'Tarjeta',
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
}
