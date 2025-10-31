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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { 
  supabase, 
  formatZimbabwePhone, 
  getUserSession, 
  getUserProfileByPhone,
  transferFunds,
  executeManualTransaction 
} from './supabase';

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

  // --- Component Lifecycle & Side Effects ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    fetchUserData();
  }, []);

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
        console.log('Using session balance:', user.balance);
      } else {
        setUserBalance(profileData.balance || 0);
        console.log('Fetched balance from profile:', profileData.balance);
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'Failed to load user data.',
      });
    }
  };

  // --- Balance Validation Functions ---
  
  /**
   * Check if amount exceeds balance
   */
  const exceedsBalance = () => {
    const sendAmount = parseFloat(amount) || 0;
    return sendAmount > userBalance;
  };

  /**
   * Check if amount is valid (positive and within balance)
   */
  const isValidAmount = () => {
    const sendAmount = parseFloat(amount) || 0;
    return sendAmount > 0 && sendAmount <= userBalance;
  };

  /**
   * Check if send button should be enabled
   */
  const isSendEnabled = () => {
    return phoneNumber && isValidAmount() && !loading;
  };

  /**
   * Get balance status message
   */
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
    } else {
      const remaining = userBalance - sendAmount;
      return {
        type: 'success', 
        message: `Remaining balance: $${remaining.toFixed(2)}`,
        color: '#4CAF50'
      };
    }
  };

  /**
   * Get send button text based on current state
   */
  const getSendButtonText = () => {
    if (!amount || parseFloat(amount) <= 0) {
      return 'Enter Amount';
    } else if (exceedsBalance()) {
      return 'Insufficient Balance';
    } else if (loading) {
      return 'Processing...';
    } else {
      return `Send $${amount}`;
    }
  };

  /**
   * Get send button colors based on current state
   */
  const getSendButtonColors = () => {
    if (!isSendEnabled()) {
      return ['#CCCCCC', '#BBBBBB']; // Gray when disabled
    } else {
      return ['#4CAF50', '#45a049']; // Green when enabled
    }
  };

  // --- User Interaction Handlers ---

  // Request camera permission for QR scanning
  const requestCameraAccess = async () => {
    try {
      await requestPermission();
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      setCameraError(`Failed to request camera permissions: ${error.message}`);
    }
  };

  // Handle Send Coupon button press
  const handleSendCoupon = () => {
    setShowRecipientModal(true);
  };

  // Handle QR scan option from the modal
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

  // Handle phone number option from the modal
  const handlePhoneOption = () => {
    setShowRecipientModal(false);
    setShowPhoneFormModal(true);
  };

  // Handle phone form submission
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

      setMessageModal({
        visible: true,
        title: 'Recipient Found',
        message: `Recipient: ${recipientData.full_name || 'User'} (${phoneNumber}). You can now enter the amount and send.`,
      });

    } catch (error) {
      console.error('Error verifying recipient:', error);
      setMessageModal({
        visible: true,
        title: 'Error',
        message: 'Failed to verify recipient. Please try again.',
      });
    }
  };

  // Handle the result of a QR code scan
  const handleBarCodeScanned = useCallback(async ({ type, data }) => {
    if (isScanning.current) return;

    isScanning.current = true;

    try {
      // Try to parse as JSON for a structured QR code
      const parsedData = JSON.parse(data);

      if (parsedData.type === 'coupon' && parsedData.phone) {
        const scannedPhone = parsedData.phone;
        const formattedPhone = formatZimbabwePhone(scannedPhone);

        // Check for self-transfer
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
          setShowCamera(false);
          isScanning.current = false;
          return;
        }

        // Set phone number and recipient name from the QR code
        setPhoneNumber(scannedPhone);
        setRecipientName(recipientData.full_name || 'User');
        setRecipientId(recipientData.id);
        setShowCamera(false);

        setMessageModal({
          visible: true,
          title: 'QR Scanned',
          message: `Coupon scanned for ${recipientData.full_name || 'User'} (${scannedPhone}). You can now enter the amount and send.`,
        });

      } else {
        // Handle invalid or unexpected QR format
        setShowCamera(false);
        setMessageModal({
          visible: true,
          title: 'Invalid QR Code',
          message: 'This is not a valid coupon QR code. Please try again or enter the number manually.',
        });
      }
    } catch (error) {
      // Handle cases where data is not JSON (e.g., a simple phone number string)
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
          setShowCamera(false);
          isScanning.current = false;
          return;
        }

        setPhoneNumber(phoneMatch[0]);
        setRecipientName(recipientData.full_name || 'User');
        setRecipientId(recipientData.id);
        setShowCamera(false);
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

  // Handle the "Send" button press with real-time transactions
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

    setLoading(true);

    try {
      console.log('🚀 Starting transaction process...', {
        senderId: userId,
        recipientId: recipientId,
        amount: sendAmount
      });

      // Try RPC method first (preferred - atomic transaction)
      let transactionResult = await transferFunds(userId, recipientId, sendAmount);

      // If RPC fails, try manual method as fallback
      if (!transactionResult.success) {
        console.log('🔄 RPC transaction failed, trying manual method...', transactionResult.error);
        transactionResult = await executeManualTransaction(userId, recipientId, sendAmount);
      }

      if (!transactionResult.success) {
        throw new Error(transactionResult.error || 'Transaction failed');
      }

      // Update local balance immediately for better UX
      const newBalance = userBalance - sendAmount;
      setUserBalance(newBalance);

      // Show success message
      setMessageModal({
        visible: true,
        title: 'Success!',
        message: `Successfully sent $${sendAmount.toFixed(2)} to ${recipientName || phoneNumber}. Your new balance is $${newBalance.toFixed(2)}.`,
      });

      // Reset form fields
      setAmount('');
      setPhoneNumber('');
      setRecipientName('');
      setRecipientId(null);

      // Optional: Refresh user data to ensure consistency
      setTimeout(() => {
        fetchUserData();
      }, 1000);

    } catch (error) {
      console.error('❌ Transaction error:', error);
      
      let errorMessage = error.message || 'Failed to complete transaction. Please try again.';
      
      // User-friendly error messages
      if (error.message.includes('Insufficient funds')) {
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
            <Text style={styles.header}>Send Digital Coupon</Text>

            {/* Balance Display */}
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <Text style={styles.balanceAmount}>${userBalance.toFixed(2)}</Text>
            </View>

            {/* Recipient Info Display */}
            {phoneNumber ? (
              <View style={styles.recipientContainer}>
                <Text style={styles.recipientLabel}>Recipient</Text>
                <Text style={styles.recipientInfo}>
                  {recipientName || 'User'} ({phoneNumber})
                </Text>
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
              </View>
            ) : null}

            {/* Amount Input */}
            <View style={styles.amountContainer}>
              <Text style={styles.label}>Enter Amount</Text>
              <View style={[
                styles.amountInputContainer,
                exceedsBalance() && styles.amountInputContainerError
              ]}>
                <Text style={[
                  styles.currencySymbol,
                  exceedsBalance() && styles.currencySymbolError
                ]}>$</Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    exceedsBalance() && styles.amountInputError
                  ]}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  selectionColor="#ffffff"
                  returnKeyType="done"
                />
              </View>
              
              {/* Balance Status Message */}
              {balanceStatus && (
                <Text style={[styles.balanceStatus, { color: balanceStatus.color }]}>
                  {balanceStatus.message}
                </Text>
              )}
            </View>

            {/* Send Coupon Button */}
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
                  {phoneNumber ? 'Change Recipient' : 'Send Coupon'}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Send Button (only enabled when form is filled and amount is valid) */}
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
          </View>
        </ScrollView>

        {/* Modal for Recipient Options */}
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
                  console.error('Camera error:', error);
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
          onClose={() => setMessageModal({ ...messageModal, visible: false })}
        />

      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
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