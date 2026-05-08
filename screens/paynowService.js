// screens/paynowService.js
import { supabase } from './supabase';

export const startPayment = async (amount, phone, method, email) => {
  const reference = `MCX-${Date.now()}`;
  
  const payload = {
    resulturl: "https://ofyocawcybfwaoyionyt.supabase.co/functions/v1/paynow-webhook",
    returnurl: "mychangex://payment-results",
    reference: reference,
    amount: amount.toString(),
    id: "24511",
    additionalinfo: "MyChangeX Wallet Top-up",
    authemail: email,
    status: "Message"
  };

  try {
    const { data: hashData, error: hashError } = await supabase.functions.invoke('paynow-initiate', {
      body: { payload }
    });

    if (hashError || !hashData?.hash) {
      throw new Error("Hash generation failed");
    }

    const response = await fetch("https://www.paynow.co.zw/interface/remotetransaction", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...payload, hash: hashData.hash, phone, method }).toString()
    });

    const resultText = await response.text();
    return Object.fromEntries(new URLSearchParams(resultText));
  } catch (error) {
    console.error("Paynow Service Error:", error);
    throw error;
  }
};