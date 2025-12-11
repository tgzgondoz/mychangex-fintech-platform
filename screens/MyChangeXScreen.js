import React, { useState, useLayoutEffect, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  SafeAreaView,
  Modal,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import { 
  supabase, 
  formatZimbabwePhone, 
  getUserSession, 
  getUserProfileByPhone,
  transferFunds
} from './supabase';
import { NotificationService } from '../screens/services/notificationService';

// Reusable custom modal for displaying messages
const MessageModal = ({ visible, title, message, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
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

const MyChangeXScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  // --- State Hooks ---
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientId, setRecipientId] = useState(null);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [showPhoneFormModal, setShowPhoneFormModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [userId, setUserId] = useState(null);
  const [userPhone, setUserPhone] = useState('');
  const [sendBackMode, setSendBackMode] = useState(false);
  const [originalReceivedAmount, setOriginalReceivedAmount] = useState(null);

  // Custom modal state
  const [messageModal, setMessageModal] = useState({
    visible: false,
    title: '',
    message: '',
  });

  // --- References & Permissions ---
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const isScanning = useRef(false);
  const autoNavigateTimeoutRef = useRef(null);

  // --- Component Lifecycle & Side Effects ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    fetchUserData();
    
    // Check if we're in send-back mode from CouponTransactions
    if (route.params?.sendBackMode && route.params?.sendBackData) {
      const { recipientId, recipientPhone, recipientName, presetAmount, receivedAmount } = route.params.sendBackData;
      
      setSendBackMode(true);
      setRecipientId(recipientId);
      setPhoneNumber(recipientPhone);
      setRecipientName(recipientName);
      setAmount(presetAmount || '');
      setOriginalReceivedAmount(receivedAmount || null);
      
      // Verify the recipient exists
      verifyRecipient(recipientPhone, recipientId);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (autoNavigateTimeoutRef.current) {
        clearTimeout(autoNavigateTimeoutRef.current);
      }
    };
  }, [route.params]);

  // Helper function to verify recipient
  const verifyRecipient = async (phone, id) => {
    try {
      const formattedPhone = formatZimbabwePhone(phone);
      
      const { data: recipientData, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('phone', formattedPhone)
        .eq('id', id)
        .single();

      if (error) {
        setMessageModal({
          visible: true,
          title: 'Error',
          message: 'Recipient not found. Please select recipient again.',
        });
        setSendBackMode(false);
        setPhoneNumber('');
        setRecipientName('');
        setRecipientId(null);
        setAmount('');
        setOriginalReceivedAmount(null);
        return;
      }

      setRecipientName(recipientData.full_name || 'User');
      
    } catch (error) {
      // If verification fails, keep the data but show warning
    }
  };

  // REAL-TIME BALANCE SUBSCRIPTION FOR MyChangeXScreen
  useEffect(() => {
    if (!userId) return;

    // Subscribe to balance changes for this user
    const balanceSubscription = supabase
      .channel('mychangex_balance_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          // Update local balance immediately
          setUserBalance(payload.new.balance);
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      balanceSubscription.unsubscribe();
    };
  }, [userId]);

  // --- Data Fetching ---
  const fetchUserData = async () => {
    try {
      // Get user from session (PIN-based auth)
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        setMessageModal({
          visible: true,
          title: 'Error',
          message: 'Please login again.',
        });
        navigation.navigate('Login');
        return;
      }

      const user = sessionResult.user;
      setUserId(user.id);
      setUserPhone(user.phone || '');

      // Get user profile with balance
      const { data: profileData, error } = await getUserProfileByPhone(user.phone);
      
      if (error) {
        // Use session data as fallback
        setUserBalance(user.balance || 0);
      } else {
        setUserBalance(profileData.balance || 0);
      }

    } catch (error) {
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'Failed to load user data.',
      });
    }
  };

  // --- Balance Validation Functions ---
  
  const exceedsBalance = () => {
    const sendAmount = parseFloat(amount) || 0;
    return sendAmount > userBalance;
  };

  const isValidAmount = () => {
    const sendAmount = parseFloat(amount) || 0;
    return sendAmount > 0 && sendAmount <= userBalance;
  };

  const isWithinChangeLimit = () => {
    const sendAmount = parseFloat(amount) || 0;
    return sendAmount < 1.00;
  };

  const isSendEnabled = () => {
    return phoneNumber && isValidAmount() && isWithinChangeLimit() && !loading;
  };

  const getBalanceStatus = () => {
    const sendAmount = parseFloat(amount) || 0;
    
    if (sendAmount === 0) return null;
    
    if (sendAmount > userBalance) {
      const shortage = sendAmount - userBalance;
      return {
        type: 'error',
        message: `Insufficient balance. You need $${shortage.toFixed(2)} more.`,
        color: '#FF6B6B'
      };
    } else if (sendAmount >= 1.00) {
      return {
        type: 'error',
        message: 'Change coupons must be less than $1.00.',
        color: '#FF6B6B'
      };
    } else {
      const remaining = userBalance - sendAmount;
      return {
        type: 'success', 
        message: `Remaining balance: $${remaining.toFixed(2)}`,
        color: '#4CAF50'
      };
    }
  };

  const getSendButtonText = () => {
    if (!amount || parseFloat(amount) <= 0) {
      return 'Enter Amount';
    } else if (exceedsBalance()) {
      return 'Insufficient Balance';
    } else if (!isWithinChangeLimit()) {
      return 'Max $0.99 for Change';
    } else if (loading) {
      return 'Processing...';
    } else {
      return sendBackMode ? `Send Back $${amount}` : `Send $${amount}`;
    }
  };

  const getSendButtonColors = () => {
    if (!isSendEnabled()) {
      return ['#CCCCCC', '#BBBBBB'];
    } else {
      return ['#4CAF50', '#45a049'];
    }
  };

  // Handle amount input change with validation
  const handleAmountChange = (text) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return;
    }
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    setAmount(cleaned);
  };

  // --- User Interaction Handlers ---

  const requestCameraAccess = async () => {
    try {
      await requestPermission();
    } catch (error) {
      setCameraError(`Failed to request camera permissions: ${error.message}`);
    }
  };

  const handleSendCoupon = () => {
    // If in send-back mode, show different modal
    if (sendBackMode) {
      Alert.alert(
        'Change Recipient',
        'You are currently in "Send Back" mode. Do you want to change the recipient?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Change Recipient', 
            onPress: () => {
              // Reset to regular mode
              setSendBackMode(false);
              setPhoneNumber('');
              setRecipientName('');
              setRecipientId(null);
              setAmount('');
              setOriginalReceivedAmount(null);
              setShowRecipientModal(true);
            }
          }
        ]
      );
    } else {
      setShowRecipientModal(true);
    }
  };

  const handleScanQR = async () => {
    setShowRecipientModal(false);

    if (!permission?.granted) {
      await requestCameraAccess();

      if (!permission?.granted) {
        setMessageModal({
          visible: true,
          title: 'Permission Required',
          message: 'Camera permission is required to scan QR codes. Please enable it in your device settings.',
        });
        return;
      }
    }

    isScanning.current = false;
    setShowCamera(true);
  };

  const handlePhoneOption = () => {
    setShowRecipientModal(false);
    setShowPhoneFormModal(true);
  };

  const handlePhoneFormSubmit = async () => {
    if (!phoneNumber.trim()) {
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'Please enter a phone number.',
      });
      return;
    }

    const formattedPhone = formatZimbabwePhone(phoneNumber);

    // Check for self-transfer
    if (formattedPhone === userPhone) {
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'You cannot send money to yourself.',
      });
      return;
    }

    try {
      // Verify recipient exists
      const { data: recipientData, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, balance')
        .eq('phone', formattedPhone)
        .single();

      if (error) {
        setMessageModal({
          visible: true,
          title: 'Error',
          message: 'Recipient not found in the system.',
        });
        return;
      }

      setRecipientName(recipientData.full_name || 'User');
      setRecipientId(recipientData.id);
      setShowPhoneFormModal(false);
      setSendBackMode(false); // Exit send-back mode if user manually selects recipient
      setOriginalReceivedAmount(null);

      setMessageModal({
        visible: true,
        title: 'Recipient Found',
        message: `Recipient: ${recipientData.full_name || 'User'} (${phoneNumber}). You can now enter the amount and send.`,
      });

    } catch (error) {
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'Failed to verify recipient. Please try again.',
      });
    }
  };

  const handleBarCodeScanned = useCallback(async ({ type, data }) => {
    if (isScanning.current) return;

    isScanning.current = true;

    try {
      const parsedData = JSON.parse(data);

      if (parsedData.type === 'coupon' && parsedData.phone) {
        const scannedPhone = parsedData.phone;
        const formattedPhone = formatZimbabwePhone(scannedPhone);

        if (formattedPhone === userPhone) {
          setMessageModal({
            visible: true,
            title: 'Error',
            message: 'You cannot send money to yourself.',
          });
          setShowCamera(false);
          isScanning.current = false;
          return;
        }

        const { data: recipientData, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone, balance')
          .eq('phone', formattedPhone)
          .single();

        if (error) {
          setMessageModal({
            visible: true,
            title: 'Error',
            message: 'Recipient not found in the system.',
          });
          setShowCamera(false);
          isScanning.current = false;
          return;
        }

        setPhoneNumber(scannedPhone);
        setRecipientName(recipientData.full_name || 'User');
        setRecipientId(recipientData.id);
        setShowCamera(false);
        setSendBackMode(false); // Exit send-back mode
        setOriginalReceivedAmount(null);

        setMessageModal({
          visible: true,
          title: 'QR Scanned',
          message: `Coupon scanned for ${recipientData.full_name || 'User'} (${scannedPhone}). You can now enter the amount and send.`,
        });

      } else {
        setShowCamera(false);
        setMessageModal({
          visible: true,
          title: 'Invalid QR Code',
          message: 'This is not a valid coupon QR code. Please try again or enter the number manually.',
        });
      }
    } catch (error) {
      const phoneRegex = /(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/;
      const phoneMatch = data.match(phoneRegex);

      if (phoneMatch) {
        const formattedPhone = formatZimbabwePhone(phoneMatch[0]);

        if (formattedPhone === userPhone) {
          setMessageModal({
            visible: true,
            title: 'Error',
            message: 'You cannot send money to yourself.',
          });
          setShowCamera(false);
          isScanning.current = false;
          return;
        }

        const { data: recipientData, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone, balance')
          .eq('phone', formattedPhone)
          .single();

        if (error) {
          setMessageModal({
            visible: true,
            title: 'Error',
            message: 'Recipient not found in the system.',
          });
          setShowCamera(false);
          isScanning.current = false;
          return;
        }

        setPhoneNumber(phoneMatch[0]);
        setRecipientName(recipientData.full_name || 'User');
        setRecipientId(recipientData.id);
        setShowCamera(false);
        setSendBackMode(false); // Exit send-back mode
        setOriginalReceivedAmount(null);
        setMessageModal({
          visible: true,
          title: 'QR Scanned',
          message: `Detected phone number: ${phoneMatch[0]}. You can now enter the amount and send.`,
        });
      } else {
        setShowCamera(false);
        setMessageModal({
          visible: true,
          title: 'Invalid QR Code',
          message: 'The scanned code is not a valid phone number or coupon.',
        });
      }
    } finally {
      isScanning.current = false;
    }
  }, [userPhone]);

  // Simplified coupon restriction logic
  const checkCouponRestriction = async () => {
    try {
      // If user is sending back to someone who sent them a coupon, allow it
      const { data: receivedCoupons } = await supabase
        .from('transactions')
        .select('*')
        .eq('sender_id', recipientId)
        .eq('receiver_id', userId)
        .lt('amount', 1.00)
        .limit(1);

      // If user received a coupon from this recipient, allow send-back
      if (receivedCoupons && receivedCoupons.length > 0) {
        return { isValid: true, isSendBack: true };
      }

      // For first-time sends, always allow (since amount is already validated to be < $1.00)
      return { isValid: true, isSendBack: false };

    } catch (error) {
      // If we can't check restrictions, allow the transaction
      return { isValid: true, isSendBack: false };
    }
  };

  // Handle the "Send" button press
  const handleSend = async () => {
    // --- Input Validation ---
    if (!phoneNumber) {
      setMessageModal({ visible: true, title: 'Error', message: 'Please enter or scan a recipient phone number.' });
      return;
    }
    
    const sendAmount = parseFloat(amount);
    if (!amount || sendAmount <= 0) {
      setMessageModal({ visible: true, title: 'Error', message: 'Please enter a valid amount.' });
      return;
    }
    
    // --- CHANGE COUPON LIMIT VALIDATION ---
    if (sendAmount >= 1.00) {
      setMessageModal({ 
        visible: true, 
        title: 'Change Coupon Limit', 
        message: 'Change coupons must be less than $1.00. Please enter an amount between $0.01 and $0.99.' 
      });
      return;
    }
    
    // --- BALANCE VALIDATION ---
    if (exceedsBalance()) {
      setMessageModal({ 
        visible: true, 
        title: 'Insufficient Balance', 
        message: `You cannot send $${sendAmount.toFixed(2)}. Your balance is only $${userBalance.toFixed(2)}.` 
      });
      return;
    }

    const formattedRecipientPhone = formatZimbabwePhone(phoneNumber);
    if (formattedRecipientPhone === userPhone) {
      setMessageModal({ visible: true, title: 'Error', message: 'You cannot send money to yourself.' });
      return;
    }

    if (!recipientId) {
      setMessageModal({ visible: true, title: 'Error', message: 'Recipient not properly identified. Please reselect recipient.' });
      return;
    }

    // --- SIMPLIFIED COUPON RESTRICTION CHECK ---
    const restrictionCheck = await checkCouponRestriction();
    
    // If in send-back mode but restriction check says it's not a valid send-back
    if (sendBackMode && !restrictionCheck.isSendBack) {
      setMessageModal({
        visible: true,
        title: 'Coupon Restriction',
        message: 'This appears to not be a valid send-back transaction. Please verify you received a coupon from this user first.',
      });
      return;
    }
    
    if (!restrictionCheck.isValid) {
      setMessageModal({
        visible: true,
        title: 'Coupon Restriction',
        message: 'You can only send coupons to users who have sent you coupons first.',
      });
      return;
    }

    setLoading(true);

    try {
      // OPTIMISTIC UPDATE: Update UI immediately for better UX
      const oldBalance = userBalance;
      const newBalance = oldBalance - sendAmount;
      setUserBalance(newBalance);

      // Try RPC method
      let transactionResult = await transferFunds(userId, recipientId, sendAmount);

      // If RPC fails, use manual method
      if (!transactionResult.success) {
        // Create transaction record
        const { data: transaction, error: transactionError } = await supabase
          .from('transactions')
          .insert({
            sender_id: userId,
            receiver_id: recipientId,
            amount: sendAmount,
            status: 'completed',
            type: 'coupon_transfer',
            notes: sendBackMode || restrictionCheck.isSendBack ? 
              `Coupon sent back: ${sendAmount.toFixed(2)} of ${originalReceivedAmount ? originalReceivedAmount.toFixed(2) : 'original'} sent back to original sender` 
              : 'First-time coupon transaction'
          })
          .select()
          .single();
          
        if (transactionError) {
          throw new Error(`Transaction creation failed: ${transactionError.message}`);
        }
        
        // Update sender balance
        const { error: senderError } = await supabase
          .from('profiles')
          .update({ 
            balance: oldBalance - sendAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
          
        if (senderError) {
          throw new Error(`Sender update failed: ${senderError.message}`);
        }
        
        // Update receiver balance
        const { data: receiverProfile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', recipientId)
          .single();
          
        if (receiverProfile) {
          const { error: receiverError } = await supabase
            .from('profiles')
            .update({ 
              balance: receiverProfile.balance + sendAmount,
              updated_at: new Date().toISOString()
            })
            .eq('id', recipientId);
            
          if (receiverError) {
            throw new Error(`Receiver update failed: ${receiverError.message}`);
          }
        }
        
        transactionResult = {
          success: true,
          transaction: transaction,
          message: 'Manual transfer successful'
        };
      }

      if (!transactionResult.success) {
        // REVERT optimistic update if transaction fails
        setUserBalance(oldBalance);
        throw new Error(transactionResult.error || 'Transaction failed');
      }

      // ✅ PUSH NOTIFICATION: Send local notification to sender
      const notificationTitle = sendBackMode || restrictionCheck.isSendBack 
        ? 'Coupon Sent Back! 🔄' 
        : 'Change Coupon Sent! 🎉';
      const notificationMessage = sendBackMode || restrictionCheck.isSendBack
        ? `You sent back $${sendAmount.toFixed(2)} to ${recipientName || phoneNumber}`
        : `You sent $${sendAmount.toFixed(2)} to ${recipientName || phoneNumber}`;

      await NotificationService.scheduleTransactionNotification(
        notificationTitle,
        notificationMessage,
        { 
          type: 'coupon_sent',
          amount: sendAmount,
          recipient: recipientName || phoneNumber,
          transaction_id: transactionResult.transaction?.id,
          is_send_back: sendBackMode || restrictionCheck.isSendBack,
          screen: 'CouponTransactions'
        }
      );

      // Show success message with auto-navigation info
      const successMessage = sendBackMode || restrictionCheck.isSendBack
        ? `✅ Successfully sent back $${sendAmount.toFixed(2)} coupon to ${recipientName || phoneNumber}.\n\nYour new balance is $${newBalance.toFixed(2)}.\n\nRedirecting to Home in 3 seconds...`
        : `✅ Successfully sent $${sendAmount.toFixed(2)} change coupon to ${recipientName || phoneNumber}.\n\nYour new balance is $${newBalance.toFixed(2)}.\n\nRedirecting to Home in 3 seconds...`;

      setMessageModal({
        visible: true,
        title: sendBackMode || restrictionCheck.isSendBack ? 'Coupon Sent Back! 🔄' : 'Change Coupon Sent! 🎉',
        message: successMessage,
      });

      // Reset form fields after a short delay
      setTimeout(() => {
        setAmount('');
        setPhoneNumber('');
        setRecipientName('');
        setRecipientId(null);
        setSendBackMode(false);
        setOriginalReceivedAmount(null);
      }, 500);

      // ✅ AUTOMATICALLY NAVIGATE TO HOME SCREEN AFTER 3 SECONDS
      // Clear any existing timeout
      if (autoNavigateTimeoutRef.current) {
        clearTimeout(autoNavigateTimeoutRef.current);
      }
      
      // Set new timeout for auto-navigation
      autoNavigateTimeoutRef.current = setTimeout(() => {
        navigation.navigate('Home');
      }, 3000);

    } catch (error) {
      // REVERT optimistic update on error
      setUserBalance(oldBalance);
      
      let errorMessage = error.message || 'Failed to complete transaction. Please try again.';
      
      // User-friendly error messages
      if (error.message.includes('Insufficient funds') || error.message.includes('balance')) {
        errorMessage = 'Insufficient balance for this transaction.';
      } else if (error.message.includes('not found')) {
        errorMessage = 'Recipient account not found. Please check the phone number.';
      } else if (error.message.includes('network') || error.message.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      }

      setMessageModal({
        visible: true,
        title: 'Transaction Failed',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Get balance status for display
  const balanceStatus = getBalanceStatus();

  // Handle modal close with additional logic
  const handleMessageModalClose = () => {
    setMessageModal({ ...messageModal, visible: false });
    
    // Clear auto-navigation timeout if modal is closed early
    if (autoNavigateTimeoutRef.current) {
      clearTimeout(autoNavigateTimeoutRef.current);
    }
  };

  return (
    <LinearGradient
      colors={['#0136c0', '#0136c0']}
      style={styles.background}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>
            {/* Header */}
            <Text style={styles.header}>
              {sendBackMode ? 'Send Back Coupon' : 'Send Change Coupon'}
            </Text>
            
            {/* Change Coupon Info */}
            <View style={styles.infoContainer}>
              {sendBackMode ? (
                <>
                  <Text style={styles.infoText}>
                    🔄 Sending back coupon to original sender
                  </Text>
                  <Text style={[styles.infoText, { fontSize: 12, marginTop: 8 }]}>
                    You can edit the amount to send back any portion of your received coupon
                  </Text>
                  {originalReceivedAmount && (
                    <Text style={[styles.infoText, { fontSize: 12, marginTop: 4, color: '#FFA726' }]}>
                      Original received amount: ${originalReceivedAmount.toFixed(2)}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.infoText}>
                    💡 Send small change amounts (less than $1.00) to other MyChangeX users
                  </Text>
                  <Text style={[styles.infoText, { fontSize: 12, marginTop: 8 }]}>
                    🔄 Received coupons can be sent back to the original sender
                  </Text>
                </>
              )}
            </View>

            {/* Balance Display */}
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <Text style={styles.balanceAmount}>${userBalance.toFixed(2)}</Text>
            </View>

            {/* Recipient Info Display */}
            {phoneNumber ? (
              <View style={styles.recipientContainer}>
                <Text style={styles.recipientLabel}>
                  {sendBackMode ? 'Sending Back To' : 'Recipient'}
                </Text>
                <Text style={styles.recipientInfo}>
                  {recipientName || 'User'} ({phoneNumber})
                </Text>
                {sendBackMode ? (
                  <Text style={styles.sendBackNotice}>
                    💡 This is a "Send Back" transaction. You can edit the amount.
                  </Text>
                ) : (
                  <Pressable 
                    style={styles.changeRecipientButton}
                    onPress={() => {
                      setPhoneNumber('');
                      setRecipientName('');
                      setRecipientId(null);
                      setShowRecipientModal(true);
                    }}
                  >
                    <Text style={styles.changeRecipientText}>Change Recipient</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {/* Amount Input */}
            <View style={styles.amountContainer}>
              <Text style={styles.label}>
                {sendBackMode ? 'Amount to Send Back (editable)' : 'Enter Change Amount (max $0.99)'}
              </Text>
              <View style={[
                styles.amountInputContainer,
                (exceedsBalance() || !isWithinChangeLimit()) && styles.amountInputContainerError
              ]}>
                <Text style={[
                  styles.currencySymbol,
                  (exceedsBalance() || !isWithinChangeLimit()) && styles.currencySymbolError
                ]}>$</Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    (exceedsBalance() || !isWithinChangeLimit()) && styles.amountInputError
                  ]}
                  placeholder={sendBackMode && originalReceivedAmount ? originalReceivedAmount.toFixed(2) : "0.00"}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="decimal-pad"
                  selectionColor="#ffffff"
                  returnKeyType="done"
                  maxLength={4}
                  editable={true} // Always editable, even in send-back mode
                />
              </View>
              
              {/* Balance Status Message */}
              {balanceStatus && (
                <Text style={[styles.balanceStatus, { color: balanceStatus.color }]}>
                  {balanceStatus.message}
                </Text>
              )}
              
              {/* Original amount suggestion for send-back mode */}
              {sendBackMode && originalReceivedAmount && !amount && (
                <Pressable 
                  onPress={() => setAmount(originalReceivedAmount.toFixed(2))}
                  style={styles.suggestionButton}
                >
                  <Text style={styles.suggestionText}>
                    Tap to use full amount: ${originalReceivedAmount.toFixed(2)}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Send Coupon Button - Only show if NOT in send-back mode or if no recipient selected */}
            {!sendBackMode && (
              <Pressable
                style={({ pressed }) => [
                  styles.scanButton,
                  pressed && styles.scanButtonPressed,
                  loading && styles.disabledButton,
                ]}
                onPress={handleSendCoupon}
                disabled={loading}
                android_ripple={{ color: 'rgba(1, 54, 192, 0.1)' }}
              >
                <LinearGradient
                  colors={['#ffffff', '#f8f9fa']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.scanButtonText}>
                    {phoneNumber ? 'Change Recipient' : 'Select Recipient'}
                  </Text>
                </LinearGradient>
              </Pressable>
            )}

            {/* Send Button */}
            {phoneNumber && (
              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  !isSendEnabled() && styles.sendButtonDisabled,
                  pressed && isSendEnabled() && styles.sendButtonPressed,
                ]}
                onPress={handleSend}
                disabled={!isSendEnabled()}
                android_ripple={isSendEnabled() ? { color: 'rgba(1, 54, 192, 0.1)' } : undefined}
              >
                <LinearGradient
                  colors={getSendButtonColors()}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={[
                      styles.sendButtonText,
                      !isSendEnabled() && styles.disabledButtonText
                    ]}>
                      {getSendButtonText()}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            )}

            {/* In send-back mode, show option to switch to regular mode */}
            {sendBackMode && (
              <Pressable
                style={styles.switchModeButton}
                onPress={() => {
                  setSendBackMode(false);
                  setPhoneNumber('');
                  setRecipientName('');
                  setRecipientId(null);
                  setAmount('');
                  setOriginalReceivedAmount(null);
                }}
              >
                <Text style={styles.switchModeButtonText}>Switch to Regular Send Mode</Text>
              </Pressable>
            )}

            {/* Coupon Rules Info */}
            <View style={styles.rulesContainer}>
              <Text style={styles.rulesTitle}>Coupon Rules:</Text>
              <Text style={styles.rulesText}>• Amount must be less than $1.00</Text>
              <Text style={styles.rulesText}>• First-time coupon to any user is allowed</Text>
              <Text style={styles.rulesText}>• Received coupons can be sent back to original sender</Text>
              <Text style={styles.rulesText}>• You can send back any portion of a received coupon</Text>
            </View>
          </View>
        </ScrollView>

        {/* Modal for Recipient Options - Only show if not in send-back mode */}
        {!sendBackMode && (
          <Modal
            visible={showRecipientModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowRecipientModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Add Recipient</Text>
                <Pressable style={styles.modalButton} onPress={handleScanQR}>
                  <Text style={styles.modalButtonText}>Scan QR Code</Text>
                </Pressable>
                <Pressable style={styles.modalButton} onPress={handlePhoneOption}>
                  <Text style={styles.modalButtonText}>Enter Phone Number</Text>
                </Pressable>
                <Pressable onPress={() => setShowRecipientModal(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}

        {/* Phone Form Modal */}
        <Modal
          visible={showPhoneFormModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPhoneFormModal(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.phoneFormModalContent}>
              <Text style={styles.modalTitle}>Enter Recipient Phone Number</Text>
              
              <TextInput
                style={styles.phoneFormInput}
                placeholder="Enter phone number"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                selectionColor="#ffffff"
                autoFocus={true}
              />
              
              <View style={styles.phoneFormButtons}>
                <Pressable 
                  style={styles.phoneFormCancelButton}
                  onPress={() => setShowPhoneFormModal(false)}
                >
                  <Text style={styles.phoneFormCancelText}>Cancel</Text>
                </Pressable>
                
                <Pressable 
                  style={[
                    styles.phoneFormSubmitButton,
                    !phoneNumber && styles.disabledButton
                  ]}
                  onPress={handlePhoneFormSubmit}
                  disabled={!phoneNumber}
                >
                  <Text style={styles.phoneFormSubmitText}>Submit</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Camera Modal for QR Scanning */}
        <Modal visible={showCamera} animationType="slide">
          <View style={styles.cameraContainer}>
            {permission?.granted ? (
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                onBarcodeScanned={isScanning.current ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onError={(error) => {
                  setCameraError(`Camera error: ${error.message}`);
                }}
              />
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {cameraError || 'Camera permission required. Please allow camera access.'}
                </Text>
                <Pressable
                  style={styles.permissionButton}
                  onPress={requestCameraAccess}
                >
                  <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </Pressable>
              </View>
            )}
            <Pressable
              style={styles.closeCameraButton}
              onPress={() => {
                setShowCamera(false);
                isScanning.current = false;
              }}
            >
              <Text style={styles.closeCameraText}>Close</Text>
            </Pressable>
          </View>
        </Modal>

        {/* Custom Message Modal */}
        <MessageModal
          visible={messageModal.visible}
          title={messageModal.title}
          message={messageModal.message}
          onClose={handleMessageModalClose}
        />

      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  infoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sendBackNotice: {
    color: '#4CAF50',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  rulesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  rulesTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  rulesText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginBottom: 6,
    paddingLeft: 10,
  },
  switchModeButton: {
    backgroundColor: 'rgba(255, 167, 38, 0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFA726',
  },
  switchModeButtonText: {
    color: '#FFA726',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionButton: {
    backgroundColor: 'rgba(255, 167, 38, 0.2)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FFA726',
  },
  suggestionText: {
    color: '#FFA726',
    fontSize: 14,
    fontWeight: '500',
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
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    letterSpacing: 0.5,
  },
  balanceContainer: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  recipientContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  recipientLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  recipientInfo: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  changeRecipientButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changeRecipientText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  amountContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    paddingBottom: 12,
  },
  amountInputContainerError: {
    borderBottomColor: '#FF6B6B',
  },
  currencySymbol: {
    fontSize: 28,
    color: '#ffffff',
    marginRight: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  currencySymbolError: {
    color: '#FF6B6B',
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    color: '#ffffff',
    paddingVertical: 0,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    includeFontPadding: false,
  },
  amountInputError: {
    color: '#FF6B6B',
  },
  balanceStatus: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  scanButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sendButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sendButtonDisabled: {
    opacity: 0.5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  scanButtonPressed: {
    opacity: 0.9,
  },
  sendButtonPressed: {
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    color: '#0136c0',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  disabledButtonText: {
    color: '#888888',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#0136c0',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  phoneFormModalContent: {
    backgroundColor: '#0136c0',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
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
    marginBottom: 10,
  },
  modalButtonText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCancel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 10,
  },
  phoneFormInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: '100%',
    marginBottom: 20,
  },
  phoneFormButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  phoneFormCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  phoneFormCancelText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  phoneFormSubmitButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  phoneFormSubmitText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  closeCameraButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 10,
  },
  closeCameraText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MyChangeXScreen;