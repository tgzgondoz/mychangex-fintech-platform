// services/notificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../supabase';

// Configure notification handler - UPDATED to fix deprecation warning
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // For backward compatibility
    shouldShowBanner: true, // New property - shows notification banner
    shouldShowList: true,   // New property - shows in notification list
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  static async registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log('❌ Must use physical device for push notifications');
      return null;
    }

    try {
      console.log('📱 Starting push notification registration...');
      
      // Get existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('📱 Current permission status:', existingStatus);
      
      let finalStatus = existingStatus;

      // If not granted, request permission
      if (existingStatus !== 'granted') {
        console.log('📱 Requesting push notification permission...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('📱 Permission request result:', status);
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permission not granted');
        return null;
      }

      console.log('✅ Push notification permission granted');
      
      // Get projectId from app config
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      console.log('📱 Using projectId from config:', projectId);
      
      if (projectId) {
        // Use the real projectId
        console.log('📱 Generating Expo push token with projectId...');
        const token = (await Notifications.getExpoPushTokenAsync({
          projectId: projectId
        })).data;
        console.log('✅ Push notification token generated with projectId:', token);
        return token;
      } else {
        // Fallback
        console.log('📱 No projectId found, using automatic detection');
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log('✅ Push notification token generated (auto):', token);
        return token;
      }

    } catch (error) {
      console.error('❌ Error getting push token:', error);
      
      // Test local notifications
      await this.scheduleTransactionNotification(
        'Notifications Active',
        'Local notifications are working perfectly!',
        { type: 'system', development: true }
      );
      
      return null;
    }
  }

  static async savePushToken(userId, token) {
    try {
      console.log('💾 Attempting to save push token for user:', userId);
      console.log('💾 Token to save:', token);
      
      // Don't save invalid tokens
      if (!token || token.includes('DEV_')) {
        console.log('🔧 Invalid token - skipping database save');
        return true;
      }
      
      // Since we're using custom auth, we need to handle RLS differently
      console.log('🔄 Using custom auth approach for push token...');
      
      // Approach 1: Try with the user ID directly (this will work if RLS policies are set correctly)
      const { data, error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          expo_push_token: token,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('❌ Upsert failed:', error);
        
        // Approach 2: Try simple insert
        const { error: insertError } = await supabase
          .from('user_push_tokens')
          .insert({
            user_id: userId,
            expo_push_token: token,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('❌ Insert also failed:', insertError);
          
          // Final approach: Log the token for manual setup
          console.log('📝 Push token for manual setup:', {
            user_id: userId,
            expo_push_token: token,
            created_at: new Date().toISOString()
          });
          
          // Don't fail the app - just log and continue
          return true;
        }
      }

      console.log('✅ Push token saved successfully for user:', userId);
      return true;
      
    } catch (error) {
      console.error('❌ Exception saving push token:', error);
      // Don't fail the app - just log and continue
      return true;
    }
  }

  static async scheduleTransactionNotification(title, body, data = {}) {
    try {
      console.log('📱 Scheduling notification:', { title, body, data });
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            ...data,
            timestamp: new Date().toISOString(),
          },
          sound: 'default',
          priority: 'high',
        },
        trigger: null, // Send immediately
      });
      
      console.log('✅ Notification scheduled successfully, ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      throw error;
    }
  }

  // NEW METHOD: Send push notification via Supabase Edge Function
  static async sendPushNotificationViaEdgeFunction(
    transactionId,
    senderId,
    receiverId,
    amount,
    recipientName,
    senderName
  ) {
    try {
      console.log('📤 Sending push notification via edge function...', {
        transactionId,
        senderId,
        receiverId,
        amount,
        recipientName,
        senderName
      });

      // IMPORTANT: Get this from Supabase Dashboard → Settings → API → anon public key
      // Consider moving this to environment variables or app config
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9meW9jYXdjeWJmd2FveWlvbnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTM3MDAsImV4cCI6MjA3MjgyOTcwMH0.rUrRAQ0sJir01lPIH1TWOVMgJssLW_ARRIBqEIev3CA';

      const response = await fetch(
        'https://ofyocawcybfwaoyionyt.supabase.co/functions/v1/send-transaction-notification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            transaction: {
              id: transactionId,
              sender_id: senderId,
              receiver_id: receiverId,
              amount: amount.toString()
            },
            recipient_name: recipientName || 'User',
            sender_name: senderName || 'User'
          }),
        }
      );
      
      const result = await response.json();
      console.log('📤 Edge function response:', result);
      return result;
    } catch (error) {
      console.error('❌ Error sending notification via edge function:', error);
      return { success: false, error: error.message };
    }
  }

  // Test method to verify everything works
  static async testNotificationSetup() {
    try {
      console.log('🧪 Testing notification setup...');
      
      // Test local notification
      await this.scheduleTransactionNotification(
        'MyChangeX Test',
        'Your notification system is working correctly!',
        { type: 'test', test: true }
      );
      
      console.log('✅ Notification test completed');
      return true;
    } catch (error) {
      console.error('❌ Notification test failed:', error);
      return false;
    }
  }

  // REMOVED: handleIncomingNotification method - now handled in App.js
  
  // REMOVED: getNotificationType method - now handled in App.js
  
  // REMOVED: getNotificationIcon method - now handled in App.js
  
  // REMOVED: getNotificationColor method - now handled in App.js

  // Setup notification channels for Android
  static async setupNotificationChannels() {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('transactions', {
          name: 'Transactions',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0136c0',
        });
        
        await Notifications.setNotificationChannelAsync('system', {
          name: 'System Notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
        
        console.log('✅ Android notification channels setup complete');
      } catch (error) {
        console.error('❌ Error setting up notification channels:', error);
      }
    }
  }

  // Method to check if we have a valid EAS project
  static hasValidEASProject() {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    return !!projectId;
  }

  // NEW: Send push notification using Expo's API directly (alternative to edge function)
  static async sendExpoPushNotification(token, title, body, data = {}) {
    try {
      console.log('📤 Sending direct Expo push notification...');
      
      const message = {
        to: token,
        sound: 'default',
        title: title,
        body: body,
        data: data,
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('📤 Expo API response:', result);
      
      if (result.data && result.data[0]?.status === 'ok') {
        return { success: true, result };
      } else {
        return { success: false, result };
      }
    } catch (error) {
      console.error('❌ Error sending Expo push notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to handle notification data (can be used by App.js)
  static createNotificationObject(notification) {
    const { title, body, data } = notification.request.content;
    
    const notificationType = data.type === 'transaction_sent' ? 'sent' : 
                            data.type === 'transaction_received' ? 'received' : 
                            data.type === 'change_coupon' ? 'completed' : 'system';
    
    const icon = data.type === 'transaction_sent' ? 'arrow-up' : 
                 data.type === 'transaction_received' ? 'arrow-down' : 
                 data.type === 'change_coupon' ? 'checkmark-circle' : 'notifications';
    
    const color = data.type === 'transaction_sent' ? '#FF6B6B' : 
                  data.type === 'transaction_received' ? '#4CAF50' : 
                  data.type === 'change_coupon' ? '#4CAF50' : '#FFA726';
    
    return {
      id: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: notificationType,
      title: title || 'MyChangeX Notification',
      message: body || '',
      amount: data.amount ? parseFloat(data.amount) : null,
      timestamp: data.timestamp || new Date().toISOString(),
      transactionId: data.transaction_id || null,
      read: false,
      icon: icon,
      color: color,
      platform: data.platform || 'MyChangeX',
      isPushNotification: true,
    };
  }
}

// REMOVED: setupNotificationListeners function - now handled in App.js

export default NotificationService;