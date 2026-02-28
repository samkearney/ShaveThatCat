interface Env {
  OPENAI_API_KEY: string;
  SHAVE_KV: KVNamespace;
}

const DAILY_LIMIT = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const ALLOWED_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);

const PROMPT = `Transform this cat to look like a hairless Sphynx cat. Remove all fur completely. Keep the cat's exact pose, expression, eye color, facial features, and background identical. The cat should have the characteristic wrinkled, bare skin of a Sphynx cat in a skin tone that matches the original cat's fur color. Keep whiskers if visible. The result should look like a realistic photo.`;

function todayKey(): string {
  return `shave-count:${new Date().toISOString().slice(0, 10)}`;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: corsHeaders() });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Invalid form data", 400);
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return errorResponse("Missing 'image' field", 400);
  }

  // Validate file type
  if (!ALLOWED_TYPES.has(file.type)) {
    return errorResponse(
      "Invalid file type. Please upload a PNG, JPEG, or WebP image.",
      400
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return errorResponse("Image too large. Maximum size is 10MB.", 400);
  }

  // Rate limit check
  const key = todayKey();
  const count = parseInt((await env.SHAVE_KV.get(key)) || "0", 10);
  if (count >= DAILY_LIMIT) {
    return errorResponse(
      "Daily shave limit reached! Come back tomorrow.",
      429
    );
  }

  // Determine output size from client hint
  const sizeParam = formData.get("size");
  const size =
    typeof sizeParam === "string" && ALLOWED_SIZES.has(sizeParam)
      ? sizeParam
      : "1024x1024";

  // Build OpenAI API request
  const openaiForm = new FormData();
  openaiForm.append("model", "gpt-image-1");
  openaiForm.append("image[]", file);
  openaiForm.append("prompt", PROMPT);
  openaiForm.append("size", size);
  openaiForm.append("quality", "medium");

  let openaiResponse: Response;
  try {
    openaiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: openaiForm,
    });
  } catch {
    return errorResponse("Failed to connect to image service", 502);
  }

  if (!openaiResponse.ok) {
    const errorBody = await openaiResponse.text();
    console.error("OpenAI API error:", openaiResponse.status, errorBody);
    // Include upstream status to aid debugging
    let detail = "";
    try {
      detail = ": " + errorBody.slice(0, 200);
    } catch {}
    return errorResponse(
      `Image transformation failed (upstream ${openaiResponse.status})${detail}`,
      502
    );
  }

  const result = (await openaiResponse.json()) as {
    data: { b64_json: string }[];
  };

  if (!result.data?.[0]?.b64_json) {
    return errorResponse("Unexpected response from image service", 502);
  }

  // Increment counter on success
  const newCount = count + 1;
  await env.SHAVE_KV.put(key, newCount.toString(), {
    expirationTtl: 86400,
  });

  const remaining = Math.max(0, DAILY_LIMIT - newCount);

  return Response.json(
    {
      image: `data:image/png;base64,${result.data[0].b64_json}`,
      remaining,
    },
    { headers: corsHeaders() }
  );
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};
