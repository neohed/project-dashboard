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

// Extensions used before uploads were normalised to webp.
const LEGACY_EXTENSIONS = ["jpg", "png", "gif"];

export class ImageValidationError extends Error {}

/**
 * Validates an uploaded cover image and re-encodes it as a fixed-size webp
 * banner (letterboxed, never cropped). Touches nothing on disk, so callers can
 * run it before any DB write and bail out cleanly on bad input.
 */
export async function processProjectImage(file: File): Promise<Buffer> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ImageValidationError(`Unsupported image type "${file.type}". Use JPG, PNG, WebP, or GIF.`);
  }
  if (file.size > MAX_BYTES) {
    throw new ImageValidationError(`Image is too large (${Math.round(file.size / 1024 / 1024)}MB). Max 5MB.`);
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  try {
    return await sharp(inputBuffer)
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "contain", background: LETTERBOX_BACKGROUND })
      .flatten({ background: LETTERBOX_BACKGROUND }) // fold transparency (e.g. PNG) into the same background
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageValidationError("Could not process that image — it may be corrupt or an unsupported format.");
  }
}

/**
 * Writes an already-processed image under a server-generated filename (never
 * the client-supplied name), overwriting any prior image for the project.
 * Returns the relative path to store in projects.image_path.
 */
export function writeProjectImage(projectId: string, image: Buffer): string {
  const filename = `${projectId}.webp`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), image);
  removeFiles(projectId, LEGACY_EXTENSIONS);
  return `images/${filename}`;
}

export function clearProjectImage(projectId: string): void {
  removeFiles(projectId, ["webp", ...LEGACY_EXTENSIONS]);
}

function removeFiles(projectId: string, extensions: string[]) {
  for (const ext of extensions) {
    const p = path.join(IMAGES_DIR, `${projectId}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
