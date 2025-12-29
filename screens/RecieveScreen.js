import React, { useState, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  StyleSheet, 
  Dimensions, 
  StatusBar,
  SafeAreaView,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { 
  supabase, 
  formatZimbabwePhone, 
  getUserSession, 
  getUserProfile,
  validatePhoneNumber,
  getUserTransactions
} from './supabase';
import { NotificationService } from './services/notificationService';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#e9edf9";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.15)";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";

// Message Modal Component - Updated styling
const MessageModal = ({ visible, title, message, onClose, type = 'info' }) => {
  const getBackgroundColor = () => {
    switch (type) {
      case 'error': return ERROR_RED;
      case 'success': return SUCCESS_GREEN;
      case 'warning': return '#FFA726';
      default: return PRIMARY_BLUE;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalBackdrop} />
        <View style={[styles.messageModalContent, { backgroundColor: getBackgroundColor() }]}>
          <View style={styles.messageModalHeader}>
            <Text style={styles.messageModalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={WHITE} />
            </TouchableOpacity>
          </View>
          <Text style={styles.messageModalMessage}>{message}</Text>
          <TouchableOpacity style={styles.messageModalButton} onPress={onClose}>
            <Text style={styles.messageModalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Transaction Item Component - Updated styling
const TransactionItem = ({ transaction, userId }) => {
  const formatTransactionAmount = (transaction, userId) => {
    const amount = parseFloat(transaction.amount);
    if (transaction.sender_id === userId) {
      return `-$${amount.toFixed(2)}`;
    } else {
      return `+$${amount.toFixed(2)}`;
    }
  };

  const getTransactionType = (transaction, userId) => {
    if (transaction.sender_id === userId) {
      return 'Sent';
    } else {
      return 'Received';
    }
  };

  const getTransactionCounterparty = (transaction, userId) => {
    if (transaction.sender_id === userId) {
      return 'To: User';
    } else {
      return 'From: User';
    }
  };

  const formatTransactionDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'Unknown date';
    }
  };

  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        <Ionicons 
          name={transaction.sender_id === userId ? "arrow-up" : "arrow-down"} 
          size={20} 
          color={transaction.sender_id === userId ? ERROR_RED : SUCCESS_GREEN} 
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionType}>
          {getTransactionType(transaction, userId)}
        </Text>
        <Text style={styles.transactionCounterparty}>
          {getTransactionCounterparty(transaction, userId)}
        </Text>
        <Text style={styles.transactionDate}>
          {formatTransactionDate(transaction.created_at)}
        </Text>
      </View>
      <Text style={[
        styles.transactionAmount,
        transaction.sender_id === userId ? styles.amountSent : styles.amountReceived
      ]}>
        {formatTransactionAmount(transaction, userId)}
      </Text>
    </View>
  );
};

const ReceiveScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  // State variables
  const [qrData, setQrData] = useState(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [userData, setUserData] = useState({
    name: '',
    phoneNumber: ''
  });
  const [balance, setBalance] = useState(0);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState('');
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [processingReceivedTransaction, setProcessingReceivedTransaction] = useState(false);
  const [hasShownAutoNavigateAlert, setHasShownAutoNavigateAlert] = useState(false);

  // Message modal state
  const [messageModal, setMessageModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info'
  });

  // Real-time subscriptions
  const [subscriptions, setSubscriptions] = useState([]);
  
  // Timeout refs
  const autoNavigateTimeoutRef = useRef(null);
  const notificationSubscriptionRef = useRef(null);

  // Cleanup subscriptions and timeouts
  useEffect(() => {
    return () => {
      // Cleanup subscriptions
      subscriptions.forEach(subscription => {
        subscription?.unsubscribe?.();
      });
      
      // Cleanup notification listener
      if (notificationSubscriptionRef.current) {
        notificationSubscriptionRef.current.remove();
      }
      
      // Cleanup timeouts
      if (autoNavigateTimeoutRef.current) {
        clearTimeout(autoNavigateTimeoutRef.current);
      }
    };
  }, [subscriptions]);

  // Check authentication when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isFocused) {
        checkAuthentication();
      }
    }, [isFocused])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Setup notification listener for this screen
  useEffect(() => {
    if (!userId) return;
    
    notificationSubscriptionRef.current = Notifications.addNotificationReceivedListener(notification => {
      const { data } = notification.request.content;
      
      if (data.type === 'transaction_received') {
        // Refresh balance immediately
        refreshBalance();
        
        // Show auto-navigation alert if not already shown
        if (!hasShownAutoNavigateAlert && isFocused) {
          setHasShownAutoNavigateAlert(true);
          
          Alert.alert(
            "Money Received! 🎉",
            `You've received $${data.amount || '0.00'}. Auto-navigating to Home in 5 seconds...`,
            [
              { 
                text: "Go to Home Now", 
                onPress: () => {
                  navigation.navigate('Home');
                  setHasShownAutoNavigateAlert(false);
                }
              },
              { 
                text: "Stay Here", 
                style: "cancel",
                onPress: () => {
                  setHasShownAutoNavigateAlert(false);
                  scheduleAutoNavigation(10000);
                }
              }
            ]
          );
          
          // Schedule auto-navigation after 5 seconds
          scheduleAutoNavigation(5000);
        }
      }
    });
    
    return () => {
      if (notificationSubscriptionRef.current) {
        notificationSubscriptionRef.current.remove();
      }
    };
  }, [userId, isFocused, hasShownAutoNavigateAlert, navigation]);

  // Schedule auto-navigation function
  const scheduleAutoNavigation = useCallback((delay = 5000) => {
    if (autoNavigateTimeoutRef.current) {
      clearTimeout(autoNavigateTimeoutRef.current);
    }
    
    autoNavigateTimeoutRef.current = setTimeout(() => {
      if (navigation.isFocused()) {
        navigation.navigate('Home');
      }
    }, delay);
  }, [navigation]);

  const checkAuthentication = async () => {
    try {
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        showMessage('Authentication Required', 'Please login to access this feature.', 'error');
        
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }, 2000);
        return;
      }

      setUserId(sessionResult.user.id);
      setUserPhone(sessionResult.user.phone || '');
      setAuthChecked(true);
      
      await fetchUserData(sessionResult.user.id);
      
    } catch (error) {
      showMessage('Error', 'Authentication check failed. Please login again.', 'error');
      
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }, 2000);
    }
  };

  // Fetch user data after authentication is confirmed
  const fetchUserData = async (userId, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, balance')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          await createUserProfile(userId);
          return;
        }
        throw error;
      }
      
      setBalance(data.balance || 0);
      setUserData({
        name: data.full_name || '',
        phoneNumber: data.phone || ''
      });
      
      if (data.phone) {
        generateQRCode(data.full_name, data.phone, data.balance || 0);
      }
      
      setIsUserLoaded(true);
      await loadRecentTransactions(userId);
      setupRealtimeSubscriptions(userId);
      
    } catch (error) {
      showMessage('Error', 'Failed to load user data. Please try again.', 'error');
    } finally {
      if (showLoading) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Setup real-time subscriptions with auto-navigation
  const setupRealtimeSubscriptions = (userId) => {
    // Profile changes subscription
    const profileSubscription = supabase
      .channel('user_balance_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          setBalance(payload.new.balance || 0);
          updateQRCodeBalance(payload.new.balance || 0);
          
          if (payload.new.balance > balance) {
            const increase = payload.new.balance - balance;
            if (increase > 0.01) {
              Alert.alert(
                "Balance Increased",
                `Your balance increased by $${increase.toFixed(2)}`,
                [{ text: "OK" }]
              );
            }
          }
        }
      )
      .subscribe();

    // Transactions subscription
    const transactionSubscription = supabase
      .channel('user_transaction_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `receiver_id=eq.${userId}`
        },
        async (payload) => {
          if (processingReceivedTransaction) {
            return;
          }
          
          setProcessingReceivedTransaction(true);
          
          try {
            await loadRecentTransactions(userId);
            
            if (payload.new.amount > 0) {
              Alert.alert(
                "Money Received! 🎉", 
                `You received $${payload.new.amount.toFixed(2)}. Auto-navigating to Home in 5 seconds...`,
                [
                  { 
                    text: "Go to Home Now", 
                    onPress: () => {
                      navigation.navigate('Home');
                    }
                  },
                  { 
                    text: "Stay Here", 
                    style: "cancel",
                    onPress: () => {
                      scheduleAutoNavigation(10000);
                    }
                  }
                ]
              );
              
              scheduleAutoNavigation(5000);
              
              try {
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
              } catch (notificationError) {
                console.error("Notification error:", notificationError);
              }
            }
          } catch (error) {
            console.error("Error processing received transaction:", error);
          } finally {
            setTimeout(() => {
              setProcessingReceivedTransaction(false);
            }, 3000);
          }
        }
      )
      .subscribe();

    setSubscriptions([profileSubscription, transactionSubscription]);
  };

  // Update QR code with new balance
  const updateQRCodeBalance = (newBalance) => {
    if (qrData) {
      try {
        const dataObj = JSON.parse(qrData);
        dataObj.balance = newBalance;
        setQrData(JSON.stringify(dataObj));
      } catch (error) {
        console.error('Error updating QR code balance:', error);
      }
    }
  };

  // Load recent transactions
  const loadRecentTransactions = async (userId) => {
    try {
      setTransactionsLoading(true);
      
      const result = await getUserTransactions(userId, 5);
      
      if (result.success) {
        setRecentTransactions(result.data || []);
      } else {
        setRecentTransactions([]);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      setRecentTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Create user profile if it doesn't exist
  const createUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            phone: userPhone || '',
            full_name: 'User',
            balance: 0.00,
            created_at: new Date().toISOString(),
          }
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setBalance(0);
      setUserData({
        name: 'User',
        phoneNumber: userPhone || ''
      });
      setIsUserLoaded(true);

    } catch (error) {
      showMessage('Error', 'Failed to create user profile. Please try again.', 'error');
    }
  };

  const generateQRCode = (name, phone, currentBalance) => {
    const data = JSON.stringify({
      type: 'coupon',
      name: name,
      phone: phone,
      balance: currentBalance,
      timestamp: new Date().toISOString(),
      app: 'MyChangeX'
    });
    
    setQrData(data);
  };

  const handleGenerateCode = async () => {
    if (!userId) {
      showMessage('Error', 'User not authenticated. Please login again.', 'error');
      return;
    }

    // Validate inputs
    if (!userData.name.trim()) {
      showMessage('Error', 'Please enter your name', 'error');
      return;
    }

    if (!userData.phoneNumber.trim()) {
      showMessage('Error', 'Please enter your phone number', 'error');
      return;
    }

    if (!validatePhoneNumber(userData.phoneNumber)) {
      showMessage('Error', 'Please enter a valid Zimbabwean phone number', 'error');
      return;
    }

    const formattedPhone = formatZimbabwePhone(userData.phoneNumber);
    
    setProfileLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userData.name.trim(),
          phone: formattedPhone,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        throw error;
      }
      
      generateQRCode(userData.name.trim(), formattedPhone, balance);
      setShowRegistrationModal(false);
      
      showMessage('Success', 'Profile updated successfully', 'success');
      
    } catch (error) {
      showMessage('Error', error.message || 'Failed to update profile', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleRegistration = () => {
    if (!userId) {
      showMessage('Error', 'User not authenticated. Please login again.', 'error');
      return;
    }
    setShowRegistrationModal(true);
  };

  // Refresh balance function
  const refreshBalance = async () => {
    try {
      if (!userId) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
    }
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    if (!userId) return;
    
    setRefreshing(true);
    await fetchUserData(userId, false);
  }, [userId]);

  // Show message helper
  const showMessage = (title, message, type = 'info') => {
    setMessageModal({
      visible: true,
      title,
      message,
      type
    });
  };

  // Handle phone number input formatting
  const handlePhoneChange = (text) => {
    const cleaned = text.replace(/[^\d+]/g, '');
    setUserData({...userData, phoneNumber: cleaned});
  };

  // Format phone number for display
  const formatDisplayPhone = (phone) => {
    if (!phone) return '';
    
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('263') && cleaned.length === 12) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `+263 ${cleaned.slice(1)}`;
    } else if (cleaned.length === 9) {
      return `+263 ${cleaned}`;
    }
    
    return phone;
  };

  // Show loading state while checking authentication or fetching data
  if (loading || !authChecked) {
    return (
      <View style={styles.background}>
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BLUE} />
        <LinearGradient
          colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
          style={styles.gradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={WHITE} />
              <Text style={styles.loadingText}>
                {!authChecked ? 'Checking authentication...' : 'Loading your profile...'}
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  // Show message if user is not authenticated (should be handled by navigation, but as fallback)
  if (!userId) {
    return (
      <View style={styles.background}>
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BLUE} />
        <LinearGradient
          colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
          style={styles.gradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>Authentication Required</Text>
              <Text style={styles.errorSubtext}>Please log in to access this feature</Text>
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={() => navigation.navigate('Login')}
              >
                <LinearGradient
                  colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                  style={styles.loginButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.loginButtonText}>Go to Login</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BLUE} />
      <LinearGradient
        colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header - Matching HomeScreen style */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={WHITE} />
            </TouchableOpacity>
            <View style={styles.headerLeft}>
              <Ionicons name="qr-code-outline" size={28} color={WHITE} />
              <Text style={styles.headerTitle}>Receive Coupons</Text>
            </View>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <Ionicons name="refresh-outline" size={22} color={WHITE} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={WHITE}
                colors={[WHITE]}
                title="Refreshing..."
                titleColor={WHITE}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* QR Code Card - Matching HomeScreen card style */}
            <View style={[styles.card, styles.qrCard]}>
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                style={styles.qrCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {qrData ? (
                  <>
                    <Text style={styles.qrInstruction}>SCAN THIS CODE TO RECEIVE COUPONS</Text>
                    <View style={styles.qrCodeWrapper}>
                      <QRCode
                        value={qrData}
                        size={width * 0.5}
                        color={PRIMARY_BLUE}
                        backgroundColor={WHITE}
                        logoBackgroundColor="transparent"
                      />
                    </View>
                    <View style={styles.userInfoContainer}>
                      <Ionicons name="person-circle-outline" size={20} color="rgba(255, 255, 255, 0.7)" />
                      <Text style={styles.userInfo}>{userData.name} • {formatDisplayPhone(userData.phoneNumber)}</Text>
                    </View>
                    <Text style={styles.qrHint}>Hold this code to the scanner</Text>
                    
                    {/* Auto-navigation info */}
                    <View style={styles.autoNavigateInfo}>
                      <Ionicons name="flash-outline" size={16} color={SUCCESS_GREEN} />
                      <Text style={styles.autoNavigateText}>
                        Auto-navigates to Home when you receive money
                      </Text>
                    </View>
                    
                    {/* Edit Button */}
                    <TouchableOpacity 
                      style={styles.editButton}
                      onPress={handleRegistration}
                    >
                      <LinearGradient
                        colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                        style={styles.editButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name="create-outline" size={16} color={WHITE} />
                        <Text style={styles.editButtonText}>Edit Profile</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.noQRContainer}>
                      <Ionicons name="qr-code-outline" size={64} color="rgba(255, 255, 255, 0.5)" />
                      <Text style={styles.noCodeText}>No QR Code Generated</Text>
                      <Text style={styles.noCodeSubtext}>Set up your profile to generate a QR code</Text>
                      
                      {/* Generate Button */}
                      <TouchableOpacity 
                        style={styles.generateButton}
                        onPress={handleRegistration}
                      >
                        <LinearGradient
                          colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                          style={styles.generateButtonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name="add-circle-outline" size={20} color={WHITE} />
                          <Text style={styles.generateButtonText}>SET UP PROFILE</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </LinearGradient>
            </View>

            {/* Balance Card - Matching HomeScreen card style */}
            <Text style={styles.sectionTitle}>Coupon Balance</Text>
            <View style={[styles.card, styles.balanceCard]}>
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                style={styles.balanceCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.balanceHeader}>
                  <Ionicons name="wallet-outline" size={20} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.balanceLabel}>Available Balance</Text>
                </View>
                <View style={styles.balanceAmountContainer}>
                  <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
                  <Text style={styles.balanceCurrency}>USD</Text>
                </View>
                <View style={styles.balanceFooter}>
                  <Text style={styles.balanceFooterText}>Coupon balance available for receiving</Text>
                  {processingReceivedTransaction && (
                    <View style={styles.refreshIndicator}>
                      <ActivityIndicator size="small" color={WHITE} />
                      <Text style={styles.refreshIndicatorText}>Updating...</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </View>

            {/* Recent Transactions Card */}
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <View style={[styles.card, styles.transactionsCard]}>
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                style={styles.transactionsCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.transactionsHeader}>
                  <Text style={styles.transactionsTitle}>Recent Activity</Text>
                  {transactionsLoading && (
                    <ActivityIndicator size="small" color={WHITE} />
                  )}
                </View>
                
                {recentTransactions.length > 0 ? (
                  <>
                    {recentTransactions.map((transaction) => (
                      <TransactionItem 
                        key={transaction.id} 
                        transaction={transaction} 
                        userId={userId} 
                      />
                    ))}
                    {recentTransactions.length >= 5 && (
                      <TouchableOpacity 
                        style={styles.viewAllButton}
                        onPress={() => navigation.navigate('TransactionHistory')}
                      >
                        <Text style={styles.viewAllText}>View All Transactions</Text>
                        <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.7)" />
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <View style={styles.noTransactions}>
                    <Ionicons name="receipt-outline" size={40} color="rgba(255, 255, 255, 0.5)" />
                    <Text style={styles.noTransactionsText}>No transactions yet</Text>
                    <Text style={styles.noTransactionsSubtext}>
                      Your transaction history will appear here
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('MyChangeX')}
              >
                <LinearGradient
                  colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                  style={styles.actionButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="send-outline" size={24} color={WHITE} />
                  <Text style={styles.actionButtonText}>SEND COUPONS</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('Home')}
              >
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                  style={styles.secondaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="home-outline" size={20} color={WHITE} />
                  <Text style={styles.secondaryButtonText}>GO TO HOME</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Footer Spacer */}
            <View style={styles.footerSpacer} />
          </ScrollView>

          {/* Registration Modal - Updated styling */}
          <Modal
            visible={showRegistrationModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowRegistrationModal(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.modalBackdrop} onPress={() => setShowRegistrationModal(false)} />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Update Your Profile</Text>
                  <TouchableOpacity onPress={() => setShowRegistrationModal(false)}>
                    <Ionicons name="close" size={24} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  placeholderTextColor="#999"
                  value={userData.name}
                  onChangeText={(text) => setUserData({...userData, name: text})}
                  autoCapitalize="words"
                  maxLength={50}
                />
                
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 0771234567"
                  placeholderTextColor="#999"
                  value={userData.phoneNumber}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
                
                <Text style={styles.inputHint}>
                  Enter your Zimbabwean mobile number
                </Text>
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={styles.modalButtonCancel}
                    onPress={() => setShowRegistrationModal(false)}
                    disabled={profileLoading}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalButtonConfirm, profileLoading && styles.disabledButton]}
                    onPress={handleGenerateCode}
                    disabled={profileLoading}
                  >
                    {profileLoading ? (
                      <ActivityIndicator color={WHITE} size="small" />
                    ) : (
                      <Text style={styles.modalButtonTextConfirm}>Save Profile</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Custom Message Modal */}
          <MessageModal
            visible={messageModal.visible}
            title={messageModal.title}
            message={messageModal.message}
            type={messageModal.type}
            onClose={() => setMessageModal({ ...messageModal, visible: false })}
          />
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: PRIMARY_BLUE,
  },
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: WHITE,
    fontSize: 16,
    marginTop: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: WHITE,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 32,
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 200,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  loginButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  refreshButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  qrCard: {},
  qrCardGradient: {
    padding: 24,
    alignItems: 'center',
  },
  qrInstruction: {
    fontSize: 14,
    fontWeight: '600',
    color: WHITE,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: WHITE,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  userInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
    textAlign: 'center',
  },
  qrHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
    textAlign: 'center',
  },
  autoNavigateInfo: {
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 83, 0.2)',
  },
  autoNavigateText: {
    fontSize: 12,
    color: SUCCESS_GREEN,
    fontWeight: '500',
    textAlign: 'center',
  },
  editButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  editButtonGradient: {
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  noQRContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noCodeText: {
    fontSize: 20,
    fontWeight: '700',
    color: WHITE,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noCodeSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  generateButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  generateButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  balanceCard: {},
  balanceCardGradient: {
    padding: 24,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  balanceAmount: {
    color: WHITE,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginRight: 8,
  },
  balanceCurrency: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontWeight: '500',
  },
  balanceFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  balanceFooterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  refreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  refreshIndicatorText: {
    color: WHITE,
    fontSize: 12,
    opacity: 0.8,
  },
  transactionsCard: {},
  transactionsCardGradient: {
    padding: 20,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: WHITE,
    marginBottom: 2,
  },
  transactionCounterparty: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountSent: {
    color: ERROR_RED,
  },
  amountReceived: {
    color: SUCCESS_GREEN,
  },
  viewAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  viewAllText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  noTransactions: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  noTransactionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
    marginTop: 12,
    marginBottom: 4,
  },
  noTransactionsSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  actionButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  secondaryButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  footerSpacer: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY_BLUE,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: -8,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: PRIMARY_BLUE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  messageModalContent: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    alignSelf: 'center',
  },
  messageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  messageModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: WHITE,
  },
  messageModalMessage: {
    fontSize: 16,
    color: WHITE,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageModalButton: {
    backgroundColor: WHITE,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  messageModalButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReceiveScreen;