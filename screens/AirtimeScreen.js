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
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getUserSession, getUserProfile } from "./supabase";

const { width, height } = Dimensions.get("window");

// Updated to match HomeScreen color scheme
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

// Network colors
const ECONET_COLOR = "#0077FF"; // Light blue
const NETONE_COLOR = "#FF9800"; // Light orange
const TELECEL_COLOR = "#FF5252"; // Light red

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
  const [refreshing, setRefreshing] = useState(false);

  // Network providers data with updated colors
  const networks = [
    {
      id: "econet",
      name: "Econet",
      color: ECONET_COLOR,
      icon: econetLogo,
      description: "Econet Wireless Zimbabwe",
      prefix: "077, 078",
      quickAmounts: [1, 2, 5, 10, 20, 50],
    },
    {
      id: "netone",
      name: "NetOne",
      color: NETONE_COLOR,
      icon: netoneLogo,
      description: "NetOne Cellular",
      prefix: "071",
      quickAmounts: [1, 2, 5, 10, 20, 50],
    },
    {
      id: "telecel",
      name: "Telecel",
      color: TELECEL_COLOR,
      icon: telecelLogo,
      description: "Telecel Zimbabwe",
      prefix: "073",
      quickAmounts: [1, 2, 5, 10, 20, 50],
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
      setRefreshing(false);
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

  const onRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  if (loading) {
    return (
      <View style={styles.background}>
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={DARK_TEXT} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Buy Airtime</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_BLUE} />
            <Text style={styles.loadingText}>Loading airtime purchase...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
      <SafeAreaView style={styles.safeArea}>
        {/* Header - Simplified without icon */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={DARK_TEXT} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Buy Airtime</Text>
          </View>

          {/* Empty view to balance the header */}
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_BLUE}
              colors={[PRIMARY_BLUE]}
              title="Refreshing..."
              titleColor={DARK_TEXT}
            />
          }
        >
          {/* Network Selection - Directly starts without banner */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Select Network</Text>
              <Text style={styles.sectionSubtitle}>
                Choose your mobile network provider
              </Text>
            </View>
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
                  activeOpacity={0.8}
                >
                  <View style={styles.networkContent}>
                    <View style={styles.networkHeader}>
                      <View style={[
                        styles.networkIconContainer,
                        { backgroundColor: `${network.color}15` }
                      ]}>
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
                            color={PRIMARY_BLUE}
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.networkFooter}>
                      <Text style={styles.networkPrefix}>
                        Numbers: {network.prefix}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Phone Number Input */}
          {selectedNetwork && (
            <View style={[styles.card, styles.inputCard]}>
              <Text style={styles.inputLabel}>Enter Phone Number</Text>
              <View style={styles.phoneInputContainer}>
                <View style={styles.phoneInputWrapper}>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder={`Enter ${selectedNetwork.name} number`}
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
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
                    <View style={styles.useMyNumberContent}>
                      <Ionicons name="person" size={16} color={PRIMARY_BLUE} />
                      <Text style={styles.useMyNumberText}>My Number</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.phoneHint}>
                {selectedNetwork.name} numbers start with{" "}
                {selectedNetwork.prefix}
              </Text>
            </View>
          )}

          {/* Amount Selection */}
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
                        airtimeAmount === amount.toString() &&
                          styles.amountButtonSelected,
                      ]}
                      onPress={() => handleAmountSelect(amount)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.amountButtonContent}>
                        <Text
                          style={[
                            styles.amountButtonText,
                            airtimeAmount === amount.toString() &&
                              styles.amountButtonTextSelected,
                          ]}
                        >
                          ${amount}
                        </Text>
                      </View>
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
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    value={customAmount}
                    onChangeText={handleCustomAmountChange}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={styles.amountHint}>Minimum amount: $0.50</Text>
              </View>
            </View>
          )}

          {/* Buy Button */}
          {selectedNetwork &&
            phoneNumber &&
            (airtimeAmount || customAmount) && (
              <TouchableOpacity
                style={styles.buyButton}
                onPress={handleBuyAirtime}
                activeOpacity={0.9}
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

        {/* Confirmation Modal */}
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
                <View style={styles.modalTitleContainer}>
                  <Ionicons name="phone-portrait-outline" size={24} color={PRIMARY_BLUE} />
                  <Text style={styles.modalTitle}>
                    Confirm Airtime Purchase
                  </Text>
                </View>
                {!processingPayment && (
                  <TouchableOpacity
                    onPress={() => setIsPaymentModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color={LIGHT_TEXT} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    backgroundColor: BACKGROUND_COLOR,
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
    color: DARK_TEXT,
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: BACKGROUND_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  backButton: {
    padding: 8,
    // Removed the background color
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: DARK_TEXT,
    fontSize: 20,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 40,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: DARK_TEXT,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT,
  },
  networksContainer: {
    gap: 12,
  },
  networkCard: {
    padding: 0,
    overflow: 'hidden',
  },
  networkCardSelected: {
    borderColor: PRIMARY_BLUE,
    borderWidth: 2,
  },
  networkContent: {
    padding: 16,
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
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    padding: 5,
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
    color: DARK_TEXT,
    marginBottom: 2,
  },
  networkNameSelected: {
    color: PRIMARY_BLUE,
    fontWeight: "700",
  },
  networkDescription: {
    fontSize: 12,
    color: LIGHT_TEXT,
  },
  selectedIndicator: {
    marginLeft: "auto",
  },
  networkFooter: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  networkPrefix: {
    fontSize: 12,
    color: LIGHT_TEXT,
    fontStyle: "italic",
  },
  inputCard: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: DARK_TEXT,
    marginBottom: 12,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  phoneInputWrapper: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  phoneInput: {
    padding: 16,
    color: DARK_TEXT,
    fontSize: 16,
  },
  useMyNumberButton: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    overflow: 'hidden',
  },
  useMyNumberContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: '#f9f9f9',
  },
  useMyNumberText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: "600",
  },
  phoneHint: {
    fontSize: 12,
    color: LIGHT_TEXT,
    marginTop: 8,
    fontStyle: "italic",
  },
  amountsCard: {
    padding: 20,
  },
  amountsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: DARK_TEXT,
    marginBottom: 16,
  },
  amountsContainer: {
    marginBottom: 20,
  },
  amountSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: LIGHT_TEXT,
    marginBottom: 12,
  },
  amountsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  amountButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: '#f9f9f9',
    minWidth: 80,
  },
  amountButtonSelected: {
    backgroundColor: LIGHT_BLUE,
    borderColor: PRIMARY_BLUE,
  },
  amountButtonContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  amountButtonText: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: "600",
  },
  amountButtonTextSelected: {
    color: PRIMARY_BLUE,
  },
  customAmountContainer: {
    gap: 12,
  },
  customAmountWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 16,
  },
  currencySymbol: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    paddingVertical: 16,
    color: DARK_TEXT,
    fontSize: 16,
  },
  amountHint: {
    fontSize: 12,
    color: LIGHT_TEXT,
    fontStyle: "italic",
  },
  buyButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
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
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    color: LIGHT_TEXT,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 16,
    color: DARK_TEXT,
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