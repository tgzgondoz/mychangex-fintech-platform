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
import { useIsFocused } from '@react-navigation/native';

const { width, height } = Dimensions.get("window");

const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";
const ACTION_ICON_COLOR = PRIMARY_BLUE;

// Import platform images
const ecocashLogo = require("../assets/ecocash-logo.png");
const omariLogo = require("../assets/omari.png");
const mychangexLogo = require("../assets/logo.png");

const Icon = ({ name, size = 24, color = LIGHT_TEXT, style = {} }) => (
  <Text style={[{ fontSize: size, color }, style]}>{name}</Text>
);

const CustomBackground = ({ children, style }) => (
  <View style={[style, { backgroundColor: PRIMARY_BLUE }]}>{children}</View>
);

const HomeScreen = ({ navigation, route, unreadCount = 0, homeRefreshTrigger, lastTransaction, setHomeRefreshTrigger }) => {
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(unreadCount);
  const buttonScale = useState(new Animated.Value(1))[0];
  
  // Track if we're currently processing a received transaction
  const [processingReceivedTransaction, setProcessingReceivedTransaction] = useState(false);
  
  // Track last balance for comparison
  const [previousBalance, setPreviousBalance] = useState(0);
  
  // Track if we've shown the auto-refresh notification
  const [hasShownRefreshNotification, setHasShownRefreshNotification] = useState(false);
  
  // Navigation focus tracker
  const isFocused = useIsFocused();
  
  // Refs for cleanup
  const subscriptionsRef = useRef([]);
  const balanceUpdateTimeoutRef = useRef(null);

  // Update local state when prop changes
  useEffect(() => {
    setUnreadNotificationsCount(unreadCount);
  }, [unreadCount]);

  // Handle refresh triggers from App.js
  useEffect(() => {
    if (homeRefreshTrigger > 0) {
      console.log('🔄 HomeScreen: Refresh trigger received from App:', homeRefreshTrigger);
      
      // Refresh balance and data immediately
      handleAutoRefresh();
      
      // Transaction notifications are now handled through the notification system only
      // No modal popups shown on home screen
    }
  }, [homeRefreshTrigger, lastTransaction, isFocused]);

  // Auto-refresh when screen comes into focus
  useEffect(() => {
    if (isFocused) {
      console.log('🏠 HomeScreen is focused, refreshing data...');
      // Small delay to ensure smooth transition
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

  // Initialize push notifications for this user
  useEffect(() => {
    const initializePushNotifications = async () => {
      if (userData?.id) {
        try {
          const token = await NotificationService.registerForPushNotifications();
          if (token) {
            await NotificationService.savePushToken(userData.id, token);
          }
        } catch (error) {
          console.error("Push notification initialization error:", error);
        }
      }
    };

    initializePushNotifications();
  }, [userData?.id]);

  // REAL-TIME BALANCE SUBSCRIPTION
  useEffect(() => {
    if (!userData?.id) return;

    console.log('🔔 Setting up real-time balance subscription in HomeScreen...');

    const balanceSubscription = supabase
      .channel("home_balance_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userData.id}`,
        },
        (payload) => {
          console.log('💰 HomeScreen: Balance updated in real-time:', payload.new.balance);
          
          const newBalance = payload.new.balance || 0;
          const oldBalance = profileData?.balance || userData?.balance || 0;
          
          // Store previous balance for comparison
          setPreviousBalance(oldBalance);
          
          // Update states
          setProfileData((prevData) => ({
            ...prevData,
            balance: newBalance,
          }));

          setUserData((prevData) => ({
            ...prevData,
            balance: newBalance,
          }));
          
          // Show notification if balance increased (money received)
          if (newBalance > oldBalance && isFocused && !hasShownRefreshNotification) {
            const difference = newBalance - oldBalance;
            if (difference > 0.01) { // Only show for meaningful changes
              setTimeout(() => {
                Alert.alert(
                  "💰 Balance Updated",
                  `Your balance increased by $${difference.toFixed(2)}`,
                  [{ text: "OK" }]
                );
                setHasShownRefreshNotification(true);
                
                // Reset after 5 seconds
                setTimeout(() => setHasShownRefreshNotification(false), 5000);
              }, 1000);
            }
          }
        }
      )
      .subscribe();
    
    subscriptionsRef.current.push(balanceSubscription);

    return () => {
      console.log('🔕 Cleaning up HomeScreen balance subscription');
      supabase.removeChannel(balanceSubscription);
    };
  }, [userData?.id, isFocused, hasShownRefreshNotification]);

  // Handle auto-refresh when triggered
  const handleAutoRefresh = useCallback(() => {
    console.log('🔄 HomeScreen: Performing auto-refresh...');
    
    // Clear any existing timeout
    if (balanceUpdateTimeoutRef.current) {
      clearTimeout(balanceUpdateTimeoutRef.current);
    }
    
    // Refresh with slight delay for better UX
    balanceUpdateTimeoutRef.current = setTimeout(() => {
      refreshBalance();
      if (userData?.id) {
        loadUnreadNotificationsCount(userData.id);
      }
      
      // Show refresh indicator
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 1000);
    }, 500);
  }, [userData?.id]);

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

      // Load notifications count only if we have a valid user ID
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

  // FIXED: Updated loadUnreadNotificationsCount function
  const loadUnreadNotificationsCount = async (userId) => {
    try {
      // First check if userId is valid
      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        console.error('❌ Invalid userId provided:', userId);
        return;
      }
      
      console.log('📊 Loading transactions for user:', userId);
      
      const transactionsResult = await getUserTransactions(userId, 50);
      
      if (transactionsResult.success) {
        console.log(`✅ Loaded ${transactionsResult.data?.length || 0} transactions`);
        
        // If no transactions, that's fine
        if (!transactionsResult.data || transactionsResult.data.length === 0) {
          console.log('ℹ️ No transactions found for user');
          return;
        }
        
        // Calculate unread count (optional logic)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentTransactions = transactionsResult.data.filter(
          (transaction) => new Date(transaction.created_at) > sevenDaysAgo
        );
        
        console.log(`📅 Found ${recentTransactions.length} recent transactions`);
        
        // You can implement logic here to count unread notifications
        // For example: const unreadCount = recentTransactions.filter(t => !t.read).length;
        // setUnreadNotificationsCount(unreadCount);
        
      } else {
        console.log('❌ Error loading transactions:', transactionsResult.error);
        
        // Don't crash the app if transactions fail to load
        // Just log the error and continue
        if (transactionsResult.error?.includes('Invalid user ID')) {
          console.log('⚠️ User ID validation issue, skipping transactions load');
        }
      }
    } catch (error) {
      console.error('❌ Error loading notifications count:', error);
    }
  };

  // Enhanced real-time subscription for new transactions
  useEffect(() => {
    if (!userData?.id) return;

    console.log('🔔 Setting up transaction subscriptions in HomeScreen...');

    const incomingSubscription = supabase
      .channel("incoming_transactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `receiver_id=eq.${userData.id}`,
        },
        async (payload) => {
          console.log('💰 HomeScreen: New incoming transaction received via real-time:', payload.new);
          
          // Prevent multiple triggers
          if (processingReceivedTransaction) {
            console.log('⚠️ Already processing a received transaction, skipping...');
            return;
          }
          
          setProcessingReceivedTransaction(true);
          
          try {
            await refreshBalance();

            try {
              // Schedule local notification only
              await NotificationService.scheduleTransactionNotification(
                "💰 Money Received!",
                `You received $${parseFloat(payload.new.amount).toFixed(2)}`,
                {
                  type: "transaction_received",
                  amount: payload.new.amount,
                  transaction_id: payload.new.id,
                  screen: "Notifications",
                }
              );

              // Check if we're on Home screen
              if (isFocused) {
                console.log('✅ Transaction received, notification scheduled');
                // No modal popup shown - users will see the notification
              } else {
                console.log('🏠 User is on another screen, transaction handled by notification system');
              }

            } catch (notificationError) {
              console.error("Notification error:", notificationError);
            }

          } catch (error) {
            console.error("Error processing received transaction:", error);
          } finally {
            // Reset the flag after a delay to prevent rapid triggers
            setTimeout(() => {
              setProcessingReceivedTransaction(false);
            }, 3000);
          }
        }
      )
      .subscribe();

    const outgoingSubscription = supabase
      .channel("outgoing_transactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `sender_id=eq.${userData.id}`,
        },
        async (payload) => {
          console.log('💸 HomeScreen: Outgoing transaction sent via real-time:', payload.new);
          
          await refreshBalance();

          try {
            await NotificationService.scheduleTransactionNotification(
              "💰 Money Sent!",
              `You sent $${parseFloat(payload.new.amount).toFixed(2)}`,
              {
                type: "transaction_sent",
                amount: payload.new.amount,
                transaction_id: payload.new.id,
                screen: "Notifications",
              }
            );

            if (isFocused) {
              console.log('✅ Transaction sent, notification scheduled');
              // No modal popup shown
            }

          } catch (error) {
            console.error("Notification error:", error);
          }
        }
      )
      .subscribe();

    subscriptionsRef.current.push(incomingSubscription, outgoingSubscription);

    return () => {
      console.log('🔕 Cleaning up HomeScreen transaction subscriptions');
      supabase.removeChannel(incomingSubscription);
      supabase.removeChannel(outgoingSubscription);
    };
  }, [userData?.id, navigation, processingReceivedTransaction, isFocused]);

  const refreshBalance = async () => {
    try {
      if (!userData?.phone) return;

      console.log('🔄 Refreshing balance for user:', userData.phone);
      
      const { data: profile, error } = await getUserProfileByPhone(
        userData.phone
      );

      if (!error && profile) {
        const oldBalance = profileData?.balance || userData?.balance || 0;
        const newBalance = profile.balance || 0;
        
        setProfileData((prevData) => ({
          ...prevData,
          balance: newBalance,
        }));

        setUserData((prevData) => ({
          ...prevData,
          balance: newBalance,
        }));
        
        console.log(`✅ Balance refreshed: $${oldBalance.toFixed(2)} → $${newBalance.toFixed(2)}`);
        
        return newBalance;
      } else if (error) {
        console.error('❌ Error refreshing balance:', error);
      }
    } catch (error) {
      console.error("Error refreshing balance:", error);
    }
    return null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear timeout
      if (balanceUpdateTimeoutRef.current) {
        clearTimeout(balanceUpdateTimeoutRef.current);
      }
      
      // Unsubscribe from all channels
      subscriptionsRef.current.forEach(subscription => {
        if (subscription) {
          supabase.removeChannel(subscription);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (route.params?.refreshNotifications && userData?.id) {
      loadUnreadNotificationsCount(userData.id);
      navigation.setParams({ refreshNotifications: undefined });
    }

    if (route.params?.refreshBalance) {
      refreshBalance();
      navigation.setParams({ refreshBalance: undefined });
    }
  }, [
    route.params?.refreshNotifications,
    route.params?.refreshBalance,
    userData?.id,
  ]);

  const onRefresh = useCallback(() => {
    console.log('👆 Manual refresh triggered');
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
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(
        5,
        8
      )} ${cleaned.slice(8, 12)}`;
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

  const HeaderBar = () => {
    const handleNotificationPress = () => {
      navigation.navigate("Notifications");
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
              {unreadNotificationsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationsCount > 9
                      ? "9+"
                      : unreadNotificationsCount}
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
              <Text style={styles.profileInitial}>U</Text>
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

    const displayData = profileData || userData;
    const userInitial = getFirstInitial(displayData.full_name);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={handleProfilePress}
        activeOpacity={0.8}
      >
        <View style={styles.profileContainer}>
          <View style={styles.profileIconCircle}>
            <Text style={styles.profileInitial}>{userInitial}</Text>
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
    const displayData = profileData || userData;
    const balance = displayData?.balance || 0;
    
    // Calculate balance change for animation/display
    const balanceChange = previousBalance ? balance - previousBalance : 0;
    const showIncrease = balanceChange > 0.01;
    const showDecrease = balanceChange < -0.01;

    return (
      <View style={[styles.card, styles.balanceCard]}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>
          ${parseFloat(balance).toFixed(2)}
        </Text>
        
        {/* Balance change indicator */}
        {(showIncrease || showDecrease) && (
          <View style={[
            styles.balanceChangeIndicator,
            showIncrease ? styles.balanceIncrease : styles.balanceDecrease
          ]}>
            <Icon 
              name={showIncrease ? "📈" : "📉"} 
              size={12} 
              color={LIGHT_TEXT} 
            />
            <Text style={styles.balanceChangeText}>
              {showIncrease ? '+' : ''}{balanceChange.toFixed(2)}
            </Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={LIGHT_TEXT} />
          ) : (
            <>
              <Icon name="🔄" size={14} color={LIGHT_TEXT} />
              <Text style={styles.refreshText}>Refresh</Text>
            </>
          )}
        </TouchableOpacity>
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
          <View style={styles.actionCircle}>
            <Icon name="ᐅ" size={20} color={ACTION_ICON_COLOR} />
          </View>
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>
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

          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f0f0f0" : LIGHT_TEXT },
            ]}
            onPress={() => handlePlatformSelect("ecocash")}
          >
            <View
              style={[
                styles.platformIconContainer,
                { backgroundColor: "rgba(0, 168, 89, 0.1)" },
              ]}
            >
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
            <Icon name="➡️" size={16} color="#666" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f0f0f0" : LIGHT_TEXT },
            ]}
            onPress={() => handlePlatformSelect("omari")}
          >
            <View
              style={[
                styles.platformIconContainer,
                { backgroundColor: "rgba(255, 107, 53, 0.1)" },
              ]}
            >
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
            <Icon name="➡️" size={16} color="#666" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.platformItem,
              { backgroundColor: pressed ? "#f0f0f0" : LIGHT_TEXT },
            ]}
            onPress={() => handlePlatformSelect("mychangex")}
          >
            <View
              style={[
                styles.platformIconContainer,
                {
                  backgroundColor: "#0136c0",
                  borderWidth: 1,
                  borderColor: "rgba(1, 54, 192, 0.3)",
                },
              ]}
            >
              <Image
                source={mychangexLogo}
                style={[styles.platformImage, styles.mychangexLogo]}
                resizeMode="contain"
              />
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
              title="Refreshing balance..."
            />
          }
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
              buttonText="Smart Invest" // Updated to fintech-related text
            />

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
  card: {
    backgroundColor: CARD_COLOR,
    borderRadius: 15,
    padding: 18,
    marginBottom: 16,
  },
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
  profileInitial: {
    color: PRIMARY_BLUE,
    fontSize: 24,
    fontWeight: "700",
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
  balanceChangeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  balanceIncrease: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  balanceDecrease: {
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
  },
  balanceChangeText: {
    color: LIGHT_TEXT,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
    minWidth: 80,
    justifyContent: 'center',
  },
  refreshText: {
    color: LIGHT_TEXT,
    fontSize: 12,
    marginLeft: 4,
  },
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
  otherServicesText: {
    color: LIGHT_TEXT,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
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
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    padding: 5,
  },
  platformImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
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