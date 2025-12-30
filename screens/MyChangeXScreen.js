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
  Dimensions,
  StatusBar,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { 
  supabase, 
  formatZimbabwePhone, 
  getUserSession, 
  getUserProfileByPhone,
  transferFunds
} from './supabase';
import { NotificationService } from '../screens/services/notificationService';

const { width, height } = Dimensions.get('window');

// Updated to match HomeScreen colors
const PRIMARY_BLUE = "#0136c0";
const ACCENT_BLUE = "#0136c0";
const LIGHT_BLUE = "#f5f8ff";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#666666";
const DARK_TEXT = "#1A1A1A";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#eaeaea";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";
const BACKGROUND_COLOR = "#f8f9fa";

// Reusable custom modal for displaying messages - Updated to match HomeScreen
const MessageModal = ({ visible, title, message, onClose, type = 'info' }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.messageModalContent}>
          <View style={styles.messageModalHeader}>
            <View style={styles.messageModalTitleContainer}>
              <Ionicons 
                name={type === 'success' ? "checkmark-circle" : type === 'error' ? "alert-circle" : "information-circle"} 
                size={24} 
                color={type === 'success' ? SUCCESS_GREEN : type === 'error' ? ERROR_RED : PRIMARY_BLUE} 
              />
              <Text style={styles.messageModalTitle}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={LIGHT_TEXT} />
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
    type: 'info'
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
    
    if (route.params?.sendBackMode && route.params?.sendBackData) {
      const { recipientId, recipientPhone, recipientName, presetAmount, receivedAmount } = route.params.sendBackData;
      
      setSendBackMode(true);
      setRecipientId(recipientId);
      setPhoneNumber(recipientPhone);
      setRecipientName(recipientName);
      setAmount(presetAmount || '');
      setOriginalReceivedAmount(receivedAmount || null);
      
      verifyRecipient(recipientPhone, recipientId);
    }
    
    return () => {
      if (autoNavigateTimeoutRef.current) {
        clearTimeout(autoNavigateTimeoutRef.current);
      }
    };
  }, [route.params]);

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
          type: 'error'
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

  // REAL-TIME BALANCE SUBSCRIPTION
  useEffect(() => {
    if (!userId) return;

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
          setUserBalance(payload.new.balance);
        }
      )
      .subscribe();

    return () => {
      balanceSubscription.unsubscribe();
    };
  }, [userId]);

  // --- Data Fetching ---
  const fetchUserData = async () => {
    try {
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        setMessageModal({
          visible: true,
          title: 'Error',
          message: 'Please login again.',
          type: 'error'
        });
        navigation.navigate('Login');
        return;
      }

      const user = sessionResult.user;
      setUserId(user.id);
      setUserPhone(user.phone || '');

      const { data: profileData, error } = await getUserProfileByPhone(user.phone);
      
      if (error) {
        setUserBalance(user.balance || 0);
      } else {
        setUserBalance(profileData.balance || 0);
      }

    } catch (error) {
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'Failed to load user data.',
        type: 'error'
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
        color: ERROR_RED
      };
    } else if (sendAmount >= 1.00) {
      return {
        type: 'error',
        message: 'Change coupons must be less than $1.00.',
        color: ERROR_RED
      };
    } else {
      const remaining = userBalance - sendAmount;
      return {
        type: 'success', 
        message: `Remaining balance: $${remaining.toFixed(2)}`,
        color: SUCCESS_GREEN
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
      return [LIGHT_BLUE, LIGHT_BLUE];
    } else {
      return [PRIMARY_BLUE, PRIMARY_BLUE];
    }
  };

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
    if (sendBackMode) {
      Alert.alert(
        'Change Recipient',
        'You are currently in "Send Back" mode. Do you want to change the recipient?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Change Recipient', 
            onPress: () => {
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
          type: 'error'
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
        type: 'error'
      });
      return;
    }

    const formattedPhone = formatZimbabwePhone(phoneNumber);

    if (formattedPhone === userPhone) {
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'You cannot send money to yourself.',
        type: 'error'
      });
      return;
    }

    try {
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
          type: 'error'
        });
        return;
      }

      setRecipientName(recipientData.full_name || 'User');
      setRecipientId(recipientData.id);
      setShowPhoneFormModal(false);
      setSendBackMode(false);
      setOriginalReceivedAmount(null);

      setMessageModal({
        visible: true,
        title: 'Recipient Found',
        message: `Recipient: ${recipientData.full_name || 'User'} (${phoneNumber}). You can now enter the amount and send.`,
        type: 'success'
      });

    } catch (error) {
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'Failed to verify recipient. Please try again.',
        type: 'error'
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
            type: 'error'
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
            type: 'error'
          });
          setShowCamera(false);
          isScanning.current = false;
          return;
        }

        setPhoneNumber(scannedPhone);
        setRecipientName(recipientData.full_name || 'User');
        setRecipientId(recipientData.id);
        setShowCamera(false);
        setSendBackMode(false);
        setOriginalReceivedAmount(null);

        setMessageModal({
          visible: true,
          title: 'QR Scanned',
          message: `Coupon scanned for ${recipientData.full_name || 'User'} (${scannedPhone}). You can now enter the amount and send.`,
          type: 'success'
        });

      } else {
        setShowCamera(false);
        setMessageModal({
          visible: true,
          title: 'Invalid QR Code',
          message: 'This is not a valid coupon QR code. Please try again or enter the number manually.',
          type: 'error'
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
            type: 'error'
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
            type: 'error'
          });
          setShowCamera(false);
          isScanning.current = false;
          return;
        }

        setPhoneNumber(phoneMatch[0]);
        setRecipientName(recipientData.full_name || 'User');
        setRecipientId(recipientData.id);
        setShowCamera(false);
        setSendBackMode(false);
        setOriginalReceivedAmount(null);
        setMessageModal({
          visible: true,
          title: 'QR Scanned',
          message: `Detected phone number: ${phoneMatch[0]}. You can now enter the amount and send.`,
          type: 'success'
        });
      } else {
        setShowCamera(false);
        setMessageModal({
          visible: true,
          title: 'Invalid QR Code',
          message: 'The scanned code is not a valid phone number or coupon.',
          type: 'error'
        });
      }
    } finally {
      isScanning.current = false;
    }
  }, [userPhone]);

  const checkCouponRestriction = async () => {
    try {
      const { data: receivedCoupons } = await supabase
        .from('transactions')
        .select('*')
        .eq('sender_id', recipientId)
        .eq('receiver_id', userId)
        .lt('amount', 1.00)
        .limit(1);

      if (receivedCoupons && receivedCoupons.length > 0) {
        return { isValid: true, isSendBack: true };
      }

      return { isValid: true, isSendBack: false };

    } catch (error) {
      return { isValid: true, isSendBack: false };
    }
  };

  const handleSend = async () => {
    if (!phoneNumber) {
      setMessageModal({ visible: true, title: 'Error', message: 'Please enter or scan a recipient phone number.', type: 'error' });
      return;
    }
    
    const sendAmount = parseFloat(amount);
    if (!amount || sendAmount <= 0) {
      setMessageModal({ visible: true, title: 'Error', message: 'Please enter a valid amount.', type: 'error' });
      return;
    }
    
    if (sendAmount >= 1.00) {
      setMessageModal({ 
        visible: true, 
        title: 'Change Coupon Limit', 
        message: 'Change coupons must be less than $1.00. Please enter an amount between $0.01 and $0.99.',
        type: 'error'
      });
      return;
    }
    
    if (exceedsBalance()) {
      setMessageModal({ 
        visible: true, 
        title: 'Insufficient Balance', 
        message: `You cannot send $${sendAmount.toFixed(2)}. Your balance is only $${userBalance.toFixed(2)}.`,
        type: 'error'
      });
      return;
    }

    const formattedRecipientPhone = formatZimbabwePhone(phoneNumber);
    if (formattedRecipientPhone === userPhone) {
      setMessageModal({ visible: true, title: 'Error', message: 'You cannot send money to yourself.', type: 'error' });
      return;
    }

    if (!recipientId) {
      setMessageModal({ visible: true, title: 'Error', message: 'Recipient not properly identified. Please reselect recipient.', type: 'error' });
      return;
    }

    const restrictionCheck = await checkCouponRestriction();
    
    if (sendBackMode && !restrictionCheck.isSendBack) {
      setMessageModal({
        visible: true,
        title: 'Coupon Restriction',
        message: 'This appears to not be a valid send-back transaction. Please verify you received a coupon from this user first.',
        type: 'error'
      });
      return;
    }
    
    if (!restrictionCheck.isValid) {
      setMessageModal({
        visible: true,
        title: 'Coupon Restriction',
        message: 'You can only send coupons to users who have sent you coupons first.',
        type: 'error'
      });
      return;
    }

    setLoading(true);

    try {
      const oldBalance = userBalance;
      const newBalance = oldBalance - sendAmount;
      setUserBalance(newBalance);

      let transactionResult = await transferFunds(userId, recipientId, sendAmount);

      if (!transactionResult.success) {
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
        setUserBalance(oldBalance);
        throw new Error(transactionResult.error || 'Transaction failed');
      }

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

      const successMessage = sendBackMode || restrictionCheck.isSendBack
        ? `✅ Successfully sent back $${sendAmount.toFixed(2)} coupon to ${recipientName || phoneNumber}.\n\nYour new balance is $${newBalance.toFixed(2)}.\n\nRedirecting to Home in 3 seconds...`
        : `✅ Successfully sent $${sendAmount.toFixed(2)} change coupon to ${recipientName || phoneNumber}.\n\nYour new balance is $${newBalance.toFixed(2)}.\n\nRedirecting to Home in 3 seconds...`;

      setMessageModal({
        visible: true,
        title: sendBackMode || restrictionCheck.isSendBack ? 'Coupon Sent Back! 🔄' : 'Change Coupon Sent! 🎉',
        message: successMessage,
        type: 'success'
      });

      setTimeout(() => {
        setAmount('');
        setPhoneNumber('');
        setRecipientName('');
        setRecipientId(null);
        setSendBackMode(false);
        setOriginalReceivedAmount(null);
      }, 500);

      if (autoNavigateTimeoutRef.current) {
        clearTimeout(autoNavigateTimeoutRef.current);
      }
      
      autoNavigateTimeoutRef.current = setTimeout(() => {
        navigation.navigate('Home');
      }, 3000);

    } catch (error) {
      setUserBalance(oldBalance);
      
      let errorMessage = error.message || 'Failed to complete transaction. Please try again.';
      
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
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const balanceStatus = getBalanceStatus();

  const handleMessageModalClose = () => {
    setMessageModal({ ...messageModal, visible: false });
    
    if (autoNavigateTimeoutRef.current) {
      clearTimeout(autoNavigateTimeoutRef.current);
    }
  };

  const HeaderBar = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={DARK_TEXT} />
        </TouchableOpacity>
        <Ionicons name="send-outline" size={28} color={PRIMARY_BLUE} />
        <Text style={styles.headerTitle}>
          {sendBackMode ? 'Send Back Coupon' : 'MyChangeX Send'}
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.infoButton}
        onPress={() => {
          Alert.alert(
            'Coupon Information',
            'Send small change amounts (< $1.00) to other MyChangeX users.\n\n• First-time sends to any user allowed\n• Received coupons can be sent back\n• Auto-navigates to Home after sending',
            [{ text: 'OK' }]
          );
        }}
      >
        <Ionicons name="information-circle-outline" size={24} color={DARK_TEXT} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
      <SafeAreaView style={styles.safeArea}>
        <HeaderBar />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
            {/* Compact Balance Card */}
            <View style={[styles.card, styles.balanceCard]}>
              <View style={styles.balanceRow}>
                <View style={styles.balanceIconContainer}>
                  <Ionicons name="wallet-outline" size={20} color={PRIMARY_BLUE} />
                </View>
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceLabel}>Available Balance</Text>
                  <Text style={styles.balanceAmount}>${userBalance.toFixed(2)}</Text>
                </View>
                <View style={styles.statusIndicator}>
                  <View style={[styles.statusDot, { backgroundColor: SUCCESS_GREEN }]} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>
            </View>

            {/* Recipient Card */}
            <Text style={styles.sectionTitle}>Recipient</Text>
            {phoneNumber ? (
              <View style={[styles.card, styles.recipientCard]}>
                <View style={styles.recipientHeader}>
                  <Ionicons name="person-outline" size={20} color={PRIMARY_BLUE} />
                  <Text style={styles.recipientLabel}>
                    {sendBackMode ? 'Sending Back To' : 'Recipient'}
                  </Text>
                </View>
                <Text style={styles.recipientInfo}>
                  {recipientName || 'User'} ({phoneNumber})
                </Text>
                {sendBackMode ? (
                  <Text style={styles.sendBackNotice}>
                    💡 This is a "Send Back" transaction
                  </Text>
                ) : (
                  <TouchableOpacity 
                    style={styles.changeRecipientButton}
                    onPress={() => {
                      setPhoneNumber('');
                      setRecipientName('');
                      setRecipientId(null);
                      setShowRecipientModal(true);
                    }}
                  >
                    <Text style={styles.changeRecipientText}>Change Recipient</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.card, styles.selectRecipientCard]}
                onPress={handleSendCoupon}
                activeOpacity={0.9}
              >
                <View style={styles.selectRecipientContent}>
                  <View style={styles.selectRecipientIcon}>
                    <Ionicons name="person-add-outline" size={28} color={PRIMARY_BLUE} />
                  </View>
                  <Text style={styles.selectRecipientText}>Select Recipient</Text>
                  <Text style={styles.selectRecipientSubtext}>
                    Choose recipient via QR code or phone number
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Amount Card */}
            <Text style={styles.sectionTitle}>Amount</Text>
            <View style={[styles.card, styles.amountCard]}>
              <View style={styles.amountHeader}>
                <Ionicons name="cash-outline" size={20} color={PRIMARY_BLUE} />
                <Text style={styles.amountLabel}>
                  {sendBackMode ? 'Amount to Send Back' : 'Enter Change Amount'}
                </Text>
              </View>
              <View style={[
                styles.amountInputContainer,
                (exceedsBalance() || !isWithinChangeLimit()) && styles.amountInputContainerError
              ]}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    (exceedsBalance() || !isWithinChangeLimit()) && styles.amountInputError
                  ]}
                  placeholder={sendBackMode && originalReceivedAmount ? originalReceivedAmount.toFixed(2) : "0.00"}
                  placeholderTextColor={LIGHT_TEXT}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="decimal-pad"
                  selectionColor={PRIMARY_BLUE}
                  returnKeyType="done"
                  maxLength={4}
                  editable={true}
                />
              </View>
              
              {balanceStatus && (
                <View style={[
                  styles.balanceStatusContainer,
                  { backgroundColor: `${balanceStatus.color}15` }
                ]}>
                  <Ionicons 
                    name={balanceStatus.type === 'error' ? "warning-outline" : "checkmark-circle-outline"} 
                    size={16} 
                    color={balanceStatus.color} 
                  />
                  <Text style={[styles.balanceStatus, { color: balanceStatus.color }]}>
                    {balanceStatus.message}
                  </Text>
                </View>
              )}
              
              {sendBackMode && originalReceivedAmount && !amount && (
                <TouchableOpacity 
                  style={styles.suggestionButton}
                  onPress={() => setAmount(originalReceivedAmount.toFixed(2))}
                >
                  <View style={styles.suggestionButtonContent}>
                    <Text style={styles.suggestionText}>
                      Tap to use full amount: ${originalReceivedAmount.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Send Button */}
            {phoneNumber && (
              <TouchableOpacity 
                style={styles.sendButton}
                onPress={handleSend}
                disabled={!isSendEnabled()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={getSendButtonColors()}
                  style={styles.sendButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {loading ? (
                    <ActivityIndicator color={WHITE} />
                  ) : (
                    <>
                      <Ionicons 
                        name={sendBackMode ? "refresh-outline" : "send-outline"} 
                        size={24} 
                        color={WHITE} 
                      />
                      <Text style={styles.sendButtonText}>
                        {getSendButtonText()}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Switch Mode Button */}
            {sendBackMode && (
              <TouchableOpacity
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
                <View style={styles.switchModeButtonContent}>
                  <Ionicons name="swap-horizontal-outline" size={20} color={PRIMARY_BLUE} />
                  <Text style={styles.switchModeButtonText}>Switch to Regular Send Mode</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Footer Spacer */}
            <View style={styles.footerSpacer} />
          </View>
        </ScrollView>

        {/* Recipient Options Modal - Matches HomeScreen modal style */}
        {!sendBackMode && (
          <Modal
            visible={showRecipientModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowRecipientModal(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.modalBackdrop} onPress={() => setShowRecipientModal(false)} />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Recipient</Text>
                  <TouchableOpacity onPress={() => setShowRecipientModal(false)}>
                    <Ionicons name="close" size={24} color={DARK_TEXT} />
                  </TouchableOpacity>
                </View>
                
                <Pressable
                  style={({ pressed }) => [
                    styles.platformItem,
                    { backgroundColor: pressed ? "#f5f5f5" : WHITE },
                  ]}
                  onPress={handleScanQR}
                >
                  <View style={styles.platformIconContainer}>
                    <Ionicons name="qr-code-outline" size={28} color={PRIMARY_BLUE} />
                  </View>
                  <View style={styles.platformInfo}>
                    <Text style={styles.platformName}>Scan QR Code</Text>
                    <Text style={styles.platformDescription}>
                      Scan recipient's coupon QR code
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.platformItem,
                    { backgroundColor: pressed ? "#f5f5f5" : WHITE },
                  ]}
                  onPress={handlePhoneOption}
                >
                  <View style={styles.platformIconContainer}>
                    <Ionicons name="call-outline" size={28} color={PRIMARY_BLUE} />
                  </View>
                  <View style={styles.platformInfo}>
                    <Text style={styles.platformName}>Enter Phone Number</Text>
                    <Text style={styles.platformDescription}>
                      Enter recipient's phone number manually
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </Pressable>

                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowRecipientModal(false)}
                >
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
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
            <Pressable style={styles.modalBackdrop} onPress={() => setShowPhoneFormModal(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enter Recipient Phone</Text>
                <TouchableOpacity onPress={() => setShowPhoneFormModal(false)}>
                  <Ionicons name="close" size={24} color={DARK_TEXT} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 0771234567"
                placeholderTextColor="#999"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                selectionColor={PRIMARY_BLUE}
                autoFocus={true}
              />
              
              <Text style={styles.inputHint}>
                Enter recipient's Zimbabwean mobile number
              </Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButtonCancel}
                  onPress={() => setShowPhoneFormModal(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButtonConfirm, !phoneNumber && styles.disabledButton]}
                  onPress={handlePhoneFormSubmit}
                  disabled={!phoneNumber}
                >
                  <LinearGradient
                    colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                    style={styles.modalButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.modalButtonTextConfirm}>Submit</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Camera Modal */}
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
                <Ionicons name="camera-off-outline" size={64} color={PRIMARY_BLUE} />
                <Text style={styles.errorText}>
                  {cameraError || 'Camera permission required'}
                </Text>
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={requestCameraAccess}
                >
                  <LinearGradient
                    colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                    style={styles.permissionButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={() => {
                setShowCamera(false);
                isScanning.current = false;
              }}
            >
              <LinearGradient
                colors={[ERROR_RED, ERROR_RED]}
                style={styles.closeCameraButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="close" size={24} color={WHITE} />
                <Text style={styles.closeCameraText}>Close</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Message Modal */}
        <MessageModal
          visible={messageModal.visible}
          title={messageModal.title}
          message={messageModal.message}
          type={messageModal.type}
          onClose={handleMessageModalClose}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContent: { flexGrow: 1, paddingBottom: 30 },
  mainContent: { flex: 1, paddingHorizontal: 20, backgroundColor: BACKGROUND_COLOR },
  
  // Header - Matches HomeScreen header
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
    marginRight: 8,
  },
  headerTitle: {
    color: DARK_TEXT,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 10,
  },
  infoButton: {
    padding: 8,
  },
  
  // Card - Matches HomeScreen card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  
  // Compact Balance Card
  balanceCard: {
    padding: 16,
    marginTop: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: LIGHT_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  balanceLabel: {
    color: LIGHT_TEXT,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  balanceAmount: {
    color: DARK_TEXT,
    fontSize: 24,
    fontWeight: '800',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  statusText: {
    color: PRIMARY_BLUE,
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Section Title
  sectionTitle: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  
  // Recipient Card
  recipientCard: {},
  recipientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  recipientLabel: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: '500',
  },
  recipientInfo: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sendBackNotice: {
    color: SUCCESS_GREEN,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  changeRecipientButton: {
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d9e4ff',
  },
  changeRecipientText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Select Recipient Card
  selectRecipientCard: {},
  selectRecipientContent: {
    alignItems: 'center',
    padding: 16,
  },
  selectRecipientIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LIGHT_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectRecipientText: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectRecipientSubtext: {
    color: LIGHT_TEXT,
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Amount Card
  amountCard: {},
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  amountLabel: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: '500',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_BLUE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 16,
  },
  amountInputContainerError: {
    borderColor: ERROR_RED,
  },
  dollarSign: {
    fontSize: 24,
    paddingLeft: 16,
    paddingRight: 8,
    color: DARK_TEXT,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    padding: 16,
    fontSize: 24,
    color: DARK_TEXT,
    fontWeight: '600',
  },
  amountInputError: {
    color: ERROR_RED,
  },
  balanceStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  balanceStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionButtonContent: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 167, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 38, 0.2)',
  },
  suggestionText: {
    color: '#FFA726',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Send Button
  sendButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sendButtonGradient: {
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sendButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Switch Mode Button
  switchModeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  switchModeButtonContent: {
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LIGHT_BLUE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  switchModeButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Footer Spacer
  footerSpacer: {
    height: 20,
  },
  
  // Modals - Matches HomeScreen modal styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
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
  modalTitle: { fontSize: 22, fontWeight: '700', color: DARK_TEXT },
  
  // Platform/Recipient Item - Matches HomeScreen platform item
  platformItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  platformIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: LIGHT_BLUE,
  },
  platformInfo: { flex: 1 },
  platformName: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 4,
  },
  platformDescription: { fontSize: 13, color: LIGHT_TEXT, fontWeight: '400' },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: { color: LIGHT_TEXT, fontSize: 16, fontWeight: '600' },
  
  // Phone Form Modal
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: LIGHT_BLUE,
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
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  modalButtonConfirm: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonGradient: {
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
  
  // Camera Modal
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WHITE,
    padding: 20,
  },
  errorText: {
    color: DARK_TEXT,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '80%',
  },
  permissionButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  closeCameraButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  closeCameraButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeCameraText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Message Modal - Matches HomeScreen style
  messageModalContent: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  messageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  messageModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  messageModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
    flex: 1,
  },
  messageModalMessage: {
    fontSize: 16,
    color: LIGHT_TEXT,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageModalButton: {
    backgroundColor: LIGHT_BLUE,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  messageModalButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MyChangeXScreen;