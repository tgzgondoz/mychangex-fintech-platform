// screens/UtilitiesScreen.js
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
  Pressable,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getUserSession, getUserProfile } from './supabase';

const { width, height } = Dimensions.get('window');

// Match HomeScreen color scheme
const PRIMARY_BLUE = "#0136c0";
const ACCENT_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#e9edf9";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.15)";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";

const UtilitiesScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [balance, setBalance] = useState(0);
  const [selectedUtility, setSelectedUtility] = useState(null);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Utility categories with their services
  const utilityCategories = [
    {
      id: 'electricity',
      title: 'Electricity',
      icon: 'bolt',
      iconType: 'ionicons',
      color: '#FFA726',
      gradient: ['#FFA726', '#FFB74D'],
      services: [
        {
          id: 'zesa',
          name: 'ZESA',
          description: 'Zimbabwe Electricity Supply Authority',
          icon: 'flash-outline',
          iconType: 'ionicons',
          billerCode: 'ZESA',
          requiredFields: ['meter_number', 'amount'],
        },
        {
          id: 'zesa_prepaid',
          name: 'ZESA Prepaid',
          description: 'Buy electricity tokens',
          icon: 'battery-charging-outline',
          iconType: 'ionicons',
          billerCode: 'ZESA_PREPAID',
          requiredFields: ['meter_number', 'amount'],
        }
      ]
    },
    {
      id: 'municipal',
      title: 'Municipal Services',
      icon: 'city',
      iconType: 'fontawesome5',
      color: '#4CAF50',
      gradient: ['#4CAF50', '#66BB6A'],
      services: [
        {
          id: 'city_council',
          name: 'City Council',
          description: 'Pay rates and municipal bills',
          icon: 'building',
          iconType: 'fontawesome5',
          billerCode: 'CITY_COUNCIL',
          requiredFields: ['account_number', 'amount'],
        },
        {
          id: 'water',
          name: 'Water Bills',
          description: 'ZINWA and local water authorities',
          icon: 'water',
          iconType: 'fontawesome5',
          billerCode: 'WATER_BILL',
          requiredFields: ['account_number', 'amount'],
        }
      ]
    },
    {
      id: 'education',
      title: 'Education',
      icon: 'graduation-cap',
      iconType: 'fontawesome5',
      color: '#2196F3',
      gradient: ['#2196F3', '#42A5F5'],
      services: [
        {
          id: 'school_fees',
          name: 'School Fees',
          description: 'Pay school and college fees',
          icon: 'school-outline',
          iconType: 'ionicons',
          billerCode: 'SCHOOL_FEES',
          requiredFields: ['student_id', 'amount', 'institution'],
        },
        {
          id: 'university',
          name: 'University Fees',
          description: 'University tuition and accommodation',
          icon: 'library-outline',
          iconType: 'ionicons',
          billerCode: 'UNIVERSITY',
          requiredFields: ['student_number', 'amount', 'institution'],
        }
      ]
    },
    {
      id: 'insurance',
      title: 'Insurance',
      icon: 'shield-checkmark-outline',
      iconType: 'ionicons',
      color: '#9C27B0',
      gradient: ['#9C27B0', '#BA68C8'],
      services: [
        {
          id: 'vehicle_insurance',
          name: 'Vehicle Insurance',
          description: 'Car, truck and motorcycle insurance',
          icon: 'car-outline',
          iconType: 'ionicons',
          billerCode: 'VEHICLE_INS',
          requiredFields: ['policy_number', 'amount'],
        },
        {
          id: 'medical_insurance',
          name: 'Medical Insurance',
          description: 'Health and medical cover payments',
          icon: 'medical-bag',
          iconType: 'materialicons',
          billerCode: 'MEDICAL_INS',
          requiredFields: ['policy_number', 'amount'],
        },
        {
          id: 'life_insurance',
          name: 'Life Insurance',
          description: 'Life insurance premium payments',
          icon: 'heart-outline',
          iconType: 'ionicons',
          billerCode: 'LIFE_INS',
          requiredFields: ['policy_number', 'amount'],
        }
      ]
    },
    {
      id: 'telecom',
      title: 'Telecommunications',
      icon: 'phone-in-talk',
      iconType: 'materialicons',
      color: '#FF5722',
      gradient: ['#FF5722', '#FF7043'],
      services: [
        {
          id: 'telone',
          name: 'TelOne',
          description: 'Landline and internet bills',
          icon: 'phone-outline',
          iconType: 'ionicons',
          billerCode: 'TELONE',
          requiredFields: ['account_number', 'amount'],
        },
        {
          id: 'broadband',
          name: 'Broadband',
          description: 'Internet service providers',
          icon: 'wifi-outline',
          iconType: 'ionicons',
          billerCode: 'BROADBAND',
          requiredFields: ['account_number', 'amount'],
        }
      ]
    },
    {
      id: 'other',
      title: 'Other Bills',
      icon: 'receipt-outline',
      iconType: 'ionicons',
      color: '#607D8B',
      gradient: ['#607D8B', '#78909C'],
      services: [
        {
          id: 'tv_license',
          name: 'TV License',
          description: 'ZBC television license',
          icon: 'tv-outline',
          iconType: 'ionicons',
          billerCode: 'TV_LICENSE',
          requiredFields: ['license_number', 'amount'],
        },
        {
          id: 'rent',
          name: 'Rent Payment',
          description: 'Monthly rental payments',
          icon: 'home-outline',
          iconType: 'ionicons',
          billerCode: 'RENT',
          requiredFields: ['landlord_code', 'amount'],
        }
      ]
    }
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
        return;
      }

      setUserData(sessionResult.user);
      
      const profileResult = await getUserProfile(sessionResult.user.id);
      if (profileResult.success) {
        setBalance(profileResult.data.balance || 0);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert(
        'Connection Error',
        'Unable to load your data. Please check your internet connection and try again.',
        [
          { text: 'Try Again', onPress: () => loadUserData() },
          { text: 'Go Back', onPress: () => navigation.goBack() },
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUtilitySelect = (utility) => {
    setSelectedUtility(utility);
    setAccountNumber('');
    setPaymentAmount('');
    setIsPaymentModalVisible(true);
  };

  const handlePayment = async () => {
    if (!paymentAmount || !accountNumber) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    if (amount < 1) {
      Alert.alert('Error', 'Minimum payment amount is $1.00.');
      return;
    }

    if (amount > balance) {
      Alert.alert(
        'Insufficient Funds',
        `You need $${amount.toFixed(2)} but only have $${balance.toFixed(2)} available.`,
        [
          { text: 'OK' },
          { text: 'Add Funds', onPress: () => navigation.navigate('AddFunds') }
        ]
      );
      return;
    }

    setProcessingPayment(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const success = Math.random() > 0.1;
      
      if (success) {
        Alert.alert(
          'Payment Successful!',
          `Your ${selectedUtility.name} payment of $${amount.toFixed(2)} has been processed successfully.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setIsPaymentModalVisible(false);
                setSelectedUtility(null);
                setPaymentAmount('');
                setAccountNumber('');
                setBalance(prev => prev - amount);
              }
            }
          ]
        );
      } else {
        throw new Error('Payment failed. Please try again.');
      }
    } catch (error) {
      Alert.alert('Payment Failed', error.message || 'Please try again later.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getFieldLabel = (utility) => {
    if (utility.id.includes('meter')) return 'Meter Number';
    if (utility.id.includes('student')) return 'Student Number';
    if (utility.id.includes('policy')) return 'Policy Number';
    if (utility.id.includes('license')) return 'License Number';
    if (utility.id.includes('landlord')) return 'Landlord Code';
    return 'Account Number';
  };

  const getFieldPlaceholder = (utility) => {
    if (utility.id.includes('meter')) return 'Enter meter number';
    if (utility.id.includes('student')) return 'Enter student number';
    if (utility.id.includes('policy')) return 'Enter policy number';
    if (utility.id.includes('license')) return 'Enter license number';
    if (utility.id.includes('landlord')) return 'Enter landlord code';
    return 'Enter account number';
  };

  const renderIcon = (iconType, iconName, size = 24, color = WHITE) => {
    switch (iconType) {
      case 'ionicons':
        return <Ionicons name={iconName} size={size} color={color} />;
      case 'materialicons':
        return <MaterialIcons name={iconName} size={size} color={color} />;
      case 'fontawesome5':
        return <FontAwesome5 name={iconName} size={size} color={color} />;
      default:
        return <Ionicons name="help-circle-outline" size={size} color={color} />;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  if (loading) {
    return (
      <View style={styles.background}>
        <StatusBar barStyle="light-content" backgroundColor="#0136c0" />
        <LinearGradient
          colors={["#0136c0", "#0136c0"]}
          style={styles.gradientBackground}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={WHITE} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <StatusBar barStyle="light-content" backgroundColor="#0136c0" />
      <LinearGradient
        colors={["#0136c0", "#0136c0"]}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          
          {/* Header - Match HomeScreen */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={WHITE} />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Ionicons name="receipt-outline" size={22} color={WHITE} />
              <Text style={styles.headerTitle}>Bill Payments</Text>
            </View>
            
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceText}>${balance.toFixed(2)}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Welcome Section - Match HomeScreen cards */}
            <View style={[styles.card, styles.welcomeCard]}>
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                style={styles.welcomeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.welcomeTitle}>Pay Your Bills</Text>
                <Text style={styles.welcomeSubtitle}>
                  Quick and secure bill payments for all your utilities and services
                </Text>
              </LinearGradient>
            </View>

            {/* Utility Categories */}
            {utilityCategories.map((category) => (
              <View key={category.id} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                    style={styles.categoryIconContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {renderIcon(category.iconType, category.icon, 20, WHITE)}
                  </LinearGradient>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                </View>
                
                <View style={styles.servicesGrid}>
                  {category.services.map((service) => (
                    <TouchableOpacity
                      key={service.id}
                      style={styles.serviceCard}
                      onPress={() => handleUtilitySelect(service)}
                    >
                      <LinearGradient
                        colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                        style={styles.serviceGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <View style={styles.serviceHeader}>
                          <View style={styles.serviceIconContainer}>
                            {renderIcon(service.iconType, service.icon, 20, WHITE)}
                          </View>
                          <View style={styles.serviceInfo}>
                            <Text style={styles.serviceName}>{service.name}</Text>
                            <Text style={styles.serviceDescription}>{service.description}</Text>
                          </View>
                          <Ionicons 
                            name="chevron-forward" 
                            size={20} 
                            color="rgba(255, 255, 255, 0.5)" 
                          />
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Payment Modal - Match HomeScreen modal */}
          <Modal
            visible={isPaymentModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => !processingPayment && setIsPaymentModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable 
                style={styles.modalBackdrop} 
                onPress={() => !processingPayment && setIsPaymentModalVisible(false)}
              />
              <View style={styles.modalContent}>
                {selectedUtility && (
                  <>
                    <View style={styles.modalHeader}>
                      <View style={styles.modalTitleContainer}>
                        {renderIcon(selectedUtility.iconType, selectedUtility.icon, 24, PRIMARY_BLUE)}
                        <Text style={styles.modalTitle}>Pay {selectedUtility.name}</Text>
                      </View>
                      {!processingPayment && (
                        <TouchableOpacity onPress={() => setIsPaymentModalVisible(false)}>
                          <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.paymentForm}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.formLabel}>
                          {getFieldLabel(selectedUtility)}
                        </Text>
                        <View style={styles.textInputWrapper}>
                          <TextInput
                            style={styles.textInput}
                            placeholder={getFieldPlaceholder(selectedUtility)}
                            placeholderTextColor="rgba(0, 0, 0, 0.4)"
                            value={accountNumber}
                            onChangeText={setAccountNumber}
                            keyboardType="default"
                            autoCapitalize="none"
                          />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.formLabel}>Amount ($)</Text>
                        <View style={styles.amountInputWrapper}>
                          <Text style={styles.currencySymbol}>$</Text>
                          <TextInput
                            style={styles.amountInput}
                            placeholder="Enter amount"
                            placeholderTextColor="rgba(0, 0, 0, 0.4)"
                            value={paymentAmount}
                            onChangeText={setPaymentAmount}
                            keyboardType="decimal-pad"
                          />
                        </View>
                        <Text style={styles.amountHint}>Minimum amount: $1.00</Text>
                      </View>

                      <View style={styles.balanceInfo}>
                        <View style={styles.balanceInfoRow}>
                          <Ionicons name="wallet-outline" size={16} color="#666" />
                          <Text style={styles.balanceLabel}>Available Balance:</Text>
                        </View>
                        <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.payButton,
                          processingPayment && styles.payButtonDisabled
                        ]}
                        onPress={handlePayment}
                        disabled={processingPayment}
                      >
                        <LinearGradient
                          colors={[SUCCESS_GREEN, "#00E676"]}
                          style={styles.payButtonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          {processingPayment ? (
                            <ActivityIndicator color={WHITE} />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={20} color={WHITE} />
                              <Text style={styles.payButtonText}>
                                Pay ${paymentAmount || '0.00'}
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  background: { 
    flex: 1, 
    backgroundColor: "#0136c0" 
  },
  gradientBackground: { 
    flex: 1 
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
    color: WHITE,
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 5,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  balanceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  balanceText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  welcomeCard: {
    padding: 0,
    overflow: 'hidden',
  },
  welcomeGradient: {
    padding: 24,
    borderRadius: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: WHITE,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: WHITE,
    letterSpacing: 0.3,
  },
  servicesGrid: {
    gap: 12,
  },
  serviceCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  serviceGradient: {
    padding: 16,
    borderRadius: 20,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
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
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY_BLUE,
  },
  paymentForm: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  textInputWrapper: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  textInput: {
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  currencySymbol: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  amountInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
  },
  amountHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  balanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
  },
  balanceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY_BLUE,
  },
  payButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  payButtonGradient: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default UtilitiesScreen;