import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, STATUS_LABELS } from './constants';

export const generateServiceTicket = async (repair, settings = {}) => {
    // A4 Format: 210mm x 297mm
    const doc = new jsPDF();
    
    // Fetch QR code image and convert to Base64 (con timeout defensivo)
    let qrBase64 = null;
    try {
        const trackingCode = repair.ticket_number;
        const trackingUrl = `${window.location.origin}/rastrear?ticketId=${encodeURIComponent(trackingCode)}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingUrl)}&margin=0`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(qrUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const blob = await response.blob();
            qrBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        console.warn('No se pudo descargar QR para PDF (se continuara sin QR):', e.message);
    }
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Theme Colors (Modern Premium Slate & Red Accents matching SySaaS)
    const primaryColor = [30, 41, 59];   // Slate 800 (#1e293b)
    const accentColor = [79, 70, 229];    // Índigo Imperial (#4f46e5)
    const darkColor = [15, 23, 42];      // Slate 900 (#0f172a)
    const mutedColor = [100, 116, 139];  // Slate 500 (#64748b)
    const lightBg = [248, 250, 252];     // Slate 50 (#f8fafc)

    const businessName = settings.business_name || settings.company_name || repair.company_name || repair.tenant_name || 'Mi Empresa';
    const contactEmail = settings.contact_email || repair.tenant_email || '';
    const contactPhone = settings.contact_phone || repair.tenant_phone || '';
    const contactAddress = settings.business_address || repair.tenant_address || '';

    let currentY = 16;

    // --- Elegant Header Banner ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 10, 'F');

    // Business details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(businessName.toUpperCase(), 15, currentY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    
    let contactInfo = [];
    if (contactPhone) contactInfo.push(`Tel: ${contactPhone}`);
    if (contactEmail) contactInfo.push(contactEmail);
    if (contactAddress) contactInfo.push(contactAddress);
    doc.text(contactInfo.join('  |  '), 15, currentY + 13);

    // Ticket Number, Status & Date (Top Right)
    const statusLabel = (STATUS_LABELS[repair.status] || repair.status || 'Recibido').toUpperCase();
    const isDelivered = repair.status === 'delivered';
    const ticketText = isDelivered ? `ORDEN ENTREGADA: #${repair.ticket_number}` : `ORDEN DE SERVICIO: #${repair.ticket_number}`;
    const ticketWidth = doc.getTextWidth(ticketText);
    doc.text(ticketText, pageWidth - 15 - ticketWidth, currentY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    const statusHeader = `ESTADO: ${statusLabel}`;
    const statusWidth = doc.getTextWidth(statusHeader);
    doc.text(statusHeader, pageWidth - 15 - statusWidth, currentY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    const dateText = `Fecha: ${formatDate(new Date())}`;
    const dateWidth = doc.getTextWidth(dateText);
    doc.text(dateText, pageWidth - 15 - dateWidth, currentY + 16);

    // Separator line
    currentY += 19;
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.5);
    doc.line(15, currentY, pageWidth - 15, currentY);
    currentY += 8;

    // --- Client & Device details ---
    // Client details — no contact info on the printed document
    const clientDetails = [
        ['Nombre:', `${repair.customer_first_name || repair.first_name || 'Mostrador'} ${repair.customer_last_name || repair.last_name || ''}`.trim()]
    ];

    const deviceDetails = [
        ['Equipo:', `${repair.brand_name || repair.brand_other || ''} ${repair.model || ''}`.trim()],
        ['Serie/IMEI:', repair.imei || repair.serial_number || 'N/A'],
        ['Estético:', `${repair.physical_condition || 5}/5`],
        ['Contraseña:', repair.device_password || 'Ninguna']
    ];

    // Client Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('INFORMACIÓN DEL CLIENTE', 15, currentY);
    
    autoTable(doc, {
        startY: currentY + 2,
        body: clientDetails,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.5, textColor: darkColor },
        columnStyles: { 0: { fontStyle: 'bold', width: 20, textColor: mutedColor } },
        margin: { left: 15 },
        tableWidth: 85
    });

    // Device Table
    doc.text('DETALLES DEL EQUIPO', 110, currentY);
    autoTable(doc, {
        startY: currentY + 2,
        body: deviceDetails,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.5, textColor: darkColor },
        columnStyles: { 0: { fontStyle: 'bold', width: 25, textColor: mutedColor } },
        margin: { left: 110 },
        tableWidth: 85
    });

    currentY = Math.max(doc.lastAutoTable.finalY, currentY + 24) + 8;

    // --- Section: Recepción e Inspección ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('RECEPCIÓN Y DIAGNÓSTICO', 15, currentY);
    
    const checklist = typeof repair.function_checklist === 'string' ? JSON.parse(repair.function_checklist) : repair.function_checklist;
    let checklistStr = 'No realizado';
    if (checklist && Object.keys(checklist).length > 0) {
        checklistStr = Object.entries(checklist)
            .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v ? '✓' : '✗'}`)
            .join('   ');
    }

    const receptionDetails = [
        ['Estado del Servicio:', statusLabel],
        ['Servicio Solicitado:', repair.service_name || repair.service_requested || 'General'],
        ['Falla Reportada:', repair.problem_description || 'N/A'],
        ['Garantía Pactada:', `${repair.warranty_days || settings.default_warranty_days || 30} días`],
    ];
    if (repair.estimated_delivery) {
        receptionDetails.push(['Entrega Estimada:', formatDate(repair.estimated_delivery, { day: '2-digit', month: 'long', year: 'numeric' })]);
    }
    if (repair.delivered_at) {
        receptionDetails.push(['Fecha de Entrega:', formatDate(repair.delivered_at, { day: '2-digit', month: 'long', year: 'numeric' })]);
    }
    if (repair.warranty_expires) {
        receptionDetails.push(['Vencimiento de Garantía:', formatDate(repair.warranty_expires, { day: '2-digit', month: 'long', year: 'numeric' })]);
    }
    if (repair.technical_observations) {
        receptionDetails.push(['Observaciones Técnicas:', repair.technical_observations]);
    }
    if (repair.parent_repair_id) {
        receptionDetails.push(['INGRESO POR GARANTÍA:', `Ticket Original: ${repair.parent_ticket || '#' + repair.parent_repair_id}`]);
    }
    receptionDetails.push(
        ['Daños Previos:', repair.existing_damage || 'Ninguno reportado'],
        ['Accesorios Recibidos:', repair.accessories_received || 'Ninguno'],
        ['Inspección Checklist:', checklistStr]
    );

    autoTable(doc, {
        startY: currentY + 2,
        body: receptionDetails,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2, textColor: darkColor },
        headStyles: { fillColor: primaryColor },
        columnStyles: { 0: { fontStyle: 'bold', width: 40, textColor: primaryColor } },
        margin: { left: 15, right: 15 }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // --- Section: Presupuesto ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('PRESUPUESTO ESTIMADO Y COSTOS', 15, currentY);
    
    // Show the selected service and its cost; keep diagnosis separately if applicable
    const diagCostPDF = parseFloat(repair.diagnosis_cost) || 0;
    const serviceCostPDF = Math.max(0, (parseFloat(repair.total_cost) || 0) - diagCostPDF);
    const serviceLabel = repair.service_name || repair.service_requested || 'Servicio';

    const costs = [
        [serviceLabel, formatCurrency(serviceCostPDF)]
    ];
    if (diagCostPDF > 0) {
        costs.push(['Diagnóstico Técnico', formatCurrency(repair.diagnosis_cost)]);
    }
    if (repair.discount > 0) {
        costs.push(['Descuento Aplicado', `-${formatCurrency(repair.discount)}`]);
    }

    autoTable(doc, {
        startY: currentY + 2,
        body: costs,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2, textColor: darkColor },
        columnStyles: { 0: { width: 140 }, 1: { halign: 'right', fontStyle: 'bold', textColor: darkColor } },
        margin: { left: 15, right: 15 }
    });

    currentY = doc.lastAutoTable.finalY + 4;

    // Totals Box
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.rect(115, currentY, pageWidth - 130, 22, 'FD');
    
    doc.setFontSize(8);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Estimado:', 120, currentY + 5);
    doc.text(formatCurrency(repair.total_cost), pageWidth - 20, currentY + 5, { align: 'right' });
    
    doc.text('Anticipo Recibido:', 120, currentY + 10);
    doc.text(formatCurrency(repair.advance_payment), pageWidth - 20, currentY + 10, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('Resta por Liquidar:', 120, currentY + 17);
    doc.text(formatCurrency(repair.total_cost - repair.advance_payment), pageWidth - 20, currentY + 17, { align: 'right' });

    // --- Signatures & QR (Fixed at the bottom to ensure 1-page fit) ---
    const bottomY = pageHeight - 54;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(8.5);

    const leftX = 25;
    const rightX = pageWidth - 85;

    // Client Signature
    const activeSignature = repair.signature_delivery || repair.signature_approval;
    if (activeSignature) {
        try {
            doc.addImage(activeSignature, 'PNG', leftX + 5, bottomY - 14, 50, 16);
        } catch (e) {
            console.error('Error rendering signature in PDF:', e);
        }
    }
    
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(leftX, bottomY + 5, leftX + 60, bottomY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text('Firma de Conformidad Cliente', leftX + 30, bottomY + 10, { align: 'center' });

    // Center QR Code
    if (qrBase64) {
        try {
            doc.addImage(qrBase64, 'PNG', pageWidth / 2 - 11, bottomY - 12, 22, 22);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
            doc.text('Escanea para seguimiento', pageWidth / 2, bottomY + 13, { align: 'center' });
        } catch (e) {
            console.error('Error rendering QR code in PDF:', e);
        }
    }

    // Tech Receiver
    doc.line(rightX, bottomY + 5, rightX + 60, bottomY + 5);
    doc.text('Sello / Firma Receptor', rightX + 30, bottomY + 10, { align: 'center' });

    // --- Legal Footer (Fixed at the very bottom) ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    
    const terms1 = `TÉRMINOS Y CONDICIONES: El cliente acepta que el equipo se recibe para revisión y diagnóstico. ${businessName} no se hace responsable por pérdida de datos no respaldados previamente, ni por tarjetas SIM, memorias o accesorios no declarados.`;
    const terms2 = `La garantía es válida por ${repair.warranty_days || settings.default_warranty_days || 30} días sobre mano de obra y refacciones sustituidas. Equipos no reclamados después de 30 días generarán costos de almacenaje. A los 60 días sin reclamo, se considerarán abandonados.`;
    
    doc.text(doc.splitTextToSize(terms1, pageWidth - 30), 15, pageHeight - 14);
    doc.text(doc.splitTextToSize(terms2, pageWidth - 30), 15, pageHeight - 8);

    doc.save(`Ticket_Orden_${repair.ticket_number}.pdf`);
};
