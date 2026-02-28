interface Env {
  SHAVE_KV: KVNamespace;
}

const DAILY_LIMIT = 50;

function todayKey(): string {
  return `shave-count:${new Date().toISOString().slice(0, 10)}`;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const count = parseInt((await env.SHAVE_KV.get(todayKey())) || "0", 10);
  const remaining = Math.max(0, DAILY_LIMIT - count);

  return Response.json(
    { remaining, total: DAILY_LIMIT },
    { headers: corsHeaders() }
  );
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};
