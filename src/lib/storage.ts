import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "studysprint";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/** Uploads a PDF buffer to Supabase Storage and returns its storage path. */
export async function uploadPdf(path: string, buffer: Buffer): Promise<string> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
  return path;
}

/** Returns a time-limited signed download URL for a stored file. */
export async function getSignedUrl(path: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error(`Failed to sign URL: ${error?.message}`);
  return data.signedUrl;
}

/** Uploads a raw source page (ingestion) and returns its storage path. */
export async function uploadSourceFile(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/**
 * Downloads a stored file's raw bytes — used to hand a source page's image back
 * to the LLM as multimodal input (diagrams/maps carry meaning text can't capture).
 */
export async function downloadFile(path: string): Promise<{ data: Buffer; contentType: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Download failed: ${error?.message}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  return { data: buffer, contentType: data.type || "application/octet-stream" };
}
