// screens/NotificationsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
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
import { getUserSession, getUserTransactions, getUserProfile } from './supabase';

const { width } = Dimensions.get('window');

const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (isFocused) {
      loadNotifications();
    }
  }, [isFocused]);

  const loadNotifications = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      console.log('🔔 Loading notifications...');

      // Get user session
      const sessionResult = await getUserSession();
      if (!sessionResult.success || !sessionResult.user) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      setUserData(sessionResult.user);

      // Get user transactions to create notifications
      const transactionsResult = await getUserTransactions(sessionResult.user.id, 50);
      
      if (transactionsResult.success) {
        const transactionNotifications = generateNotificationsFromTransactions(
          transactionsResult.data || [],
          sessionResult.user.id
        );
        
        // Sort by date (newest first)
        const sortedNotifications = transactionNotifications.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        setNotifications(sortedNotifications);
        
        // Calculate unread count (notifications from last 7 days that are unread)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentUnread = sortedNotifications.filter(notification => 
          new Date(notification.timestamp) > sevenDaysAgo && !notification.read
        ).length;
        
        setUnreadCount(recentUnread);
        
        console.log(`✅ Loaded ${sortedNotifications.length} notifications, ${recentUnread} unread`);
      } else {
        throw new Error('Failed to load transactions');
      }

    } catch (error) {
      console.error('❌ Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
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
        }
      ];
    }

    const generatedNotifications = [];

    transactions.forEach((transaction, index) => {
      const amount = parseFloat(transaction.amount);
      const isSent = transaction.sender_id === userId;
      const transactionDate = new Date(transaction.created_at);
      
      // Determine platform based on transaction type or other criteria
      const platform = getTransactionPlatform(transaction, index);
      
      // Create detailed notification for each transaction
      generatedNotifications.push({
        id: `transaction_${transaction.id}`,
        type: isSent ? 'sent' : 'received',
        title: isSent ? 'Money Sent' : 'Money Received',
        message: isSent 
          ? `You sent $${amount.toFixed(2)} via ${platform} to User${Math.floor(Math.random() * 1000) + 1}`
          : `You received $${amount.toFixed(2)} via ${platform} from User${Math.floor(Math.random() * 1000) + 1}`,
        amount: amount,
        timestamp: transaction.created_at,
        transactionId: transaction.id,
        read: false,
        icon: isSent ? 'arrow-up' : 'arrow-down',
        color: isSent ? '#FF6B6B' : '#4CAF50',
        platform: platform,
      });

      // Add instant notification for completed transactions
      generatedNotifications.push({
        id: `completed_${transaction.id}`,
        type: 'completed',
        title: 'Transaction Completed',
        message: `Your ${isSent ? 'payment' : 'transfer'} of $${amount.toFixed(2)} was successful`,
        amount: amount,
        timestamp: new Date(transactionDate.getTime() + 30000).toISOString(), // 30 seconds after
        transactionId: transaction.id,
        read: false,
        icon: 'checkmark-circle',
        color: '#4CAF50',
        platform: platform,
      });

      // Simulate balance update notifications (every transaction)
      const simulatedBalance = (Math.random() * 1000 + 100).toFixed(2);
      generatedNotifications.push({
        id: `balance_${transaction.id}`,
        type: 'balance',
        title: 'Balance Updated',
        message: `Your account balance is now $${simulatedBalance}`,
        amount: null,
        timestamp: new Date(transactionDate.getTime() + 60000).toISOString(), // 1 minute after transaction
        transactionId: null,
        read: false,
        icon: 'wallet',
        color: '#2196F3',
        platform: null,
      });

      // Simulate system notifications (every 5th transaction)
      if (index % 5 === 0) {
        const systemMessages = [
          'Security alert: New login detected from your account',
          'Feature update: New bill payment options available',
          'Reminder: Keep your PIN secure and do not share it',
          'Promotion: Get 5% cashback on your next airtime purchase',
          'Maintenance: System upgrade scheduled for tonight'
        ];
        
        generatedNotifications.push({
          id: `system_${transaction.id}_${index}`,
          type: 'system',
          title: 'System Notification',
          message: systemMessages[Math.floor(Math.random() * systemMessages.length)],
          amount: null,
          timestamp: new Date(transactionDate.getTime() + 120000).toISOString(), // 2 minutes after transaction
          transactionId: null,
          read: false,
          icon: 'notifications',
          color: '#FFA726',
          platform: null,
        });
      }
    });

    return generatedNotifications;
  };

  const getTransactionPlatform = (transaction, index) => {
    const platforms = ['MyChangeX', 'EcoCash', 'Omari', 'Bank Transfer'];
    // Use transaction type or other criteria to determine platform
    if (transaction.type === 'mychangex') return 'MyChangeX';
    if (transaction.type === 'ecocash') return 'EcoCash';
    if (transaction.type === 'omari') return 'Omari';
    
    // Fallback to random platform for demo
    return platforms[index % platforms.length];
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications(false);
  }, []);

  const formatDetailedTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    // For older notifications, show exact date and time
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true
    }));
    
    setNotifications(updatedNotifications);
    setUnreadCount(0);
    
    console.log('✅ Marked all notifications as read');
  };

  const clearAllNotifications = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            setNotifications([]);
            setUnreadCount(0);
            console.log('✅ Cleared all notifications');
          }
        }
      ]
    );
  };

  const handleNotificationPress = (notification) => {
    if (!notification.read) {
      // Mark as read and decrement count
      const updatedNotifications = notifications.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      );
      
      setNotifications(updatedNotifications);
      setUnreadCount(prev => prev - 1);
      
      console.log(`✅ Marked notification ${notification.id} as read`);
    }

    // Navigate to transaction details if it's a transaction notification
    if (notification.transactionId) {
      Alert.alert(
        'Transaction Details',
        `Amount: $${notification.amount?.toFixed(2) || 'N/A'}\n` +
        `Type: ${notification.type}\n` +
        `Platform: ${notification.platform || 'MyChangeX'}\n` +
        `Time: ${formatDetailedTime(notification.timestamp)}`,
        [{ text: 'OK' }]
      );
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'sent':
        return 'arrow-up';
      case 'received':
        return 'arrow-down';
      case 'completed':
        return 'checkmark-circle';
      case 'balance':
        return 'wallet';
      case 'system':
        return 'notifications';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'sent':
        return '#FF6B6B';
      case 'received':
        return '#4CAF50';
      case 'completed':
        return '#4CAF50';
      case 'balance':
        return '#2196F3';
      case 'system':
        return '#FFA726';
      default:
        return '#666';
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'MyChangeX':
        return '🔄';
      case 'EcoCash':
        return '📱';
      case 'Omari':
        return '💳';
      case 'Bank Transfer':
        return '🏦';
      default:
        return '💰';
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#0136c0', '#0136c0']}
        style={styles.background}
      >
        <SafeAreaView style={styles.safeArea}>
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
            {notifications.length > 0 && unreadCount > 0 && (
              <>
                <TouchableOpacity 
                  style={styles.headerActionButton}
                  onPress={markAllAsRead}
                >
                  <Ionicons name="checkmark-done" size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.headerActionButton}
                  onPress={clearAllNotifications}
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
            />
          }
          showsVerticalScrollIndicator={false}
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
                {notifications.length === 0 ? 'No Notifications' : 'Recent Activity'}
              </Text>
              <Text style={styles.summarySubtitle}>
                {notifications.length === 0 
                  ? 'Your notifications will appear here' 
                  : `${unreadCount} unread of ${notifications.length} total`}
              </Text>
            </View>
          </View>

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyTitle}>No Notifications Yet</Text>
              <Text style={styles.emptySubtitle}>
                Your transaction notifications and alerts will appear here once you start using the app.
              </Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={onRefresh}
              >
                <Text style={styles.emptyButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {notifications.map((notification, index) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    !notification.read && styles.notificationItemUnread,
                    index === notifications.length - 1 && styles.lastNotificationItem
                  ]}
                  onPress={() => handleNotificationPress(notification)}
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
                        <Text style={styles.notificationTitle}>
                          {notification.title}
                        </Text>
                        {notification.platform && (
                          <View style={styles.platformBadge}>
                            <Text style={styles.platformIcon}>
                              {getPlatformIcon(notification.platform)}
                            </Text>
                            <Text style={styles.platformText}>
                              {notification.platform}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.notificationMessage}>
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
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerActionButton: {
    padding: 8,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
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
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  notificationItemUnread: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  lastNotificationItem: {
    borderBottomWidth: 0,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  },
  platformIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  platformText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  notificationMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  notificationRight: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  notificationAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  footerSpacer: {
    height: 20,
  },
});

export default NotificationsScreen;