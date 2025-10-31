// screens/OTPVerification.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { 
  verifyOTP, 
  createUserProfile,
  sendOTP,
  testSupabaseConnection,
  formatZimbabwePhone
} from './supabase';

const { width, height } = Dimensions.get('window');

const OTPVerification = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { phoneNumber, userData, isSignup } = route.params || {};
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [dbConnected, setDbConnected] = useState(false);
  
  const inputRefs = useRef([]);

  useEffect(() => {
    testDatabaseConnection();
    startCountdown();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const testDatabaseConnection = async () => {
    const connected = await testSupabaseConnection();
    setDbConnected(connected);
  };

  const startCountdown = () => {
    setCountdown(60);
  };

  const handleOtpChange = (value, index) => {
    if (value.length > 1) {
      // Handle paste
      const pastedOtp = value.split('').slice(0, 6);
      const newOtp = [...otp];
      pastedOtp.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);
      
      // Focus last input
      const lastFilledIndex = pastedOtp.findIndex(digit => !digit) - 1;
      const focusIndex = lastFilledIndex >= 0 ? lastFilledIndex : Math.min(5, pastedOtp.length - 1);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex].focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are filled
    if (newOtp.every(digit => digit) && index === 5) {
      handleVerifyOtp();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    
    // Development bypass for testing
    if (__DEV__ && (otpString.length < 6 || otpString === '000000')) {
      console.log('🚀 DEVELOPMENT MODE: Bypassing OTP verification');
      
      if (isSignup) {
        // Bypass signup completion
        console.log('✅ Bypassing signup completion');
        Alert.alert(
          'Test Mode', 
          'Bypassing OTP verification for signup. Account created successfully!',
          [{ 
            text: 'Continue', 
            onPress: () => navigation.reset({
              index: 0,
              routes: [{ name: 'HomeScreen' }],
            })
          }]
        );
      } else {
        // Bypass login completion
        console.log('✅ Bypassing OTP verification for login');
        Alert.alert(
          'Test Mode', 
          'Bypassing OTP verification. Login successful!',
          [{ 
            text: 'Continue', 
            onPress: () => navigation.reset({
              index: 0,
              routes: [{ name: 'HomeScreen' }],
            })
          }]
        );
      }
      return;
    }

    // Production validation
    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Verifying OTP...', { 
        phoneNumber, 
        isSignup, 
        hasUserData: !!userData 
      });

      // Step 1: Verify OTP with Supabase
      const verificationResult = await verifyOTP(phoneNumber, otpString);
      
      if (!verificationResult.success) {
        Alert.alert('Error', verificationResult.error || 'Invalid verification code');
        return;
      }

      console.log('✅ OTP verified successfully');

      // Step 2: Handle post-verification logic
      if (isSignup && userData) {
        // Create user profile after successful verification
        console.log('👤 Creating user profile...');
        const profileResult = await createUserProfile(
          verificationResult.data.user.id,
          phoneNumber,
          userData.fullName,
          userData.pin
        );
        
        if (!profileResult.success) {
          console.error('Profile creation failed:', profileResult.error);
          Alert.alert('Error', 'Account created but profile setup failed. Please contact support.');
          return;
        }

        console.log('✅ User profile created successfully');
        Alert.alert('Success', 'Account created successfully! 🎉');
        
        // Navigate to main app - CHANGED TO Home
        navigation.reset({
          index: 0,
          routes: [{ name: 'HomeScreen' }],
        });

      } else {
        // Login flow - user is already authenticated by Supabase
        console.log('✅ Login successful');
        Alert.alert('Success', 'Welcome back! 👋');
        
        // Navigate to main app - CHANGED TO Home
        navigation.reset({
          index: 0,
          routes: [{ name: 'HomeScreen' }],
        });
      }

    } catch (error) {
      console.error('OTP verification error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || resendLoading) return;

    setResendLoading(true);
    try {
      console.log('📱 Resending OTP to:', phoneNumber);
      
      const otpResult = await sendOTP(phoneNumber);
      
      if (otpResult.success) {
        Alert.alert('Success', 'Verification code sent successfully 📲');
        startCountdown();
      } else {
        Alert.alert('Error', otpResult.error || 'Failed to resend code');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      Alert.alert('Error', 'Failed to resend verification code');
    } finally {
      setResendLoading(false);
    }
  };

  const quickTestBypass = () => {
    // Fill with bypass code and auto-submit
    setOtp(['0', '0', '0', '0', '0', '0']);
    setTimeout(() => {
      Alert.alert(
        'Quick Test Ready',
        'Bypass OTP code (000000) filled. The form will auto-submit for testing.',
        [{ text: 'OK' }]
      );
    }, 100);
  };

  const testWithValidOtp = () => {
    // Fill with a test OTP
    setOtp(['1', '2', '3', '4', '5', '6']);
    setTimeout(() => {
      Alert.alert(
        'Test OTP Ready',
        'Test OTP code (123456) filled. This will trigger actual OTP verification.',
        [{ text: 'OK' }]
      );
    }, 100);
  };

  const formatPhoneDisplay = (phone) => {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('263')) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
    }
    return phone;
  };

  const getFlowDescription = () => {
    if (isSignup) {
      return 'We sent a 6-digit code to verify your new account';
    } else {
      return 'We sent a 6-digit code to verify your login';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#0136c0', '#0136c0']}
        style={styles.background}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentContainer}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.title}>Verification</Text>
                <View style={styles.placeholder} />
              </View>

              {/* Main Content */}
              <View style={styles.mainContent}>
                <Text style={styles.subtitle}>
                  {isSignup ? 'Verify Your Account' : 'Verify Your Login'}
                </Text>
                <Text style={styles.description}>
                  {getFlowDescription()}
                </Text>
                <Text style={styles.phoneNumberText}>
                  {formatPhoneDisplay(phoneNumber)}
                </Text>

                {/* Database Status */}
                <View style={[styles.dbStatus, dbConnected ? styles.dbConnected : styles.dbDisconnected]}>
                  <Text style={styles.dbStatusText}>
                    {dbConnected ? '✅ DB CONNECTED' : '❌ DB OFFLINE'}
                  </Text>
                </View>

                <Text style={styles.testingText}>
                  {dbConnected ? '📱 OTP VERIFICATION ACTIVE' : '🔧 CHECKING DATABASE...'}
                </Text>

                {/* OTP Inputs */}
                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={ref => inputRefs.current[index] = ref}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled
                      ]}
                      value={digit}
                      onChangeText={value => handleOtpChange(value, index)}
                      onKeyPress={e => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={index === 0 ? 6 : 1}
                      selectTextOnFocus
                      textContentType="oneTimeCode"
                    />
                  ))}
                </View>

                {/* Test Buttons - Only in development */}
                {__DEV__ && (
                  <View style={styles.testButtonsRow}>
                    <TouchableOpacity 
                      style={styles.testButton}
                      onPress={quickTestBypass}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.testButtonText}>🚀 Bypass OTP</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.testButton}
                      onPress={testWithValidOtp}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.testButtonText}>🔐 Test Real OTP</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Verify Button */}
                <TouchableOpacity
                  style={[styles.verifyButton, loading && styles.buttonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#ffffff', '#f8f9fa']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#0136c0" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>
                        {isSignup ? 'Complete Signup & Continue' : 'Verify & Continue'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Resend OTP */}
                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>
                    Didn't Receive the code?{' '}
                  </Text>
                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={countdown > 0 || resendLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.resendLink,
                      (countdown > 0 || resendLoading) && styles.resendLinkDisabled
                    ]}>
                      {resendLoading ? 'Sending...' : countdown > 0 ? `Resend (${countdown}s)` : 'Resend Now'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Flow Info */}
                <View style={styles.flowInfo}>
                  <Text style={styles.flowTitle}>
                    {isSignup ? 'Account Creation' : 'Login'} Flow
                  </Text>
                  <Text style={styles.flowText}>
                    • Enter 6-digit code sent via SMS{'\n'}
                    • Secure Supabase + Twilio verification{'\n'}
                    • {isSignup ? 'Profile creation after verification' : 'Instant access after verification'}
                    {'\n'}• Navigates to Home screen after success
                    {__DEV__ && '\n• Development: 000000 bypasses OTP'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0136c0',
  },
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : StatusBar.currentHeight + 10,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  placeholder: {
    width: 40,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  phoneNumberText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 30,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  dbStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  dbConnected: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  dbDisconnected: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: '#F44336',
    borderWidth: 1,
  },
  dbStatusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  testingText: {
    fontSize: 14,
    color: '#ffeb3b',
    fontWeight: '600',
    marginBottom: 30,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    width: '100%',
  },
  otpInput: {
    width: 50,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  otpInputFilled: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: '#FFFFFF',
  },
  testButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
    width: '100%',
  },
  testButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  verifyButton: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    color: '#0136c0',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  resendText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  resendLink: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  resendLinkDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  flowInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  flowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  flowText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    lineHeight: 16,
  },
});

export default OTPVerification;