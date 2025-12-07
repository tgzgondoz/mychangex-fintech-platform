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
  Alert
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

const { width } = Dimensions.get('window');

// Reusable custom modal for displaying messages
const MessageModal = ({ visible, title, message, onClose, type = 'info' }) => {
  const getBackgroundColor = () => {
    switch (type) {
      case 'error': return '#FF6B6B';
      case 'success': return '#4CAF50';
      case 'warning': return '#FFA726';
      default: return '#0136c0';
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
        <View style={[styles.modalContent, { backgroundColor: getBackgroundColor() }]}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <Pressable style={styles.modalButton} onPress={onClose}>
            <Text style={styles.modalButtonText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

// Transaction Item Component
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

  // Setup notification listener for this screen
  useEffect(() => {
    if (!userId) return;
    
    console.log('🔔 Setting up notification listener for ReceiveScreen...');
    
    notificationSubscriptionRef.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 ReceiveScreen: Notification received:', notification);
      
      const { data } = notification.request.content;
      
      if (data.type === 'transaction_received') {
        console.log('💰 ReceiveScreen: Money received notification');
        
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
                  console.log('🏠 Navigating to Home from notification alert');
                  navigation.navigate('Home');
                  setHasShownAutoNavigateAlert(false);
                }
              },
              { 
                text: "Stay Here", 
                style: "cancel",
                onPress: () => {
                  console.log('✅ Staying on Receive screen');
                  setHasShownAutoNavigateAlert(false);
                  
                  // Still auto-navigate after longer delay
                  scheduleAutoNavigation(10000); // 10 seconds
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
    console.log(`⏳ Scheduling auto-navigation to Home in ${delay}ms...`);
    
    // Clear any existing timeout
    if (autoNavigateTimeoutRef.current) {
      clearTimeout(autoNavigateTimeoutRef.current);
    }
    
    // Set new timeout
    autoNavigateTimeoutRef.current = setTimeout(() => {
      console.log('🏠 Auto-navigating to Home from ReceiveScreen...');
      
      if (navigation.isFocused()) {
        navigation.navigate('Home');
      } else {
        console.log('⚠️ Not on Receive screen, skipping auto-navigation');
      }
    }, delay);
  }, [navigation]);

  const checkAuthentication = async () => {
    try {
      console.log('🔐 Checking authentication for Receive screen...');
      
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        console.error("❌ No authenticated user found");
        showMessage('Authentication Required', 'Please login to access this feature.', 'error');
        
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }, 2000);
        return;
      }

      console.log("✅ User authenticated:", sessionResult.user.id);
      setUserId(sessionResult.user.id);
      setUserPhone(sessionResult.user.phone || '');
      setAuthChecked(true);
      
      await fetchUserData(sessionResult.user.id);
      
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
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
      
      console.log('📱 Fetching user profile for:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, balance')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('❌ Error fetching profile:', error);
        
        if (error.code === 'PGRST116') {
          console.log('📝 Creating new profile for user...');
          await createUserProfile(userId);
          return;
        }
        
        throw error;
      }
      
      console.log('✅ Profile data loaded:', data);
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
      console.error('❌ Error fetching user data:', error);
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
    console.log('🔔 Setting up real-time subscriptions for user:', userId);
    
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
          console.log('🔄 Balance updated:', payload.new.balance);
          setBalance(payload.new.balance || 0);
          updateQRCodeBalance(payload.new.balance || 0);
          
          // Show notification for balance increase
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

    // Transactions subscription - UPDATED WITH AUTO-NAVIGATION
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
          console.log('💰 New incoming transaction:', payload.new);
          
          // Prevent multiple triggers
          if (processingReceivedTransaction) {
            console.log('⚠️ Already processing a received transaction, skipping...');
            return;
          }
          
          setProcessingReceivedTransaction(true);
          
          try {
            await loadRecentTransactions(userId);
            
            if (payload.new.amount > 0) {
              console.log('🎉 Showing money received alert with auto-navigation');
              
              // Show success message with auto-navigation option
              Alert.alert(
                "Money Received! 🎉", 
                `You received $${payload.new.amount.toFixed(2)}. Auto-navigating to Home in 5 seconds...`,
                [
                  { 
                    text: "Go to Home Now", 
                    onPress: () => {
                      console.log('🏠 Navigating to Home immediately');
                      navigation.navigate('Home');
                    }
                  },
                  { 
                    text: "Stay Here", 
                    style: "cancel",
                    onPress: () => {
                      console.log('✅ Staying on Receive screen');
                      // Still auto-navigate after longer delay
                      scheduleAutoNavigation(10000);
                    }
                  }
                ]
              );
              
              // Schedule auto-navigation after 5 seconds
              scheduleAutoNavigation(5000);
              
              // Send local notification
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
            // Reset the flag after a delay to prevent rapid triggers
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
        console.error('❌ Error updating QR code balance:', error);
      }
    }
  };

  // Load recent transactions
  const loadRecentTransactions = async (userId) => {
    try {
      setTransactionsLoading(true);
      console.log('📊 Loading recent transactions for user:', userId);
      
      const result = await getUserTransactions(userId, 5);
      
      if (result.success) {
        console.log(`✅ Loaded ${result.data?.length || 0} transactions`);
        setRecentTransactions(result.data || []);
      } else {
        console.log('❌ Error loading transactions:', result.error);
        setRecentTransactions([]);
      }
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
      setRecentTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Create user profile if it doesn't exist
  const createUserProfile = async (userId) => {
    try {
      console.log('👤 Creating new profile for user:', userId);
      
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
        console.error('❌ Profile creation error:', error);
        throw error;
      }

      console.log('✅ Created new profile:', data);
      setBalance(0);
      setUserData({
        name: 'User',
        phoneNumber: userPhone || ''
      });
      setIsUserLoaded(true);

    } catch (error) {
      console.error('❌ Error creating profile:', error);
      showMessage('Error', 'Failed to create user profile. Please try again.', 'error');
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

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
    console.log('📱 QR Code generated for:', name);
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
      console.log('🔄 Updating profile for user:', userId);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userData.name.trim(),
          phone: formattedPhone,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        console.error('❌ Supabase update error:', error);
        throw error;
      }
      
      generateQRCode(userData.name.trim(), formattedPhone, balance);
      setShowRegistrationModal(false);
      
      showMessage('Success', 'Profile updated successfully', 'success');
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
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
      
      console.log('🔄 Refreshing balance for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setBalance(data.balance || 0);
        console.log('✅ Balance refreshed:', data.balance);
      }
    } catch (error) {
      console.error('❌ Error refreshing balance:', error);
    }
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    if (!userId) return;
    
    console.log('👆 Manual refresh triggered');
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
    // Allow only numbers and common formatting characters
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
      <LinearGradient
        colors={['#0136c0', '#0136c0']}
        style={styles.background}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>
              {!authChecked ? 'Checking authentication...' : 'Loading your profile...'}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Show message if user is not authenticated (should be handled by navigation, but as fallback)
  if (!userId) {
    return (
      <LinearGradient
        colors={['#0136c0', '#0136c0']}
        style={styles.background}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Authentication Required</Text>
            <Text style={styles.errorSubtext}>Please log in to access this feature</Text>
            <Pressable 
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginButtonText}>Go to Login</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0136c0', '#0136c0']}
      style={styles.background}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ffffff"
              colors={['#ffffff']}
              title="Refreshing..."
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Receive Coupons</Text>
              <Pressable 
                style={styles.refreshButton}
                onPress={onRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                )}
              </Pressable>
            </View>
            
            {/* QR Code Card */}
            <View style={styles.card}>
              {qrData ? (
                <>
                  <Text style={styles.qrInstruction}>SCAN THIS CODE TO RECEIVE COUPONS</Text>
                  <View style={styles.qrCodeWrapper}>
                    <QRCode
                      value={qrData}
                      size={width * 0.6}
                      color="#0136c0"
                      backgroundColor="#ffffff"
                      logoBackgroundColor="transparent"
                    />
                  </View>
                  <Text style={styles.userInfo}>{userData.name} • {formatDisplayPhone(userData.phoneNumber)}</Text>
                  <Text style={styles.qrHint}>Hold this code to the scanner</Text>
                  
                  {/* Auto-navigation info */}
                  <View style={styles.autoNavigateInfo}>
                    <Text style={styles.autoNavigateText}>
                      💰 Auto-navigates to Home when you receive money
                    </Text>
                  </View>
                  
                  {/* Edit Button */}
                  <Pressable 
                    style={({ pressed }) => [
                      styles.editButton,
                      pressed && styles.editButtonPressed
                    ]}
                    onPress={handleRegistration}
                  >
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.noCodeText}>No QR Code Generated</Text>
                  <Text style={styles.noCodeSubtext}>Set up your profile to generate a QR code</Text>
                  
                  {/* Generate Button */}
                  <Pressable 
                    style={({ pressed }) => [
                      styles.generateButton,
                      pressed && styles.generateButtonPressed
                    ]}
                    onPress={handleRegistration}
                  >
                    <LinearGradient
                      colors={['#ffffff', '#f8f9fa']}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.generateButtonText}>SET UP PROFILE</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              )}
            </View>

            {/* Balance Display */}
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>YOUR COUPON BALANCE</Text>
              <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
              {processingReceivedTransaction && (
                <View style={styles.refreshIndicator}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.refreshIndicatorText}>Updating...</Text>
                </View>
              )}
            </View>

            {/* Recent Transactions */}
            <View style={styles.transactionsContainer}>
              <View style={styles.transactionsHeader}>
                <Text style={styles.transactionsTitle}>RECENT TRANSACTIONS</Text>
                {transactionsLoading && (
                  <ActivityIndicator size="small" color="#ffffff" />
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
                    <Pressable 
                      style={styles.viewAllButton}
                      onPress={() => navigation.navigate('TransactionHistory')}
                    >
                      <Text style={styles.viewAllText}>View All Transactions</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <View style={styles.noTransactions}>
                  <Text style={styles.noTransactionsText}>No transactions yet</Text>
                  <Text style={styles.noTransactionsSubtext}>
                    Your transaction history will appear here
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {/* Send Button */}
              <Pressable 
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && styles.sendButtonPressed
                ]}
                onPress={() => navigation.navigate('MyChangeX')}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.sendButtonText}>SEND COUPONS</Text>
                </LinearGradient>
              </Pressable>

              {/* Go to Home Button */}
              <Pressable 
                style={({ pressed }) => [
                  styles.homeButton,
                  pressed && styles.homeButtonPressed
                ]}
                onPress={() => navigation.navigate('Home')}
              >
                <Text style={styles.homeButtonText}>GO TO HOME</Text>
              </Pressable>

              {/* Transaction History Button */}
              <Pressable 
                style={({ pressed }) => [
                  styles.historyButton,
                  pressed && styles.historyButtonPressed
                ]}
                onPress={() => navigation.navigate('TransactionHistory')}
              >
                <Text style={styles.historyButtonText}>VIEW FULL HISTORY</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Registration Modal */}
        <Modal
          visible={showRegistrationModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowRegistrationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Your Profile</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={userData.name}
                onChangeText={(text) => setUserData({...userData, name: text})}
                autoCapitalize="words"
                maxLength={50}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Phone Number (e.g., 0771234567)"
                placeholderTextColor="#999"
                value={userData.phoneNumber}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={15}
              />
              
              <Text style={styles.phoneHint}>
                Enter your Zimbabwean mobile number
              </Text>
              
              <View style={styles.modalButtons}>
                <Pressable 
                  style={styles.modalButtonCancel}
                  onPress={() => setShowRegistrationModal(false)}
                  disabled={profileLoading}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </Pressable>
                
                <Pressable 
                  style={[styles.modalButtonConfirm, profileLoading && styles.disabledButton]}
                  onPress={handleGenerateCode}
                  disabled={profileLoading}
                >
                  {profileLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalButtonTextConfirm}>Save Profile</Text>
                  )}
                </Pressable>
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
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  phoneHint: {
    fontSize: 12,
    color: '#666',
    marginTop: -8,
    marginBottom: 16,
    textAlign: 'center',
  },
  noTransactions: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  background: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 32,
  },
  loginButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  qrInstruction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0136c0',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
  },
  userInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  qrHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  autoNavigateInfo: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  autoNavigateText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    textAlign: 'center',
  },
  editButton: {
    backgroundColor: 'rgba(1, 54, 192, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonPressed: {
    opacity: 0.8,
  },
  editButtonText: {
    color: '#0136c0',
    fontSize: 14,
    fontWeight: '600',
  },
  noCodeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  noCodeSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  generateButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  generateButtonPressed: {
    opacity: 0.9,
  },
  generateButtonText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  refreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  refreshIndicatorText: {
    color: '#ffffff',
    fontSize: 12,
    marginLeft: 8,
    opacity: 0.8,
  },
  transactionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  transactionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  transactionCounterparty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountSent: {
    color: '#FF6B6B',
  },
  amountReceived: {
    color: '#4CAF50',
  },
  viewAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noTransactionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  noTransactionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  noTransactionsSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  actionsContainer: {
    gap: 12,
  },
  sendButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  sendButtonPressed: {
    opacity: 0.9,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  homeButtonPressed: {
    opacity: 0.8,
  },
  homeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  historyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  historyButtonPressed: {
    opacity: 0.8,
  },
  historyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0136c0',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: '#0136c0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalMessage: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ReceiveScreen;