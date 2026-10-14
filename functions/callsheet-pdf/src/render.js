import PDFDocument from 'pdfkit';

const time = (iso) => iso.slice(11, 16);
const date = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Pure: call sheet JSON in, PDF bytes out. Tagged PDF so screen readers can navigate it. */
export function renderCallSheet(sheet) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER', margin: 48, tagged: true, displayTitle: true, lang: 'en-US',
      info: { Title: `Call Sheet: ${sheet.productionTitle}, ${sheet.unit}, ${sheet.callAt.slice(0, 10)}`, Author: 'CallSheet' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(22).text(sheet.productionTitle);
    doc.font('Helvetica').fontSize(12).fillColor('#444')
      .text(`${sheet.unit}  ·  ${date(sheet.callAt)}  ·  Version ${sheet.version}`);
    doc.moveDown();

    doc.fillColor('#000').font('Helvetica-Bold').fontSize(14).text(`General call ${time(sheet.callAt)}`, { continued: true })
      .font('Helvetica').text(`   Estimated wrap ${time(sheet.wrapAt)}`);
    doc.text(`Location: ${sheet.locationName}`);
    if (sheet.notes) doc.moveDown(0.5).fontSize(11).text(`Notes: ${sheet.notes}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(14).text('Crew');
    doc.moveDown(0.3);
    const byDept = new Map();
    for (const a of sheet.assignments) {
      const dept = a.crewMember?.department ?? 'Other';
      byDept.set(dept, [...(byDept.get(dept) ?? []), a]);
    }
    for (const [dept, list] of [...byDept].sort(([a], [b]) => a.localeCompare(b))) {
      doc.font('Helvetica-Bold').fontSize(11).text(dept.toUpperCase());
      for (const a of list) {
        const name = a.crewMember?.name ?? a.crewMemberId;
        doc.font('Helvetica').fontSize(11).text(`${a.role}: ${name}`, { indent: 12 });
      }
      doc.moveDown(0.4);
    }

    doc.moveDown().fontSize(9).fillColor('#666')
      .text(`Published ${sheet.publishedAt}. Reply to your 1st AD with any questions.`);
    doc.end();
  });
}

export function recipients(sheet) {
  return [...new Set(sheet.assignments.map((a) => a.crewMember?.email).filter(Boolean))];
}
