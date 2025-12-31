import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import * as Device from "expo-device";
import {
  getUserSession,
  getUserTransactions,
  isAuthenticated,
} from "./supabase";
import { NotificationService } from "./services/notificationService";

const { width, height } = Dimensions.get("window");

const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#666666";
const DARK_TEXT = "#1A1A1A";
const CARD_BG = "#ffffff"; 
const CARD_BORDER = "#eaeaea";
const ERROR_RED = "#FF5252";
const SUCCESS_GREEN = "#00C853";
const WARNING_ORANGE = "#FFA726";
const BACKGROUND_COLOR = "#f8f9fa";

const NotificationsScreen = ({
  navigation,
  route,
  notifications = [],
  setNotifications,
  setUnreadCount,
}) => {
  const isFocused = useIsFocused();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("all"); // 'all', 'unread', 'transactions'

  const displayNotifications =
    notifications.length > 0 ? notifications : localNotifications;

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        navigation.navigate("Login");
        return;
      }
      if (isFocused) {
        initializeScreen();
      }
    };

    checkAuth();
  }, [isFocused, navigation]);

  const initializeScreen = () => {
    if (!isFocused || !isMounted.current) return;

    const init = async () => {
      try {
        await initializePushNotifications();
        await loadNotifications(true);
      } catch (error) {
        console.error("Screen initialization error:", error);
      }
    };

    init();
  };

  const initializePushNotifications = async () => {
    try {
      const sessionResult = await getUserSession();

      if (!sessionResult.success || !sessionResult.user) {
        return;
      }

      const token = await NotificationService.registerForPushNotifications();
      if (token) {
        await NotificationService.savePushToken(sessionResult.user.id, token);
      }
    } catch (error) {
      console.warn("Push notification initialization failed:", error.message);
    }
  };

  const loadNotifications = async (showLoading = true) => {
    try {
      if (!isMounted.current) return;

      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        if (isMounted.current) {
          Alert.alert("Session Expired", "Please login again.", [
            {
              text: "OK",
              onPress: () => navigation.navigate("Login"),
            },
          ]);
        }
        return;
      }

      if (showLoading) {
        setLoading(true);
      }
      setRefreshing(true);
      setError(null);

      const sessionResult = await getUserSession();
      if (!sessionResult.success || !sessionResult.user) {
        if (isMounted.current) {
          Alert.alert("Session Expired", "Please login again.");
          navigation.navigate("Login");
        }
        return;
      }

      if (isMounted.current) {
        setUserData(sessionResult.user);
      }

      if (notifications.length > 0) {
        return;
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), 10000);
      });

      const transactionsPromise = getUserTransactions(
        sessionResult.user.id,
        50
      );

      const transactionsResult = await Promise.race([
        transactionsPromise,
        timeoutPromise,
      ]);

      if (transactionsResult.success) {
        const transactionNotifications = generateNotificationsFromTransactions(
          transactionsResult.data || [],
          sessionResult.user.id
        );

        const sortedNotifications = transactionNotifications.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );

        if (isMounted.current) {
          setLocalNotifications(sortedNotifications);
        }
      } else {
        throw new Error("Failed to load transactions");
      }
    } catch (error) {
      console.error("Error loading notifications:", error);

      if (isMounted.current) {
        setError(error.message || "Failed to load notifications");

        const authResult = await isAuthenticated();
        if (!authResult.authenticated) {
          navigation.navigate("Login");
          return;
        }

        if (error.message === "Request timeout") {
          Alert.alert(
            "Connection Timeout",
            "The request took too long. Please check your internet connection and try again.",
            [
              {
                text: "Try Again",
                onPress: () => loadNotifications(showLoading),
              },
              { text: "Cancel", style: "cancel" },
            ]
          );
        } else if (!displayNotifications.length) {
          Alert.alert(
            "Error Loading Notifications",
            "Unable to load notifications. Please try again later.",
            [{ text: "OK" }]
          );
        }
      }
    } finally {
      if (isMounted.current) {
        if (showLoading) {
          setLoading(false);
        }
        setRefreshing(false);
      }
    }
  };

  const generateNotificationsFromTransactions = (transactions, userId) => {
    if (!transactions || transactions.length === 0) {
      return [
        {
          id: "welcome_1",
          type: "system",
          title: "Welcome to MyChangeX!",
          message: "Start using the app to see your transaction notifications here.",
          amount: null,
          timestamp: new Date().toISOString(),
          transactionId: null,
          read: true,
          icon: "notifications",
          color: WARNING_ORANGE,
          platform: null,
          isPushNotification: false,
        },
      ];
    }

    const generatedNotifications = [];
    const limitedTransactions = transactions.slice(0, 20);

    limitedTransactions.forEach((transaction, index) => {
      const amount = parseFloat(transaction.amount) || 0;
      const isSent = transaction.sender_id === userId;
      const transactionDate = new Date(transaction.created_at);

      const platform = getTransactionPlatform(transaction, index);

      generatedNotifications.push({
        id: `transaction_${transaction.id}`,
        type: isSent ? "sent" : "received",
        title: isSent ? "Money Sent" : "Money Received",
        message: isSent
          ? `You sent $${amount.toFixed(2)} via ${platform}`
          : `You received $${amount.toFixed(2)} via ${platform}`,
        amount: amount,
        timestamp: transaction.created_at,
        transactionId: transaction.id,
        read: false,
        icon: isSent ? "arrow-up" : "arrow-down",
        color: isSent ? ERROR_RED : SUCCESS_GREEN,
        platform: platform,
        isPushNotification: false,
      });

      generatedNotifications.push({
        id: `completed_${transaction.id}`,
        type: "completed",
        title: "Transaction Completed",
        message: `Your ${isSent ? "payment" : "transfer"} of $${amount.toFixed(2)} was successful`,
        amount: amount,
        timestamp: new Date(transactionDate.getTime() + 30000).toISOString(),
        transactionId: transaction.id,
        read: false,
        icon: "checkmark-circle",
        color: SUCCESS_GREEN,
        platform: platform,
        isPushNotification: false,
      });
    });

    if (generatedNotifications.length < 5) {
      const sampleNotifications = [
        {
          id: "sample_balance",
          type: "balance",
          title: "Balance Updated",
          message: "Your account balance is now $245.67",
          amount: 245.67,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          transactionId: null,
          read: true,
          icon: "wallet",
          color: PRIMARY_BLUE,
          platform: "MyChangeX",
          isPushNotification: false,
        },
        {
          id: "sample_system",
          type: "system",
          title: "Security Alert",
          message: "New login detected from your account",
          amount: null,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          transactionId: null,
          read: true,
          icon: "shield-checkmark",
          color: WARNING_ORANGE,
          platform: null,
          isPushNotification: false,
        },
        {
          id: "sample_promo",
          type: "promo",
          title: "Special Offer",
          message: "Get 10% cashback on your next transaction",
          amount: null,
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          transactionId: null,
          read: true,
          icon: "gift",
          color: "#9C27B0",
          platform: null,
          isPushNotification: false,
        },
      ];
      generatedNotifications.push(...sampleNotifications);
    }

    return generatedNotifications;
  };

  const getTransactionPlatform = (transaction, index) => {
    if (transaction.type === "mychangex") return "MyChangeX";
    if (transaction.type === "ecocash") return "EcoCash";
    if (transaction.type === "omari") return "Omari";

    const platforms = ["MyChangeX", "EcoCash", "Omari"];
    return platforms[index % platforms.length];
  };

  const getFilteredNotifications = () => {
    switch (viewMode) {
      case "unread":
        return displayNotifications.filter(notification => !notification.read);
      case "transactions":
        return displayNotifications.filter(notification => 
          notification.type === "sent" || 
          notification.type === "received" || 
          notification.type === "completed"
        );
      default:
        return displayNotifications;
    }
  };

  const onRefresh = useCallback(async () => {
    if (refreshing) return;

    const authResult = await isAuthenticated();
    if (!authResult.authenticated) {
      navigation.navigate("Login");
      return;
    }

    await loadNotifications(false);
  }, [refreshing, navigation]);

  const formatTimeAgo = useCallback((timestamp) => {
    try {
      const now = new Date();
      const date = new Date(timestamp);

      if (isNaN(date.getTime())) {
        return "Just now";
      }

      const diffInSeconds = Math.floor((now - date) / 1000);

      if (diffInSeconds < 60) return "Just now";
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400)
        return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800)
        return `${Math.floor(diffInSeconds / 86400)}d ago`;

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch (error) {
      return "Recently";
    }
  }, []);

  const formatDate = useCallback((timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "Invalid date";
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === today.toDateString()) {
        return "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      } else {
        return date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      }
    } catch (error) {
      return "Invalid date";
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        navigation.navigate("Login");
        return;
      }

      if (setNotifications && setUnreadCount) {
        const updatedNotifications = displayNotifications.map(
          (notification) => ({
            ...notification,
            read: true,
          })
        );

        setNotifications(updatedNotifications);
        setUnreadCount(0);
      } else {
        const updatedNotifications = localNotifications.map((notification) => ({
          ...notification,
          read: true,
        }));
        setLocalNotifications(updatedNotifications);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
      Alert.alert("Error", "Failed to mark notifications as read.");
    }
  }, [
    displayNotifications,
    localNotifications,
    setNotifications,
    setUnreadCount,
    navigation,
  ]);

  const clearAllNotifications = useCallback(async () => {
    const authResult = await isAuthenticated();
    if (!authResult.authenticated) {
      navigation.navigate("Login");
      return;
    }

    Alert.alert(
      "Clear All Notifications",
      "Are you sure you want to clear all notifications? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            try {
              if (setNotifications && setUnreadCount) {
                setNotifications([]);
                setUnreadCount(0);
              } else {
                setLocalNotifications([]);
              }
            } catch (error) {
              console.error("Error clearing notifications:", error);
              Alert.alert("Error", "Failed to clear notifications.");
            }
          },
        },
      ]
    );
  }, [setNotifications, setUnreadCount, navigation]);

  const handleNotificationPress = useCallback(
    async (notification) => {
      try {
        const authResult = await isAuthenticated();
        if (!authResult.authenticated) {
          navigation.navigate("Login");
          return;
        }

        if (!notification.read) {
          if (setNotifications && setUnreadCount) {
            const updatedNotifications = displayNotifications.map((n) =>
              n.id === notification.id ? { ...n, read: true } : n
            );

            setNotifications(updatedNotifications);
            setUnreadCount((prev) => Math.max(0, prev - 1));
          } else {
            const updatedNotifications = localNotifications.map((n) =>
              n.id === notification.id ? { ...n, read: true } : n
            );
            setLocalNotifications(updatedNotifications);
          }
        }

        if (notification.transactionId) {
          Alert.alert(
            "Transaction Details",
            `Amount: $${notification.amount?.toFixed(2) || "N/A"}\n` +
              `Type: ${notification.type}\n` +
              `Platform: ${notification.platform || "MyChangeX"}\n` +
              `Time: ${formatTimeAgo(notification.timestamp)}`,
            [{ text: "OK" }]
          );
        }
      } catch (error) {
        console.error("Error handling notification press:", error);
      }
    },
    [
      displayNotifications,
      localNotifications,
      setNotifications,
      setUnreadCount,
      formatTimeAgo,
      navigation,
    ]
  );

  const getNotificationIcon = useCallback((type) => {
    switch (type) {
      case "sent":
        return "arrow-up";
      case "received":
        return "arrow-down";
      case "completed":
        return "checkmark-circle";
      case "balance":
        return "wallet";
      case "system":
        return "notifications";
      case "security":
        return "shield-checkmark";
      case "promo":
        return "gift";
      default:
        return "notifications";
    }
  }, []);

  const getNotificationColor = useCallback((type) => {
    switch (type) {
      case "sent":
        return ERROR_RED;
      case "received":
        return SUCCESS_GREEN;
      case "completed":
        return SUCCESS_GREEN;
      case "balance":
        return PRIMARY_BLUE;
      case "system":
        return WARNING_ORANGE;
      case "security":
        return "#FF6B6B";
      case "promo":
        return "#9C27B0";
      default:
        return "#666";
    }
  }, []);

  const getTypeBadge = useCallback((type) => {
    switch (type) {
      case "sent":
        return { text: "Sent", bg: "#FFEBEE", color: ERROR_RED };
      case "received":
        return { text: "Received", bg: "#E8F5E9", color: SUCCESS_GREEN };
      case "completed":
        return { text: "Completed", bg: "#E8F5E9", color: SUCCESS_GREEN };
      case "balance":
        return { text: "Balance", bg: "#E3F2FD", color: PRIMARY_BLUE };
      case "system":
        return { text: "System", bg: "#FFF3E0", color: WARNING_ORANGE };
      case "security":
        return { text: "Security", bg: "#FFEBEE", color: "#FF6B6B" };
      case "promo":
        return { text: "Promo", bg: "#F3E5F5", color: "#9C27B0" };
      default:
        return { text: "Other", bg: "#F5F5F5", color: "#666" };
    }
  }, []);

  const getPlatformIcon = useCallback((platform) => {
    switch (platform) {
      case "MyChangeX":
        return "🔄";
      case "EcoCash":
        return "📱";
      case "Omari":
        return "💳";
      default:
        return "💰";
    }
  }, []);

  const unreadCount = displayNotifications.filter(
    (notification) => !notification.read
  ).length;

  const filteredNotifications = getFilteredNotifications();

  const NotificationItem = React.memo(({ notification, index }) => {
    const typeBadge = getTypeBadge(notification.type);
    const formattedDate = formatDate(notification.timestamp);
    const showDateHeader = index === 0 || 
      formatDate(filteredNotifications[index - 1].timestamp) !== formattedDate;

    return (
      <>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formattedDate}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.tableRow,
            !notification.read && styles.tableRowUnread,
          ]}
          onPress={() => handleNotificationPress(notification)}
          activeOpacity={0.7}
        >
          <View style={styles.iconColumn}>
            <Ionicons
              name={getNotificationIcon(notification.type)}
              size={18}
              color={getNotificationColor(notification.type)}
            />
          </View>

          <View style={styles.detailsColumn}>
            <View style={styles.detailsHeader}>
              <Text style={styles.notificationTitle} numberOfLines={1}>
                {notification.title}
              </Text>
              {notification.amount && (
                <Text style={[styles.amountText, { color: getNotificationColor(notification.type) }]}>
                  {notification.type === "sent" ? "-" : "+"}${notification.amount.toFixed(2)}
                </Text>
              )}
            </View>
            
            <Text style={styles.notificationMessage} numberOfLines={2}>
              {notification.message}
            </Text>
            
            <View style={styles.detailsFooter}>
              <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>
                {typeBadge.text}
              </Text>
              
              {notification.platform && (
                <View style={styles.platformContainer}>
                  <Text style={styles.platformIcon}>
                    {getPlatformIcon(notification.platform)}
                  </Text>
                  <Text style={styles.platformText} numberOfLines={1}>
                    {notification.platform}
                  </Text>
                </View>
              )}
              
              <Text style={styles.timeText}>
                {formatTimeAgo(notification.timestamp)}
              </Text>
            </View>
          </View>

          <View style={styles.statusColumn}>
            {!notification.read && <View style={styles.unreadDot} />}
          </View>
        </TouchableOpacity>
      </>
    );
  });

  const ViewModeTabs = () => (
    <View style={styles.viewModeContainer}>
      <View style={styles.viewModeButtons}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === "all" && styles.viewModeButtonActive]}
          onPress={() => setViewMode("all")}
        >
          <Text style={[styles.viewModeButtonText, viewMode === "all" && styles.viewModeButtonTextActive]}>
            All ({displayNotifications.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === "unread" && styles.viewModeButtonActive]}
          onPress={() => setViewMode("unread")}
        >
          <View style={styles.unreadButtonContent}>
            <Text style={[styles.viewModeButtonText, viewMode === "unread" && styles.viewModeButtonTextActive]}>
              Unread
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === "transactions" && styles.viewModeButtonActive]}
          onPress={() => setViewMode("transactions")}
        >
          <Text style={[styles.viewModeButtonText, viewMode === "transactions" && styles.viewModeButtonTextActive]}>
            Transactions
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.background}>
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
        <View style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={DARK_TEXT} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.headerPlaceholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_BLUE} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={DARK_TEXT} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Ionicons name="notifications" size={22} color={PRIMARY_BLUE} style={styles.headerIcon} />
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.headerUnreadBadge}>
                <Text style={styles.headerUnreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerActions}>
            {displayNotifications.length > 0 && (
              <>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.headerActionButton}
                    onPress={markAllAsRead}
                    disabled={refreshing}
                  >
                    <Ionicons name="checkmark-done" size={20} color={DARK_TEXT} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.headerActionButton}
                  onPress={clearAllNotifications}
                  disabled={refreshing}
                >
                  <Ionicons name="trash-outline" size={20} color={DARK_TEXT} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_BLUE}
              colors={[PRIMARY_BLUE]}
              title="Refreshing notifications..."
              titleColor={DARK_TEXT}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* View Mode Tabs */}
          <ViewModeTabs />

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{displayNotifications.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{unreadCount}</Text>
              <Text style={styles.statLabel}>Unread</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {displayNotifications.filter(n => n.type === "received" || n.type === "sent").length}
              </Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
          </View>

          {/* Notifications Header */}
          {filteredNotifications.length > 0 && (
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsHeaderText}>Recent Activity</Text>
            </View>
          )}

          {/* Notifications Table */}
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={viewMode === "unread" ? "checkmark-circle" : "notifications-off"}
                size={48}
                color={LIGHT_TEXT}
              />
              <Text style={styles.emptyTitle}>
                {viewMode === "unread" ? "All Read! 🎉" : "No Notifications"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {viewMode === "unread" 
                  ? "You're all caught up with your notifications."
                  : "Your notifications will appear here once you start using the app."}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={onRefresh}
                disabled={refreshing}
              >
                <Ionicons 
                  name="refresh" 
                  size={18} 
                  color={PRIMARY_BLUE} 
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.emptyButtonText}>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              {filteredNotifications.map((notification, index) => (
                <NotificationItem
                  key={`${notification.id}_${index}`}
                  notification={notification}
                  index={index}
                />
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''} shown
            </Text>
            <TouchableOpacity
              style={styles.footerButton}
              onPress={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <Text style={[styles.footerButtonText, unreadCount === 0 && styles.footerButtonTextDisabled]}>
                Mark all as read
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: WHITE,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: "600",
  },
  headerUnreadBadge: {
    backgroundColor: ERROR_RED,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  headerUnreadText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
  },
  headerActionButton: {
    padding: 4,
    marginLeft: 12,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
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
  },
  viewModeContainer: {
    marginVertical: 16,
  },
  viewModeButtons: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    marginHorizontal: 2,
    borderRadius: 16,
  },
  viewModeButtonActive: {
    backgroundColor: PRIMARY_BLUE,
  },
  viewModeButtonText: {
    color: LIGHT_TEXT,
    fontSize: 13,
    fontWeight: "500",
  },
  viewModeButtonTextActive: {
    color: WHITE,
  },
  unreadButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadCountBadge: {
    backgroundColor: ERROR_RED,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    borderRadius: 8,
  },
  unreadCountText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: "bold",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    color: DARK_TEXT,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    color: LIGHT_TEXT,
    fontSize: 12,
    fontWeight: "500",
  },
  notificationsHeader: {
    marginBottom: 12,
  },
  notificationsHeaderText: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: "600",
  },
  tableContainer: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  dateHeader: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateHeaderText: {
    color: LIGHT_TEXT,
    fontSize: 12,
    fontWeight: "500",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  tableRowUnread: {
    backgroundColor: "#fafbfc",
  },
  iconColumn: {
    width: 32,
    marginRight: 12,
  },
  detailsColumn: {
    flex: 1,
    marginRight: 8,
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  notificationTitle: {
    color: DARK_TEXT,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  amountText: {
    fontSize: 14,
    fontWeight: "600",
  },
  notificationMessage: {
    color: LIGHT_TEXT,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  detailsFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    marginRight: 8,
    marginBottom: 4,
  },
  platformContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 4,
  },
  platformIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  platformText: {
    color: LIGHT_TEXT,
    fontSize: 10,
    fontWeight: "500",
  },
  timeText: {
    color: LIGHT_TEXT,
    fontSize: 10,
    fontWeight: "500",
    marginBottom: 4,
  },
  statusColumn: {
    width: 24,
    alignItems: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    backgroundColor: PRIMARY_BLUE,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 16,
  },
  emptyTitle: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    color: LIGHT_TEXT,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f0f5ff",
  },
  emptyButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  footerText: {
    color: LIGHT_TEXT,
    fontSize: 12,
    fontWeight: "500",
  },
  footerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  footerButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 12,
    fontWeight: "600",
  },
  footerButtonTextDisabled: {
    color: LIGHT_TEXT,
    opacity: 0.5,
  },
});

export default React.memo(NotificationsScreen);