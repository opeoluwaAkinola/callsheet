import { describe, expect, it, vi } from 'vitest';
import { handler } from '../src/handler.js';
import { recipients, renderCallSheet } from '../src/render.js';

const sheet = {
  id: 1, version: 3, productionTitle: 'Northern Lights (Season 2)', unit: 'Main Unit', locationName: 'Stage 7',
  callAt: '2026-11-02T07:00:00', wrapAt: '2026-11-02T19:00:00', notes: 'Ep 201 interiors', publishedAt: '2026-10-30T18:00:00Z',
  assignments: [
    { crewMemberId: 'crew-001', role: 'DP', crewMember: { name: 'Maya Okafor', department: 'Camera', email: 'maya@example.com' } },
    { crewMemberId: 'crew-004', role: 'Operator', crewMember: { name: 'Lucia Ferreira', department: 'Camera', email: 'maya@example.com' } },
    { crewMemberId: 'crew-gone', role: 'Gaffer', crewMember: null },
  ],
};

describe('renderCallSheet', () => {
  it('produces a PDF', async () => {
    const pdf = await renderCallSheet(sheet);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

describe('recipients', () => {
  it('dedupes and skips crew without an email', () => {
    expect(recipients(sheet)).toEqual(['maya@example.com']);
  });
});

describe('handler', () => {
  const event = { Records: [{ s3: { bucket: { name: 'bucket' }, object: { key: 'callsheets/1/v3.json' } } }] };
  const s3Client = () => ({
    send: vi.fn(async (cmd) => (cmd.constructor.name === 'GetObjectCommand'
      ? { Body: { transformToString: async () => JSON.stringify(sheet) } }
      : {})),
  });

  it('writes the PDF next to the JSON and emails the crew', async () => {
    const s3 = s3Client();
    const ses = { send: vi.fn().mockResolvedValue({}) };
    const out = await handler(event, { s3Client: s3, sesClient: ses, env: { SENDER_EMAIL: 'ad@example.com' } });

    expect(out).toEqual([{ pdfKey: 'callsheets/1/v3.pdf', recipients: 1 }]);
    const put = s3.send.mock.calls[1][0].input;
    expect(put).toMatchObject({ Bucket: 'bucket', Key: 'callsheets/1/v3.pdf', ContentType: 'application/pdf' });
    expect(ses.send.mock.calls[0][0].input.Destination.BccAddresses).toEqual(['maya@example.com']);
  });

  it('skips email when no sender is configured, and ignores non-JSON keys', async () => {
    const ses = { send: vi.fn() };
    const mixed = { Records: [...event.Records, { s3: { bucket: { name: 'bucket' }, object: { key: 'callsheets/1/v3.pdf' } } }] };
    const out = await handler(mixed, { s3Client: s3Client(), sesClient: ses, env: {} });
    expect(out).toHaveLength(1);
    expect(ses.send).not.toHaveBeenCalled();
  });
});
