import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { IMAGES_DIR } from "./db";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// Card cover art is a wide banner (roughly 2:1) regardless of card width, so
// every upload is scaled server-side to fit within this exact size. Uses
// "contain" (not "cover") so the whole image is always visible — a portrait
// photo (e.g. 784x1168) gets letterboxed rather than having its top/bottom
// cropped off.
const OUTPUT_WIDTH = 800;
const OUTPUT_HEIGHT = 400;
// Matches --color-surface in globals.css, so letterbox bars blend with the card.
const LETTERBOX_BACKGROUND = { r: 0x13, g: 0x18, b: 0x26, alpha: 1 };

export class ImageValidationError extends Error {}

/**
 * Writes an uploaded cover image to disk under a server-generated filename
 * (never the client-supplied name). The image is scaled to fit within a
 * fixed banner size via sharp (never cropped — letterboxed instead if the
 * aspect ratio doesn't match) and re-encoded as webp. Overwrites any prior
 * image for the project.
 */
export async function saveProjectImage(projectId: string, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ImageValidationError(`Unsupported image type "${file.type}". Use JPG, PNG, WebP, or GIF.`);
  }
  if (file.size > MAX_BYTES) {
    throw new ImageValidationError(`Image is too large (${Math.round(file.size / 1024 / 1024)}MB). Max 5MB.`);
  }

  clearProjectImage(projectId);

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let outputBuffer: Buffer;
  try {
    outputBuffer = await sharp(inputBuffer)
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "contain", background: LETTERBOX_BACKGROUND })
      .flatten({ background: LETTERBOX_BACKGROUND }) // fold transparency (e.g. PNG) into the same background
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageValidationError("Could not process that image — it may be corrupt or an unsupported format.");
  }

  const filename = `${projectId}.webp`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), outputBuffer);

  return `images/${filename}`;
}

export function clearProjectImage(projectId: string): void {
  // Output is always .webp now, but also sweep the older per-type extensions
  // in case this project's image was uploaded before this change.
  for (const ext of ["webp", "jpg", "png", "gif"]) {
    const p = path.join(IMAGES_DIR, `${projectId}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
