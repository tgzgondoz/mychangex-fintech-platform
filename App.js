import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { 
  isAuthenticated, 
  testSupabaseConnection 
} from './screens/supabase';

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

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState('checking');

  useEffect(() => {
    initializeApp();
  }, []);

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
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#0136c0' 
      }}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={{ 
          color: '#ffffff', 
          marginTop: 16, 
          fontSize: 16,
          fontWeight: '500',
          textAlign: 'center'
        }}>
          Loading ChangeX...{'\n'}
          <Text style={{ fontSize: 12, opacity: 0.8 }}>
            {dbStatus === 'checking' && '🔌 Checking database...'}
            {dbStatus === 'connected' && '✅ Database connected'}
            {dbStatus === 'disconnected' && '❌ Database offline'}
          </Text>
        </Text>
      </View>
    );
  }

  console.log('🎯 App rendering - User:', user ? `Authenticated (${user.full_name})` : 'Not authenticated');
  console.log('🌐 Database status:', dbStatus);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is authenticated - show main app screens
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="SpendCard" component={SpendCard} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Airtime" component={AirtimeScreen} />
            <Stack.Screen name="Send" component={SendScreen} />
            <Stack.Screen name="Recieve" component={RecieveScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="TransactionHistory" component={TransactionHistory} />
            <Stack.Screen name="SuccessPay" component={SuccessPay} />
            <Stack.Screen name="Utilities" component={UtilitiesScreen} />
            <Stack.Screen name="Econet" component={EconetScreen} />
            <Stack.Screen name="MyChangeX" component={MyChangeXScreen} />
            <Stack.Screen name="Omari" component={OmariScreen} />

            {/* Keep auth screens available for logout/login flow */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : (
          // User is not authenticated - show auth screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="UserType" component={UserTypeScreen} />
            <Stack.Screen name="VendorSignup" component={VendorSignup} />
            <Stack.Screen name="CustomerSignup" component={CustomerSignup} />
            <Stack.Screen name="Password" component={PasswordScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
            {/* Keep main app screens available for testing */}
            <Stack.Screen name="Home" component={HomeScreen} />
          </>
        )}
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}