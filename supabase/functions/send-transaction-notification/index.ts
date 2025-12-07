// supabase/functions/send-transaction-notification/index.js

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transaction, recipient_name, sender_name } = await req.json()
    
    console.log('📨 Received transaction data:', JSON.stringify(transaction));
    console.log('📨 Recipient name:', recipient_name);
    console.log('📨 Sender name:', sender_name);
    
    if (!transaction) {
      throw new Error('Transaction data is required')
    }

    // ⚠️ TEMPORARY: Hardcoded for testing - ROTATE THIS KEY AFTER USE!
    const supabaseClient = createClient(
      'https://ofyocawcybfwaoyionyt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9meW9jYXdjeWJmd2FveWlvbnl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI1MzcwMCwiZXhwIjoyMDcyODI5NzAwfQ.FyladfOXEjA8hP8A7Z-QCCzV8TUDolJji47N8fZAFcA'
    )

    console.log('🔍 Looking for sender token for user_id:', transaction.sender_id);
    // Get push tokens for both users
    const { data: senderToken, error: senderError } = await supabaseClient
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', transaction.sender_id)
      .single()

    console.log('🔍 Sender token query result:', { data: senderToken, error: senderError });
    
    if (senderError && senderError.code !== 'PGRST116') {
      console.error('❌ Error fetching sender token:', senderError);
    }

    console.log('🔍 Looking for receiver token for user_id:', transaction.receiver_id);
    const { data: receiverToken, error: receiverError } = await supabaseClient
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', transaction.receiver_id)
      .single()

    console.log('🔍 Receiver token query result:', { data: receiverToken, error: receiverError });
    
    if (receiverError && receiverError.code !== 'PGRST116') {
      console.error('❌ Error fetching receiver token:', receiverError);
    }

    const notifications = []

    // Send notification to sender
    if (senderToken?.expo_push_token) {
      console.log('📤 Sending notification to sender with token:', senderToken.expo_push_token.substring(0, 20) + '...');
      
      const senderNotification = {
        to: senderToken.expo_push_token,
        title: '💰 Change Coupon Sent!',
        body: `You sent $${transaction.amount} to ${recipient_name || 'a user'}`,
        data: { 
          type: 'transaction_sent',
          transaction_id: transaction.id,
          screen: 'TransactionHistory'
        },
        sound: 'default',
        priority: 'high'
      }
      notifications.push(senderNotification)
    } else {
      console.log('⚠️ No sender token found for user:', transaction.sender_id);
    }

    // Send notification to receiver
    if (receiverToken?.expo_push_token) {
      console.log('📤 Sending notification to receiver with token:', receiverToken.expo_push_token.substring(0, 20) + '...');
      
      const receiverNotification = {
        to: receiverToken.expo_push_token,
        title: '💰 Change Coupon Received!',
        body: `You received $${transaction.amount} from ${sender_name || 'a user'}`,
        data: { 
          type: 'transaction_received',
          transaction_id: transaction.id,
          screen: 'TransactionHistory'
        },
        sound: 'default',
        priority: 'high'
      }
      notifications.push(receiverNotification)
    } else {
      console.log('⚠️ No receiver token found for user:', transaction.receiver_id);
    }

    // Send all notifications
    if (notifications.length > 0) {
      console.log(`📤 Sending ${notifications.length} notification(s) to Expo...`);
      
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(notifications),
      })

      const expoResult = await response.json();
      console.log('📤 Expo API response:', JSON.stringify(expoResult, null, 2));

      if (!response.ok) {
        throw new Error(`Expo API error: ${response.status} - ${JSON.stringify(expoResult)}`)
      }

      // Check individual ticket status
      if (expoResult.data) {
        expoResult.data.forEach((ticket, index) => {
          if (ticket.status === 'error') {
            console.error(`❌ Notification ${index} failed:`, ticket.message);
            console.error(`❌ Error details:`, ticket.details);
          } else {
            console.log(`✅ Notification ${index} sent successfully:`, ticket.status);
          }
        });
      }
    } else {
      console.log('⚠️ No notifications to send (no tokens found)');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications_sent: notifications.length,
        message: `Sent ${notifications.length} notification(s)`,
        debug: {
          sender_has_token: !!senderToken?.expo_push_token,
          receiver_has_token: !!receiverToken?.expo_push_token,
          sender_id: transaction.sender_id,
          receiver_id: transaction.receiver_id
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Error sending notifications:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})