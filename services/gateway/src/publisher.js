import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Writes the call sheet JSON to S3. An S3 event notification invokes the callsheet-pdf Lambda,
 * which renders the PDF and emails the crew. Without a bucket (local dev) it is a dry run.
 */
export function createPublisher({ bucket, s3 = bucket ? new S3Client({}) : null, logger } = {}) {
  return {
    async publish(callSheet) {
      const objectKey = `callsheets/${callSheet.id}/v${callSheet.version}.json`;
      if (!bucket) {
        logger?.info({ objectKey }, 'CALLSHEET_BUCKET not set; skipping S3 upload');
        return { status: 'DRY_RUN', objectKey };
      }
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: JSON.stringify(callSheet),
        ContentType: 'application/json',
      }));
      return { status: 'PUBLISHED', objectKey };
    },
  };
}
