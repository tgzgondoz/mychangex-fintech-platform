import React, {
  useLayoutEffect,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import {
  supabase,
  getUserSession,
  getUserProfileByPhone,
  signOut,
  isAuthenticated,
  getUserTransactions,
} from "./supabase";
import SpendCard from "./SpendCard";
import { NotificationService } from "./services/notificationService";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const PRIMARY_BLUE = "#0136c0";
const ACCENT_BLUE = "#0136c0";
const LIGHT_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#e9edf9";
const DARK_TEXT = "#1A1A1A";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.15)";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";
const ecocashLogo = require("../assets/ecocash-logo.png");
const omariLogo = require("../assets/omari.png");
const mychangexLogo = require("../assets/logo.png");

const HomeScreen = ({
  navigation,
  route,
  unreadCount = 0,
  homeRefreshTrigger,
  lastTransaction,
  setHomeRefreshTrigger,
}) => {
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] =
    useState(unreadCount);
  const [showBalance, setShowBalance] = useState(true);
  const buttonScale = useState(new Animated.Value(1))[0];
  const balanceOpacity = useRef(new Animated.Value(1)).current;
  const [processingReceivedTransaction, setProcessingReceivedTransaction] =
    useState(false);
  const [previousBalance, setPreviousBalance] = useState(0);
  const [hasShownRefreshNotification, setHasShownRefreshNotification] =
    useState(false);
  const isFocused = useIsFocused();
  const subscriptionsRef = useRef([]);
  const balanceUpdateTimeoutRef = useRef(null);

  useEffect(() => {
    setUnreadNotificationsCount(unreadCount);
  }, [unreadCount]);
  useEffect(() => {
    if (homeRefreshTrigger > 0) {
      handleAutoRefresh();
    }
  }, [homeRefreshTrigger, lastTransaction, isFocused]);
  useEffect(() => {
    if (isFocused) {
      setTimeout(() => {
        refreshBalance();
        if (userData?.id) {
          loadUnreadNotificationsCount(userData.id);
        }
      }, 300);
    }
  }, [isFocused, userData?.id]);
  useLayoutEffect(() => {
    loadUserData();
  }, []);

  const toggleBalanceVisibility = () => {
    Animated.timing(balanceOpacity, {
      toValue: showBalance ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowBalance(!showBalance);
  };

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
      const { data: profile, error: profileError } =
        await getUserProfileByPhone(sessionResult.user.phone);
      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setProfileData(sessionResult.user);
        setPreviousBalance(sessionResult.user.balance || 0);
      } else {
        setProfileData(profile);
        setPreviousBalance(profile.balance || 0);
      }
      if (sessionResult.user?.id) {
        await loadUnreadNotificationsCount(sessionResult.user.id);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert(
        "Connection Error",
        "Unable to load your data. Please check your internet connection and try again.",
        [
          { text: "Try Again", onPress: () => loadUserData() },
          { text: "Logout", onPress: () => handleLogout() },
        ]
      );
      if (userData) {
        setProfileData(userData);
        setPreviousBalance(userData.balance || 0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUnreadNotificationsCount = async (userId) => {
    try {
      if (!userId || typeof userId !== "string" || userId.trim() === "") {
        console.error("❌ Invalid userId provided:", userId);
        return;
      }
      const transactionsResult = await getUserTransactions(userId, 50);
      if (transactionsResult.success) {
        console.log(
          `✅ Loaded ${transactionsResult.data?.length || 0} transactions`
        );
      } else {
        console.log("❌ Error loading transactions:", transactionsResult.error);
      }
    } catch (error) {
      console.error("❌ Error loading notifications count:", error);
    }
  };

  const refreshBalance = async () => {
    try {
      if (!userData?.phone) return;
      console.log("🔄 Refreshing balance for user:", userData.phone);
      const { data: profile, error } = await getUserProfileByPhone(
        userData.phone
      );
      if (!error && profile) {
        const oldBalance = profileData?.balance || userData?.balance || 0;
        const newBalance = profile.balance || 0;
        setProfileData((prevData) => ({ ...prevData, balance: newBalance }));
        setUserData((prevData) => ({ ...prevData, balance: newBalance }));
        console.log(
          `✅ Balance refreshed: $${oldBalance.toFixed(2)} → $${newBalance.toFixed(2)}`
        );
        return newBalance;
      } else if (error) {
        console.error("❌ Error refreshing balance:", error);
      }
    } catch (error) {
      console.error("Error refreshing balance:", error);
    }
    return null;
  };

  const handleAutoRefresh = useCallback(() => {
    console.log("🔄 HomeScreen: Performing auto-refresh...");
    if (balanceUpdateTimeoutRef.current) {
      clearTimeout(balanceUpdateTimeoutRef.current);
    }
    balanceUpdateTimeoutRef.current = setTimeout(() => {
      refreshBalance();
      if (userData?.id) {
        loadUnreadNotificationsCount(userData.id);
      }
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 1000);
    }, 500);
  }, [userData?.id]);

  const onRefresh = useCallback(() => {
    console.log("👆 Manual refresh triggered");
    setRefreshing(true);
    loadUserData();
  }, []);
  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);
  const handlePressOut = useCallback(() => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);
  const openSendModal = () => setIsSendModalVisible(true);
  const closeSendModal = () => setIsSendModalVisible(false);

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        Alert.alert("Logout Failed", "Unable to logout. Please try again.", [
          { text: "OK" },
        ]);
        return;
      }
      navigation.navigate("Login");
    } catch (error) {
      Alert.alert(
        "Logout Error",
        "An unexpected error occurred. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const handleReceive = () => {
    navigation.navigate("Recieve");
  };
  const handlePlatformSelect = (platform) => {
    closeSendModal();
    setTimeout(() => {
      switch (platform) {
        case "ecocash":
          navigation.navigate("Econet");
          break;
        case "omari":
          navigation.navigate("Omari");
          break;
        case "mychangex":
          navigation.navigate("MyChangeX");
          break;
        default:
          console.log("Unknown platform:", platform);
      }
    }, 100);
  };

  const handleServiceSelect = (service) => {
    Alert.alert(
      "Service Selected",
      `You selected: ${service.name}\n\nThis feature will be implemented soon!`,
      [{ text: "OK" }]
    );
  };

  const formatDisplayPhone = (phone) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("263") && cleaned.length === 12) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 12)}`;
    }
    return phone;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        navigation.navigate("Login");
      }
    };
    const unsubscribe = navigation.addListener("focus", checkAuth);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    return () => {
      if (balanceUpdateTimeoutRef.current) {
        clearTimeout(balanceUpdateTimeoutRef.current);
      }
      subscriptionsRef.current.forEach((subscription) => {
        if (subscription) {
          supabase.removeChannel(subscription);
        }
      });
    };
  }, []);

  const HeaderBar = () => {
    const handleNotificationPress = () => {
      navigation.navigate("Notifications");
    };
    return (
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="wallet-outline" size={28} color={WHITE} />
          <Text style={styles.headerTitle}>MyChangeX</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleNotificationPress}
          >
            <Ionicons name="notifications-outline" size={24} color={WHITE} />
            {unreadNotificationsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadNotificationsCount > 9
                    ? "9+"
                    : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("Profile")}
          >
            <Ionicons name="person-outline" size={24} color={WHITE} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ProfileCard = () => {
    const handleProfilePress = () => {
      navigation.navigate("Profile");
    };
    const getFirstInitial = (name) => {
      if (!name) return "U";
      const trimmedName = name.trim();
      if (trimmedName.length === 0) return "U";
      return trimmedName.charAt(0).toUpperCase();
    };
    if (loading && !refreshing) {
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={handleProfilePress}
          activeOpacity={0.9}
        >
          <View style={styles.profileContainer}>
            <View style={styles.profileIconCircle}>
              <ActivityIndicator size="small" color={ACCENT_BLUE} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileUsername}>Loading...</Text>
              <Text style={styles.profilePhone}>Please wait</Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color="rgba(255, 255, 255, 0.5)"
            />
          </View>
        </TouchableOpacity>
      );
    }
    if (!profileData && !userData) {
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={handleProfilePress}
          activeOpacity={0.9}
        >
          <View style={styles.profileContainer}>
            <View style={styles.profileIconCircle}>
              <Feather name="user" size={24} color={ACCENT_BLUE} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileUsername}>No Profile Data</Text>
              <Text style={styles.profilePhone}>
                Please check your connection
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={20}
              color="rgba(255, 255, 255, 0.5)"
            />
          </View>
        </TouchableOpacity>
      );
    }
    const displayData = profileData || userData;
    const userInitial = getFirstInitial(displayData.full_name);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={handleProfilePress}
        activeOpacity={0.9}
      >
        <View style={styles.profileContainer}>
          <LinearGradient
            colors={["#0136c0", "#0136c0"]}
            style={styles.profileIconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.profileInitial}>{userInitial}</Text>
          </LinearGradient>
          <View style={styles.profileInfo}>
            <Text style={styles.profileUsername} numberOfLines={1}>
              {displayData.full_name || "User"}
            </Text>
            <Text style={styles.profilePhone}>
              {formatDisplayPhone(displayData.phone) || "No phone number"}
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color="rgba(255, 255, 255, 0.5)"
          />
        </View>
      </TouchableOpacity>
    );
  };

  const BalanceCard = () => {
    const displayData = profileData || userData;
    const balance = displayData?.balance || 0;
    const balanceChange = previousBalance ? balance - previousBalance : 0;
    const showIncrease = balanceChange > 0.01;
    const showDecrease = balanceChange < -0.01;
    return (
      <View style={[styles.card, styles.balanceCard]}>
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
          style={styles.balanceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.balanceHeader}>
            <View style={styles.balanceLabelContainer}>
              <Ionicons
                name="wallet-outline"
                size={16}
                color="rgba(255, 255, 255, 0.7)"
              />
              <Text style={styles.balanceLabel}>Total Balance</Text>
            </View>
            <TouchableOpacity
              onPress={toggleBalanceVisibility}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showBalance ? "eye-outline" : "eye-off-outline"}
                size={20}
                color="rgba(255, 255, 255, 0.7)"
              />
            </TouchableOpacity>
          </View>
          <View style={styles.balanceAmountContainer}>
            <Animated.View
              style={[styles.balanceGlow, { opacity: balanceOpacity }]}
            >
              <LinearGradient
                colors={["rgba(1, 54, 192, 0.3)", "transparent"]}
                style={styles.glowEffect}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            </Animated.View>
            <Animated.View
              style={{
                opacity: balanceOpacity,
                flexDirection: "row",
                alignItems: "baseline",
              }}
            >
              <Text style={styles.balanceAmount}>
                ${showBalance ? parseFloat(balance).toFixed(2) : "•••••"}
              </Text>
              <Text style={styles.balanceCurrency}> USD</Text>
            </Animated.View>
          </View>
          {showBalance && (showIncrease || showDecrease) && (
            <View
              style={[
                styles.balanceChangeContainer,
                showIncrease ? styles.balanceIncrease : styles.balanceDecrease,
              ]}
            >
              <Ionicons
                name={showIncrease ? "trending-up" : "trending-down"}
                size={14}
                color={WHITE}
              />
              <Text style={styles.balanceChangeText}>
                {showIncrease ? "+" : ""}${Math.abs(balanceChange).toFixed(2)}
              </Text>
              <View style={styles.balanceChangeSeparator} />
              <Text style={styles.balanceChangeLabel}>
                {showIncrease ? "This week" : "This week"}
              </Text>
            </View>
          )}
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: showIncrease ? SUCCESS_GREEN : "#4CAF50" },
              ]}
            />
            <Text style={styles.statusText}>
              {showIncrease ? "Active" : "Updated"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={WHITE} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color={WHITE} />
                <Text style={styles.refreshText}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  const QuickActions = () => (
    <View style={styles.quickActionsWrapper}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionItem}
          activeOpacity={0.8}
          onPress={openSendModal}
        >
          <LinearGradient
            colors={["#0136c0", "#0136c0"]}
            style={styles.actionCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialIcons name="send" size={28} color={WHITE} />
          </LinearGradient>
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionItem}
          activeOpacity={0.8}
          onPress={handleReceive}
        >
          <LinearGradient
            colors={[SUCCESS_GREEN, "#00E676"]}
            style={styles.actionCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialIcons name="call-received" size={28} color={WHITE} />
          </LinearGradient>
          <Text style={styles.actionText}>Receive</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const SendPlatformModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isSendModalVisible}
      onRequestClose={closeSendModal}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={closeSendModal} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Platform</Text>
            <TouchableOpacity onPress={closeSendModal}>
              <Ionicons name="close" size={24} color={DARK_TEXT} />
            </TouchableOpacity>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f5f5f5" : WHITE },
            ]}
            onPress={() => handlePlatformSelect("ecocash")}
          >
            <View style={styles.platformIconContainer}>
              <Image
                source={ecocashLogo}
                style={styles.platformImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>EcoCash</Text>
              <Text style={styles.platformDescription}>
                Send via EcoCash wallet
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f5f5f5" : WHITE },
            ]}
            onPress={() => handlePlatformSelect("omari")}
          >
            <View style={styles.platformIconContainer}>
              <Image
                source={omariLogo}
                style={styles.platformImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>Omari</Text>
              <Text style={styles.platformDescription}>
                Send via Omari platform
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f5f5f5" : WHITE },
            ]}
            onPress={() => handlePlatformSelect("mychangex")}
          >
            <LinearGradient
              colors={["#0136c0", "#0136c0"]}
              style={styles.platformIconContainer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Image
                source={mychangexLogo}
                style={[styles.platformImage, styles.mychangexLogo]}
                resizeMode="contain"
              />
            </LinearGradient>
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>MyChangeX</Text>
              <Text style={styles.platformDescription}>
                Send within MyChangeX network
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </Pressable>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={closeSendModal}
          >
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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
          <HeaderBar />
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={WHITE}
                colors={[WHITE]}
                title="Refreshing balance..."
                titleColor={WHITE}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.mainContent}>
              <ProfileCard />
              <BalanceCard />
              <QuickActions />
              <SpendCard
                buttonScale={buttonScale}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onServiceSelect={handleServiceSelect}
                userBalance={profileData?.balance || userData?.balance || 0}
                navigation={navigation}
                buttonText="Use your $0.30 to pay for bills, airtime, event tickets on Spend MyChangeX"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
      <SendPlatformModal />
    </View>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#0136c0" },
  gradientBackground: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  mainContent: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 5,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: {
    color: WHITE,
    fontSize: 22,
    fontWeight: "700",
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 15 },
  iconButton: { padding: 8, position: "relative" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: ERROR_RED,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0136c0",
  },
  badgeText: { color: WHITE, fontSize: 10, fontWeight: "bold" },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  profileInitial: { color: WHITE, fontSize: 22, fontWeight: "700" },
  profileInfo: { flex: 1 },
  profileUsername: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  profilePhone: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "400",
  },
  balanceCard: {
    padding: 0,
    overflow: "hidden",
    shadowColor: "#0136c0",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  balanceGradient: { padding: 24, borderRadius: 20, position: "relative" },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  balanceLabelContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  balanceLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  eyeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "transparent",
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  balanceAmountContainer: {
    position: "relative",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  balanceGlow: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    height: 100,
  },
  glowEffect: { width: "100%", height: "100%", borderRadius: 20 },
  balanceAmount: {
    color: WHITE,
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -0.5,
    textShadowColor: "rgba(255, 255, 255, 0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  balanceCurrency: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 1,
  },
  balanceChangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 20,
    gap: 8,
  },
  balanceIncrease: {
    backgroundColor: "rgba(0, 200, 83, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(0, 200, 83, 0.3)",
  },
  balanceDecrease: {
    backgroundColor: "rgba(255, 82, 82, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.3)",
  },
  balanceChangeText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  balanceChangeSeparator: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 4,
  },
  balanceChangeLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontWeight: "400",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  statusText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  refreshText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  quickActionsWrapper: { marginTop: 24, marginBottom: 32 },
  sectionTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  actionsContainer: { flexDirection: "row", justifyContent: "center", gap: 40 },
  actionItem: { alignItems: "center", width: 80 },
  actionCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  actionText: { color: WHITE, fontSize: 14, fontWeight: "600" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
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
  modalTitle: { fontSize: 22, fontWeight: "700", color: "#0136c0" },
  platformItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  platformIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    padding: 8,
  },
  platformImage: { width: "100%", height: "100%" },
  mychangexLogo: { width: "80%", height: "80%" },
  platformInfo: { flex: 1 },
  platformName: {
    fontSize: 16,
    fontWeight: "600",
    color: DARK_TEXT,
    marginBottom: 4,
  },
  platformDescription: { fontSize: 13, color: "#666", fontWeight: "400" },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: { color: "#666", fontSize: 16, fontWeight: "600" },
});

export default HomeScreen;
