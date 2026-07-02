// src/lib/r2-client.js
import { S3Client } from "@aws-sdk/client-s3";

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || "local";

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

let r2Client = null;

if (
  STORAGE_DRIVER === "r2" &&
  R2_ENDPOINT &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY
) {
  r2Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
} else if (STORAGE_DRIVER === "r2") {
  console.warn(
    "[R2] STORAGE_DRIVER=r2 لكن إعدادات R2 ناقصة. تأكد من R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY"
  );
}

export default r2Client;
