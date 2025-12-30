// screens/AirtimeScreen.js
import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Image,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getUserSession, getUserProfile } from "./supabase";

const { width, height } = Dimensions.get("window");

// Match HomeScreen color scheme
const PRIMARY_BLUE = "#0136c0";
const ACCENT_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#e9edf9";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.15)";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";

// Import your image assets
const econetLogo = require("../assets/econet-wireless-logo.png");
const netoneLogo = require("../assets/netone.png");
const telecelLogo = require("../assets/telecel-zimbabwe-logo.png");
const mychangexLogo = require("../assets/logo.png");

const AirtimeScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [balance, setBalance] = useState(0);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [airtimeAmount, setAirtimeAmount] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [userPhoneNumber, setUserPhoneNumber] = useState("");

  // Network providers data - match HomeScreen design
  const networks = [
    {
      id: "econet",
      name: "Econet",
      color: "#FF6B35",
      icon: econetLogo,
      description: "Econet Wireless Zimbabwe",
      prefix: "077, 078",
      quickAmounts: [1, 2, 5, 10, 20, 50],
      gradient: ["#0136c0", "#0136c0"], // Match HomeScreen gradient
    },
    {
      id: "netone",
      name: "NetOne",
      color: "#4CAF50",
      icon: netoneLogo,
      description: "NetOne Cellular",
      prefix: "071",
      quickAmounts: [1, 2, 5, 10, 20, 50],
      gradient: ["#0136c0", "#0136c0"], // Match HomeScreen gradient
    },
    {
      id: "telecel",
      name: "Telecel",
      color: "#2196F3",
      icon: telecelLogo,
      description: "Telecel Zimbabwe",
      prefix: "073",
      quickAmounts: [1, 2, 5, 10, 20, 50],
      gradient: ["#0136c0", "#0136c0"], // Match HomeScreen gradient
    },
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const sessionResult = await getUserSession();

      if (!sessionResult.success || !sessionResult.user) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please login again.",
          [{ text: "OK", onPress: () => navigation.navigate("Login") }]
        );
        return;
      }

      setUserData(sessionResult.user);
      setUserPhoneNumber(sessionResult.user.phone || "");

      const profileResult = await getUserProfile(sessionResult.user.id);
      if (profileResult.success) {
        setBalance(profileResult.data.balance || 0);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert(
        "Connection Error",
        "Unable to load your data. Please check your internet connection and try again.",
        [
          { text: "Try Again", onPress: () => loadUserData() },
          { text: "Go Back", onPress: () => navigation.goBack() },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNetworkSelect = (network) => {
    setSelectedNetwork(network);
    setAirtimeAmount("");
    setCustomAmount("");
    setPhoneNumber(userPhoneNumber);
  };

  const handleAmountSelect = (amount) => {
    setAirtimeAmount(amount.toString());
    setCustomAmount("");
  };

  const handleCustomAmountChange = (amount) => {
    setCustomAmount(amount);
    setAirtimeAmount("");
  };

  const validatePhoneNumber = (number, network) => {
    const cleaned = number.replace(/\D/g, "");

    if (cleaned.length < 9) {
      return { valid: false, message: "Phone number is too short" };
    }

    switch (network.id) {
      case "econet":
        if (!cleaned.startsWith("77") && !cleaned.startsWith("78")) {
          return {
            valid: false,
            message: "Econet numbers start with 077 or 078",
          };
        }
        break;
      case "netone":
        if (!cleaned.startsWith("71")) {
          return { valid: false, message: "NetOne numbers start with 071" };
        }
        break;
      case "telecel":
        if (!cleaned.startsWith("73")) {
          return { valid: false, message: "Telecel numbers start with 073" };
        }
        break;
    }

    return { valid: true };
  };

  const handleBuyAirtime = () => {
    if (!selectedNetwork) {
      Alert.alert("Error", "Please select a network.");
      return;
    }

    if (!phoneNumber) {
      Alert.alert("Error", "Please enter a phone number.");
      return;
    }

    const phoneValidation = validatePhoneNumber(phoneNumber, selectedNetwork);
    if (!phoneValidation.valid) {
      Alert.alert("Invalid Number", phoneValidation.message);
      return;
    }

    const amount = parseFloat(customAmount || airtimeAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please select or enter a valid amount.");
      return;
    }

    if (amount < 0.5) {
      Alert.alert("Error", "Minimum airtime purchase is $0.50.");
      return;
    }

    if (amount > balance) {
      Alert.alert(
        "Insufficient Funds",
        `You need $${amount.toFixed(2)} but only have $${balance.toFixed(2)} available.`,
        [
          { text: "OK" },
          { text: "Add Funds", onPress: () => navigation.navigate("AddFunds") },
        ]
      );
      return;
    }

    setIsPaymentModalVisible(true);
  };

  const confirmPurchase = async () => {
    setProcessingPayment(true);

    try {
      const amount = parseFloat(customAmount || airtimeAmount);

      // Simulate API call to purchase airtime
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Simulate successful purchase
      const success = Math.random() > 0.1;

      if (success) {
        Alert.alert(
          "Airtime Purchase Successful!",
          `$${amount.toFixed(2)} airtime has been sent to ${formatPhoneNumber(phoneNumber)}.`,
          [
            {
              text: "OK",
              onPress: () => {
                setIsPaymentModalVisible(false);
                setSelectedNetwork(null);
                setAirtimeAmount("");
                setCustomAmount("");
                setPhoneNumber("");
                setBalance((prev) => prev - amount);
              },
            },
          ]
        );
      } else {
        throw new Error("Purchase failed. Please try again.");
      }
    } catch (error) {
      Alert.alert(
        "Purchase Failed",
        error.message || "Please try again later."
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatPhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, "");
    if (cleaned.length === 9 && cleaned.startsWith("7")) {
      return `+263 ${cleaned}`;
    }
    if (cleaned.length === 10 && cleaned.startsWith("0")) {
      return `+263 ${cleaned.slice(1)}`;
    }
    return number;
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const useMyNumber = () => {
    setPhoneNumber(userPhoneNumber);
  };

  if (loading) {
    return (
      <View style={styles.background}>
        <StatusBar barStyle="light-content" backgroundColor="#0136c0" />
        <LinearGradient
          colors={["#0136c0", "#0136c0"]}
          style={styles.gradientBackground}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={WHITE} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <StatusBar barStyle="light-content" backgroundColor="#0136c0" />
      <LinearGradient
        colors={["#0136c0", "#0136c0"]}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header - Match HomeScreen header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={WHITE} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Ionicons name="phone-portrait-outline" size={22} color={WHITE} />
              <Text style={styles.headerTitle}>Buy Airtime</Text>
            </View>

            <View style={styles.balanceContainer}>
              <Text style={styles.balanceText}>${balance.toFixed(2)}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Welcome Section - Match HomeScreen cards */}
            <View style={[styles.card, styles.welcomeCard]}>
              <LinearGradient
                colors={[
                  "rgba(255, 255, 255, 0.1)",
                  "rgba(255, 255, 255, 0.05)",
                ]}
                style={styles.welcomeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.welcomeTitle}>Buy Airtime</Text>
                <Text style={styles.welcomeSubtitle}>
                  Instant airtime top-up for all networks in Zimbabwe
                </Text>
              </LinearGradient>
            </View>

            {/* Network Selection - Match HomeScreen design */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Network</Text>
              <Text style={styles.sectionSubtitle}>
                Choose your mobile network provider
              </Text>
              <View style={styles.networksContainer}>
                {networks.map((network) => (
                  <TouchableOpacity
                    key={network.id}
                    style={[
                      styles.card,
                      styles.networkCard,
                      selectedNetwork?.id === network.id &&
                        styles.networkCardSelected,
                    ]}
                    onPress={() => handleNetworkSelect(network)}
                  >
                    <LinearGradient
                      colors={
                        selectedNetwork?.id === network.id
                          ? network.gradient
                          : [
                              "rgba(255, 255, 255, 0.1)",
                              "rgba(255, 255, 255, 0.05)",
                            ]
                      }
                      style={styles.networkGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.networkHeader}>
                        <View
                          style={[
                            styles.networkIconContainer,
                            selectedNetwork?.id === network.id &&
                              styles.networkIconContainerSelected,
                          ]}
                        >
                          <Image
                            source={network.icon}
                            style={styles.networkImage}
                            resizeMode="contain"
                          />
                        </View>
                        <View style={styles.networkInfo}>
                          <Text
                            style={[
                              styles.networkName,
                              selectedNetwork?.id === network.id &&
                                styles.networkNameSelected,
                            ]}
                          >
                            {network.name}
                          </Text>
                          <Text style={styles.networkDescription}>
                            {network.description}
                          </Text>
                        </View>
                        {selectedNetwork?.id === network.id && (
                          <View style={styles.selectedIndicator}>
                            <Ionicons
                              name="checkmark-circle"
                              size={20}
                              color={WHITE}
                            />
                          </View>
                        )}
                      </View>

                      <View style={styles.networkFooter}>
                        <Text style={styles.networkPrefix}>
                          Numbers: {network.prefix}
                        </Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Phone Number Input - Match HomeScreen input styles */}
            {selectedNetwork && (
              <View style={[styles.card, styles.inputCard]}>
                <Text style={styles.inputLabel}>Enter Phone Number</Text>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.phoneInputWrapper}>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder={`Enter ${selectedNetwork.name} number`}
                      placeholderTextColor="rgba(255, 255, 255, 0.6)"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      maxLength={15}
                    />
                  </View>
                  {userPhoneNumber && (
                    <TouchableOpacity
                      style={styles.useMyNumberButton}
                      onPress={useMyNumber}
                    >
                      <LinearGradient
                        colors={[
                          "rgba(255, 255, 255, 0.1)",
                          "rgba(255, 255, 255, 0.05)",
                        ]}
                        style={styles.useMyNumberGradient}
                      >
                        <Ionicons name="person" size={16} color={WHITE} />
                        <Text style={styles.useMyNumberText}>My Number</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.phoneHint}>
                  {selectedNetwork.name} numbers start with{" "}
                  {selectedNetwork.prefix}
                </Text>
              </View>
            )}

            {/* Amount Selection - Match HomeScreen buttons */}
            {selectedNetwork && phoneNumber && (
              <View style={[styles.card, styles.amountsCard]}>
                <Text style={styles.amountsTitle}>Select Amount</Text>

                {/* Quick Amounts */}
                <View style={styles.amountsContainer}>
                  <Text style={styles.amountSectionTitle}>Quick Select</Text>
                  <View style={styles.amountsGrid}>
                    {selectedNetwork.quickAmounts.map((amount) => (
                      <TouchableOpacity
                        key={amount}
                        style={[
                          styles.amountButton,
                          airtimeAmount === amount.toString() && [
                            styles.amountButtonSelected,
                            { borderColor: WHITE },
                          ],
                        ]}
                        onPress={() => handleAmountSelect(amount)}
                      >
                        <LinearGradient
                          colors={
                            airtimeAmount === amount.toString()
                              ? [
                                  "rgba(255, 255, 255, 0.2)",
                                  "rgba(255, 255, 255, 0.1)",
                                ]
                              : [
                                  "rgba(255, 255, 255, 0.1)",
                                  "rgba(255, 255, 255, 0.05)",
                                ]
                          }
                          style={styles.amountButtonGradient}
                        >
                          <Text
                            style={[
                              styles.amountButtonText,
                              airtimeAmount === amount.toString() &&
                                styles.amountButtonTextSelected,
                            ]}
                          >
                            ${amount}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Custom Amount */}
                <View style={styles.customAmountContainer}>
                  <Text style={styles.amountSectionTitle}>Custom Amount</Text>
                  <View style={styles.customAmountWrapper}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.customAmountInput}
                      placeholder="Enter amount"
                      placeholderTextColor="rgba(255, 255, 255, 0.6)"
                      value={customAmount}
                      onChangeText={handleCustomAmountChange}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Text style={styles.amountHint}>Minimum amount: $0.50</Text>
                </View>
              </View>
            )}

            {/* Buy Button - Match HomeScreen action buttons */}
            {selectedNetwork &&
              phoneNumber &&
              (airtimeAmount || customAmount) && (
                <TouchableOpacity
                  style={styles.buyButton}
                  onPress={handleBuyAirtime}
                >
                  <LinearGradient
                    colors={[SUCCESS_GREEN, "#00E676"]}
                    style={styles.buyButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="flash" size={20} color={WHITE} />
                    <Text style={styles.buyButtonText}>
                      Buy {formatCurrency(customAmount || airtimeAmount)}{" "}
                      Airtime
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
          </ScrollView>

          {/* Confirmation Modal - Match HomeScreen modal */}
          <Modal
            visible={isPaymentModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() =>
              !processingPayment && setIsPaymentModalVisible(false)
            }
          >
            <View style={styles.modalOverlay}>
              <Pressable
                style={styles.modalBackdrop}
                onPress={() =>
                  !processingPayment && setIsPaymentModalVisible(false)
                }
              />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Confirm Airtime Purchase
                  </Text>
                  {!processingPayment && (
                    <TouchableOpacity
                      onPress={() => setIsPaymentModalVisible(false)}
                    >
                      <Ionicons name="close" size={24} color="#0136c0" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.confirmationDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Network:</Text>
                    <Text style={styles.detailValue}>
                      {selectedNetwork?.name}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone Number:</Text>
                    <Text style={styles.detailValue}>
                      {formatPhoneNumber(phoneNumber)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount:</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(customAmount || airtimeAmount)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Your Balance:</Text>
                    <Text style={styles.detailValue}>
                      ${balance.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    processingPayment && styles.confirmButtonDisabled,
                  ]}
                  onPress={confirmPurchase}
                  disabled={processingPayment}
                >
                  <LinearGradient
                    colors={[SUCCESS_GREEN, "#00E676"]}
                    style={styles.confirmButtonGradient}
                  >
                    {processingPayment ? (
                      <ActivityIndicator color={WHITE} />
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        Confirm Purchase
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#0136c0",
  },
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: WHITE,
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 5,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: WHITE,
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  balanceContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  balanceText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  welcomeCard: {
    padding: 0,
    overflow: "hidden",
  },
  welcomeGradient: {
    padding: 24,
    borderRadius: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: WHITE,
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: WHITE,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 16,
  },
  networksContainer: {
    gap: 12,
  },
  networkCard: {
    padding: 0,
    overflow: "hidden",
  },
  networkCardSelected: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  networkGradient: {
    padding: 16,
    borderRadius: 20,
  },
  networkHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  networkIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    padding: 5,
  },
  networkIconContainerSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  networkImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  networkInfo: {
    flex: 1,
  },
  networkName: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 2,
  },
  networkNameSelected: {
    color: WHITE,
    fontWeight: "700",
  },
  networkDescription: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
  },
  selectedIndicator: {
    marginLeft: "auto",
  },
  networkFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 12,
  },
  networkPrefix: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    fontStyle: "italic",
  },
  inputCard: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: WHITE,
    marginBottom: 12,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  phoneInputWrapper: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  phoneInput: {
    padding: 16,
    color: WHITE,
    fontSize: 16,
  },
  useMyNumberButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  useMyNumberGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  useMyNumberText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
  },
  phoneHint: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 8,
    fontStyle: "italic",
  },
  amountsCard: {
    padding: 20,
  },
  amountsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: WHITE,
    marginBottom: 16,
  },
  amountsContainer: {
    marginBottom: 20,
  },
  amountSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 12,
  },
  amountsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amountButton: {
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 80,
    borderWidth: 2,
    borderColor: "transparent",
  },
  amountButtonSelected: {
    borderColor: WHITE,
  },
  amountButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  amountButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
  amountButtonTextSelected: {
    color: WHITE,
  },
  customAmountContainer: {
    gap: 12,
  },
  customAmountWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 16,
  },
  currencySymbol: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    paddingVertical: 16,
    color: WHITE,
    fontSize: 16,
  },
  amountHint: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    fontStyle: "italic",
  },
  buyButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buyButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buyButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: PRIMARY_BLUE,
  },
  confirmationDetails: {
    gap: 12,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  confirmButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  confirmButtonGradient: {
    padding: 18,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "700",
  },
});

export default AirtimeScreen;
