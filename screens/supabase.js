// lib/supabase.js
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const supabaseUrl = 'https://ofyocawcybfwaoyionyt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9meW9jYXdjeWJmd2FveWlvbnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNTM3MDAsImV4cCI6MjA3MjgyOTcwMH0.rUrRAQ0sJir01lPIH1TWOVMgJssLW_ARRIBqEIev3CA';

// Create supabase client with enhanced error handling
let supabase;

try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'my-app',
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  console.log('✅ Supabase client created successfully');
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error);
  // Create fallback client without auth config
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

/**
 * Get PIN hashing secret key (use environment variable in production)
 */
const getSecretKey = () => {
  return process.env.PIN_HASH_SECRET || 'mychangex-pin-secret-key-2024-change-in-production';
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format Zimbabwe phone numbers to standard format
 */
export const formatZimbabwePhone = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    console.log('❌ Invalid phone number input:', phoneNumber);
    return null;
  }
  
  try {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 9 && cleaned.startsWith('7')) {
      return `+263${cleaned}`;
    }
    
    if (cleaned.length === 10 && cleaned.startsWith('07')) {
      return `+263${cleaned.slice(1)}`;
    }
    
    if (cleaned.length === 12 && cleaned.startsWith('2637')) {
      return `+${cleaned}`;
    }
    
    if (phoneNumber.startsWith('+263') && phoneNumber.length === 13) {
      return phoneNumber;
    }
    
    // If we can't format it properly but it has some digits, try with +263
    if (cleaned.length >= 9 && cleaned.startsWith('7')) {
      return `+263${cleaned.substring(0, 9)}`;
    }
    
    console.log('❌ Unable to format phone number:', phoneNumber);
    return null;
  } catch (error) {
    console.error('❌ Error formatting phone number:', error);
    return null;
  }
};

/**
 * Secure PIN hashing function
 */
export const hashPIN = (pin) => {
  try {
    if (!pin || typeof pin !== 'string') {
      throw new Error('Invalid PIN input');
    }
    
    const secretKey = getSecretKey();
    return CryptoJS.HmacSHA256(pin, secretKey).toString();
  } catch (error) {
    console.error('❌ Error hashing PIN:', error);
    throw new Error('Failed to secure PIN');
  }
};

/**
 * Validate phone number format for Zimbabwe
 */
export const validatePhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }
  
  try {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 9 && cleaned.startsWith('7')) {
      return true;
    }
    
    if (cleaned.length === 10 && cleaned.startsWith('07')) {
      return true;
    }
    
    if (cleaned.length === 12 && cleaned.startsWith('2637')) {
      return true;
    }
    
    if (phoneNumber.startsWith('+263') && phoneNumber.length === 13) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error validating phone number:', error);
    return false;
  }
};

/**
 * Validate PIN format (4 digits)
 */
export const validatePIN = (pin) => {
  try {
    if (!pin || typeof pin !== 'string') {
      return false;
    }
    return /^\d{4}$/.test(pin);
  } catch (error) {
    console.error('❌ Error validating PIN:', error);
    return false;
  }
};

// =============================================================================
// DATABASE CONNECTION & TESTING
// =============================================================================

/**
 * Test Supabase connection with comprehensive error handling
 */
export const testSupabaseConnection = async () => {
  try {
    console.log('🔌 Testing Supabase connection...');
    
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return false;
    }

    // Test with a simple query and timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );

    const queryPromise = supabase.from('profiles').select('id').limit(1);
    
    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
    
    if (error) {
      // Handle specific error cases
      switch (error.code) {
        case '42P01': // Table doesn't exist
          console.log('ℹ️ Profiles table does not exist - please run database schema');
          return { connected: true, tableExists: false };
        
        case '42501': // Permission denied
          console.log('❌ Permission denied - check RLS policies');
          return { connected: true, tableExists: true, hasPermission: false };
        
        case '08006': // Connection failure
        case '08001': // SQLSTATE connection exception
          console.error('❌ Database connection failed:', error.message);
          return { connected: false, tableExists: false };
        
        default:
          console.log('ℹ️ Database connection test completed with error:', error.message);
          return { connected: true, tableExists: false };
      }
    }
    
    console.log('✅ Supabase connection test successful - table exists');
    return { connected: true, tableExists: true, hasPermission: true };
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    
    if (error.message.includes('timeout')) {
      return { connected: false, tableExists: false, error: 'Connection timeout' };
    }
    
    if (error.message.includes('network') || error.message.includes('Network')) {
      return { connected: false, tableExists: false, error: 'Network error' };
    }
    
    return { connected: false, tableExists: false, error: error.message };
  }
};

/**
 * Debug function to check database status
 */
export const debugDatabaseStatus = async () => {
  try {
    console.log('🔍 Debugging database status...');
    
    const connectionTest = await testSupabaseConnection();
    console.log('📊 Connection test result:', connectionTest);
    
    // Try to count users
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('❌ Count query failed:', countError.message);
    } else {
      console.log(`👥 Total users in database: ${count}`);
    }
    
    return {
      connection: connectionTest,
      userCount: count,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    return { error: error.message };
  }
};

// =============================================================================
// AUTH SESSION MANAGEMENT
// =============================================================================

/**
 * Ensure authenticated session before database operations
 */
export const ensureAuthenticatedSession = async () => {
  try {
    console.log('🔐 Ensuring authenticated session...');
    
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session check error:', sessionError);
      return { success: false, error: sessionError };
    }
    
    if (session) {
      console.log('✅ Active session found');
      return { success: true, session, user: session.user };
    }
    
    // Try to get user directly
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ User check error:', userError);
      return { success: false, error: userError };
    }
    
    if (user) {
      console.log('✅ Authenticated user found');
      return { success: true, user };
    }
    
    console.log('❌ No authenticated session or user found');
    return { success: false, error: 'No authenticated session' };
    
  } catch (error) {
    console.error('❌ Ensure auth session error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get current auth state with detailed info
 */
export const getAuthState = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    
    const localSession = await getUserSession();
    
    return {
      supabase: {
        hasSession: !!session,
        hasUser: !!user,
        userId: user?.id,
        email: user?.email
      },
      local: {
        hasSession: !!localSession.user,
        user: localSession.user
      },
      isConsistent: session?.user?.id === localSession.user?.id
    };
  } catch (error) {
    console.error('❌ Get auth state error:', error);
    return { error: error.message };
  }
};

// =============================================================================
// RLS POLICY DEBUGGING
// =============================================================================

/**
 * Check RLS policies for user_push_tokens table
 */
export const checkRLSPolicies = async () => {
  try {
    console.log('🔐 Checking RLS policies for user_push_tokens...');
    
    // Try to insert a test record to see if RLS is blocking
    const testData = {
      user_id: '00000000-0000-0000-0000-000000000000', // dummy ID
      expo_push_token: 'test-token-' + Date.now(),
      created_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('user_push_tokens')
      .insert(testData);
    
    if (error?.code === '42501') {
      console.log('❌ RLS Policy is blocking inserts');
      return {
        hasRLS: true,
        canInsert: false,
        error: error.message
      };
    }
    
    // Clean up test data if it succeeded (RLS might be disabled)
    if (!error) {
      await supabase
        .from('user_push_tokens')
        .delete()
        .eq('expo_push_token', testData.expo_push_token);
      
      console.log('⚠️ RLS might be disabled - test insert succeeded');
      return {
        hasRLS: false,
        canInsert: true
      };
    }
    
    return {
      hasRLS: true,
      canInsert: true,
      error: error?.message
    };
    
  } catch (error) {
    console.error('❌ RLS check error:', error);
    return {
      hasRLS: null,
      canInsert: false,
      error: error.message
    };
  }
};

/**
 * Test authenticated insert for push tokens
 */
export const testPushTokenInsert = async (userId) => {
  try {
    console.log('🧪 Testing push token insert for user:', userId);
    
    const testToken = 'test-token-' + Date.now();
    
    const { data, error } = await supabase
      .from('user_push_tokens')
      .insert({
        user_id: userId,
        expo_push_token: testToken,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select();
    
    if (error) {
      console.log('❌ Push token insert test failed:', error);
      return {
        success: false,
        error: error,
        code: error.code
      };
    }
    
    // Clean up test data
    await supabase
      .from('user_push_tokens')
      .delete()
      .eq('id', data[0].id);
    
    console.log('✅ Push token insert test successful');
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    console.error('❌ Push token test error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Debug the push token RLS issue
 */
export const debugPushTokenIssue = async () => {
  console.log('🐛 Debugging push token RLS issue...');
  
  const authState = await getAuthState();
  console.log('🔐 Auth State:', authState);
  
  const rlsCheck = await checkRLSPolicies();
  console.log('🔐 RLS Check:', rlsCheck);
  
  let insertTest = null;
  if (authState.supabase.hasUser) {
    insertTest = await testPushTokenInsert(authState.supabase.userId);
    console.log('🧪 Insert Test:', insertTest);
  }
  
  return {
    authState,
    rlsCheck,
    insertTest
  };
};

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Store user session in AsyncStorage
 */
export const storeUserSession = async (userData) => {
  try {
    if (!userData || !userData.id) {
      throw new Error('Invalid user data for session storage');
    }
    
    const sessionData = {
      user: userData,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };
    
    await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
    await AsyncStorage.setItem('is_authenticated', 'true');
    
    console.log('✅ User session stored successfully for:', userData.full_name);
    return { success: true };
  } catch (error) {
    console.error('❌ Store session error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user session from AsyncStorage
 */
export const getUserSession = async () => {
  try {
    const sessionData = await AsyncStorage.getItem('user_session');
    if (!sessionData) {
      return { success: true, user: null };
    }

    const session = JSON.parse(sessionData);
    
    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      console.log('🕒 Session expired, cleaning up...');
      await AsyncStorage.removeItem('user_session');
      await AsyncStorage.removeItem('is_authenticated');
      return { success: true, user: null };
    }

    console.log('✅ Session retrieved for:', session.user?.full_name);
    return { 
      success: true, 
      user: session.user,
      timestamp: session.timestamp
    };
  } catch (error) {
    console.error('❌ Get session error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async () => {
  try {
    const sessionResult = await getUserSession();
    const authenticated = await AsyncStorage.getItem('is_authenticated');
    
    const isAuth = authenticated === 'true' && sessionResult.user !== null;
    
    console.log('🔐 Authentication check:', isAuth ? 'Authenticated' : 'Not authenticated');
    
    return { 
      success: true, 
      authenticated: isAuth,
      user: sessionResult.user
    };
  } catch (error) {
    console.error('❌ Check authentication error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sign out user
 */
export const signOut = async () => {
  try {
    await AsyncStorage.removeItem('user_session');
    await AsyncStorage.removeItem('is_authenticated');
    console.log('✅ User signed out successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Sign out error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Clear all stored data (for debugging)
 */
export const clearAllStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys);
    console.log('✅ All storage cleared');
    return { success: true };
  } catch (error) {
    console.error('❌ Clear storage error:', error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// USER MANAGEMENT FUNCTIONS
// =============================================================================

/**
 * Check if user exists in the database
 */
export const checkUserExists = async (phoneNumber) => {
  try {
    console.log('🔍 [CHECK] Starting user existence check...');
    
    if (!phoneNumber) {
      return { success: false, exists: false, error: 'Phone number is required' };
    }
    
    const formattedPhone = formatZimbabwePhone(phoneNumber);
    console.log('📱 [CHECK] Formatted phone:', formattedPhone);
    
    if (!formattedPhone) {
      return { success: false, exists: false, error: 'Invalid phone number format' };
    }

    // Use maybeSingle() instead of single() to avoid errors when no user found
    console.log('🔎 [CHECK] Querying database...');
    const { data, error } = await supabase
      .from('profiles')
      .select('id, phone, full_name, pin_hash, balance, created_at')
      .eq('phone', formattedPhone)
      .maybeSingle(); // This won't throw error if no rows found

    console.log('📊 [CHECK] Query result:', { 
      dataFound: !!data, 
      error: error,
      errorCode: error?.code,
      errorMessage: error?.message
    });

    if (error) {
      console.log('❌ [CHECK] Database error:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      
      return { 
        success: false, 
        exists: false, 
        error: `Database error: ${error.message} (code: ${error.code})` 
      };
    }

    // If data is null, no user was found (this is OK)
    if (!data) {
      console.log('✅ [CHECK] User not found (this is OK for new signup)');
      return { success: true, exists: false, data: null };
    }

    console.log('✅ [CHECK] User found:', data.id);
    return { success: true, exists: true, data };
    
  } catch (error) {
    console.error('💥 [CHECK] Unexpected error:', {
      message: error.message,
      stack: error.stack
    });
    
    return { 
      success: false, 
      exists: false, 
      error: `Unexpected error: ${error.message}` 
    };
  }
};

// =============================================================================
// AUTHENTICATION FUNCTIONS (PIN-BASED)
// =============================================================================

/**
 * Sign up new user with PIN
 */
export const signUpWithPIN = async (phoneNumber, fullName, pin) => {
  try {
    // Development bypass for testing
    if (__DEV__ && (!phoneNumber || !fullName || !pin)) {
      console.log('🚀 DEVELOPMENT: Bypassing signup for testing');
      const mockUser = {
        id: 'dev-user-' + Date.now(),
        phone: formatZimbabwePhone(phoneNumber || '771234567'),
        full_name: fullName || 'Test User',
        balance: 0.00,
        created_at: new Date().toISOString()
      };
      
      await storeUserSession(mockUser);
      
      return {
        success: true,
        message: 'Development account created successfully!',
        user: mockUser
      };
    }

    // Input validation
    if (!phoneNumber || !fullName || !pin) {
      return {
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Please fill in all required fields.'
      };
    }

    if (!validatePIN(pin)) {
      return {
        success: false,
        error: 'INVALID_PIN',
        message: 'PIN must be exactly 4 digits.'
      };
    }

    const formattedPhone = formatZimbabwePhone(phoneNumber);
    if (!formattedPhone) {
      return {
        success: false,
        error: 'INVALID_PHONE',
        message: 'Please enter a valid Zimbabwean phone number.'
      };
    }

    if (fullName.trim().length < 2) {
      return {
        success: false,
        error: 'INVALID_NAME',
        message: 'Full name must be at least 2 characters long.'
      };
    }

    console.log('📝 Starting user signup process:', {
      phone: formattedPhone,
      name: fullName.trim()
    });

    // Check if user already exists
    const userCheck = await checkUserExists(formattedPhone);
    if (userCheck.exists) {
      return {
        success: false,
        error: 'USER_ALREADY_EXISTS',
        message: 'This phone number is already registered. Please login instead.'
      };
    }

    if (!userCheck.success) {
      return {
        success: false,
        error: 'CHECK_FAILED',
        message: 'Failed to verify account status. Please try again.'
      };
    }

    // Hash the PIN
    const pinHash = hashPIN(pin);

    console.log('🔐 Attempting to create user in database...');

    // Create user in database
    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          phone: formattedPhone,
          full_name: fullName.trim(),
          pin_hash: pinHash,
          balance: 0.00,
          created_at: new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Database error during signup:', error);

      // Handle specific database errors
      if (error.code === '23505') { // Unique constraint violation
        return {
          success: false,
          error: 'USER_ALREADY_EXISTS',
          message: 'This phone number is already registered. Please login instead.'
        };
      }

      if (error.code === '42501') { // Permission denied
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'Database permission error. Please contact support.'
        };
      }

      if (error.message.includes('network') || error.message.includes('Network')) {
        return {
          success: false,
          error: 'NETWORK_ERROR',
          message: 'Network error. Please check your internet connection and try again.'
        };
      }

      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Failed to create account. Please try again.'
      };
    }

    console.log('✅ User created successfully:', data.id);

    // Store session
    await storeUserSession(data);

    return {
      success: true,
      message: 'Account created successfully!',
      user: data
    };

  } catch (error) {
    console.error('❌ Signup error:', error);

    if (error.message.includes('network') || error.message.includes('Network')) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: 'Network error. Please check your internet connection.'
      };
    }

    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred. Please try again.'
    };
  }
};

/**
 * Login user with PIN
 */
export const loginWithPIN = async (phoneNumber, pin) => {
  try {
    // Development bypass for testing
    if (__DEV__ && (!phoneNumber || !pin)) {
      console.log('🚀 DEVELOPMENT: Bypassing login for testing');
      const mockUser = {
        id: 'dev-user-' + Date.now(),
        phone: formatZimbabwePhone(phoneNumber || '771234567'),
        full_name: 'Test User',
        balance: 100.00,
        created_at: new Date().toISOString()
      };
      
      await storeUserSession(mockUser);
      
      return {
        success: true,
        message: 'Development login successful!',
        user: mockUser
      };
    }

    // Input validation
    if (!phoneNumber || !pin) {
      return {
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Please enter both phone number and PIN.'
      };
    }

    if (!validatePIN(pin)) {
      return {
        success: false,
        error: 'INVALID_PIN',
        message: 'PIN must be exactly 4 digits.'
      };
    }

    const formattedPhone = formatZimbabwePhone(phoneNumber);
    if (!formattedPhone) {
      return {
        success: false,
        error: 'INVALID_PHONE',
        message: 'Please enter a valid Zimbabwean phone number.'
      };
    }

    console.log('🔐 Attempting login for:', formattedPhone);

    // Check if user exists
    const userCheck = await checkUserExists(formattedPhone);

    if (!userCheck.success) {
      return {
        success: false,
        error: 'CHECK_FAILED',
        message: 'Failed to verify account. Please try again.'
      };
    }

    if (!userCheck.exists) {
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'No account found with this phone number. Please sign up first.'
      };
    }

    // Verify PIN
    const pinHash = hashPIN(pin);
    const isPINValid = pinHash === userCheck.data.pin_hash;

    if (!isPINValid) {
      return {
        success: false,
        error: 'INVALID_PIN',
        message: 'Invalid PIN. Please try again.'
      };
    }

    console.log('✅ Login successful for user:', userCheck.data.id);

    // Store user session
    await storeUserSession(userCheck.data);

    return {
      success: true,
      message: 'Login successful!',
      user: userCheck.data
    };

  } catch (error) {
    console.error('❌ Login error:', error);

    if (error.message.includes('network') || error.message.includes('Network')) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: 'Network error. Please check your internet connection.'
      };
    }

    return {
      success: false,
      error: 'LOGIN_FAILED',
      message: 'Login failed. Please try again.'
    };
  }
};

/**
 * Verify PIN for additional security
 */
export const verifyPIN = async (phoneNumber, pin) => {
  try {
    if (!phoneNumber || !pin) {
      return { success: false, error: 'Phone number and PIN are required' };
    }

    const formattedPhone = formatZimbabwePhone(phoneNumber);
    const userCheck = await checkUserExists(formattedPhone);

    if (!userCheck.exists) {
      return { success: false, error: 'USER_NOT_FOUND' };
    }

    const pinHash = hashPIN(pin);
    const isPINValid = pinHash === userCheck.data.pin_hash;

    return {
      success: isPINValid,
      error: isPINValid ? null : 'INVALID_PIN'
    };

  } catch (error) {
    console.error('❌ PIN verification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// =============================================================================
// USER PROFILE FUNCTIONS
// =============================================================================

/**
 * Get user profile by phone number (FIXED VERSION)
 */
export const getUserProfileByPhone = async (phoneNumber) => {
  try {
    console.log('📱 [GET_PROFILE] Fetching profile for phone:', phoneNumber);
    
    const formattedPhone = formatZimbabwePhone(phoneNumber);
    if (!formattedPhone) {
      return { success: false, error: 'Invalid phone number format' };
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', formattedPhone)
      .maybeSingle(); // Use maybeSingle instead of single

    if (error) {
      console.error('❌ [GET_PROFILE] Error:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      console.log('ℹ️ [GET_PROFILE] No profile found for phone:', formattedPhone);
      return { success: false, error: 'Profile not found' };
    }

    console.log('✅ [GET_PROFILE] Profile found:', data.id);
    return { success: true, data };
    
  } catch (error) {
    console.error('❌ [GET_PROFILE] Unexpected error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user profile by ID (with better error handling)
 */
export const getUserProfile = async (userId) => {
  try {
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }

    console.log('🔍 Fetching user profile for ID:', userId);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Get user profile error:', error);
      
      if (error.code === 'PGRST116') { // No rows found
        return { 
          success: false, 
          error: 'USER_NOT_FOUND',
          message: 'User profile not found' 
        };
      }
      
      return { 
        success: false, 
        error: `Database error: ${error.message}` 
      };
    }

    console.log('✅ User profile loaded successfully');
    return { success: true, data };
    
  } catch (error) {
    console.error('❌ Get user profile error:', error);
    return { 
      success: false, 
      error: `Unexpected error: ${error.message}` 
    };
  }
};

/**
 * Update user PIN
 */
export const updateUserPIN = async (phoneNumber, newPIN) => {
  try {
    const formattedPhone = formatZimbabwePhone(phoneNumber);
    
    if (!validatePIN(newPIN)) {
      return {
        success: false,
        error: 'PIN must be exactly 4 digits'
      };
    }

    const pinHash = hashPIN(newPIN);

    const { data, error } = await supabase
      .from('profiles')
      .update({ pin_hash: pinHash })
      .eq('phone', formattedPhone)
      .select()
      .single();

    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('❌ Update PIN error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update user balance
 */
export const updateUserBalance = async (phoneNumber, newBalance) => {
  try {
    const formattedPhone = formatZimbabwePhone(phoneNumber);
    
    if (typeof newBalance !== 'number' || newBalance < 0) {
      return {
        success: false,
        error: 'Invalid balance amount'
      };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('phone', formattedPhone)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ User balance updated successfully');
    return { success: true, data };
    
  } catch (error) {
    console.error('❌ Update balance error:', error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// TRANSACTION FUNCTIONS - UPDATED FOR RLS FIX
// =============================================================================

/**
 * Execute a secure fund transfer between users using RPC function
 */
export const transferFunds = async (senderId, receiverId, amount) => {
  try {
    console.log('💰 Starting fund transfer:', {
      senderId,
      receiverId, 
      amount
    });

    // Validate inputs
    if (!senderId || !receiverId || !amount) {
      return {
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Sender, receiver, and amount are required'
      };
    }

    if (amount <= 0) {
      return {
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Transfer amount must be positive'
      };
    }

    if (senderId === receiverId) {
      return {
        success: false,
        error: 'SELF_TRANSFER',
        message: 'Cannot transfer to yourself'
      };
    }

    // Use the database function for atomic transaction
    const { data, error } = await supabase.rpc('transfer_funds', {
      sender_id: senderId,
      receiver_id: receiverId,
      transfer_amount: amount
    });

    if (error) {
      console.error('❌ Transfer funds RPC error:', error);
      
      // Handle specific error cases
      if (error.message.includes('Insufficient funds')) {
        return {
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient balance for this transfer'
        };
      }
      
      if (error.message.includes('not found')) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'One of the users was not found'
        };
      }

      return {
        success: false,
        error: 'TRANSFER_FAILED',
        message: `Transfer failed: ${error.message}`
      };
    }

    console.log('✅ Fund transfer successful:', data);
    return {
      success: true,
      data: data,
      message: 'Transfer completed successfully'
    };

  } catch (error) {
    console.error('❌ Transfer funds error:', error);
    return {
      success: false,
      error: 'TRANSFER_ERROR',
      message: `Transfer error: ${error.message}`
    };
  }
};

/**
 * Manual transaction execution as fallback
 */
export const executeManualTransaction = async (senderId, receiverId, amount) => {
  try {
    console.log('🔄 Starting manual transaction...');

    // Get current balances within a transaction context
    const { data: senderData, error: senderError } = await supabase
      .from('profiles')
      .select('balance, phone, full_name')
      .eq('id', senderId)
      .single();

    if (senderError) {
      throw new Error(`Failed to fetch sender: ${senderError.message}`);
    }

    const { data: receiverData, error: receiverError } = await supabase
      .from('profiles')
      .select('balance, phone, full_name')
      .eq('id', receiverId)
      .single();

    if (receiverError) {
      throw new Error(`Failed to fetch receiver: ${receiverError.message}`);
    }

    const senderBalance = parseFloat(senderData.balance);
    const receiverBalance = parseFloat(receiverData.balance);
    const transferAmount = parseFloat(amount);

    // Validate sender has sufficient funds
    if (senderBalance < transferAmount) {
      throw new Error('Insufficient funds');
    }

    // Calculate new balances
    const newSenderBalance = senderBalance - transferAmount;
    const newReceiverBalance = receiverBalance + transferAmount;

    console.log('📊 Balance calculations:', {
      senderBalance,
      receiverBalance,
      transferAmount,
      newSenderBalance,
      newReceiverBalance
    });

    // Update sender balance
    const { error: updateSenderError } = await supabase
      .from('profiles')
      .update({ 
        balance: newSenderBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', senderId);

    if (updateSenderError) {
      throw new Error(`Failed to update sender balance: ${updateSenderError.message}`);
    }

    // Update receiver balance
    const { error: updateReceiverError } = await supabase
      .from('profiles')
      .update({ 
        balance: newReceiverBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', receiverId);

    if (updateReceiverError) {
      // Rollback sender balance if receiver update fails
      await supabase
        .from('profiles')
        .update({ 
          balance: senderBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', senderId);
      
      throw new Error(`Failed to update receiver balance: ${updateReceiverError.message}`);
    }

    // Record the transaction
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          sender_id: senderId,
          receiver_id: receiverId,
          amount: transferAmount,
          type: 'mychangex',
          status: 'completed',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (transactionError) {
      console.warn('⚠️ Transaction recorded but failed to return data:', transactionError);
      // Don't throw error here as the funds transfer was successful
    }

    console.log('✅ Manual transaction completed successfully');
    return {
      success: true,
      data: {
        transaction: transactionData,
        newSenderBalance,
        newReceiverBalance
      }
    };

  } catch (error) {
    console.error('❌ Manual transaction error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get user transaction history (FIXED VERSION - handles RLS issues)
 */
export const getUserTransactions = async (userId, limit = 50) => {
  try {
    console.log('📊 [GET_TX] Loading transactions for user:', userId);
    
    // First, verify the user exists
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('❌ [GET_TX] User verification failed:', userError);
      return {
        success: false,
        error: 'User not found',
        data: []
      };
    }
    
    console.log('✅ [GET_TX] User verified, querying transactions...');
    
    // Try with explicit column selection and no joins first
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id,
        sender_id,
        receiver_id,
        amount,
        type,
        status,
        created_at,
        updated_at
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ [GET_TX] Query error:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      
      // Try alternative query if first fails
      console.log('🔄 [GET_TX] Trying alternative query...');
      
      const { data: altData, error: altError } = await supabase
        .from('transactions')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (altError) {
        console.error('❌ [GET_TX] Alternative query also failed:', altError);
        return {
          success: false,
          error: error.message,
          data: []
        };
      }
      
      console.log(`✅ [GET_TX] Alternative query successful: ${altData?.length || 0} transactions`);
      return {
        success: true,
        data: altData || [],
        count: altData?.length || 0
      };
    }

    console.log(`✅ [GET_TX] Query successful: ${data?.length || 0} transactions`);
    
    if (data && data.length > 0) {
      console.log('📊 [GET_TX] Sample transaction:', {
        id: data[0].id,
        amount: data[0].amount,
        sender: data[0].sender_id,
        receiver: data[0].receiver_id,
        date: data[0].created_at
      });
    }
    
    return {
      success: true,
      data: data || [],
      count: data?.length || 0
    };
  } catch (error) {
    console.error('❌ [GET_TX] Unexpected error:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

/**
 * Get transaction by ID (SIMPLIFIED VERSION - no joins)
 */
export const getTransactionById = async (transactionId) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) {
      console.error('❌ Get transaction error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error('❌ Get transaction error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * DIRECT TRANSACTION QUERY - Bypasses getUserTransactions function
 * Use this for CouponTransactionsScreen to avoid RLS issues
 */
export const getDirectTransactions = async (userId) => {
  try {
    console.log('🎯 [DIRECT_TX] Direct query for user:', userId);
    
    // Direct query without any complex logic
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ [DIRECT_TX] Direct query error:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      
      // If RLS error, try with service role key temporarily
      if (error.code === '42501') {
        console.log('🔓 [DIRECT_TX] RLS blocked access. Check RLS policies in Supabase dashboard.');
        console.log('💡 [DIRECT_TX] Run this SQL in Supabase SQL Editor:');
        console.log(`
          -- Enable RLS but allow all reads for testing
          ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
          
          -- Create policy that allows all authenticated users to read
          CREATE POLICY "Allow all authenticated users to read transactions" 
          ON transactions FOR SELECT 
          USING (auth.role() = 'authenticated');
          
          -- Or disable RLS temporarily for testing:
          -- ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
        `);
      }
      
      return {
        success: false,
        error: error.message,
        data: []
      };
    }

    console.log(`✅ [DIRECT_TX] Direct query successful: ${data?.length || 0} transactions`);
    
    if (data && data.length > 0) {
      // Log first few transactions for debugging
      data.slice(0, 3).forEach((tx, i) => {
        console.log(`📊 [DIRECT_TX] TX ${i+1}: $${tx.amount} from ${tx.sender_id.substring(0, 8)} to ${tx.receiver_id.substring(0, 8)}`);
      });
    }
    
    return {
      success: true,
      data: data || [],
      count: data?.length || 0
    };
  } catch (error) {
    console.error('❌ [DIRECT_TX] Unexpected error:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

// =============================================================================
// TESTING & DEBUGGING UTILITIES
// =============================================================================

/**
 * Create a test user for development
 */
export const createTestUser = async (phoneNumber = '771234567', name = 'Test User', pin = '1234') => {
  try {
    return await signUpWithPIN(phoneNumber, name, pin);
  } catch (error) {
    console.error('❌ Create test user error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete test user (cleanup)
 */
export const deleteTestUser = async (phoneNumber = '771234567') => {
  try {
    const formattedPhone = formatZimbabwePhone(phoneNumber);
    
    const { data, error } = await supabase
      .from('profiles')
      .delete()
      .eq('phone', formattedPhone)
      .select();

    if (error) throw error;

    console.log('✅ Test user deleted successfully');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Delete test user error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all users (for debugging)
 */
export const getAllUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`📊 Found ${data.length} users in database`);
    return { success: true, data, count: data.length };
  } catch (error) {
    console.error('❌ Get all users error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Debug signup process
 */
export const debugSignupProcess = async (phoneNumber, fullName, pin) => {
  try {
    console.log('🐛 [DEBUG] Starting signup process debug...');
    
    // Step 1: Phone formatting
    console.log('1. 📱 Testing phone formatting...');
    const formattedPhone = formatZimbabwePhone(phoneNumber);
    console.log('   Input:', phoneNumber);
    console.log('   Formatted:', formattedPhone);
    
    if (!formattedPhone) {
      return { success: false, error: 'Phone formatting failed' };
    }

    // Step 2: Database connection test
    console.log('2. 🔌 Testing database connection...');
    const { data: connData, error: connError } = await supabase
      .from('profiles')
      .select('count(*)', { count: 'exact' })
      .limit(1);
    
    console.log('   Connection result:', { data: connData, error: connError });
    
    if (connError) {
      return { success: false, error: `Connection failed: ${connError.message}` };
    }

    // Step 3: Check if user exists
    console.log('3. 🔍 Checking if user exists...');
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', formattedPhone)
      .maybeSingle();

    console.log('   User check result:', { 
      data: userData, 
      error: userError,
      userExists: !!userData 
    });

    // Step 4: Test insertion
    console.log('4. 🧪 Testing insertion...');
    const testPhone = '+26378' + Date.now().toString().slice(-6);
    const { data: insertData, error: insertError } = await supabase
      .from('profiles')
      .insert([
        {
          phone: testPhone,
          full_name: 'Debug Test User',
          pin_hash: 'debug_hash',
          balance: 0.00
        }
      ])
      .select()
      .single();

    console.log('   Insert test result:', { data: insertData, error: insertError });

    // Clean up test data
    if (insertData) {
      await supabase.from('profiles').delete().eq('id', insertData.id);
      console.log('   🧹 Cleaned up test data');
    }

    return {
      success: true,
      steps: {
        phoneFormatting: { input: phoneNumber, output: formattedPhone, success: !!formattedPhone },
        connection: { success: !connError, error: connError },
        userCheck: { success: !userError, error: userError, userExists: !!userData },
        insertion: { success: !insertError, error: insertError }
      }
    };

  } catch (error) {
    console.error('💥 [DEBUG] Debug process failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Test transaction functionality
 */
export const testTransactionFunctionality = async () => {
  try {
    console.log('🧪 Testing transaction functionality...');
    
    // Create two test users
    const testPhone1 = '+26378' + Date.now().toString().slice(-6);
    const testPhone2 = '+26379' + Date.now().toString().slice(-5);
    
    console.log('1. Creating test users...');
    
    const user1 = await createTestUser(testPhone1, 'Test Sender', '1234');
    const user2 = await createTestUser(testPhone2, 'Test Receiver', '1234');
    
    if (!user1.success || !user2.success) {
      throw new Error('Failed to create test users');
    }
    
    console.log('✅ Test users created:', {
      sender: user1.user.id,
      receiver: user2.user.id
    });
    
    // Test RPC transaction function
    console.log('2. Testing RPC transaction function...');
    const transferResult = await transferFunds(user1.user.id, user2.user.id, 10.00);
    
    console.log('📊 Transfer result:', transferResult);
    
    // Clean up test users
    console.log('3. Cleaning up test data...');
    await deleteTestUser(testPhone1);
    await deleteTestUser(testPhone2);
    
    return {
      success: true,
      transferTest: transferResult,
      message: 'Transaction functionality test completed'
    };
    
  } catch (error) {
    console.error('❌ Transaction test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get database schema information
 */
export const getDatabaseSchema = async () => {
  try {
    console.log('📋 Getting database schema information...');
    
    // Check if profiles table exists and get its structure
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    // Check if transactions table exists
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);
    
    // Check if RPC function exists by testing it
    let rpcFunctionExists = false;
    try {
      // This will fail if function doesn't exist, but that's OK
      await supabase.rpc('transfer_funds', {
        sender_id: '00000000-0000-0000-0000-000000000000',
        receiver_id: '00000000-0000-0000-0000-000000000000',
        transfer_amount: 0
      });
      rpcFunctionExists = true;
    } catch (error) {
      rpcFunctionExists = false;
    }
    
    return {
      success: true,
      schema: {
        profilesTable: {
          exists: !profilesError,
          error: profilesError?.message,
          sampleData: profilesData ? 'Available' : 'No data'
        },
        transactionsTable: {
          exists: !transactionsError,
          error: transactionsError?.message,
          sampleData: transactionsData ? 'Available' : 'No data'
        },
        transferFunction: {
          exists: rpcFunctionExists
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Get schema error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default supabase;