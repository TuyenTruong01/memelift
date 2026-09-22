import { NextResponse } from "next/server";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const runtime = "nodejs";

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value
    && typeof value === "object"
    && "arrayBuffer" in value
    && "name" in value
    && typeof value.type === "string"
    && typeof value.size === "number",
  );
}

export async function POST(request: Request) {
  const pinataJwt = process.env.PINATA_JWT?.trim();
  console.info("Pinata upload configuration", {
    jwtExists: Boolean(pinataJwt),
    jwtLength: pinataJwt?.length ?? 0,
  });
  if (!pinataJwt) {
    return NextResponse.json({ error: "Image uploads are not configured." }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedFile(file)) {
      return NextResponse.json({ error: "Select an image file to upload." }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPG, and WebP images are supported." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Image must be no larger than 2 MB." }, { status: 400 });
    }

    const pinataForm = new FormData();
    pinataForm.append("file", file, file.name);
    pinataForm.append("network", "public");

    const response = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: pinataForm,
      cache: "no-store",
    });

    const responseBody = await response.text();
    if (!response.ok) {
      console.error("Pinata upload failed", {
        status: response.status,
        body: responseBody,
      });
      return NextResponse.json(
        { error: `Pinata upload failed (HTTP ${response.status}). Check the server log for details.` },
        { status: 502 },
      );
    }

    let payload: { data?: { cid?: string } };
    try {
      payload = JSON.parse(responseBody) as { data?: { cid?: string } };
    } catch {
      console.error("Pinata upload returned invalid JSON", { status: response.status, body: responseBody });
      return NextResponse.json({ error: "Pinata upload returned an invalid response." }, { status: 502 });
    }
    const cid = payload.data?.cid;
    if (!cid) {
      console.error("Pinata upload returned no CID", { status: response.status, body: responseBody });
      return NextResponse.json({ error: "Pinata upload completed without a CID." }, { status: 502 });
    }
    return NextResponse.json({ cid, uri: `ipfs://${cid}` });
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : undefined;
    console.error("Image upload route failed", {
      message: error instanceof Error ? error.message : "Unknown upload route error",
      cause: cause?.message,
      code: typeof cause === "object" && cause && "code" in cause ? cause.code : undefined,
    });
    return NextResponse.json({ error: "Image upload failed. Please try again." }, { status: 500 });
  }
}
