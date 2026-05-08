import { supabase } from './supabase';

/**
 * Initiates the payment process
 */
export const startPayment = async (amount, phone, method, email) => {
  const payload = {
    resulturl: "https://ofyocawcybfwaoyionyt.supabase.co/functions/v1/paynow-webhook",
    returnurl: "mychangex://payment-results",
    reference: `MCX-${Date.now()}`,
    amount: amount.toString(),
    id: "24511",
    additionalinfo: "MyChangeX Wallet Top-up",
    authemail: email,
    phone: phone,
    method: method,
    status: "Message"
  };

  try {
    // 1. Get the Hash from your Supabase Edge Function
    const { data: hashData, error: hashError } = await supabase.functions.invoke('paynow-initiate', {
      body: { payload }
    });

    if (hashError || !hashData.hash) {
      throw new Error("Hash generation failed. Check Supabase logs.");
    }

    // 2. Post directly to Paynow (Use Expo Go to avoid CORS)
    const response = await fetch("https://www.paynow.co.zw/interface/remotetransaction", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...payload, hash: hashData.hash }).toString()
    });

    const resultText = await response.text();
    return Object.fromEntries(new URLSearchParams(resultText));
  } catch (error) {
    console.error("Paynow Service Error:", error);
    throw error;
  }
};

/**
 * Checks the status of the transaction
 */
export const pollPaymentStatus = async (pollUrl) => {
  try {
    const response = await fetch(pollUrl);
    const text = await response.text();
    const statusData = Object.fromEntries(new URLSearchParams(text));
    return {
      status: statusData.status,
      raw: statusData
    };
  } catch (error) {
    console.error("Polling Error:", error);
    throw error;
  }
};