import React, { useLayoutEffect, useState, useRef } from "react";
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
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons, FontAwesome } from "@expo/vector-icons";
import {
  signUpWithPIN,
  formatZimbabwePhone,
  testSupabaseConnection,
  validatePIN,
} from "./supabase";

const { width, height } = Dimensions.get("window");

const SignupScreen = () => {
  const navigation = useNavigation();
  const isMounted = useRef(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });

    // Test database connection on component mount
    testDatabaseConnection();

    return () => {
      isMounted.current = false;
    };
  }, [navigation]);

  const testDatabaseConnection = async () => {
    try {
      const connected = await testSupabaseConnection();
      if (isMounted.current) {
        setDbConnected(connected);
      }
    } catch (error) {
      console.error('Database connection test failed:', error);
      if (isMounted.current) {
        setDbConnected(false);
      }
    }
  };

  const validatePhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 9 && cleaned.startsWith("7")) {
      return true;
    }
    if (cleaned.length === 10 && cleaned.startsWith("07")) {
      return true;
    }
    if (cleaned.length === 12 && cleaned.startsWith("2637")) {
      return true;
    }
    return false;
  };

  const formatPhoneDisplay = (text) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("263")) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(
        6,
        9
      )} ${cleaned.slice(9, 12)}`;
    }
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(
        6,
        10
      )}`;
    }
  };

  const handlePhoneChange = (text) => {
    if (text.length < phoneNumber.length) {
      setPhoneNumber(text);
      return;
    }
    const cleaned = text.replace(/\D/g, "");
    const formatted = formatPhoneDisplay(cleaned);
    setPhoneNumber(formatted);
  };

  const validateForm = () => {
    // Clear previous errors
    setError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return false;
    }

    const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");
    if (!validatePhoneNumber(cleanedPhoneNumber)) {
      setError("Please enter a valid Zimbabwe mobile number (e.g., 078 473 9341).");
      return false;
    }

    if (!validatePIN(pin)) {
      setError("Please enter a valid 4-digit PIN.");
      return false;
    }

    if (!validatePIN(confirmPin)) {
      setError("Please confirm your 4-digit PIN.");
      return false;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match. Please try again.");
      return false;
    }

    const uniqueDigits = new Set(pin.split(""));
    if (uniqueDigits.size === 1) {
      setError("Please choose a PIN with different digits for better security.");
      return false;
    }

    // Check for sequential numbers (1234, 4321)
    const isSequential = () => {
      const digits = pin.split('').map(Number);
      let ascending = true;
      let descending = true;
      
      for (let i = 1; i < digits.length; i++) {
        if (digits[i] !== digits[i-1] + 1) ascending = false;
        if (digits[i] !== digits[i-1] - 1) descending = false;
      }
      
      return ascending || descending;
    };

    if (isSequential()) {
      setError("Avoid sequential numbers (like 1234) for better security.");
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    // Prevent multiple signup attempts
    if (loading) return;

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");
      const formattedPhone = formatZimbabwePhone(cleanedPhoneNumber);

      // Test database connection first with timeout
      const connectionTimeout = setTimeout(() => {
        if (isMounted.current) {
          Alert.alert(
            "Connection Timeout",
            "Unable to connect to server. Please check your internet connection.",
            [
              { text: "Retry", onPress: () => handleSignup() },
              { text: "Cancel", style: "cancel" }
            ]
          );
          setLoading(false);
        }
      }, 10000);

      try {
        const connected = await testSupabaseConnection();
        clearTimeout(connectionTimeout);
        
        if (!connected) {
          throw new Error("Database connection failed");
        }
        
        if (isMounted.current) {
          setDbConnected(true);
        }
      } catch (connectionError) {
        clearTimeout(connectionTimeout);
        throw new Error("Database connection failed");
      }

      // PIN-based signup
      const signupResult = await signUpWithPIN(
        formattedPhone,
        fullName.trim(),
        pin
      );

      if (!signupResult.success) {
        if (signupResult.error === "USER_ALREADY_EXISTS") {
          Alert.alert(
            "Already Registered",
            "An account with this phone number already exists. Please log in instead.",
            [
              {
                text: "Login",
                onPress: () =>
                  navigation.navigate("Login", { phoneNumber: formattedPhone }),
              },
              { text: "OK", style: "cancel" },
            ]
          );
        } else if (signupResult.error === "INVALID_PHONE") {
          setError("Invalid phone number format.");
        } else if (signupResult.error === "PIN_TOO_SIMPLE") {
          setError("Please choose a more secure PIN.");
        } else if (signupResult.error === "DATABASE_ERROR") {
          Alert.alert(
            "Server Error",
            "Unable to create account. Please try again later.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert(
            "Signup Failed",
            signupResult.error || "Unable to create account. Please try again."
          );
        }
        return;
      }

      // Success - navigate to login
      Alert.alert(
        "Account Created!",
        "Your account has been created successfully. Please login with your phone number and PIN.",
        [
          {
            text: "Login Now",
            onPress: () => {
              navigation.navigate("Login", {
                phoneNumber: formattedPhone,
              });
            },
          },
        ]
      );

    } catch (error) {
      console.error("Signup error:", error);
      
      if (error.message === "Network request failed") {
        Alert.alert(
          "Network Error",
          "Unable to connect to the server. Please check your internet connection.",
          [
            { text: "Retry", onPress: () => handleSignup() },
            { text: "Cancel", style: "cancel" }
          ]
        );
      } else if (error.message === "Database connection failed") {
        Alert.alert(
          "Server Unavailable",
          "The server is currently unavailable. Please try again later.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Signup Error",
          "An unexpected error occurred. Please try again."
        );
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handlePinChange = (text) => {
    const digitsOnly = text.replace(/[^0-9]/g, "");
    if (digitsOnly.length <= 4) {
      setPin(digitsOnly);
    }
  };

  const handleConfirmPinChange = (text) => {
    const digitsOnly = text.replace(/[^0-9]/g, "");
    if (digitsOnly.length <= 4) {
      setConfirmPin(digitsOnly);
    }
  };

  const handleKeyPress = (e) => {
    if (e.nativeEvent.key === "Enter" || e.nativeEvent.key === "done") {
      handleSignup();
    }
  };

  const goToLogin = () => {
    navigation.navigate("Login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#0136c0", "#0136c0"]}
        style={styles.background}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.contentContainer}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../assets/logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.welcomeText}>Create Account</Text>
                <Text style={styles.subText}>Join us to get started</Text>

                {/* Database Status */}
                <View
                  style={[
                    styles.dbStatus,
                    dbConnected ? styles.dbConnected : styles.dbDisconnected,
                  ]}
                >
                  <Text style={styles.dbStatusText}>
                    {dbConnected ? "✓ CONNECTED" : "⚠ CONNECTING..."}
                  </Text>
                </View>
              </View>

              <View style={styles.formContainer}>
                {/* Error Message */}
                {error && (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error" size={16} color="#FF6B6B" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Full Name Input */}
                <View style={styles.inputContainer}>
                  <MaterialIcons
                    name="person"
                    size={20}
                    color="rgba(255,255,255,0.8)"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={fullName}
                    onChangeText={setFullName}
                    onKeyPress={handleKeyPress}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    autoCorrect={false}
                    returnKeyType="next"
                    maxLength={50}
                    editable={!loading}
                  />
                </View>

                {/* Phone Number Input */}
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
                    onKeyPress={handleKeyPress}
                    keyboardType="phone-pad"
                    maxLength={16}
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    returnKeyType="next"
                    editable={!loading}
                  />
                </View>

                {/* PIN Input */}
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
                    onKeyPress={handleKeyPress}
                    secureTextEntry={!showPin}
                    keyboardType="numeric"
                    maxLength={4}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="next"
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
                      color="rgba(255,255,255,0.8)"
                    />
                  </TouchableOpacity>
                </View>

                {/* Confirm PIN Input */}
                <View style={styles.inputContainer}>
                  <FontAwesome
                    name="lock"
                    size={20}
                    color="rgba(255,255,255,0.8)"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm 4-digit PIN"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    value={confirmPin}
                    onChangeText={handleConfirmPinChange}
                    onKeyPress={handleKeyPress}
                    secureTextEntry={!showPin}
                    keyboardType="numeric"
                    maxLength={4}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                    editable={!loading}
                  />
                </View>

                {/* PIN Strength Indicator */}
                {pin.length > 0 && (
                  <View style={styles.pinStrengthContainer}>
                    <MaterialIcons
                      name={
                        pin.length === 4 && new Set(pin.split("")).size > 1
                          ? "check-circle"
                          : "info"
                      }
                      size={16}
                      color={
                        pin.length === 4 && new Set(pin.split("")).size > 1
                          ? "#4CAF50"
                          : "rgba(255,255,255,0.6)"
                      }
                    />
                    <Text style={styles.pinStrengthText}>
                      {pin.length < 4
                        ? `${4 - pin.length} digits remaining`
                        : new Set(pin.split("")).size === 1
                          ? "Use different digits"
                          : "Good PIN"
                      }
                    </Text>
                  </View>
                )}

                {/* PIN Match Indicator */}
                {confirmPin.length > 0 && (
                  <View style={styles.pinMatchContainer}>
                    <MaterialIcons
                      name={
                        pin === confirmPin && pin.length === 4
                          ? "check-circle"
                          : "error"
                      }
                      size={16}
                      color={
                        pin === confirmPin && pin.length === 4
                          ? "#4CAF50"
                          : "#F44336"
                      }
                    />
                    <Text
                      style={[
                        styles.pinMatchText,
                        {
                          color:
                            pin === confirmPin && pin.length === 4
                              ? "#4CAF50"
                              : "#F44336",
                        },
                      ]}
                    >
                      {pin === confirmPin && pin.length === 4
                        ? "PINs match"
                        : "PINs don't match"}
                    </Text>
                  </View>
                )}

                {/* Signup Button */}
                <TouchableOpacity
                  style={[
                    styles.signupButton,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleSignup}
                  disabled={loading || !dbConnected}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#ffffff", "#f8f9fa"]}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#0136c0" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>
                        {dbConnected ? "Create Account" : "Connecting..."}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Login Link */}
                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity
                    onPress={goToLogin}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Text style={styles.loginLink}>Login</Text>
                  </TouchableOpacity>
                </View>

                {/* Security Info */}
                <View style={styles.securityInfoContainer}>
                  <Text style={styles.securityInfoText}>
                    🔒 Secure PIN authentication
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
    justifyContent: "center",
    minHeight: height - (StatusBar.currentHeight || 0),
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    paddingTop: height * 0.05,
    paddingBottom: height * 0.03,
  },
  logo: {
    width: width * 0.25,
    height: width * 0.25,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 6,
    textAlign: "center",
  },
  subText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  dbStatus: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  dbConnected: {
    backgroundColor: "rgba(76, 175, 80, 0.2)",
  },
  dbDisconnected: {
    backgroundColor: "rgba(255, 193, 7, 0.2)",
  },
  dbStatusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  formContainer: {
    paddingHorizontal: width * 0.08,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.3)",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: 0,
  },
  visibilityToggle: {
    padding: 8,
  },
  pinStrengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  pinStrengthText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginLeft: 6,
    fontWeight: "500",
  },
  pinMatchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  pinMatchText: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: "500",
  },
  signupButton: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 16,
    marginBottom: 24,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#0136c0",
    fontSize: 16,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  loginText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
  },
  loginLink: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  securityInfoContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  securityInfoText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    textAlign: "center",
  },
});

export default SignupScreen;