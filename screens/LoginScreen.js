
import React, { useLayoutEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { 
  loginWithPIN, 
  checkUserExists, 
  testSupabaseConnection,
  formatZimbabwePhone,
  validatePIN,
  storeUserSession 
} from './supabase'; // Updated import path

const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
  const navigation = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    
    // Test database connection on component mount
    testDatabaseConnection();
  }, []);

  const testDatabaseConnection = async () => {
    console.log('🔌 Testing Supabase connection...');
    const connected = await testSupabaseConnection();
    setDbConnected(connected);
    if (connected) {
      console.log('✅ Supabase connection successful');
    } else {
      console.log('❌ Supabase connection failed');
    }
  };

  const validatePhoneInput = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 12;
  };

  const handleLogin = async () => {
    // Development bypass for testing
    if (__DEV__ && (!phoneNumber || !pin)) {
      console.log('🚀 DEVELOPMENT MODE: Testing PIN login flow');
      Alert.alert(
        'Test Mode', 
        'Testing PIN-based login',
        [{ text: 'Continue' }]
      );
      
      // For testing, we'll simulate a login
      const testPhone = formatZimbabwePhone(phoneNumber || '771234567');
      const testResult = await loginWithPIN(testPhone, pin || '1234');
      
      if (testResult.success) {
        // Store user session and navigate to home
        await storeUserSession(testResult.user);
        Alert.alert(
          'Success', 
          'Login successful!',
          [{ text: 'OK', onPress: () => navigation.navigate("Home") }]
        );
      } else {
        Alert.alert('Error', testResult.error || 'Login failed');
      }
      return;
    }

    // Production validation
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneInput(phoneNumber)) {
      Alert.alert('Invalid Phone', 'Please enter a valid Zimbabwean phone number');
      return;
    }

    if (!validatePIN(pin)) {
      Alert.alert('Error', 'Please enter a valid 4-digit PIN');
      return;
    }

    setLoading(true);

    try {
      const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
      const formattedPhone = formatZimbabwePhone(cleanedPhoneNumber);

      console.log('🔐 Starting PIN login process for:', formattedPhone);

      // Test database connection first
      if (!dbConnected) {
        const connected = await testSupabaseConnection();
        if (!connected) {
          Alert.alert('Database Error', 'Cannot connect to database. Please try again.');
          setLoading(false);
          return;
        }
        setDbConnected(true);
      }

      // NEW: Direct PIN-based login
      console.log('🔑 Verifying PIN...');
      const loginResult = await loginWithPIN(formattedPhone, pin);
      
      if (!loginResult.success) {
        if (loginResult.error === 'USER_NOT_FOUND') {
          Alert.alert(
            'User Not Found', 
            'No account found with this phone number. Please sign up first.',
            [
              { 
                text: 'Sign Up', 
                onPress: () => navigation.navigate('Signup', { phoneNumber: formattedPhone }) 
              },
              { text: 'OK', style: 'cancel' }
            ]
          );
        } else if (loginResult.error === 'INVALID_PIN') {
          Alert.alert(
            'Invalid PIN', 
            'The PIN you entered is incorrect. Please try again.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            "Login Error",
            loginResult.error || "Failed to login. Please try again."
          );
        }
        return;
      }

      console.log('✅ Login successful');

      // NEW: Store user session and navigate to home
      await storeUserSession(loginResult.user);

      // Success - navigate to home screen
      Alert.alert(
        "Welcome Back!",
        `Login successful. Welcome back, ${loginResult.user.full_name}!`,
        [
          {
            text: "Continue",
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            }
          }
        ]
      );

    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = () => {
    console.log('📝 Navigating to Signup');
    navigation.navigate('Signup', { phoneNumber });
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Reset PIN',
      'To reset your PIN, please contact support or create a new account.',
      [
        {
          text: 'Contact Support',
          onPress: () => console.log('Contact support pressed')
        },
        {
          text: 'Create New Account',
          onPress: () => navigation.navigate('Signup')
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handlePinChange = (text) => setPin(text.replace(/[^0-9]/g, ""));

  const fillTestData = () => {
    setPhoneNumber('771234567');
    setPin('1234');
    Alert.alert(
      'Test Data Loaded', 
      'Sample login credentials filled. Click Login to test PIN authentication.',
      [{ text: 'OK' }]
    );
  };

  const fillQuickTestData = () => {
    // Quick test with minimal data (will trigger development bypass)
    setPhoneNumber('7');
    setPin('1');
    setTimeout(() => {
      Alert.alert(
        'Quick Test Ready',
        'Minimal test data loaded. Click "Login" to test development bypass.',
        [{ text: 'OK' }]
      );
    }, 100);
  };

  const formatPhoneDisplay = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (text) => {
    if (text.length < phoneNumber.length) {
      setPhoneNumber(text);
      return;
    }
    const cleaned = text.replace(/\D/g, '');
    const formatted = formatPhoneDisplay(cleaned);
    setPhoneNumber(formatted);
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
            {/* Centered Content */}
            <View style={styles.contentContainer}>
              {/* Logo Section */}
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.welcomeText}>Welcome Back</Text>
                <Text style={styles.subText}>Sign in to continue</Text>
                
                {/* Database Status */}
                <View style={[styles.dbStatus, dbConnected ? styles.dbConnected : styles.dbDisconnected]}>
                  <Text style={styles.dbStatusText}>
                    {dbConnected ? '✅ DB CONNECTED' : '❌ DB OFFLINE'}
                  </Text>
                </View>
                
                <Text style={styles.testingText}>
                  {dbConnected ? '🔐 READY FOR PIN AUTH' : '🔧 CHECKING DATABASE...'}
                </Text>
              </View>

              {/* Form Section */}
              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <MaterialIcons 
                    name="phone" 
                    size={20}
                    color="rgba(255,255,255,0.8)" 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number (e.g., 771234567)"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    maxLength={12}
                    returnKeyType="next"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                  />
                </View>

                {/* NEW: PIN Input Field */}
                <View style={styles.inputContainer}>
                  <FontAwesome
                    name="lock"
                    size={20}
                    color="rgba(255,255,255,0.8)"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="4-digit PIN"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={pin}
                    onChangeText={handlePinChange}
                    secureTextEntry={!showPin}
                    keyboardType="numeric"
                    maxLength={4}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPin(!showPin)}
                    style={styles.visibilityToggle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <MaterialIcons
                      name={showPin ? "visibility-off" : "visibility"}
                      size={20}
                      color="rgba(255,255,255,0.8)"
                    />
                  </TouchableOpacity>
                </View>

                {/* UPDATED: Login Info */}
                <View style={styles.loginInfoContainer}>
                  <Text style={styles.loginInfoText}>
                    Enter your phone number and 4-digit PIN to login
                  </Text>
                </View>

                {/* PIN Strength Indicator */}
                {pin.length > 0 && (
                  <View style={styles.pinIndicatorContainer}>
                    <MaterialIcons
                      name={pin.length === 4 ? "check-circle" : "info"}
                      size={16}
                      color={pin.length === 4 ? "#4CAF50" : "rgba(255,255,255,0.6)"}
                    />
                    <Text style={styles.pinIndicatorText}>
                      {pin.length < 4 
                        ? `${4 - pin.length} digits remaining` 
                        : "PIN ready"
                      }
                    </Text>
                  </View>
                )}

                {/* Test Buttons Row - Only in development */}
                {__DEV__ && (
                  <View style={styles.testButtonsRow}>
                    <TouchableOpacity 
                      style={styles.testButton}
                      onPress={fillTestData}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.testButtonText}>🎯 Fill Test Data</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.testButton}
                      onPress={fillQuickTestData}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.testButtonText}>⚡ Quick Test</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.forgotPassword}
                  onPress={handleForgotPin}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPasswordText}>Forgot your PIN?</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.loginButton, loading && styles.disabledButton]}
                  onPress={handleLogin}
                  activeOpacity={0.9}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#fff', '#f8f9fa']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#0136c0" />
                    ) : (
                      <Text style={styles.buttonText}>
                        {dbConnected ? '🔐 Login with PIN' : '🔌 Connecting...'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.signupContainer}>
                  <Text style={styles.signupText}>Don't have an account? </Text>
                  <TouchableOpacity 
                    onPress={handleSignup}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.signupLink}>Sign Up</Text>
                  </TouchableOpacity>
                </View>

                {/* UPDATED: Auth Flow Info */}
                <View style={styles.authInfoContainer}>
                  <Text style={styles.authInfoTitle}>
                    Login Flow: {dbConnected ? 'PIN Auth ✅' : 'Setup Required 🔧'}
                  </Text>
                  <Text style={styles.authInfoText}>
                    • Enter phone + PIN → Direct login → Home screen{'\n'}
                    • No SMS verification required{'\n'}
                    • Secure PIN-based authentication{'\n'}
                    {__DEV__ && '• Development: Test mode available'}
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
    backgroundColor: "#0136c0",
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
    justifyContent: 'center',
    minHeight: height - (StatusBar.currentHeight || 0),
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: height * 0.05,
    paddingBottom: height * 0.03,
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    color: '#ffffff',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.36,
    includeFontPadding: false,
  },
  subText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
    includeFontPadding: false,
    marginBottom: 8,
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
    includeFontPadding: false,
  },
  testingText: {
    fontSize: 14,
    color: '#ffeb3b',
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    includeFontPadding: false,
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: width * 0.08,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  visibilityToggle: {
    padding: 8,
  },
  loginInfoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  loginInfoText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  // NEW: PIN indicator styles
  pinIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  pinIndicatorText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginLeft: 6,
    fontWeight: "500",
  },
  testButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
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
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
    includeFontPadding: false,
  },
  loginButton: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
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
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  signupText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    includeFontPadding: false,
  },
  signupLink: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
    textDecorationLine: 'underline',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    includeFontPadding: false,
  },
  authInfoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  authInfoTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  authInfoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    lineHeight: 16,
  },
});

export default LoginScreen;