// screens/AirtimeScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getUserSession, getUserProfile } from './supabase';

const { width } = Dimensions.get('window');

const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";

const AirtimeScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [balance, setBalance] = useState(0);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [airtimeAmount, setAirtimeAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [userPhoneNumber, setUserPhoneNumber] = useState('');

  // Network providers data
  const networks = [
    {
      id: 'econet',
      name: 'Econet',
      color: '#FF6B35',
      icon: '📱',
      description: 'Econet Wireless Zimbabwe',
      prefix: '077, 078',
      quickAmounts: [1, 2, 5, 10, 20, 50],
      gradient: ['#FF6B35', '#FF8A65'],
    },
    {
      id: 'netone',
      name: 'NetOne',
      color: '#4CAF50',
      icon: '📶',
      description: 'NetOne Cellular',
      prefix: '071',
      quickAmounts: [1, 2, 5, 10, 20, 50],
      gradient: ['#4CAF50', '#66BB6A'],
    },
    {
      id: 'telecel',
      name: 'Telecel',
      color: '#2196F3',
      icon: '🔵',
      description: 'Telecel Zimbabwe',
      prefix: '073',
      quickAmounts: [1, 2, 5, 10, 20, 50],
      gradient: ['#2196F3', '#42A5F5'],
    },
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      setUserData(sessionResult.user);
      setUserPhoneNumber(sessionResult.user.phone || '');
      
      // Get user profile for balance
      const profileResult = await getUserProfile(sessionResult.user.id);
      if (profileResult.success) {
        setBalance(profileResult.data.balance || 0);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data.');
    } finally {
      setLoading(false);
    }
  };

  const handleNetworkSelect = (network) => {
    setSelectedNetwork(network);
    setAirtimeAmount('');
    setCustomAmount('');
    setPhoneNumber(userPhoneNumber); // Pre-fill with user's phone number
  };

  const handleAmountSelect = (amount) => {
    setAirtimeAmount(amount.toString());
    setCustomAmount('');
  };

  const handleCustomAmountChange = (amount) => {
    setCustomAmount(amount);
    setAirtimeAmount('');
  };

  const validatePhoneNumber = (number, network) => {
    const cleaned = number.replace(/\D/g, '');
    
    if (cleaned.length < 9) {
      return { valid: false, message: 'Phone number is too short' };
    }

    // Network-specific validation
    switch (network.id) {
      case 'econet':
        if (!cleaned.startsWith('77') && !cleaned.startsWith('78')) {
          return { valid: false, message: 'Econet numbers start with 077 or 078' };
        }
        break;
      case 'netone':
        if (!cleaned.startsWith('71')) {
          return { valid: false, message: 'NetOne numbers start with 071' };
        }
        break;
      case 'telecel':
        if (!cleaned.startsWith('73')) {
          return { valid: false, message: 'Telecel numbers start with 073' };
        }
        break;
    }

    return { valid: true };
  };

  const handleBuyAirtime = () => {
    if (!selectedNetwork) {
      Alert.alert('Error', 'Please select a network.');
      return;
    }

    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a phone number.');
      return;
    }

    const phoneValidation = validatePhoneNumber(phoneNumber, selectedNetwork);
    if (!phoneValidation.valid) {
      Alert.alert('Invalid Number', phoneValidation.message);
      return;
    }

    const amount = parseFloat(customAmount || airtimeAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please select or enter a valid amount.');
      return;
    }

    if (amount < 0.5) {
      Alert.alert('Error', 'Minimum airtime purchase is $0.50.');
      return;
    }

    if (amount > balance) {
      Alert.alert('Insufficient Funds', `You need $${amount.toFixed(2)} but only have $${balance.toFixed(2)} available.`);
      return;
    }

    setIsPaymentModalVisible(true);
  };

  const confirmPurchase = async () => {
    setProcessingPayment(true);

    try {
      const amount = parseFloat(customAmount || airtimeAmount);
      
      // Simulate API call to purchase airtime
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate successful purchase
      const success = Math.random() > 0.1; // 90% success rate for demo
      
      if (success) {
        Alert.alert(
          'Airtime Purchase Successful!',
          `$${amount.toFixed(2)} airtime has been sent to ${formatPhoneNumber(phoneNumber)}.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setIsPaymentModalVisible(false);
                setSelectedNetwork(null);
                setAirtimeAmount('');
                setCustomAmount('');
                setPhoneNumber('');
                // Update balance (in real app, this would come from backend)
                setBalance(prev => prev - amount);
              }
            }
          ]
        );
      } else {
        throw new Error('Purchase failed. Please try again.');
      }
    } catch (error) {
      Alert.alert('Purchase Failed', error.message || 'Please try again later.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatPhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 9 && cleaned.startsWith('7')) {
      return `+263 ${cleaned}`;
    }
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      return `+263 ${cleaned.slice(1)}`;
    }
    return number;
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const useMyNumber = () => {
    setPhoneNumber(userPhoneNumber);
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
            <Text style={styles.loadingText}>Loading...</Text>
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
          <Text style={styles.headerTitle}>Buy Airtime</Text>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceText}>${balance.toFixed(2)}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Section */}
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>Buy Airtime</Text>
            <Text style={styles.welcomeSubtitle}>
              Instant airtime top-up for all networks in Zimbabwe
            </Text>
          </View>

          {/* Network Selection - Improved Design */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Network</Text>
            <Text style={styles.sectionSubtitle}>
              Choose your mobile network provider
            </Text>
            <View style={styles.networksContainer}>
              {networks.map((network) => (
                <TouchableOpacity
                  key={network.id}
                  style={[
                    styles.networkCard,
                    selectedNetwork?.id === network.id && styles.networkCardSelected,
                  ]}
                  onPress={() => handleNetworkSelect(network)}
                >
                  <LinearGradient
                    colors={selectedNetwork?.id === network.id ? network.gradient : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                    style={styles.networkGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.networkHeader}>
                      <View style={styles.networkIconContainer}>
                        <Text style={styles.networkIcon}>{network.icon}</Text>
                      </View>
                      <View style={styles.networkInfo}>
                        <Text style={[
                          styles.networkName,
                          selectedNetwork?.id === network.id && styles.networkNameSelected
                        ]}>
                          {network.name}
                        </Text>
                        <Text style={styles.networkDescription}>
                          {network.description}
                        </Text>
                      </View>
                      {selectedNetwork?.id === network.id && (
                        <View style={styles.selectedIndicator}>
                          <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.networkFooter}>
                      <Text style={styles.networkPrefix}>
                        Numbers: {network.prefix}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Phone Number Input */}
          {selectedNetwork && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Enter Phone Number</Text>
              <View style={styles.phoneInputContainer}>
                <View style={styles.phoneInputWrapper}>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder={`Enter ${selectedNetwork.name} number`}
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>
                {userPhoneNumber && (
                  <TouchableOpacity style={styles.useMyNumberButton} onPress={useMyNumber}>
                    <Ionicons name="person" size={16} color="#ffffff" />
                    <Text style={styles.useMyNumberText}>My Number</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.phoneHint}>
                {selectedNetwork.name} numbers start with {selectedNetwork.prefix}
              </Text>
            </View>
          )}

          {/* Amount Selection */}
          {selectedNetwork && phoneNumber && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Amount</Text>
              
              {/* Quick Amounts - Improved Layout */}
              <View style={styles.amountsContainer}>
                <Text style={styles.amountSectionTitle}>Quick Select</Text>
                <View style={styles.amountsGrid}>
                  {selectedNetwork.quickAmounts.map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.amountButton,
                        airtimeAmount === amount.toString() && [
                          styles.amountButtonSelected,
                          { borderColor: selectedNetwork.color }
                        ],
                      ]}
                      onPress={() => handleAmountSelect(amount)}
                    >
                      <Text style={[
                        styles.amountButtonText,
                        airtimeAmount === amount.toString() && styles.amountButtonTextSelected,
                      ]}>
                        ${amount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Custom Amount - Improved Styling */}
              <View style={styles.customAmountContainer}>
                <Text style={styles.amountSectionTitle}>Custom Amount</Text>
                <View style={styles.customAmountWrapper}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.customAmountInput}
                    placeholder="Enter amount"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={customAmount}
                    onChangeText={handleCustomAmountChange}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={styles.amountHint}>Minimum amount: $0.50</Text>
              </View>
            </View>
          )}

          {/* Buy Button */}
          {selectedNetwork && phoneNumber && (airtimeAmount || customAmount) && (
            <TouchableOpacity
              style={styles.buyButton}
              onPress={handleBuyAirtime}
            >
              <LinearGradient
                colors={['#4CAF50', '#45a049']}
                style={styles.buyButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="flash" size={20} color="#ffffff" />
                <Text style={styles.buyButtonText}>
                  Buy {formatCurrency(customAmount || airtimeAmount)} Airtime
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Confirmation Modal */}
        <Modal
          visible={isPaymentModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => !processingPayment && setIsPaymentModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Airtime Purchase</Text>
                {!processingPayment && (
                  <TouchableOpacity onPress={() => setIsPaymentModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.confirmationDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Network:</Text>
                  <Text style={styles.detailValue}>{selectedNetwork?.name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone Number:</Text>
                  <Text style={styles.detailValue}>{formatPhoneNumber(phoneNumber)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(customAmount || airtimeAmount)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Your Balance:</Text>
                  <Text style={styles.detailValue}>${balance.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  processingPayment && styles.confirmButtonDisabled
                ]}
                onPress={confirmPurchase}
                disabled={processingPayment}
              >
                {processingPayment ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Confirm Purchase
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  balanceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  balanceText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  welcomeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
  },
  networksContainer: {
    gap: 12,
  },
  networkCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  networkCardSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  networkGradient: {
    padding: 16,
    borderRadius: 12,
  },
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  networkIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  networkIcon: {
    fontSize: 20,
  },
  networkInfo: {
    flex: 1,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
  },
  networkNameSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  networkDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  selectedIndicator: {
    marginLeft: 'auto',
  },
  networkFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
  networkPrefix: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phoneInputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  phoneInput: {
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  useMyNumberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  useMyNumberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  phoneHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    fontStyle: 'italic',
  },
  amountsContainer: {
    marginBottom: 20,
  },
  amountSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  amountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amountButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  amountButtonSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  amountButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  amountButtonTextSelected: {
    color: '#ffffff',
  },
  customAmountContainer: {
    gap: 12,
  },
  customAmountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    paddingVertical: 16,
    color: '#ffffff',
    fontSize: 16,
  },
  amountHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
  buyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buyButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buyButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY_BLUE,
  },
  confirmationDetails: {
    gap: 12,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: PRIMARY_BLUE,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AirtimeScreen;