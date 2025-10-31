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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getUserSession, getUserProfile } from './supabase';

const { width } = Dimensions.get('window');

const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";

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

  // Utility categories with their services
  const utilityCategories = [
    {
      id: 'electricity',
      title: 'Electricity',
      icon: '⚡',
      color: '#FFA726',
      services: [
        {
          id: 'zesa',
          name: 'ZESA',
          description: 'Zimbabwe Electricity Supply Authority',
          icon: '💡',
          billerCode: 'ZESA',
          requiredFields: ['meter_number', 'amount'],
        },
        {
          id: 'zesa_prepaid',
          name: 'ZESA Prepaid',
          description: 'Buy electricity tokens',
          icon: '🔌',
          billerCode: 'ZESA_PREPAID',
          requiredFields: ['meter_number', 'amount'],
        }
      ]
    },
    {
      id: 'municipal',
      title: 'Municipal Services',
      icon: '🏛️',
      color: '#4CAF50',
      services: [
        {
          id: 'city_council',
          name: 'City Council',
          description: 'Pay rates and municipal bills',
          icon: '🏢',
          billerCode: 'CITY_COUNCIL',
          requiredFields: ['account_number', 'amount'],
        },
        {
          id: 'water',
          name: 'Water Bills',
          description: 'ZINWA and local water authorities',
          icon: '💧',
          billerCode: 'WATER_BILL',
          requiredFields: ['account_number', 'amount'],
        }
      ]
    },
    {
      id: 'education',
      title: 'Education',
      icon: '🎓',
      color: '#2196F3',
      services: [
        {
          id: 'school_fees',
          name: 'School Fees',
          description: 'Pay school and college fees',
          icon: '📚',
          billerCode: 'SCHOOL_FEES',
          requiredFields: ['student_id', 'amount', 'institution'],
        },
        {
          id: 'university',
          name: 'University Fees',
          description: 'University tuition and accommodation',
          icon: '🏫',
          billerCode: 'UNIVERSITY',
          requiredFields: ['student_number', 'amount', 'institution'],
        }
      ]
    },
    {
      id: 'insurance',
      title: 'Insurance',
      icon: '🛡️',
      color: '#9C27B0',
      services: [
        {
          id: 'vehicle_insurance',
          name: 'Vehicle Insurance',
          description: 'Car, truck and motorcycle insurance',
          icon: '🚗',
          billerCode: 'VEHICLE_INS',
          requiredFields: ['policy_number', 'amount'],
        },
        {
          id: 'medical_insurance',
          name: 'Medical Insurance',
          description: 'Health and medical cover payments',
          icon: '🏥',
          billerCode: 'MEDICAL_INS',
          requiredFields: ['policy_number', 'amount'],
        },
        {
          id: 'life_insurance',
          name: 'Life Insurance',
          description: 'Life insurance premium payments',
          icon: '❤️',
          billerCode: 'LIFE_INS',
          requiredFields: ['policy_number', 'amount'],
        }
      ]
    },
    {
      id: 'telecom',
      title: 'Telecommunications',
      icon: '📞',
      color: '#FF5722',
      services: [
        {
          id: 'telone',
          name: 'TelOne',
          description: 'Landline and internet bills',
          icon: '📠',
          billerCode: 'TELONE',
          requiredFields: ['account_number', 'amount'],
        },
        {
          id: 'broadband',
          name: 'Broadband',
          description: 'Internet service providers',
          icon: '🌐',
          billerCode: 'BROADBAND',
          requiredFields: ['account_number', 'amount'],
        }
      ]
    },
    {
      id: 'other',
      title: 'Other Bills',
      icon: '📋',
      color: '#607D8B',
      services: [
        {
          id: 'tv_license',
          name: 'TV License',
          description: 'ZBC television license',
          icon: '📺',
          billerCode: 'TV_LICENSE',
          requiredFields: ['license_number', 'amount'],
        },
        {
          id: 'rent',
          name: 'Rent Payment',
          description: 'Monthly rental payments',
          icon: '🏠',
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
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      setUserData(sessionResult.user);
      
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

    if (amount > balance) {
      Alert.alert('Insufficient Funds', `You need $${amount.toFixed(2)} but only have $${balance.toFixed(2)} available.`);
      return;
    }

    setProcessingPayment(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real app, you would integrate with payment gateway here
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
              // Update balance (in real app, this would come from backend)
              setBalance(prev => prev - amount);
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Payment Failed', 'Please try again later.');
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

  if (loading) {
    return (
      <LinearGradient
        colors={['#0136c0', '#0136c0']}
        style={styles.background}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Loading utilities...</Text>
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
          <Text style={styles.headerTitle}>Bill Payments</Text>
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
            <Text style={styles.welcomeTitle}>Pay Your Bills</Text>
            <Text style={styles.welcomeSubtitle}>
              Quick and secure bill payments for all your utilities and services
            </Text>
          </View>

          {/* Utility Categories */}
          {utilityCategories.map((category) => (
            <View key={category.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.categoryTitle}>{category.title}</Text>
              </View>
              
              <View style={styles.servicesGrid}>
                {category.services.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.serviceCard}
                    onPress={() => handleUtilitySelect(service)}
                  >
                    <View style={[styles.serviceIcon, { backgroundColor: `${category.color}20` }]}>
                      <Text style={[styles.serviceIconText, { color: category.color }]}>
                        {service.icon}
                      </Text>
                    </View>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Payment Modal */}
        <Modal
          visible={isPaymentModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsPaymentModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedUtility && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Pay {selectedUtility.name}</Text>
                    <TouchableOpacity 
                      onPress={() => setIsPaymentModalVisible(false)}
                      disabled={processingPayment}
                    >
                      <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.paymentForm}>
                    <Text style={styles.formLabel}>
                      {getFieldLabel(selectedUtility)}
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder={getFieldPlaceholder(selectedUtility)}
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      keyboardType="default"
                      autoCapitalize="none"
                    />

                    <Text style={styles.formLabel}>Amount ($)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter amount"
                      value={paymentAmount}
                      onChangeText={setPaymentAmount}
                      keyboardType="decimal-pad"
                    />

                    <View style={styles.balanceInfo}>
                      <Text style={styles.balanceLabel}>Available Balance:</Text>
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
                      {processingPayment ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.payButtonText}>
                          Pay ${paymentAmount || '0.00'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
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
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    width: (width - 60) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceIconText: {
    fontSize: 20,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  serviceDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 14,
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
    maxHeight: '80%',
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
  paymentForm: {
    gap: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  balanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_BLUE,
  },
  payButton: {
    backgroundColor: PRIMARY_BLUE,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default UtilitiesScreen;