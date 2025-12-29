import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#e9edf9";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.15)";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";

const SendScreen = () => {
  const navigation = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('0.25');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, []);

  return (
    <View style={styles.background}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_BLUE} />
      <LinearGradient
        colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header - Matching HomeScreen style */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={WHITE} />
            </TouchableOpacity>
            <View style={styles.headerLeft}>
              <Ionicons name="send-outline" size={28} color={WHITE} />
              <Text style={styles.headerTitle}>Send Coupons</Text>
            </View>
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => navigation.navigate('Help')}
            >
              <Ionicons name="help-circle-outline" size={24} color={WHITE} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Instructions Card */}
              <View style={[styles.card, styles.instructionsCard]}>
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                  style={styles.instructionsGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.instructionsIcon}>
                    <Ionicons name="information-circle" size={24} color={WHITE} />
                  </View>
                  <Text style={styles.instructionsText}>
                    Send coupons to any phone number. Receiver will get SMS with coupon code.
                  </Text>
                </LinearGradient>
              </View>

              {/* Recipient Input Card */}
              <View style={[styles.card, styles.inputCard]}>
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                  style={styles.inputCardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.inputHeader}>
                    <View style={styles.inputIcon}>
                      <Ionicons name="person-outline" size={20} color={WHITE} />
                    </View>
                    <Text style={styles.inputLabel}>Recipient Phone Number</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number (e.g., +263 77 123 4567)"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.inputFooter}>
                    <Text style={styles.inputFooterText}>
                      Enter the receiver's phone number with country code
                    </Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Amount Input Card */}
              <View style={[styles.card, styles.amountCard]}>
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                  style={styles.amountCardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.amountHeader}>
                    <View style={styles.amountIcon}>
                      <Ionicons name="cash-outline" size={20} color={WHITE} />
                    </View>
                    <Text style={styles.amountLabel}>Coupon Amount</Text>
                  </View>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      placeholder="0.00"
                    />
                  </View>
                  <View style={styles.quickAmounts}>
                    <TouchableOpacity 
                      style={styles.quickAmountButton}
                      onPress={() => setAmount('0.25')}
                    >
                      <Text style={styles.quickAmountText}>$0.25</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.quickAmountButton}
                      onPress={() => setAmount('0.50')}
                    >
                      <Text style={styles.quickAmountText}>$0.50</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.quickAmountButton}
                      onPress={() => setAmount('1.00')}
                    >
                      <Text style={styles.quickAmountText}>$1.00</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.quickAmountButton}
                      onPress={() => setAmount('2.00')}
                    >
                      <Text style={styles.quickAmountText}>$2.00</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>

              {/* Balance Display Card */}
              <View style={[styles.card, styles.balanceCard]}>
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                  style={styles.balanceGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.balanceHeader}>
                    <View style={styles.balanceIcon}>
                      <Ionicons name="wallet-outline" size={20} color={WHITE} />
                    </View>
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                  </View>
                  <View style={styles.balanceAmountContainer}>
                    <Text style={styles.balanceAmount}>$2.40</Text>
                    <Text style={styles.balanceCurrency}>USD</Text>
                  </View>
                  <View style={styles.balanceFooter}>
                    <Text style={styles.balanceFooterText}>
                      Coupon balance available for sending
                    </Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Summary Card */}
              <View style={[styles.card, styles.summaryCard]}>
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                  style={styles.summaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.summaryTitle}>Transaction Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount to Send:</Text>
                    <Text style={styles.summaryValue}>${amount || '0.00'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Service Fee:</Text>
                    <Text style={styles.summaryValue}>$0.00</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryTotalLabel}>Total:</Text>
                    <Text style={styles.summaryTotalValue}>${amount || '0.00'}</Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Send Button */}
              <TouchableOpacity 
                style={styles.sendButton}
                onPress={() => navigation.navigate('SuccessPay')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                  style={styles.sendButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="send" size={24} color={WHITE} />
                  <Text style={styles.sendButtonText}>SEND COUPONS</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Security Note */}
              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark" size={16} color="rgba(255, 255, 255, 0.7)" />
                <Text style={styles.securityText}>
                  Your transaction is secured with end-to-end encryption
                </Text>
              </View>

              {/* Footer Spacer */}
              <View style={styles.footerSpacer} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: PRIMARY_BLUE,
  },
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  helpButton: {
    padding: 8,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  instructionsCard: {
    marginTop: 10,
  },
  instructionsGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionsIcon: {
    marginRight: 12,
  },
  instructionsText: {
    color: WHITE,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  inputCard: {},
  inputCardGradient: {
    padding: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  inputLabel: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: WHITE,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 12,
  },
  inputFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputFooterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  amountCard: {},
  amountCardGradient: {
    padding: 20,
  },
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  amountIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  amountLabel: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 16,
  },
  dollarSign: {
    fontSize: 20,
    paddingLeft: 16,
    paddingRight: 8,
    color: WHITE,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    padding: 16,
    fontSize: 20,
    color: WHITE,
    fontWeight: '600',
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAmountButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  quickAmountText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  balanceCard: {},
  balanceGradient: {
    padding: 20,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  balanceLabel: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  balanceAmount: {
    color: WHITE,
    fontSize: 32,
    fontWeight: '700',
    marginRight: 8,
  },
  balanceCurrency: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  balanceFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  balanceFooterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  summaryCard: {},
  summaryGradient: {
    padding: 20,
  },
  summaryTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  summaryValue: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  summaryTotalLabel: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  summaryTotalValue: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '700',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  sendButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  securityText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  footerSpacer: {
    height: 20,
  },
});

export default SendScreen;