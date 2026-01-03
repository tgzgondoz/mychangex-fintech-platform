import React, { useState, useLayoutEffect } from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  StyleSheet, 
  Dimensions,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Modal,
  Image
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const SUCCESS_GREEN = "#10b981"; // Emerald green for success
const WHITE = "#ffffff";
const DARK_TEXT = "#1A1A1A";
const LIGHT_TEXT = "#666666";
const CARD_BORDER = "#eaeaea";
const BACKGROUND_COLOR = "#f8f9fa";

const OmariScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handlePayment = () => {
    setModalVisible(true);
  };

  const handleOptionSelect = (option) => {
    // Handle payment option selection
    console.log(`Selected payment option: ${option}`);
    setModalVisible(false);
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
              {/* Logo with green border background */}
              <View style={styles.logoBorderContainer}>
                <Image 
                  source={require('../assets/omari.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              
              <Text style={styles.header}>Omari Payment</Text>
              
              {/* Tab Selector */}
              <View style={styles.tabContainer}>
                <Pressable 
                  style={({ pressed }) => [
                    styles.tabButton, 
                    activeTab === 'qr' && styles.activeTab,
                    pressed && styles.pressedTab
                  ]}
                  onPress={() => setActiveTab('qr')}
                >
                  <Text style={[styles.tabText, activeTab === 'qr' && styles.activeTabText]}>QR Code</Text>
                </Pressable>
                
                <Pressable 
                  style={({ pressed }) => [
                    styles.tabButton, 
                    activeTab === 'number' && styles.activeTab,
                    pressed && styles.pressedTab
                  ]}
                  onPress={() => setActiveTab('number')}
                >
                  <Text style={[styles.tabText, activeTab === 'number' && styles.activeTabText]}>Phone Number</Text>
                </Pressable>
              </View>
              
              {/* QR Code Section */}
              {activeTab === 'qr' && (
                <View style={styles.qrContainer}>
                  <Text style={styles.sectionTitle}>Scan QR Code to Pay</Text>
                  <View style={styles.qrCodeWrapper}>
                    <QRCode
                      value="omari:payment?amount=0&reference=MyChangeX"
                      size={width * 0.6}
                      color={SUCCESS_GREEN}
                      backgroundColor={WHITE}
                      logo={require('../assets/omari.png')}
                      logoSize={width * 0.18}
                      logoBackgroundColor="transparent"
                    />
                  </View>
                  <Text style={styles.qrHint}>Show this at any Omari merchant</Text>
                </View>
              )}
              
              {/* Phone Number Section */}
              {activeTab === 'number' && (
                <View style={styles.formContainer}>
                  <Text style={styles.sectionTitle}>Enter Payment Details</Text>
                  
                  <View style={styles.inputContainer}>
                    <MaterialIcons 
                      name="phone" 
                      size={24} 
                      color={SUCCESS_GREEN} 
                      style={styles.inputIcon} 
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Omari Number"
                      placeholderTextColor={LIGHT_TEXT}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      selectionColor={SUCCESS_GREEN}
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      returnKeyType="next"
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <MaterialIcons 
                      name="attach-money" 
                      size={24} 
                      color={SUCCESS_GREEN} 
                      style={styles.inputIcon} 
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Amount"
                      placeholderTextColor={LIGHT_TEXT}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      selectionColor={SUCCESS_GREEN}
                      returnKeyType="done"
                    />
                  </View>
                  
                  <Pressable 
                    style={({ pressed }) => [
                      styles.payButton,
                      pressed && styles.payButtonPressed
                    ]}
                    onPress={handlePayment}
                    android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    <View style={styles.buttonBackground}>
                      <Text style={styles.payButtonText}>Confirm Payment</Text>
                    </View>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Send Options Modal */}
        <Modal
          animationType={Platform.OS === 'ios' ? 'fade' : 'slide'}
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setModalVisible(false)}
          >
            <View style={styles.centeredView}>
              <Pressable style={styles.modalView} onPress={(e) => e.stopPropagation()}>
                {/* Logo in modal */}
                <View style={styles.modalLogoContainer}>
                  <Image 
                    source={require('../assets/omari.png')}
                    style={styles.modalLogo}
                    resizeMode="contain"
                  />
                </View>
                
                <Text style={styles.modalTitle}>Confirm PIN for the payment</Text>
                
                {/* PIN Input */}
                <View style={[styles.inputContainer, { marginBottom: 8, backgroundColor: WHITE }]}>
                  <MaterialIcons name="lock" size={24} color={SUCCESS_GREEN} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: DARK_TEXT }]}
                    placeholder="Enter PIN"
                    placeholderTextColor={LIGHT_TEXT}
                    secureTextEntry={true}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                
                <Pressable
                  style={styles.optionButton}
                  onPress={() => handleOptionSelect('Omari')}
                  android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  <Text style={styles.optionText}>Confirm</Text>
                </Pressable>
                
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  logoBorderContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: WHITE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    padding: 16,
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: SUCCESS_GREEN,
  },
  logo: {
    width: 80,
    height: 80,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: DARK_TEXT,
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: SUCCESS_GREEN,
  },
  pressedTab: {
    opacity: 0.8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_TEXT,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  activeTabText: {
    color: WHITE,
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  qrCodeWrapper: {
    backgroundColor: WHITE,
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: SUCCESS_GREEN,
    ...Platform.select({
      ios: {
        shadowColor: SUCCESS_GREEN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  qrHint: {
    fontSize: 14,
    color: LIGHT_TEXT,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  formContainer: {
    marginTop: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 56,
    borderWidth: 1.5,
    borderColor: SUCCESS_GREEN,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    paddingVertical: 0,
    includeFontPadding: false,
  },
  payButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 24,
    ...Platform.select({
      ios: {
        shadowColor: SUCCESS_GREEN,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  buttonBackground: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS_GREEN,
    borderRadius: 12,
  },
  payButtonPressed: {
    opacity: 0.9,
  },
  payButtonText: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredView: {
    width: '80%',
    maxWidth: 400,
  },
  modalView: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: SUCCESS_GREEN,
    ...Platform.select({
      ios: {
        shadowColor: SUCCESS_GREEN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalLogoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SUCCESS_GREEN,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    padding: 12,
  },
  modalLogo: {
    width: 56,
    height: 56,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 20,
    textAlign: 'center',
  },
  optionButton: {
    width: '100%',
    padding: 16,
    backgroundColor: SUCCESS_GREEN,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  optionText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
    borderWidth: 1.5,
    borderColor: SUCCESS_GREEN,
  },
  cancelText: {
    color: SUCCESS_GREEN,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OmariScreen;