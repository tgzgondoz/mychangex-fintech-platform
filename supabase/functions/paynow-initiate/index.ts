import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { payload } = await req.json();
    const integrationKey = Deno.env.get("PAYNOW_KEY")!;
    
    console.log("=== Hash Generation Debug ===");
    console.log("Integration Key:", integrationKey);
    console.log("Payload:", payload);

    // CRITICAL: PayNow expects EXACTLY this order with NO additional fields
    // Order: resulturl, returnurl, reference, amount, id, additionalinfo, authemail, status
    const stringToHash = 
      (payload.resulturl || '') + 
      (payload.returnurl || '') + 
      (payload.reference || '') + 
      (payload.amount || '') + 
      (payload.id || '') + 
      (payload.additionalinfo || '') + 
      (payload.authemail || '') + 
      (payload.status || '') + 
      integrationKey;
    
    console.log("String to hash:", stringToHash);
    console.log("String length:", stringToHash.length);

    // Create SHA-512 hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-512", encoder.encode(stringToHash));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    
    console.log("Generated Hash:", hash);
    console.log("Hash starts with:", hash.substring(0, 6));
    console.log("============================");

    return new Response(JSON.stringify({ hash }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});