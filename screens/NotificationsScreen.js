import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as Device from 'expo-device';
import { 
  getUserSession, 
  getUserTransactions,
  isAuthenticated // Import isAuthenticated
} from './supabase';
import { NotificationService } from './services/notificationService';

const { width } = Dimensions.get('window');

const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";

const NotificationsScreen = ({ 
  navigation, 
  route, 
  notifications = [], 
  setNotifications, 
  setUnreadCount 
}) => {
  const isFocused = useIsFocused();
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [error, setError] = useState(null);

  // Use either prop notifications or local notifications
  const displayNotifications = notifications.length > 0 ? notifications : localNotifications;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        console.log('🔒 NotificationsScreen: User not authenticated, redirecting to Login');
        navigation.navigate('Login');
        return;
      }
      // If authenticated and screen is focused, initialize
      if (isFocused) {
        initializeScreen();
      }
    };
    
    checkAuth();
  }, [isFocused, navigation]);

  // Initialize screen when focused and authenticated
  const initializeScreen = () => {
    if (!isFocused || !isMounted.current) return;

    const init = async () => {
      try {
        // Initialize push notifications
        await initializePushNotifications();
        
        // Load notifications
        await loadNotifications(true);
      } catch (error) {
        console.error('Screen initialization error:', error);
      }
    };

    init();
  };

  const initializePushNotifications = async () => {
    try {
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        console.log('No user session found for notifications');
        return;
      }

      const token = await NotificationService.registerForPushNotifications();
      if (token) {
        await NotificationService.savePushToken(sessionResult.user.id, token);
      }
    } catch (error) {
      console.warn('Push notification initialization failed:', error.message);
    }
  };

  const loadNotifications = async (showLoading = true) => {
    try {
      if (!isMounted.current) return;

      // Double-check authentication
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        if (isMounted.current) {
          Alert.alert('Session Expired', 'Please login again.', [
            { 
              text: 'OK', 
              onPress: () => navigation.navigate('Login') 
            }
          ]);
        }
        return;
      }

      if (showLoading) {
        setLoading(true);
      }
      setRefreshing(true);
      setError(null);

      // Get user session
      const sessionResult = await getUserSession();
      if (!sessionResult.success || !sessionResult.user) {
        if (isMounted.current) {
          Alert.alert('Session Expired', 'Please login again.');
          navigation.navigate('Login');
        }
        return;
      }

      if (isMounted.current) {
        setUserData(sessionResult.user);
      }

      // If we have notifications from props, use them
      if (notifications.length > 0) {
        return;
      }

      // Load from transactions with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000);
      });

      const transactionsPromise = getUserTransactions(sessionResult.user.id, 50);
      
      const transactionsResult = await Promise.race([transactionsPromise, timeoutPromise]);
      
      if (transactionsResult.success) {
        const transactionNotifications = generateNotificationsFromTransactions(
          transactionsResult.data || [],
          sessionResult.user.id
        );
        
        const sortedNotifications = transactionNotifications.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        if (isMounted.current) {
          setLocalNotifications(sortedNotifications);
        }
      } else {
        throw new Error('Failed to load transactions');
      }

    } catch (error) {
      console.error('Error loading notifications:', error);
      
      if (isMounted.current) {
        setError(error.message || 'Failed to load notifications');
        
        // Check if session expired during the process
        const authResult = await isAuthenticated();
        if (!authResult.authenticated) {
          navigation.navigate('Login');
          return;
        }
        
        // Show user-friendly error
        if (error.message === 'Request timeout') {
          Alert.alert(
            'Connection Timeout',
            'The request took too long. Please check your internet connection and try again.',
            [
              { text: 'Try Again', onPress: () => loadNotifications(showLoading) },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else if (!displayNotifications.length) {
          // Only show error if we have no notifications to display
          Alert.alert(
            'Error Loading Notifications',
            'Unable to load notifications. Please try again later.',
            [{ text: 'OK' }]
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
          id: 'welcome_1',
          type: 'system',
          title: 'Welcome to MyChangeX!',
          message: 'Start using the app to see your transaction notifications here.',
          amount: null,
          timestamp: new Date().toISOString(),
          transactionId: null,
          read: true,
          icon: 'notifications',
          color: '#FFA726',
          platform: null,
          isPushNotification: false,
        }
      ];
    }

    const generatedNotifications = [];

    // Limit to reasonable number for performance
    const limitedTransactions = transactions.slice(0, 20);

    limitedTransactions.forEach((transaction, index) => {
      const amount = parseFloat(transaction.amount) || 0;
      const isSent = transaction.sender_id === userId;
      const transactionDate = new Date(transaction.created_at);
      
      // Determine platform
      const platform = getTransactionPlatform(transaction, index);
      
      // Create main transaction notification
      generatedNotifications.push({
        id: `transaction_${transaction.id}`,
        type: isSent ? 'sent' : 'received',
        title: isSent ? 'Money Sent' : 'Money Received',
        message: isSent 
          ? `You sent $${amount.toFixed(2)} via ${platform}`
          : `You received $${amount.toFixed(2)} via ${platform}`,
        amount: amount,
        timestamp: transaction.created_at,
        transactionId: transaction.id,
        read: false,
        icon: isSent ? 'arrow-up' : 'arrow-down',
        color: isSent ? '#FF6B6B' : '#4CAF50',
        platform: platform,
        isPushNotification: false,
      });

      // Add completed notification
      generatedNotifications.push({
        id: `completed_${transaction.id}`,
        type: 'completed',
        title: 'Transaction Completed',
        message: `Your ${isSent ? 'payment' : 'transfer'} of $${amount.toFixed(2)} was successful`,
        amount: amount,
        timestamp: new Date(transactionDate.getTime() + 30000).toISOString(),
        transactionId: transaction.id,
        read: false,
        icon: 'checkmark-circle',
        color: '#4CAF50',
        platform: platform,
        isPushNotification: false,
      });
    });

    // Add a few sample notifications if we have less than 5
    if (generatedNotifications.length < 5) {
      const sampleNotifications = [
        {
          id: 'sample_balance',
          type: 'balance',
          title: 'Balance Updated',
          message: 'Your account balance is now $245.67',
          amount: null,
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          transactionId: null,
          read: true,
          icon: 'wallet',
          color: '#2196F3',
          platform: null,
          isPushNotification: false,
        },
        {
          id: 'sample_system',
          type: 'system',
          title: 'Security Alert',
          message: 'New login detected from your account',
          amount: null,
          timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          transactionId: null,
          read: true,
          icon: 'notifications',
          color: '#FFA726',
          platform: null,
          isPushNotification: false,
        }
      ];
      generatedNotifications.push(...sampleNotifications);
    }

    return generatedNotifications;
  };

  const getTransactionPlatform = (transaction, index) => {
    if (transaction.type === 'mychangex') return 'MyChangeX';
    if (transaction.type === 'ecocash') return 'EcoCash';
    if (transaction.type === 'omari') return 'Omari';
    
    const platforms = ['MyChangeX', 'EcoCash', 'Omari'];
    return platforms[index % platforms.length];
  };

  const onRefresh = useCallback(async () => {
    if (refreshing) return; // Prevent multiple refreshes
    
    // Check authentication before refresh
    const authResult = await isAuthenticated();
    if (!authResult.authenticated) {
      navigation.navigate('Login');
      return;
    }
    
    await loadNotifications(false);
  }, [refreshing, navigation]);

  const formatTimeAgo = useCallback((timestamp) => {
    try {
      const now = new Date();
      const date = new Date(timestamp);
      
      if (isNaN(date.getTime())) {
        return 'Recently';
      }
      
      const diffInSeconds = Math.floor((now - date) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Recently';
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      // Check authentication before action
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        navigation.navigate('Login');
        return;
      }

      if (setNotifications && setUnreadCount) {
        const updatedNotifications = displayNotifications.map(notification => ({
          ...notification,
          read: true
        }));
        
        setNotifications(updatedNotifications);
        setUnreadCount(0);
      } else {
        const updatedNotifications = localNotifications.map(notification => ({
          ...notification,
          read: true
        }));
        setLocalNotifications(updatedNotifications);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read.');
    }
  }, [displayNotifications, localNotifications, setNotifications, setUnreadCount, navigation]);

  const clearAllNotifications = useCallback(async () => {
    // Check authentication before action
    const authResult = await isAuthenticated();
    if (!authResult.authenticated) {
      navigation.navigate('Login');
      return;
    }

    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            try {
              if (setNotifications && setUnreadCount) {
                setNotifications([]);
                setUnreadCount(0);
              } else {
                setLocalNotifications([]);
              }
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications.');
            }
          }
        }
      ]
    );
  }, [setNotifications, setUnreadCount, navigation]);

  const handleNotificationPress = useCallback(async (notification) => {
    try {
      // Check authentication before action
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        navigation.navigate('Login');
        return;
      }

      if (!notification.read) {
        if (setNotifications && setUnreadCount) {
          const updatedNotifications = displayNotifications.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          );
          
          setNotifications(updatedNotifications);
          setUnreadCount(prev => Math.max(0, prev - 1));
        } else {
          const updatedNotifications = localNotifications.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          );
          setLocalNotifications(updatedNotifications);
        }
      }

      if (notification.transactionId) {
        Alert.alert(
          'Transaction Details',
          `Amount: $${notification.amount?.toFixed(2) || 'N/A'}\n` +
          `Type: ${notification.type}\n` +
          `Platform: ${notification.platform || 'MyChangeX'}\n` +
          `Time: ${formatTimeAgo(notification.timestamp)}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  }, [displayNotifications, localNotifications, setNotifications, setUnreadCount, formatTimeAgo, navigation]);

  const getNotificationIcon = useCallback((type) => {
    switch (type) {
      case 'sent': return 'arrow-up';
      case 'received': return 'arrow-down';
      case 'completed': return 'checkmark-circle';
      case 'balance': return 'wallet';
      case 'system': return 'notifications';
      default: return 'notifications';
    }
  }, []);

  const getNotificationColor = useCallback((type) => {
    switch (type) {
      case 'sent': return '#FF6B6B';
      case 'received': return '#4CAF50';
      case 'completed': return '#4CAF50';
      case 'balance': return '#2196F3';
      case 'system': return '#FFA726';
      default: return '#666';
    }
  }, []);

  const getPlatformIcon = useCallback((platform) => {
    switch (platform) {
      case 'MyChangeX': return '🔄';
      case 'EcoCash': return '📱';
      case 'Omari': return '💳';
      case 'Bank Transfer': return '🏦';
      default: return '💰';
    }
  }, []);

  // Calculate unread count for display
  const unreadCount = displayNotifications.filter(notification => !notification.read).length;

  const NotificationItem = React.memo(({ notification, index, isLast }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.read && styles.notificationItemUnread,
        isLast && styles.lastNotificationItem,
      ]}
      onPress={() => handleNotificationPress(notification)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationLeft}>
        <View 
          style={[
            styles.notificationIcon,
            { backgroundColor: `${getNotificationColor(notification.type)}20` }
          ]}
        >
          <Ionicons 
            name={getNotificationIcon(notification.type)} 
            size={20} 
            color={getNotificationColor(notification.type)} 
          />
        </View>
        
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle} numberOfLines={1}>
              {notification.title}
            </Text>
            {notification.platform && (
              <View style={styles.platformBadge}>
                <Text style={styles.platformIcon}>
                  {getPlatformIcon(notification.platform)}
                </Text>
                <Text style={styles.platformText} numberOfLines={1}>
                  {notification.platform}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {notification.message}
          </Text>
          <Text style={styles.notificationTime}>
            {formatTimeAgo(notification.timestamp)}
          </Text>
        </View>
      </View>

      <View style={styles.notificationRight}>
        {notification.amount && (
          <Text style={[
            styles.notificationAmount,
            { color: getNotificationColor(notification.type) }
          ]}>
            {notification.type === 'sent' ? '-' : '+'}${notification.amount.toFixed(2)}
          </Text>
        )}
        {!notification.read && (
          <View style={styles.unreadIndicator} />
        )}
      </View>
    </TouchableOpacity>
  ));

  if (loading) {
    return (
      <LinearGradient
        colors={['#0136c0', '#0136c0']}
        style={styles.background}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.headerActions} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0136c0', '#0136c0']}
      style={styles.background}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerActions}>
            {displayNotifications.length > 0 && unreadCount > 0 && (
              <>
                <TouchableOpacity 
                  style={styles.headerActionButton}
                  onPress={markAllAsRead}
                  disabled={refreshing}
                >
                  <Ionicons name="checkmark-done" size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.headerActionButton}
                  onPress={clearAllNotifications}
                  disabled={refreshing}
                >
                  <Ionicons name="trash" size={20} color="#ffffff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ffffff"
              colors={['#ffffff']}
              enabled={!refreshing}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="notifications" size={32} color="#ffffff" />
              {unreadCount > 0 && (
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>
                {displayNotifications.length === 0 ? 'No Notifications' : 'Recent Activity'}
              </Text>
              <Text style={styles.summarySubtitle}>
                {displayNotifications.length === 0 
                  ? 'Your notifications will appear here' 
                  : `${unreadCount} unread of ${displayNotifications.length} total`}
              </Text>
            </View>
          </View>

          {/* Error Message */}
          {error && !displayNotifications.length && (
            <View style={styles.errorCard}>
              <Ionicons name="warning" size={24} color="#FF6B6B" />
              <Text style={styles.errorText}>
                Unable to load notifications. Pull to refresh.
              </Text>
            </View>
          )}

          {/* Push Notifications Status */}
          <View style={styles.pushStatusCard}>
            <Ionicons name="wifi" size={20} color={Device.isDevice ? "#4CAF50" : "#FFA726"} />
            <Text style={styles.pushStatusText}>
              {Device.isDevice ? 'Push notifications enabled' : 'Simulator mode'}
            </Text>
          </View>

          {/* Notifications List */}
          {displayNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyTitle}>No Notifications Yet</Text>
              <Text style={styles.emptySubtitle}>
                Your transaction notifications and alerts will appear here once you start using the app.
              </Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={onRefresh}
                disabled={refreshing}
              >
                <Text style={styles.emptyButtonText}>
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {displayNotifications.map((notification, index) => (
                <NotificationItem 
                  key={`${notification.id}_${index}`} 
                  notification={notification} 
                  index={index}
                  isLast={index === displayNotifications.length - 1}
                />
              ))}
            </View>
          )}

          {/* Footer Spacer */}
          <View style={styles.footerSpacer} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: LIGHT_TEXT,
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: LIGHT_TEXT,
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 12,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  summaryCard: {
    backgroundColor: CARD_COLOR,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIcon: {
    position: 'relative',
    marginRight: 16,
  },
  summaryBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBadgeText: {
    color: LIGHT_TEXT,
    fontSize: 10,
    fontWeight: 'bold',
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    color: LIGHT_TEXT,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  summarySubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  pushStatusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pushStatusText: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: LIGHT_TEXT,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  notificationsList: {
    marginBottom: 20,
  },
  notificationItem: {
    backgroundColor: CARD_COLOR,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  notificationItemUnread: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  lastNotificationItem: {
    marginBottom: 0,
  },
  notificationLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
    maxWidth: 100,
  },
  platformIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  platformText: {
    color: LIGHT_TEXT,
    fontSize: 10,
    fontWeight: '500',
  },
  notificationMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  notificationRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    minWidth: 60,
  },
  notificationAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  footerSpacer: {
    height: 40,
  },
});

export default React.memo(NotificationsScreen);