import React, { useState, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
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
const LIGHT_TEXT = "#666666";
const DARK_TEXT = "#1A1A1A";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#eaeaea";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";
const BACKGROUND_COLOR = "#f8f9fa";

// Import your logo
const LOGO = require('../assets/logo.png');

// Message Modal Component
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
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          onPress={onClose}
          activeOpacity={1}
        />
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

  // Show loading state while checking authentication or fetching data
  if (loading || !authChecked) {
    return (
      <View style={styles.background}>
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_BLUE} />
            <Text style={styles.loadingText}>
              {!authChecked ? 'Checking authentication...' : 'Loading your profile...'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Show message if user is not authenticated (should be handled by navigation, but as fallback)
  if (!userId) {
    return (
      <View style={styles.background}>
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Authentication Required</Text>
            <Text style={styles.errorSubtext}>Please log in to access this feature</Text>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <View style={styles.loginButtonContent}>
                <Text style={styles.loginButtonText}>Go to Login</Text>
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
          <View style={styles.headerLeft}>
            <Ionicons name="qr-code-outline" size={28} color={PRIMARY_BLUE} />
            <Text style={styles.headerTitle}>Receive Coupons</Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={PRIMARY_BLUE} />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={DARK_TEXT} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
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
          showsVerticalScrollIndicator={false}
        >
          {/* Centered QR Code Card */}
          <View style={styles.centerContainer}>
            <View style={[styles.card, styles.qrCard]}>
              <View style={styles.qrContent}>
                {qrData ? (
                  <>
                    <Text style={styles.qrInstruction}>SCAN THIS CODE TO RECEIVE COUPONS</Text>
                    <View style={styles.qrCodeWrapper}>
                      <QRCode
                        value={qrData}
                        size={width * 0.7}  
                        color={PRIMARY_BLUE}
                        backgroundColor={WHITE}
                        logo={LOGO}
                        logoSize={40}
                        logoBackgroundColor={PRIMARY_BLUE}
                        logoBorderRadius={20}
                        logoMargin={2}
                      />
                      {/* Logo overlay at center of QR code */}
                      <View style={styles.qrLogoOverlay}>
                        <View style={styles.qrLogoContainer}>
                          <Image 
                            source={LOGO}
                            style={styles.qrLogo}
                            resizeMode="contain"
                          />
                        </View>
                      </View>
                    </View>
                    <Text style={styles.qrHint}>Hold this code to the scanner</Text>
                  </>
                ) : (
                  <>
                    <View style={styles.noQRContainer}>
                      <Ionicons name="qr-code-outline" size={64} color={LIGHT_TEXT} />
                      <Text style={styles.noCodeText}>No QR Code Generated</Text>
                      <Text style={styles.noCodeSubtext}>Set up your profile to generate a QR code</Text>
                      
                      {/* Generate Button */}
                      <TouchableOpacity 
                        style={styles.generateButton}
                        onPress={handleRegistration}
                      >
                        <View style={styles.generateButtonContent}>
                          <Ionicons name="add-circle-outline" size={20} color={WHITE} />
                          <Text style={styles.generateButtonText}>SET UP PROFILE</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* View Transactions Button - Centered below QR */}
            <TouchableOpacity 
              style={styles.viewTransactionsButton}
              onPress={() => navigation.navigate('TransactionHistory')}
            >
              <View style={styles.viewTransactionsButtonContent}>
                <Text style={styles.viewTransactionsButtonText}>View Transactions</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Spacer */}
          <View style={styles.footerSpacer} />
        </ScrollView>

        {/* Registration Modal */}
        <Modal
          visible={showRegistrationModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowRegistrationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              onPress={() => setShowRegistrationModal(false)}
              activeOpacity={1}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Update Your Profile</Text>
                <TouchableOpacity onPress={() => setShowRegistrationModal(false)}>
                  <Ionicons name="close" size={24} color={DARK_TEXT} />
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: BACKGROUND_COLOR,
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
    color: DARK_TEXT,
    fontSize: 16,
    marginTop: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: height * 0.1,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK_TEXT,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorSubtext: {
    fontSize: 16,
    color: LIGHT_TEXT,
    textAlign: 'center',
    marginBottom: 32,
  },
  loginButton: {
    borderRadius: 12,
    width: '100%',
    maxWidth: 200,
    backgroundColor: PRIMARY_BLUE,
  },
  loginButtonContent: {
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
    backgroundColor: BACKGROUND_COLOR,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: DARK_TEXT,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 10,
  },
  refreshButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
  },
  qrCard: {
    width: width * 0.85,
    maxWidth: 400,
    alignItems: 'center',
  },
  qrContent: {
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  qrInstruction: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 24,
    textAlign: 'center',
  },
  qrCodeWrapper: {
    position: 'relative',
    padding: 20,
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  qrLogoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrLogoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor:PRIMARY_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PRIMARY_BLUE,
  },
  qrLogo: {
    width: 30,
    height: 30,
  },
  qrHint: {
    fontSize: 14,
    color: LIGHT_TEXT,
    textAlign: 'center',
  },
  noQRContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  noCodeText: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK_TEXT,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noCodeSubtext: {
    fontSize: 14,
    color: LIGHT_TEXT,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  generateButton: {
    borderRadius: 12,
    width: '100%',
    maxWidth: 250,
    backgroundColor: PRIMARY_BLUE,
  },
  generateButtonContent: {
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
  viewTransactionsButton: {
    borderRadius: 12,
    marginTop: 24,
    width: width * 0.85,
    maxWidth: 400,
  },
  viewTransactionsButtonContent: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewTransactionsButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 16,
    fontWeight: '600',
  },
  footerSpacer: {
    height: 40,
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
    color: DARK_TEXT,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputHint: {
    fontSize: 12,
    color: LIGHT_TEXT,
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
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: PRIMARY_BLUE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: DARK_TEXT,
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