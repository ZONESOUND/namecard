import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// --- R2 Client Setup ---
const USE_R2 = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME;

const R2 = USE_R2 ? new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
}) : null;

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

// --- IMAGE OPERATIONS ---

export async function uploadImage(buffer, key, contentType) {
  if (!USE_R2) return null;

  await R2.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function getR2Stream(key) {
  if (!USE_R2) return null;
  try {
    const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return { stream: res.Body, contentType: res.ContentType };
  } catch (e) {
    return null;
  }
}

export async function getImageBuffer(key) {
  if (!USE_R2) return null;
  try {
    const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return Buffer.from(await res.Body.transformToByteArray());
  } catch (e) {
    console.error("Failed to get image buffer", e);
    return null;
  }
}
