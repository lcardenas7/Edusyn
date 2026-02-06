import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PdfGeneratorService {
  constructor(private prisma: PrismaService) {}

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

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      this.drawHeader(doc, invoice.institution, settings);

      // Invoice Info
      this.drawInvoiceInfo(doc, invoice);

      // Third Party Info
      this.drawThirdPartyInfo(doc, invoice.thirdParty);

      // Items Table
      this.drawItemsTable(doc, invoice.items);

      // Totals
      this.drawTotals(doc, invoice);

      // Footer
      this.drawFooter(doc, invoice.institution);

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

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(payment.institution.name, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(payment.institution.address || '', { align: 'center' });
      doc.moveDown(2);

      // Receipt Title
      doc.fontSize(16).font('Helvetica-Bold').text('RECIBO DE PAGO', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(`N° ${payment.receiptNumber}`, { align: 'center' });
      doc.moveDown(2);

      // Payment Details
      const startY = doc.y;
      doc.fontSize(10);

      doc.font('Helvetica-Bold').text('Fecha:', 50, startY);
      doc.font('Helvetica').text(new Date(payment.paymentDate).toLocaleDateString('es-CO'), 150, startY);

      doc.font('Helvetica-Bold').text('Recibido de:', 50, startY + 20);
      doc.font('Helvetica').text(payment.thirdParty.name, 150, startY + 20);

      if (payment.thirdParty.document) {
        doc.font('Helvetica-Bold').text('Documento:', 50, startY + 40);
        doc.font('Helvetica').text(payment.thirdParty.document, 150, startY + 40);
      }

      doc.font('Helvetica-Bold').text('Concepto:', 50, startY + 60);
      doc.font('Helvetica').text(
        payment.obligation?.concept?.name || 'Pago general',
        150,
        startY + 60,
      );

      doc.font('Helvetica-Bold').text('Método de pago:', 50, startY + 80);
      doc.font('Helvetica').text(this.getPaymentMethodLabel(payment.paymentMethod), 150, startY + 80);

      if (payment.transactionRef) {
        doc.font('Helvetica-Bold').text('Referencia:', 50, startY + 100);
        doc.font('Helvetica').text(payment.transactionRef, 150, startY + 100);
      }

      doc.moveDown(6);

      // Amount Box
      const amountY = doc.y;
      doc.rect(50, amountY, 512, 60).stroke();
      doc.fontSize(14).font('Helvetica-Bold').text('VALOR RECIBIDO:', 60, amountY + 10);
      doc.fontSize(20).text(
        this.formatCurrency(Number(payment.amount)),
        60,
        amountY + 30,
      );

      doc.moveDown(4);

      // Signature
      doc.fontSize(10).font('Helvetica');
      doc.text('_______________________________', 350, doc.y);
      doc.text(`Recibido por: ${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`, 350, doc.y + 5);

      // Footer
      doc.fontSize(8).text(
        `Documento generado el ${new Date().toLocaleString('es-CO')}`,
        50,
        doc.page.height - 50,
        { align: 'center' },
      );

      doc.end();
    });
  }

  private drawHeader(doc: PDFKit.PDFDocument, institution: any, settings: any) {
    doc.fontSize(18).font('Helvetica-Bold').text(institution.name, { align: 'center' });
    
    if (institution.address) {
      doc.fontSize(10).font('Helvetica').text(institution.address, { align: 'center' });
    }
    
    if (settings?.taxId) {
      doc.fontSize(10).text(`NIT: ${settings.taxId}`, { align: 'center' });
    }
    
    doc.moveDown(2);
  }

  private drawInvoiceInfo(doc: PDFKit.PDFDocument, invoice: any) {
    doc.fontSize(14).font('Helvetica-Bold').text(
      invoice.type === 'INCOME' ? 'FACTURA DE VENTA' : 'FACTURA DE COMPRA',
      { align: 'center' },
    );
    doc.fontSize(12).font('Helvetica').text(`N° ${invoice.invoiceNumber}`, { align: 'center' });
    doc.moveDown();

    const infoY = doc.y;
    doc.fontSize(10);
    
    doc.font('Helvetica-Bold').text('Fecha de emisión:', 50, infoY);
    doc.font('Helvetica').text(
      invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('es-CO') : 'Pendiente',
      170,
      infoY,
    );

    if (invoice.dueDate) {
      doc.font('Helvetica-Bold').text('Fecha de vencimiento:', 300, infoY);
      doc.font('Helvetica').text(new Date(invoice.dueDate).toLocaleDateString('es-CO'), 430, infoY);
    }

    doc.font('Helvetica-Bold').text('Estado:', 50, infoY + 15);
    doc.font('Helvetica').text(this.getStatusLabel(invoice.status), 170, infoY + 15);

    doc.moveDown(2);
  }

  private drawThirdPartyInfo(doc: PDFKit.PDFDocument, thirdParty: any) {
    doc.fontSize(10).font('Helvetica-Bold').text('DATOS DEL CLIENTE:');
    doc.font('Helvetica');
    doc.text(`Nombre: ${thirdParty.name}`);
    
    if (thirdParty.document) {
      doc.text(`Documento: ${thirdParty.documentType || ''} ${thirdParty.document}`);
    }
    
    if (thirdParty.address) {
      doc.text(`Dirección: ${thirdParty.address}`);
    }
    
    if (thirdParty.phone) {
      doc.text(`Teléfono: ${thirdParty.phone}`);
    }
    
    if (thirdParty.email) {
      doc.text(`Email: ${thirdParty.email}`);
    }
    
    doc.moveDown(2);
  }

  private drawItemsTable(doc: PDFKit.PDFDocument, items: any[]) {
    const tableTop = doc.y;
    const tableHeaders = ['Descripción', 'Cantidad', 'Valor Unit.', 'Total'];
    const columnWidths = [250, 70, 100, 100];
    const startX = 50;

    // Header row
    doc.rect(startX, tableTop, 520, 20).fill('#f3f4f6');
    doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');

    let currentX = startX + 5;
    tableHeaders.forEach((header, i) => {
      doc.text(header, currentX, tableTop + 5, { width: columnWidths[i] - 10 });
      currentX += columnWidths[i];
    });

    // Data rows
    doc.font('Helvetica').fontSize(9);
    let currentY = tableTop + 25;

    items.forEach((item) => {
      currentX = startX + 5;
      
      doc.text(item.description, currentX, currentY, { width: columnWidths[0] - 10 });
      currentX += columnWidths[0];
      
      doc.text(String(item.quantity), currentX, currentY, { width: columnWidths[1] - 10, align: 'center' });
      currentX += columnWidths[1];
      
      doc.text(this.formatCurrency(Number(item.unitPrice)), currentX, currentY, { width: columnWidths[2] - 10, align: 'right' });
      currentX += columnWidths[2];
      
      doc.text(this.formatCurrency(Number(item.total)), currentX, currentY, { width: columnWidths[3] - 10, align: 'right' });

      currentY += 20;

      // Draw line
      doc.moveTo(startX, currentY - 5).lineTo(startX + 520, currentY - 5).stroke('#e5e7eb');
    });

    doc.y = currentY + 10;
  }

  private drawTotals(doc: PDFKit.PDFDocument, invoice: any) {
    const totalsX = 370;
    const valueX = 470;
    const startY = doc.y;

    doc.fontSize(10);

    doc.font('Helvetica').text('Subtotal:', totalsX, startY);
    doc.text(this.formatCurrency(Number(invoice.subtotal)), valueX, startY, { align: 'right', width: 100 });

    if (invoice.taxAmount && Number(invoice.taxAmount) > 0) {
      doc.text('IVA:', totalsX, startY + 15);
      doc.text(this.formatCurrency(Number(invoice.taxAmount)), valueX, startY + 15, { align: 'right', width: 100 });
    }

    if (invoice.discountAmount && Number(invoice.discountAmount) > 0) {
      doc.text('Descuento:', totalsX, startY + 30);
      doc.text(`-${this.formatCurrency(Number(invoice.discountAmount))}`, valueX, startY + 30, { align: 'right', width: 100 });
    }

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('TOTAL:', totalsX, startY + 50);
    doc.text(this.formatCurrency(Number(invoice.total)), valueX, startY + 50, { align: 'right', width: 100 });

    doc.moveDown(3);
  }

  private drawFooter(doc: PDFKit.PDFDocument, institution: any) {
    const footerY = doc.page.height - 80;
    
    doc.fontSize(8).font('Helvetica');
    doc.text(
      `Documento generado el ${new Date().toLocaleString('es-CO')}`,
      50,
      footerY,
      { align: 'center' },
    );
    
    if (institution.phone) {
      doc.text(`Teléfono: ${institution.phone}`, 50, footerY + 12, { align: 'center' });
    }
    
    if (institution.email) {
      doc.text(`Email: ${institution.email}`, 50, footerY + 24, { align: 'center' });
    }
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
