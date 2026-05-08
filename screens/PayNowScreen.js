// screens/PayNowScreen.js
import React, { useState, useLayoutEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  TextInput,
  StatusBar,
  Modal,
  Pressable,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { startPayment, pollPaymentStatus } from './paynowService';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = "#165ff9";
const WHITE = "#ffffff";
const DARK_TEXT = "#1A1A1A";
const LIGHT_TEXT = "#666666";
const CARD_BORDER = "#eaeaea";
const BACKGROUND_COLOR = "#f8f9fa";

const PayNowScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('number');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleSendPress = async () => {
    if (!phoneNumber || !amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const amountNum = parseFloat(amount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const userEmail = email || 'customer@mychangex.com';
      const result = await startPayment(amountNum, cleanPhone, 'ecocash', userEmail);
      
      if (result && result.status === 'Ok') {
        Alert.alert(
          'Payment Initiated',
          'Please complete payment on the PayNow page.',
          [
            {
              text: 'Open Payment Page',
              onPress: () => {
                if (result.browserurl) {
                  Linking.openURL(result.browserurl);
                }
              }
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Error', result?.error || 'Payment initiation failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', error.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPin = () => {
    if (!pin || pin.length < 4) {
      Alert.alert('Error', 'Please enter a valid PIN');
      return;
    }
    setModalVisible(false);
    setPin('');
    Alert.alert('Success', 'Payment confirmed successfully!');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[BACKGROUND_COLOR, WHITE]}
        style={styles.background}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentContainer}>
              <View style={[styles.logoBorderContainer, { borderColor: PRIMARY_COLOR }]}>
                <Image 
                  source={require('../assets/paynow-logo.jpg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              
              <Text style={styles.header}>PayNow Payment</Text>
              
              <View style={styles.tabContainer}>
                <TouchableOpacity 
                  style={[styles.tabButton, activeTab === 'qr' && styles.activeTab]}
                  onPress={() => setActiveTab('qr')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, activeTab === 'qr' && styles.activeTabText]}>QR Code</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.tabButton, activeTab === 'number' && styles.activeTab]}
                  onPress={() => setActiveTab('number')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, activeTab === 'number' && styles.activeTabText]}>Phone Number</Text>
                </TouchableOpacity>
              </View>
              
              {activeTab === 'qr' && (
                <View style={styles.qrContainer}>
                  <Text style={styles.sectionTitle}>Scan QR Code to Pay</Text>
                  <View style={styles.qrCodeWrapper}>
                    <QRCode
                      value="paynow:payment?amount=0&reference=MyChangeX"
                      size={width * 0.6}
                      color={PRIMARY_COLOR}
                      backgroundColor={WHITE}
                      logo={require('../assets/paynow-logo.jpg')}
                      logoSize={60}
                      logoBackgroundColor="transparent"
                    />
                  </View>
                  <Text style={styles.qrHint}>Show this at any PayNow merchant</Text>
                </View>
              )}
              
              {activeTab === 'number' && (
                <View style={styles.formContainer}>
                  <Text style={styles.sectionTitle}>Enter Payment Details</Text>
                  
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="phone" size={24} color={PRIMARY_COLOR} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number (263xxxxxxxxx)"
                      placeholderTextColor={LIGHT_TEXT}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      selectionColor={PRIMARY_COLOR}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <MaterialIcons name="email" size={24} color={PRIMARY_COLOR} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email Address (optional)"
                      placeholderTextColor={LIGHT_TEXT}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      selectionColor={PRIMARY_COLOR}
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="attach-money" size={24} color={PRIMARY_COLOR} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Amount (USD)"
                      placeholderTextColor={LIGHT_TEXT}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      selectionColor={PRIMARY_COLOR}
                    />
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.payButton} 
                    onPress={handleSendPress}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    <View style={[styles.buttonBackground, { backgroundColor: PRIMARY_COLOR }]}>
                      {loading ? (
                        <ActivityIndicator color={WHITE} size="small" />
                      ) : (
                        <Text style={styles.payButtonText}>Pay Now</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <View style={[styles.modalLogoContainer, { backgroundColor: PRIMARY_COLOR }]}>
                  <Image 
                    source={require('../assets/paynow-logo.jpg')}
                    style={styles.modalLogo}
                    resizeMode="contain"
                  />
                </View>
                
                <Text style={styles.modalTitle}>Confirm PIN</Text>
                
                <View style={[styles.inputContainer, { marginBottom: 8, backgroundColor: WHITE }]}>
                  <MaterialIcons name="lock" size={24} color={PRIMARY_COLOR} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: DARK_TEXT }]}
                    placeholder="Enter PIN"
                    placeholderTextColor={LIGHT_TEXT}
                    secureTextEntry={true}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={pin}
                    onChangeText={setPin}
                  />
                </View>
                
                <Pressable
                  style={[styles.optionButton, { backgroundColor: PRIMARY_COLOR }]}
                  onPress={handleConfirmPin}
                >
                  <Text style={styles.optionText}>Confirm</Text>
                </Pressable>
                
                <Pressable style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                  <Text style={[styles.cancelText, { color: PRIMARY_COLOR }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  background: { flex: 1 },
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1 },
  contentContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  logoBorderContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: WHITE, justifyContent: "center", alignItems: "center", marginBottom: 20, padding: 16, alignSelf: 'center', borderWidth: 2 },
  logo: { width: 80, height: 80, borderRadius: 10 },
  header: { fontSize: 28, fontWeight: '700', color: DARK_TEXT, textAlign: 'center', marginBottom: 32 },
  tabContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, backgroundColor: WHITE, borderRadius: 12, padding: 6, borderWidth: 1, borderColor: CARD_BORDER },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: PRIMARY_COLOR },
  tabText: { fontSize: 16, fontWeight: '600', color: LIGHT_TEXT },
  activeTabText: { color: WHITE },
  qrContainer: { alignItems: 'center', marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: DARK_TEXT, marginBottom: 24, textAlign: 'center' },
  qrCodeWrapper: { backgroundColor: WHITE, padding: 24, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: CARD_BORDER },
  qrHint: { fontSize: 14, color: LIGHT_TEXT, textAlign: 'center', marginTop: 12 },
  formContainer: { marginTop: 24 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20, height: 56, borderWidth: 1, borderColor: CARD_BORDER },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', color: DARK_TEXT, fontSize: 16, fontWeight: '500' },
  payButton: { borderRadius: 12, overflow: 'hidden', marginTop: 24 },
  buttonBackground: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  payButtonText: { color: WHITE, fontSize: 17, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  centeredView: { width: '100%', alignItems: 'center', paddingHorizontal: 24 },
  modalView: { width: '100%', maxWidth: 400, backgroundColor: WHITE, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: CARD_BORDER },
  modalLogoContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 20, padding: 12 },
  modalLogo: { width: 56, height: 56, borderRadius: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 24, color: DARK_TEXT, textAlign: 'center' },
  optionButton: { width: '100%', padding: 16, marginVertical: 8, borderRadius: 12, alignItems: 'center' },
  optionText: { color: WHITE, fontSize: 16, fontWeight: '600' },
  cancelButton: { width: '100%', padding: 16, marginTop: 16, backgroundColor: BACKGROUND_COLOR, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: CARD_BORDER },
  cancelText: { fontSize: 16, fontWeight: '600' },
});

export default PayNowScreen;