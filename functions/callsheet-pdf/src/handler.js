import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { recipients, renderCallSheet } from './render.js';

const s3 = new S3Client({});
const ses = new SESv2Client({});

/**
 * Triggered by S3 ObjectCreated on callsheets/*.json (written by the gateway's publishCallSheet mutation).
 * Writes the PDF next to the JSON and, if SENDER_EMAIL is configured, emails a link to the crew.
 */
export async function handler(event, { s3Client = s3, sesClient = ses, env = process.env } = {}) {
  const results = [];
  for (const record of event.Records ?? []) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    if (!key.endsWith('.json')) continue;

    const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const sheet = JSON.parse(await obj.Body.transformToString());
    const pdf = await renderCallSheet(sheet);
    const pdfKey = key.replace(/\.json$/, '.pdf');
    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: pdfKey, Body: pdf, ContentType: 'application/pdf' }));

    const to = recipients(sheet);
    if (env.SENDER_EMAIL && to.length > 0) {
      await sesClient.send(new SendEmailCommand({
        FromEmailAddress: env.SENDER_EMAIL,
        Destination: { BccAddresses: to },
        Content: {
          Simple: {
            Subject: { Data: `Call sheet: ${sheet.productionTitle}, ${sheet.unit}, ${sheet.callAt.slice(0, 10)}` },
            Body: { Text: { Data: `General call ${sheet.callAt.slice(11, 16)} at ${sheet.locationName}.\n\nPDF: s3://${bucket}/${pdfKey}` } },
          },
        },
      }));
    }
    console.log(JSON.stringify({ msg: 'rendered call sheet', key: pdfKey, bytes: pdf.length, emailed: env.SENDER_EMAIL ? to.length : 0 }));
    results.push({ pdfKey, recipients: to.length });
  }
  return results;
}
