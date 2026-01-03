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
  testSupabaseConnection,
  formatZimbabwePhone,
  validatePIN,
  storeUserSession 
} from './supabase';

const { width, height } = Dimensions.get('window');
const PRIMARY_BLUE = "#0136c0";
const ACCENT_BLUE = "#0136c0";
const LIGHT_BLUE = "#f5f8ff";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#666666";
const DARK_TEXT = "#1A1A1A";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#eaeaea";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";
const BACKGROUND_COLOR = "#f8f9fa";

const LoginScreen = () => {
  const navigation = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    
    // Test database connection on component mount
    testDatabaseConnection();
  }, [navigation]);

  const testDatabaseConnection = async () => {
    try {
      setIsConnecting(true);
      const connected = await testSupabaseConnection();
      setDbConnected(connected);
    } catch (error) {
      console.error('Database connection test failed:', error);
      setDbConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const validatePhoneInput = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 12;
  };

  const handleLogin = async () => {
    // Prevent multiple login attempts
    if (loading) return;

    // Validation
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneInput(phoneNumber)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid Zimbabwean phone number (9-12 digits)');
      return;
    }

    if (!validatePIN(pin)) {
      Alert.alert('Invalid PIN', 'Please enter a valid 4-digit PIN');
      return;
    }

    setLoading(true);

    try {
      const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');
      const formattedPhone = formatZimbabwePhone(cleanedPhoneNumber);

      // Test database connection first with timeout
      const connectionTimeout = setTimeout(() => {
        Alert.alert('Connection Timeout', 'Unable to connect to server. Please check your internet connection.');
        setLoading(false);
      }, 10000);

      try {
        const connected = await testSupabaseConnection();
        clearTimeout(connectionTimeout);
        
        if (!connected) {
          Alert.alert('Connection Error', 'Cannot connect to server. Please try again.');
          setLoading(false);
          return;
        }
        setDbConnected(true);
      } catch (connectionError) {
        clearTimeout(connectionTimeout);
        throw new Error('Database connection failed');
      }

      // PIN-based login
      const loginResult = await loginWithPIN(formattedPhone, pin);
      
      if (!loginResult.success) {
        if (loginResult.error === 'USER_NOT_FOUND') {
          Alert.alert(
            'Account Not Found', 
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
            'Incorrect PIN', 
            'The PIN you entered is incorrect. Please try again.',
            [{ text: 'OK' }]
          );
        } else if (loginResult.error === 'ACCOUNT_LOCKED') {
          Alert.alert(
            'Account Locked',
            'Your account has been locked due to multiple failed attempts. Please contact support.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            "Login Failed",
            loginResult.error || "Unable to login. Please try again."
          );
        }
        return;
      }

      // Store user session
      await storeUserSession(loginResult.user);

      // Success - navigate to home screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });

    } catch (error) {
      console.error("Login error:", error);
      
      if (error.message === 'Network request failed') {
        Alert.alert(
          'Network Error',
          'Unable to connect to the server. Please check your internet connection and try again.',
          [
            { text: 'Retry', onPress: () => handleLogin() },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else if (error.message === 'Database connection failed') {
        Alert.alert(
          'Server Unavailable',
          'The server is currently unavailable. Please try again later.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          "Login Error",
          "An unexpected error occurred. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = () => {
    navigation.navigate('Signup', { phoneNumber });
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Forgot PIN',
      'To reset your PIN, please contact customer support.',
      [
        {
          text: 'OK',
          onPress: () => console.log('Forgot PIN assistance')
        }
      ]
    );
  };

  const handlePinChange = (text) => {
    const digitsOnly = text.replace(/[^0-9]/g, "");
    if (digitsOnly.length <= 4) {
      setPin(digitsOnly);
    }
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

  const handleKeyPress = (e) => {
    if (e.nativeEvent.key === 'Enter' || e.nativeEvent.key === 'done') {
      handleLogin();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[BACKGROUND_COLOR, WHITE]}
        style={styles.background}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Centered Content */}
            <View style={styles.contentContainer}>
              {/* Logo Section */}
              <View style={styles.logoContainer}>
                {/* Logo with blue border background */}
                <View style={styles.logoBorderContainer}>
                  <Image 
                    source={require('../assets/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.welcomeText}>Welcome Back</Text>
                <Text style={styles.subText}>Sign in to continue</Text>
                
                {/* Database Status */}
                {!isConnecting && (
                  <Text style={[
                    styles.statusText,
                    dbConnected ? styles.connectedText : styles.disconnectedText
                  ]}>
                    {dbConnected ? '✓ CONNECTED' : 'DISCONNECTED'}
                  </Text>
                )}
              </View>

              {/* Form Section */}
              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <MaterialIcons 
                    name="phone" 
                    size={20}
                    color={PRIMARY_BLUE} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number (e.g., 771234567)"
                    placeholderTextColor={LIGHT_TEXT}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    onKeyPress={handleKeyPress}
                    keyboardType="phone-pad"
                    maxLength={12}
                    returnKeyType="next"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    editable={!loading}
                  />
                </View>

                {/* PIN Input Field */}
                <View style={styles.inputContainer}>
                  <FontAwesome
                    name="lock"
                    size={20}
                    color={PRIMARY_BLUE}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="4-digit PIN"
                    placeholderTextColor={LIGHT_TEXT}
                    value={pin}
                    onChangeText={handlePinChange}
                    onKeyPress={handleKeyPress}
                    secureTextEntry={!showPin}
                    keyboardType="numeric"
                    maxLength={4}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPin(!showPin)}
                    style={styles.visibilityToggle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={loading}
                  >
                    <MaterialIcons
                      name={showPin ? "visibility-off" : "visibility"}
                      size={20}
                      color={LIGHT_TEXT}
                    />
                  </TouchableOpacity>
                </View>

                {/* PIN Strength Indicator */}
                {pin.length > 0 && (
                  <View style={styles.pinIndicatorContainer}>
                    <MaterialIcons
                      name={pin.length === 4 ? "check-circle" : "info"}
                      size={16}
                      color={pin.length === 4 ? SUCCESS_GREEN : LIGHT_TEXT}
                    />
                    <Text style={styles.pinIndicatorText}>
                      {pin.length < 4 
                        ? `${4 - pin.length} digits remaining` 
                        : "PIN ready"
                      }
                    </Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.forgotPassword}
                  onPress={handleForgotPin}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={styles.forgotPasswordText}>Forgot your PIN?</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.loginButton, loading && styles.disabledButton]}
                  onPress={handleLogin}
                  activeOpacity={0.9}
                  disabled={loading || !dbConnected}
                >
                  <View style={styles.buttonBackground}>
                    {loading ? (
                      <ActivityIndicator size="small" color={WHITE} />
                    ) : (
                      <Text style={styles.buttonText}>
                        {dbConnected ? 'Login with PIN' : 'Connecting...'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.signupContainer}>
                  <Text style={styles.signupText}>Don't have an account? </Text>
                  <TouchableOpacity 
                    onPress={handleSignup}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Text style={styles.signupLink}>Sign Up</Text>
                  </TouchableOpacity>
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
    backgroundColor: BACKGROUND_COLOR,
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
  logoBorderContainer: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15, // Makes it perfectly circular
    backgroundColor: PRIMARY_BLUE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    padding: 8, // Adds some padding inside the blue circle
  },
  logo: {
    width: width * 0.2,
    height: width * 0.2,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 6,
    textAlign: 'center',
  },
  subText: {
    fontSize: 16,
    color: LIGHT_TEXT,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  connectedText: {
    color: SUCCESS_GREEN,
  },
  disconnectedText: {
    color: ERROR_RED,
  },
  formContainer: {
    paddingHorizontal: width * 0.08,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 0,
  },
  visibilityToggle: {
    padding: 8,
  },
  pinIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  pinIndicatorText: {
    fontSize: 12,
    color: LIGHT_TEXT,
    marginLeft: 6,
    fontWeight: "500",
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonBackground: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 10,
  },
  buttonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  signupText: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: '500',
  },
  signupLink: {
    color: PRIMARY_BLUE,
    fontWeight: '600',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;