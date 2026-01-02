import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text, Image, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { 
  isAuthenticated, 
  testSupabaseConnection 
} from './screens/supabase';
import { NotificationService } from './screens/services/notificationService';

const Stack = createNativeStackNavigator();

// Add color constants
const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const DARK_TEXT = "#1A1A1A";
const LIGHT_TEXT = "#666666";
const BACKGROUND_COLOR = "#f8f9fa";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState('checking');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // NEW: Global state for refreshing Home screen
  const [homeRefreshTrigger, setHomeRefreshTrigger] = useState(0);
  const [lastTransaction, setLastTransaction] = useState(null);
  
  // Navigation ref for global access
  const navigationRef = useRef(null);

  useEffect(() => {
    initializeApp();
    setupGlobalNotificationListeners();
  }, []);

  // NEW: Setup global notification listeners at App level
  const setupGlobalNotificationListeners = () => {
    console.log('🔔 Setting up global notification listeners in App.js...');
    
    // Setup Android channels
    NotificationService.setupNotificationChannels();
    
    // Listen for notifications received while app is foregrounded
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Global (App.js): Notification received:', notification);
      
      const { title, body, data } = notification.request.content;
      
      // Create new notification object using helper method
      let newNotification = NotificationService.createNotificationObject(notification);
      
      if (!newNotification) {
        // Fallback if helper method doesn't exist
        newNotification = {
          id: `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: data.type === 'transaction_received' ? 'received' : 
                data.type === 'transaction_sent' ? 'sent' : 
                data.type === 'change_coupon' ? 'completed' : 'system',
          title: title || 'MyChangeX Notification',
          message: body || '',
          amount: data.amount ? parseFloat(data.amount) : null,
          timestamp: data.timestamp || new Date().toISOString(),
          transactionId: data.transaction_id || null,
          read: false,
          icon: data.type === 'transaction_received' ? 'arrow-down' : 
                data.type === 'transaction_sent' ? 'arrow-up' : 
                data.type === 'change_coupon' ? 'checkmark-circle' : 'notifications',
          color: data.type === 'transaction_received' ? '#4CAF50' : 
                 data.type === 'transaction_sent' ? '#FF6B6B' : 
                 data.type === 'change_coupon' ? '#4CAF50' : '#FFA726',
          platform: 'MyChangeX',
          isPushNotification: true,
        };
      }

      // Update notifications state
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // ✅ CRITICAL: If it's a transaction notification, trigger Home screen refresh
      if (data.type === 'transaction_received' || data.type === 'transaction_sent') {
        console.log('💰 Global: Transaction notification detected, triggering Home refresh');
        
        // Update last transaction info
        setLastTransaction({
          type: data.type,
          amount: data.amount,
          timestamp: new Date().toISOString(),
          transactionId: data.transaction_id
        });
        
        // Trigger Home screen refresh by incrementing the trigger
        setHomeRefreshTrigger(prev => prev + 1);
        
        console.log('🔄 Home refresh trigger updated:', homeRefreshTrigger + 1);
      }
    });

    // Listen for notification responses (user taps on notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Global: Notification response:', response);
      const { data } = response.notification.request.content;
      
      // Navigate based on notification type
      if (navigationRef.current?.isReady()) {
        if (data.screen) {
          console.log('📍 Navigating to:', data.screen);
          navigationRef.current.navigate(data.screen);
        } else if (data.type === 'transaction_received' || data.type === 'transaction_sent') {
          console.log('📍 Navigating to Notifications for transaction');
          navigationRef.current.navigate('Notifications');
        }
      }
    });

    console.log('✅ Global notification listeners setup complete');

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
      console.log('🔕 Global notification listeners cleaned up');
    };
  };

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing app...');
      
      // Test database connection
      console.log('🔌 Testing database connection...');
      const connectionResult = await testSupabaseConnection();
      
      if (connectionResult.connected) {
        setDbStatus('connected');
        console.log('✅ Database connection successful');
        
        if (connectionResult.tableExists) {
          console.log('✅ Profiles table exists');
        } else {
          console.log('ℹ️ Profiles table does not exist');
        }
      } else {
        setDbStatus('disconnected');
        console.log('❌ Database connection failed');
      }

      // Check authentication state
      console.log('🔍 Checking authentication state...');
      const authResult = await isAuthenticated();
      
      if (authResult.success) {
        console.log('📱 Auth check:', authResult.authenticated ? `User: ${authResult.user?.full_name}` : 'No user session');
        setUser(authResult.authenticated ? authResult.user : null);
        
        // Initialize push notifications for authenticated user
        if (authResult.authenticated && authResult.user?.id) {
          console.log('📱 Initializing push notifications for authenticated user');
          try {
            const token = await NotificationService.registerForPushNotifications();
            if (token) {
              await NotificationService.savePushToken(authResult.user.id, token);
            }
          } catch (error) {
            console.error('❌ Push notification initialization error:', error);
          }
        }
      } else {
        console.error('❌ Auth check failed:', authResult.error);
        setUser(null);
      }
      
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      setUser(null);
      setDbStatus('error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {/* Logo with blue border background */}
        <View style={styles.logoBorderContainer}>
          <Image 
            source={require('./assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <Text style={styles.loadingTitle}>MyChangeX</Text>
        
        <ActivityIndicator size="large" color={PRIMARY_BLUE} style={styles.spinner} />
        
        <Text style={styles.loadingText}>
          Loading...
        </Text>
        
        <Text style={styles.statusText}>
          {dbStatus === 'checking' && '🔌 Checking database...'}
          {dbStatus === 'connected' && '✅ Database connected'}
          {dbStatus === 'disconnected' && '❌ Database offline'}
          {dbStatus === 'error' && '⚠️ Connection error'}
        </Text>
      </View>
    );
  }

  console.log('🎯 App rendering - User:', user ? `Authenticated (${user.full_name})` : 'Not authenticated');
  console.log('🌐 Database status:', dbStatus);
  console.log('📱 Notification state:', { 
    notificationCount: notifications.length, 
    unreadCount: unreadCount,
    homeRefreshTrigger: homeRefreshTrigger,
    lastTransaction: lastTransaction
  });

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is authenticated - show main app screens
          <>
            <Stack.Screen name="Home">
              {(props) => (
                <HomeScreen 
                  {...props} 
                  unreadCount={unreadCount}
                  homeRefreshTrigger={homeRefreshTrigger}
                  lastTransaction={lastTransaction}
                  setHomeRefreshTrigger={setHomeRefreshTrigger}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="SpendCard" component={SpendCard} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Airtime" component={AirtimeScreen} />
            <Stack.Screen name="Send" component={SendScreen} />
            <Stack.Screen name="Recieve" component={RecieveScreen} />
            <Stack.Screen name="Notifications">
              {(props) => (
                <NotificationsScreen 
                  {...props} 
                  notifications={notifications}
                  setNotifications={setNotifications}
                  setUnreadCount={setUnreadCount}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="TransactionHistory" component={TransactionHistory} />
            <Stack.Screen name="SuccessPay" component={SuccessPay} />
            <Stack.Screen name="Utilities" component={UtilitiesScreen} />
            <Stack.Screen name="Econet" component={EconetScreen} />
            <Stack.Screen name="MyChangeX" component={MyChangeXScreen} /> 
            <Stack.Screen name="Omari" component={OmariScreen} />
            {/* ADDED: CouponTransaction for authenticated users */}
            <Stack.Screen name="CouponTransaction" component={CouponTransactionsScreen} />

            {/* Keep auth screens available for logout/login flow */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="UserType" component={UserTypeScreen} />
            <Stack.Screen name="VendorSignup" component={VendorSignup} />
            <Stack.Screen name="CustomerSignup" component={CustomerSignup} />
            <Stack.Screen name="Password" component={PasswordScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
          </>
        ) : (
          // User is not authenticated - show auth screens with main app screens as fallback
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="UserType" component={UserTypeScreen} />
            <Stack.Screen name="VendorSignup" component={VendorSignup} />
            <Stack.Screen name="CustomerSignup" component={CustomerSignup} />
            <Stack.Screen name="Password" component={PasswordScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
            
            {/* Main app screens available as fallback - they'll redirect to login */}
            <Stack.Screen name="Home">
              {(props) => (
                <HomeScreen 
                  {...props} 
                  unreadCount={unreadCount}
                  homeRefreshTrigger={homeRefreshTrigger}
                  lastTransaction={lastTransaction}
                  setHomeRefreshTrigger={setHomeRefreshTrigger}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Notifications">
              {(props) => (
                <NotificationsScreen 
                  {...props} 
                  notifications={notifications}
                  setNotifications={setNotifications}
                  setUnreadCount={setUnreadCount}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="SpendCard" component={SpendCard} />
            <Stack.Screen name="Airtime" component={AirtimeScreen} />
            <Stack.Screen name="Send" component={SendScreen} />
            <Stack.Screen name="Recieve" component={RecieveScreen} />
            <Stack.Screen name="TransactionHistory" component={TransactionHistory} />
            <Stack.Screen name="SuccessPay" component={SuccessPay} />
            <Stack.Screen name="Utilities" component={UtilitiesScreen} />
            <Stack.Screen name="Econet" component={EconetScreen} />
            <Stack.Screen name="MyChangeX" component={MyChangeXScreen} /> 
            <Stack.Screen name="Omari" component={OmariScreen} />
            <Stack.Screen name="CouponTransaction" component={CouponTransactionsScreen} />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

// Styles for the loading screen
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: BACKGROUND_COLOR,
    paddingHorizontal: 20,
  },
  logoBorderContainer: {
    width: 120,
    height: 120,
    borderRadius: 60, // Makes it perfectly circular
    backgroundColor: PRIMARY_BLUE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    padding: 16, // Adds some padding inside the blue circle
  },
  logo: {
    width: 80,
    height: 80,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 30,
    textAlign: 'center',
  },
  spinner: {
    marginBottom: 20,
  },
  loadingText: {
    color: LIGHT_TEXT, 
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14, 
    color: LIGHT_TEXT,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 10,
  },
});

// Add these imports at the top with your other imports
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import UtilitiesScreen from './screens/UtilitiesScreen';
import SignupScreen from './screens/SignUpScreen';
import UserTypeScreen from './screens/UserTypeScreen';
import VendorSignup from './screens/VendorSignup';
import CustomerSignup from './screens/CustomerSignup';
import PasswordScreen from './screens/PasswordScreen';
import SpendCard from './screens/SpendCard';
import AirtimeScreen from './screens/AirtimeScreen';
import SendScreen from './screens/SendScreen';
import TransactionHistory from './screens/TransactionHistory';
import RecieveScreen from './screens/RecieveScreen';
import SuccessPay from './screens/SuccessPay';
import EconetScreen from './screens/EconetScreen';
import MyChangeXScreen from './screens/MyChangeXScreen';
import OmariScreen from './screens/OmariScreen';
import OTPVerificationScreen from './screens/OTPVerificationScreen';
import CouponTransactionsScreen from './screens/CouponTransactionsScreen';