import React, {
  useLayoutEffect,
  useState,
  useCallback,
  useEffect,
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

const { width, height } = Dimensions.get("window");

// --- Constants ---
const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";
const ACTION_ICON_COLOR = PRIMARY_BLUE;

// Simple Icon component replacement (using text/emojis)
const Icon = ({ name, size = 24, color = LIGHT_TEXT, style = {} }) => (
  <Text style={[{ fontSize: size, color }, style]}>{name}</Text>
);

/**
 * Custom Background Placeholder
 * Replaces 'expo-linear-gradient' and handles the background styling.
 */
const CustomBackground = ({ children, style }) => (
  <View style={[style, { backgroundColor: PRIMARY_BLUE }]}>{children}</View>
);

const HomeScreen = ({ navigation, route }) => {
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const buttonScale = useState(new Animated.Value(1))[0];

  useLayoutEffect(() => {
    // Load user data when component mounts
    loadUserData();
  }, []);

  // Load user data from session (PIN-based auth)
  const loadUserData = async () => {
    try {
      setLoading(true);
      console.log("🔍 Loading user data from session...");

      // Get user from session storage (PIN-based auth)
      const sessionResult = await getUserSession();

      if (!sessionResult.success || !sessionResult.user) {
        console.error("❌ No user session found:", sessionResult.error);
        Alert.alert("Session Expired", "Please login again.");
        // Navigate to login screen
        navigation.navigate("Login");
        return;
      }

      console.log("✅ User session found:", sessionResult.user);
      setUserData(sessionResult.user);

      // Get user profile data using phone number from session
      const { data: profile, error: profileError } =
        await getUserProfileByPhone(sessionResult.user.phone);

      if (profileError) {
        console.error("❌ Error fetching profile:", profileError);
        // Use session data as fallback
        setProfileData(sessionResult.user);
      } else {
        console.log("✅ User profile loaded:", profile);
        setProfileData(profile);
      }

      // Load unread notifications count
      await loadUnreadNotificationsCount(sessionResult.user.id);
      
    } catch (error) {
      console.error("❌ Error loading user data:", error);
      // Try to use session data as fallback
      if (userData) {
        setProfileData(userData);
      } else {
        Alert.alert("Error", "Failed to load user data. Please login again.");
        navigation.navigate("Login");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Function to load unread notifications count
  const loadUnreadNotificationsCount = async (userId) => {
    try {
      console.log('🔔 Loading unread notifications count...');
      
      // Get user transactions to calculate unread notifications
      const transactionsResult = await getUserTransactions(userId, 50);
      
      if (transactionsResult.success) {
        const transactions = transactionsResult.data || [];
        
        // Calculate unread count (notifications from last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Count transactions from last 7 days as "unread" notifications
        const recentTransactions = transactions.filter(transaction => 
          new Date(transaction.created_at) > sevenDaysAgo
        );
        
        // Add some system notifications for demo (remove in production)
        const systemNotificationsCount = Math.min(2, Math.floor(recentTransactions.length / 3));
        
        const totalUnreadCount = recentTransactions.length + systemNotificationsCount;
        
        console.log(`✅ Unread notifications count: ${totalUnreadCount}`);
        setUnreadNotificationsCount(totalUnreadCount);
      } else {
        console.log('❌ Could not load transactions for notifications count');
        setUnreadNotificationsCount(0);
      }
      
    } catch (error) {
      console.error('❌ Error loading notifications count:', error);
      setUnreadNotificationsCount(0);
    }
  };

  // Real-time subscription for new transactions
  useEffect(() => {
    if (!userData?.id) return;

    console.log('🔔 Setting up real-time transaction subscriptions...');

    // Subscribe to new incoming transactions
    const incomingSubscription = supabase
      .channel('incoming_transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `receiver_id=eq.${userData.id}`
        },
        (payload) => {
          console.log('💰 New incoming transaction:', payload.new);
          // Increment notification count for received money
          setUnreadNotificationsCount(prev => {
            const newCount = prev + 1;
            console.log(`📈 Notification count updated to: ${newCount}`);
            return newCount;
          });
        }
      )
      .subscribe();

    // Subscribe to new outgoing transactions
    const outgoingSubscription = supabase
      .channel('outgoing_transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `sender_id=eq.${userData.id}`
        },
        (payload) => {
          console.log('💰 New outgoing transaction:', payload.new);
          // Increment notification count for sent money
          setUnreadNotificationsCount(prev => {
            const newCount = prev + 1;
            console.log(`📈 Notification count updated to: ${newCount}`);
            return newCount;
          });
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      console.log('🔕 Cleaning up transaction subscriptions');
      incomingSubscription.unsubscribe();
      outgoingSubscription.unsubscribe();
    };
  }, [userData?.id]);

  // Handle refresh from other screens
  useEffect(() => {
    if (route.params?.refreshNotifications) {
      console.log('🔄 Refreshing notifications from params...');
      loadUnreadNotificationsCount(userData?.id);
      // Clear the param
      navigation.setParams({ refreshNotifications: undefined });
    }
  }, [route.params?.refreshNotifications, userData?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserData();
  }, []);

  // Button feedback animations
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
      console.log("🚪 Logging out...");
      const { error } = await signOut();

      if (error) {
        console.error("❌ Logout error:", error);
        Alert.alert("Error", "Failed to logout. Please try again.");
        return;
      }

      console.log("✅ Logout successful");
      // Navigate to login screen
      navigation.navigate("Login");
    } catch (error) {
      console.error("❌ Logout error:", error);
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  // Handle Receive button press
  const handleReceive = () => {
    console.log("📱 Navigating to Receive page");
    navigation.navigate("Recieve");
  };

  // Handle platform selection for sending money
  const handlePlatformSelect = (platform) => {
    closeSendModal();
    console.log(`Selected platform: ${platform}`);

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
  };

  // Handle service selection from SpendCard
  const handleServiceSelect = (service) => {
    console.log(`Service selected: ${service.name}`);
    // You can add navigation logic for different services here
    Alert.alert(
      "Service Selected",
      `You selected: ${service.name}\n\nThis feature will be implemented soon!`,
      [{ text: "OK" }]
    );
  };

  // Format phone number for display
  const formatDisplayPhone = (phone) => {
    if (!phone) return "";

    // Remove any existing formatting and keep only digits
    const cleaned = phone.replace(/\D/g, "");

    // Format as +263 XX XXX XXXX
    if (cleaned.startsWith("263") && cleaned.length === 12) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(
        5,
        8
      )} ${cleaned.slice(8, 12)}`;
    }

    // Return original if format doesn't match expected
    return phone;
  };

  // Check authentication on focus
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

  // --- UI Components ---

  const HeaderBar = () => {
    const handleNotificationPress = () => {
      console.log('📱 Navigating to Notifications screen');
      navigation.navigate('Notifications');
    };

    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MyChangeX</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={handleNotificationPress}
          >
            <View style={styles.notificationBadgeContainer}>
              <Icon name="🔔" size={20} />
              {/* Only show badge if there are unread notifications */}
              {unreadNotificationsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ProfileCard = () => {
    const handleProfilePress = () => {
      console.log('📱 Navigating to Profile screen');
      navigation.navigate('Profile');
    };

    if (loading && !refreshing) {
      return (
        <TouchableOpacity 
          style={styles.card}
          onPress={handleProfilePress}
          activeOpacity={0.8}
        >
          <View style={styles.profileContainer}>
            <View style={styles.profileIconCircle}>
              <ActivityIndicator size="small" color={PRIMARY_BLUE} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileUsername}>Loading...</Text>
              <Text style={styles.profilePhone}>Please wait</Text>
            </View>
            <View style={styles.chevronContainer}>
              <Icon name="➡️" size={16} color="rgba(255, 255, 255, 0.7)" />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (!profileData && !userData) {
      return (
        <TouchableOpacity 
          style={styles.card}
          onPress={handleProfilePress}
          activeOpacity={0.8}
        >
          <View style={styles.profileContainer}>
            <View style={styles.profileIconCircle}>
              <Icon name="❌" size={28} color={PRIMARY_BLUE} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileUsername}>No Profile Data</Text>
              <Text style={styles.profilePhone}>
                Please check your connection
              </Text>
            </View>
            <View style={styles.chevronContainer}>
              <Icon name="➡️" size={16} color="rgba(255, 255, 255, 0.7)" />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Use profileData if available, otherwise use userData from session
    const displayData = profileData || userData;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={handleProfilePress}
        activeOpacity={0.8}
      >
        <View style={styles.profileContainer}>
          <View style={styles.profileIconCircle}>
            <Icon name="👤" size={28} color={PRIMARY_BLUE} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileUsername}>
              {displayData.full_name || "User"}
            </Text>
            <Text style={styles.profilePhone}>
              {formatDisplayPhone(displayData.phone) || "No phone number"}
            </Text>
          </View>
          <View style={styles.chevronContainer}>
            <Icon name="➡️" size={16} color="rgba(255, 255, 255, 0.7)" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const BalanceCard = () => {
    // Use profileData if available, otherwise use userData from session
    const displayData = profileData || userData;
    const balance = displayData?.balance || 0;

    return (
      <View style={[styles.card, styles.balanceCard]}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>
          ${parseFloat(balance).toFixed(2)}
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadUserData}>
          <Icon name="🔄" size={14} color={LIGHT_TEXT} />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const QuickActions = () => (
    <View style={styles.quickActionsWrapper}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsContainer}>
        {/* Send Button */}
        <TouchableOpacity
          style={styles.actionItem}
          activeOpacity={0.8}
          onPress={openSendModal}
        >
          <View style={styles.actionCircle}>
            <Icon name="ᐅ" size={20} color={ACTION_ICON_COLOR} />
          </View>
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>
        {/* Receive Button */}
        <TouchableOpacity
          style={styles.actionItem}
          activeOpacity={0.8}
          onPress={handleReceive}
        >
          <View style={styles.actionCircle}>
            <Icon name="✓" size={20} color={ACTION_ICON_COLOR} />
          </View>
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
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Platform</Text>

          {/* EcoCash Option */}
          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f0f0f0" : LIGHT_TEXT },
            ]}
            onPress={() => handlePlatformSelect("ecocash")}
          >
            <View style={styles.platformIconContainer}>
              <Icon name="📱" size={24} color="#00A859" />
            </View>
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>EcoCash</Text>
              <Text style={styles.platformDescription}>
                Send via EcoCash wallet
              </Text>
            </View>
            <Icon name="➡️" size={16} color="#666" />
          </Pressable>

          {/* Omari Option */}
          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f0f0f0" : LIGHT_TEXT },
            ]}
            onPress={() => handlePlatformSelect("omari")}
          >
            <View style={styles.platformIconContainer}>
              <Icon name="💳" size={24} color="#FF6B35" />
            </View>
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>Omari</Text>
              <Text style={styles.platformDescription}>
                Send via Omari platform
              </Text>
            </View>
            <Icon name="➡️" size={16} color="#666" />
          </Pressable>

          {/* MyChangeX Option */}
          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f0f0f0" : LIGHT_TEXT },
            ]}
            onPress={() => handlePlatformSelect("mychangex")}
          >
            <View style={styles.platformIconContainer}>
              <Icon name="🔄" size={24} color={PRIMARY_BLUE} />
            </View>
            <View style={styles.platformInfo}>
              <Text style={styles.platformName}>MyChangeX</Text>
              <Text style={styles.platformDescription}>
                Send within MyChangeX network
              </Text>
            </View>
            <Icon name="➡️" size={16} color="#666" />
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
    <CustomBackground style={styles.background}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <SafeAreaView style={styles.safeArea}>
        <HeaderBar />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={LIGHT_TEXT}
              colors={[LIGHT_TEXT]}
            />
          }
        >
          <View style={styles.mainContent}>
            <ProfileCard />
            <BalanceCard />
            <QuickActions />
            
            {/* Using the separated SpendCard component */}
            <SpendCard 
              buttonScale={buttonScale}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onServiceSelect={handleServiceSelect}
              userBalance={profileData?.balance || userData?.balance || 0}
              navigation={navigation} 
            />
            
            {/* Final section shown in the image */}
            <Text style={styles.otherServicesText}>Other Services</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
      <SendPlatformModal />
    </CustomBackground>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  background: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // --- Header Styling (Corrected) ---
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 10,
  },

  headerTitle: {
    color: LIGHT_TEXT,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1,
    marginRight: "auto",
  },
  headerRight: {
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  notificationButton: {
    padding: 8,
  },
  notificationBadgeContainer: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    paddingHorizontal: 5,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: PRIMARY_BLUE,
  },
  badgeText: {
    color: LIGHT_TEXT,
    fontSize: 10,
    fontWeight: "bold",
  },

  // --- Card General Styles ---
  card: {
    backgroundColor: CARD_COLOR,
    borderRadius: 15,
    padding: 18,
    marginBottom: 16,
  },

  // --- Profile Card ---
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileIconCircle: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: LIGHT_TEXT,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileUsername: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  profilePhone: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
  },
  chevronContainer: {
    marginLeft: 10,
  },

  // --- Balance Card ---
  balanceCard: {
    alignItems: "center",
    paddingVertical: 30,
    position: "relative",
  },
  balanceLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
  },
  balanceAmount: {
    color: LIGHT_TEXT,
    fontSize: 48,
    fontWeight: "800",
  },
  refreshButton: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  refreshText: {
    color: LIGHT_TEXT,
    fontSize: 12,
    marginLeft: 4,
  },

  // --- Quick Actions ---
  quickActionsWrapper: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  sectionTitle: {
    color: LIGHT_TEXT,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "70%",
  },
  actionItem: {
    alignItems: "center",
    width: 80,
  },
  actionCircle: {
    width: 65,
    height: 65,
    borderRadius: 35,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  actionText: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: "500",
  },

  // --- Other Services Footer ---
  otherServicesText: {
    color: LIGHT_TEXT,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },

  // --- Modal Styling ---
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    backgroundColor: LIGHT_TEXT,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 30,
    width: "100%",
    paddingBottom: Platform.OS === "ios" ? 40 : 30,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: PRIMARY_BLUE,
    marginBottom: 20,
    textAlign: "center",
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginVertical: 4,
  },
  serviceIcon: {
    fontSize: 24,
    marginRight: 15,
    width: 30,
    textAlign: "center",
  },
  serviceText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },

  // --- Platform Selection Modal Styles ---
  platformItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    borderRadius: 12,
    marginVertical: 6,
  },
  platformIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0, 168, 89, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  platformInfo: {
    flex: 1,
  },
  platformName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  platformDescription: {
    fontSize: 14,
    color: "#666",
  },
  modalCloseButton: {
    marginTop: 30,
    backgroundColor: PRIMARY_BLUE,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCloseText: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: "700",
  },
});

export default HomeScreen;