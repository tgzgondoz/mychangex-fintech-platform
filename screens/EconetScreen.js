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
  Image
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const DARK_TEXT = "#1A1A1A";
const LIGHT_TEXT = "#666666";
const CARD_BORDER = "#eaeaea";
const BACKGROUND_COLOR = "#f8f9fa";

const EconetScreen = () => {
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

  const handleSendPress = () => {
    setModalVisible(true);
  };

  const handleOptionSelect = (option) => {
    setModalVisible(false);
    console.log(`Selected: ${option}`);
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
              {/* Logo with blue border background */}
              <View style={styles.logoBorderContainer}>
                <Image 
                  source={require('../assets/ecocash.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              
              <Text style={styles.header}>Ecocash Payment</Text>
              
              {/* Tab Selector */}
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
              
              {/* QR Code Section */}
              {activeTab === 'qr' && (
                <View style={styles.qrContainer}>
                  <Text style={styles.sectionTitle}>Scan QR Code to Pay</Text>
                  <View style={styles.qrCodeWrapper}>
                    <QRCode
                      value="ecocash:payment?amount=0&reference=MyChangeX"
                      size={width * 0.6}
                      color={PRIMARY_BLUE}
                      backgroundColor={WHITE}
                      logo={require('../assets/ecocash.png')}
                      logoSize={60}
                      logoBackgroundColor="transparent"
                    />
                  </View>
                  <Text style={styles.qrHint}>Show this at any Ecocash merchant</Text>
                </View>
              )}
              
              {/* Phone Number Section */}
              {activeTab === 'number' && (
                <View style={styles.formContainer}>
                  <Text style={styles.sectionTitle}>Enter Payment Details</Text>
                  
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="phone" size={24} color={PRIMARY_BLUE} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ecocash Number"
                      placeholderTextColor={LIGHT_TEXT}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      selectionColor={PRIMARY_BLUE}
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      returnKeyType="next"
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="attach-money" size={24} color={PRIMARY_BLUE} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Amount"
                      placeholderTextColor={LIGHT_TEXT}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      selectionColor={PRIMARY_BLUE}
                      returnKeyType="done"
                    />
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.payButton} 
                    onPress={handleSendPress}
                    activeOpacity={0.8}
                  >
                    <View style={styles.buttonBackground}>
                      <Text style={styles.payButtonText}>Confirm Payment</Text>
                    </View>
                  </TouchableOpacity>
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
              <View style={styles.modalView}>
                {/* Logo in modal */}
                <View style={styles.modalLogoContainer}>
                  <Image 
                    source={require('../assets/ecocash.png')}
                    style={styles.modalLogo}
                    resizeMode="contain"
                  />
                </View>
                
                <Text style={styles.modalTitle}>Confirm PIN for the payment</Text>
                
                {/* PIN Input */}
                <View style={[styles.inputContainer, { marginBottom: 8, backgroundColor: WHITE }]}>
                  <MaterialIcons name="lock" size={24} color={PRIMARY_BLUE} style={styles.inputIcon} />
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
                  onPress={() => handleOptionSelect('Ecocash')}
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
              </View>
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
    backgroundColor: PRIMARY_BLUE,
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
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    borderWidth: 1,
    borderColor: CARD_BORDER,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
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
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 12,
  },
  payButtonText: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centeredView: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalView: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalLogoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PRIMARY_BLUE,
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
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
    color: DARK_TEXT,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    textAlign: 'center',
  },
  optionButton: {
    width: '100%',
    padding: 16,
    marginVertical: 8,
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  cancelButton: {
    width: '100%',
    padding: 16,
    marginTop: 16,
    backgroundColor: BACKGROUND_COLOR,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  cancelText: {
    color: PRIMARY_BLUE,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default EconetScreen;