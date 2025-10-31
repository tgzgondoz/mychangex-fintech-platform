import React, { useLayoutEffect, useState } from "react";
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
} from "./supabase"; // Updated import path

const { width, height } = Dimensions.get("window");

const SignupScreen = () => {
  const navigation = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [fullName, setFullName] = useState("");
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
    console.log("🔌 Testing Supabase connection for Signup...");
    const connected = await testSupabaseConnection();
    setDbConnected(connected);
    if (connected) {
      console.log("✅ Supabase connection successful");
    } else {
      console.log("❌ Supabase connection failed");
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
    if (!fullName.trim() || fullName.trim().length < 2) {
      Alert.alert("Error", "Full name must be at least 2 characters.");
      return false;
    }
    const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");
    if (!validatePhoneNumber(cleanedPhoneNumber)) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid Zimbabwe mobile number (e.g., 078 473 9341 or 263784739341)."
      );
      return false;
    }

    // Updated PIN validation using the new function
    if (!validatePIN(pin)) {
      Alert.alert("Error", "Please enter a valid 4-digit PIN.");
      return false;
    }

    if (!validatePIN(confirmPin)) {
      Alert.alert("Error", "Please confirm your 4-digit PIN.");
      return false;
    }

    if (pin !== confirmPin) {
      Alert.alert("Error", "PINs do not match. Please try again.");
      return false;
    }

    const uniqueDigits = new Set(pin.split(""));
    if (uniqueDigits.size === 1) {
      Alert.alert(
        "Weak PIN",
        "Please choose a PIN with different digits for better security."
      );
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    // Development bypass for testing
    if (__DEV__ && (!phoneNumber || !pin || !fullName)) {
      console.log("🚀 DEVELOPMENT MODE: Testing PIN signup flow");
      Alert.alert("Test Mode", "Testing PIN-based signup (no OTP required)", [
        { text: "Continue" },
      ]);

      // For testing, we'll simulate a successful signup
      const testPhone = formatZimbabwePhone(phoneNumber || "771234567");
      const testResult = await signUpWithPIN(
        testPhone,
        fullName || "Test User",
        pin || "1234"
      );

      if (testResult.success) {
        Alert.alert("Success", "Account created successfully! Please login.", [
          { text: "OK", onPress: () => navigation.navigate("Login") },
        ]);
      } else {
        Alert.alert("Error", testResult.error || "Failed to create account");
      }
      return;
    }

    // Production validation
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");
      const formattedPhone = formatZimbabwePhone(cleanedPhoneNumber);

      console.log("📝 Starting PIN-based signup process for:", formattedPhone);

      // Test database connection first
      if (!dbConnected) {
        const connected = await testSupabaseConnection();
        if (!connected) {
          Alert.alert(
            "Database Error",
            "Cannot connect to database. Please try again."
          );
          setLoading(false);
          return;
        }
        setDbConnected(true);
      }

      // NEW: Direct PIN-based signup (no OTP)
      console.log("🔐 Creating account with PIN...");
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
                text: "Login Instead",
                onPress: () =>
                  navigation.navigate("Login", { phoneNumber: formattedPhone }),
              },
              { text: "OK", style: "cancel" },
            ]
          );
        } else {
          Alert.alert(
            "Signup Error",
            signupResult.error || "Failed to create account. Please try again."
          );
        }
        return;
      }

      console.log("✅ Account created successfully");

      // NEW: Redirect directly to login page after successful signup
      Alert.alert(
        "Success!",
        "Account created successfully! Please login with your phone number and PIN.",
        [
          {
            text: "Login Now",
            onPress: () => {
              navigation.navigate("Login", {
                phoneNumber: formattedPhone,
                prefillPhone: true,
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error("Signup error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (text) => setPin(text.replace(/[^0-9]/g, ""));
  const handleConfirmPinChange = (text) =>
    setConfirmPin(text.replace(/[^0-9]/g, ""));

  const fillTestData = () => {
    setFullName("Test User");
    setPhoneNumber("771234567");
    setPin("1234");
    setConfirmPin("1234");
    Alert.alert(
      "Test Data Loaded",
      'Sample data filled. Click "Create Account" to test PIN-based signup.',
      [{ text: "OK" }]
    );
  };

  const fillQuickTestData = () => {
    // Quick test with minimal data (will trigger development bypass)
    setFullName("T");
    setPhoneNumber("7");
    setPin("1");
    setConfirmPin("1");
    setTimeout(() => {
      Alert.alert(
        "Quick Test Ready",
        'Minimal test data loaded. Click "Create Account" to test development bypass.',
        [{ text: "OK" }]
      );
    }, 100);
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
                    {dbConnected ? "✅ DB CONNECTED" : "❌ DB OFFLINE"}
                  </Text>
                </View>

                <Text style={styles.testingText}>
                  {dbConnected
                    ? "🔐 READY FOR PIN AUTH"
                    : "🔧 CHECKING DATABASE..."}
                </Text>
              </View>

              <View style={styles.formContainer}>
                {/* FORM FIELDS REMAIN EXACTLY THE SAME */}
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
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    autoCorrect={false}
                    returnKeyType="next"
                    maxLength={50}
                  />
                </View>

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
                    maxLength={16}
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    returnKeyType="next"
                  />
                </View>

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
                    returnKeyType="next"
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
                    secureTextEntry={!showPin}
                    keyboardType="numeric"
                    maxLength={4}
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                  />
                </View>

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
                        ? `${4 - pin.length} more digits needed`
                        : new Set(pin.split("")).size === 1
                          ? "Use different digits for better security"
                          : "Good PIN strength"}
                    </Text>
                  </View>
                )}

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
                        : "PINs do not match"}
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
                      <Text style={styles.testButtonText}>
                        🎯 Fill Test Data
                      </Text>
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
                  style={[
                    styles.signupButton,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleSignup}
                  disabled={loading}
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
                        {dbConnected ? "🔐 Create Account" : "🔌 Connecting..."}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Login")}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.loginLink}>Login</Text>
                  </TouchableOpacity>
                </View>

                {/* UPDATED: Auth Flow Info */}
                <View style={styles.authInfoContainer}>
                  <Text style={styles.authInfoTitle}>
                    Authentication Flow:{" "}
                    {dbConnected ? "PIN Auth ✅" : "Setup Required 🔧"}
                  </Text>
                  <Text style={styles.authInfoText}>
                    • Enter details → Account creation → Redirect to login{"\n"}
                    • 4-digit PIN for authentication{"\n"}• No SMS verification
                    required{"\n"}
                    {__DEV__ && "• Development: Test mode available"}
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
    width: width * 0.3,
    height: width * 0.3,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    color: "#ffffff",
    marginBottom: 6,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.36,
    includeFontPadding: false,
  },
  subText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    textShadowColor: "rgba(0, 0, 0, 0.1)",
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
    backgroundColor: "rgba(76, 175, 80, 0.2)",
    borderColor: "#4CAF50",
    borderWidth: 1,
  },
  dbDisconnected: {
    backgroundColor: "rgba(244, 67, 54, 0.2)",
    borderColor: "#F44336",
    borderWidth: 1,
  },
  dbStatusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    includeFontPadding: false,
  },
  testingText: {
    fontSize: 14,
    color: "#ffeb3b",
    fontWeight: "600",
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    includeFontPadding: false,
    marginTop: 4,
    textAlign: "center",
  },
  formContainer: {
    paddingHorizontal: width * 0.08,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
    borderWidth: 0.5,
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
    letterSpacing: 0.5,
    paddingVertical: 0,
    includeFontPadding: false,
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
  testButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 10,
  },
  testButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
  },
  testButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
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
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#0136c0",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  loginText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    fontWeight: "500",
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    includeFontPadding: false,
  },
  loginLink: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
    textDecorationLine: "underline",
    fontFamily: Platform.select({ ios: "System", android: "Roboto" }),
    includeFontPadding: false,
  },
  authInfoContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  authInfoTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  authInfoText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    lineHeight: 16,
  },
});

export default SignupScreen;
