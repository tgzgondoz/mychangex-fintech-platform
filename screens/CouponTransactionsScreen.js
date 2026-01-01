import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase, getUserSession } from './supabase';
import { Ionicons } from '@expo/vector-icons';

// Updated to match HomeScreen color scheme
const BACKGROUND_COLOR = "#f8f9fa";
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

const CouponTransactionsScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [couponTransactions, setCouponTransactions] = useState([]);
  const [userBalance, setUserBalance] = useState(0);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) {
        loadCouponTransactions(userId);
        refreshBalance();
      }
    });

    return unsubscribe;
  }, [navigation, userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        navigation.navigate('Login');
        return;
      }

      const currentUserId = sessionResult.user.id;
      setUserId(currentUserId);
      setUserBalance(sessionResult.user.balance || 0);
      
      await loadCouponTransactions(currentUserId);
    } catch (error) {
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const refreshBalance = async () => {
    try {
      const sessionResult = await getUserSession();
      if (sessionResult.success && sessionResult.user) {
        setUserBalance(sessionResult.user.balance || 0);
      }
    } catch (error) {
      // Silently fail for balance refresh
    }
  };

  const loadCouponTransactions = async (currentUserId) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .lt('amount', 1.00)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        setCouponTransactions([]);
        return;
      }

      if (data && data.length > 0) {
        await processTransactionData(data, currentUserId);
      } else {
        setCouponTransactions([]);
      }
    } catch (error) {
      setCouponTransactions([]);
    }
  };

  const processTransactionData = async (data, currentUserId) => {
    try {
      const userIds = new Set();
      data.forEach(tx => {
        userIds.add(tx.sender_id);
        userIds.add(tx.receiver_id);
      });
      
      const uniqueUserIds = Array.from(userIds);
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', uniqueUserIds);
      
      const profileMap = {};
      if (profiles) {
        profiles.forEach(profile => {
          profileMap[profile.id] = {
            full_name: profile.full_name || `User ${profile.id.substring(0, 8)}...`,
            phone: profile.phone || 'N/A'
          };
        });
      }
      
      const formattedTransactions = data.map(tx => {
        const amount = parseFloat(tx.amount);
        const isReceived = tx.receiver_id === currentUserId;
        
        const senderInfo = profileMap[tx.sender_id] || {
          full_name: `User ${tx.sender_id.substring(0, 8)}...`,
          phone: 'N/A'
        };
        
        const receiverInfo = profileMap[tx.receiver_id] || {
          full_name: `User ${tx.receiver_id.substring(0, 8)}...`,
          phone: 'N/A'
        };

        return {
          id: tx.id,
          amount: amount.toFixed(2),
          rawAmount: amount,
          isReceived: isReceived,
          senderName: senderInfo.full_name,
          receiverName: receiverInfo.full_name,
          senderPhone: senderInfo.phone,
          receiverPhone: receiverInfo.phone,
          createdAt: new Date(tx.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          originalSenderId: tx.sender_id,
          type: tx.type || 'transfer',
          formattedDate: new Date(tx.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          formattedTime: new Date(tx.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })
        };
      });
      
      setCouponTransactions(formattedTransactions);
    } catch (error) {
      const basicTransactions = data.map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount).toFixed(2),
        rawAmount: parseFloat(tx.amount),
        isReceived: tx.receiver_id === currentUserId,
        senderName: `User ${tx.sender_id.substring(0, 8)}...`,
        receiverName: `User ${tx.receiver_id.substring(0, 8)}...`,
        senderPhone: 'N/A',
        receiverPhone: 'N/A',
        createdAt: new Date(tx.created_at).toLocaleDateString(),
        formattedDate: new Date(tx.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        formattedTime: new Date(tx.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        originalSenderId: tx.sender_id,
        type: tx.type || 'transfer'
      }));
      setCouponTransactions(basicTransactions);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleSendBack = (transaction) => {
    if (!transaction.isReceived) {
      Alert.alert('Cannot Send Back', 'You can only send back coupons that you received');
      return;
    }

    if (!transaction.originalSenderId || transaction.originalSenderId === userId) {
      Alert.alert('Cannot Send Back', 'Cannot send back to yourself');
      return;
    }

    // Navigate with ALL necessary data for automatic send-back
    navigation.navigate('MyChangeX', {
      sendBackMode: true,
      sendBackData: {
        recipientId: transaction.originalSenderId,
        recipientPhone: transaction.senderPhone,
        recipientName: transaction.senderName,
        presetAmount: transaction.amount
      }
    });
  };

  const handleViewTransactionHistory = (transaction) => {
    Alert.alert(
      'Transaction Details',
      `Amount: $${transaction.amount}\n` +
      `Status: ${transaction.isReceived ? 'Received' : 'Sent'}\n` +
      `From: ${transaction.senderName}\n` +
      `To: ${transaction.receiverName}\n` +
      `Date: ${transaction.formattedDate}\n` +
      `Time: ${transaction.formattedTime}\n` +
      `Type: ${transaction.type}`,
      [
        { text: 'Close', style: 'default' },
        transaction.isReceived && {
          text: 'Send Back',
          style: 'default',
          onPress: () => handleSendBack(transaction)
        }
      ].filter(Boolean)
    );
  };

  const formatPhoneNumber = (phone) => {
    if (!phone || phone === 'N/A') return phone;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("263") && cleaned.length === 12) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 12)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <View style={[styles.background, styles.centerContent]}>
        <ActivityIndicator size="large" color={PRIMARY_BLUE} />
        <Text style={styles.loadingText}>Loading coupon transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={BACKGROUND_COLOR}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButtonContainer}
          >
            <Ionicons name="arrow-back" size={24} color={DARK_TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Coupon Transactions</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceLabelContainer}>
              <Ionicons name="wallet-outline" size={16} color={LIGHT_TEXT} />
              <Text style={styles.balanceLabel}>Total Balance</Text>
            </View>
          </View>
          <View style={styles.balanceAmountContainer}>
            <Text style={styles.balanceAmount}>${parseFloat(userBalance).toFixed(2)}</Text>
            <Text style={styles.balanceCurrency}> USD</Text>
          </View>
          <Text style={styles.balanceSubtitle}>Tap on Home screen to toggle visibility</Text>
        </View>

        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_BLUE}
              colors={[PRIMARY_BLUE]}
              title="Refreshing..."
              titleColor={DARK_TEXT}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Coupon Transactions
            </Text>
            <View style={styles.transactionCountBadge}>
              <Text style={styles.transactionCountText}>
                {couponTransactions.length}
              </Text>
            </View>
          </View>

          {couponTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color={LIGHT_TEXT} />
              <Text style={styles.emptyStateText}>No coupon transactions found</Text>
              <Text style={styles.emptyStateSubtext}>
                Coupon transactions are amounts less than $1.00
              </Text>
            </View>
          ) : (
            <>
              {couponTransactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionHeader}>
                    <View style={styles.transactionIconContainer}>
                      <View style={[
                        styles.transactionIcon,
                        { backgroundColor: transaction.isReceived ? SUCCESS_GREEN : ERROR_RED }
                      ]}>
                        <Ionicons 
                          name={transaction.isReceived ? "arrow-down" : "arrow-up"} 
                          size={20} 
                          color={WHITE} 
                        />
                      </View>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionName}>
                          {transaction.isReceived ? 'Received from' : 'Sent to'}
                        </Text>
                        <Text style={styles.transactionPerson}>
                          {transaction.isReceived ? transaction.senderName : transaction.receiverName}
                        </Text>
                        <Text style={styles.transactionPhone}>
                          {formatPhoneNumber(transaction.isReceived ? transaction.senderPhone : transaction.receiverPhone)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.transactionAmountContainer}>
                      <Text style={[
                        styles.transactionAmount,
                        transaction.isReceived ? styles.receivedAmount : styles.sentAmount
                      ]}>
                        {transaction.isReceived ? '+' : '-'}${transaction.amount}
                      </Text>
                      <Text style={styles.transactionDate}>
                        {transaction.formattedDate}
                      </Text>
                      <Text style={styles.transactionTime}>
                        {transaction.formattedTime}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.transactionDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Type:</Text>
                      <Text style={styles.detailValue}>{transaction.type}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Transaction ID:</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>
                        {transaction.id.substring(0, 8)}...
                      </Text>
                    </View>
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleViewTransactionHistory(transaction)}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={PRIMARY_BLUE} />
                      <Text style={styles.actionButtonText}>View Details</Text>
                    </TouchableOpacity>
                    
                    {transaction.isReceived && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.sendBackButton]}
                        onPress={() => handleSendBack(transaction)}
                      >
                        <Ionicons name="arrow-redo-outline" size={16} color={WHITE} />
                        <Text style={[styles.actionButtonText, styles.sendBackButtonText]}>Send Back</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}
          
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle-outline" size={20} color={PRIMARY_BLUE} />
              <Text style={styles.infoTitle}>Coupon Rules</Text>
            </View>
            <View style={styles.infoContent}>
              <View style={styles.infoItem}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>Coupons are amounts less than $1.00</Text>
              </View>
              <View style={styles.infoItem}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>Received coupons can only be sent back to the original sender</Text>
              </View>
              <View style={styles.infoItem}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>Click "Send Back" to automatically send the same amount back</Text>
              </View>
              <View style={styles.infoItem}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>This prevents coupon misuse and ensures proper tracking</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: BACKGROUND_COLOR,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: DARK_TEXT,
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: BACKGROUND_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  backButtonContainer: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  headerTitle: {
    color: DARK_TEXT,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  balanceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: '500',
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  balanceAmount: {
    color: DARK_TEXT,
    fontSize: 36,
    fontWeight: '800',
  },
  balanceCurrency: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  balanceSubtitle: {
    color: LIGHT_TEXT,
    fontSize: 12,
    fontWeight: '400',
  },
  container: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: '600',
  },
  transactionCountBadge: {
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e4ff',
  },
  transactionCountText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 40,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  emptyStateText: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: LIGHT_TEXT,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  transactionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  transactionIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionName: {
    color: LIGHT_TEXT,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  transactionPerson: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionPhone: {
    color: LIGHT_TEXT,
    fontSize: 14,
    marginBottom: 4,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 4,
  },
  receivedAmount: {
    color: SUCCESS_GREEN,
  },
  sentAmount: {
    color: ERROR_RED,
  },
  transactionDate: {
    color: LIGHT_TEXT,
    fontSize: 12,
    marginBottom: 2,
  },
  transactionTime: {
    color: LIGHT_TEXT,
    fontSize: 12,
    fontWeight: '400',
  },
  transactionDetails: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabel: {
    color: LIGHT_TEXT,
    fontSize: 13,
    fontWeight: '500',
  },
  detailValue: {
    color: DARK_TEXT,
    fontSize: 13,
    fontWeight: '400',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LIGHT_BLUE,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e4ff',
    gap: 8,
  },
  actionButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  sendBackButton: {
    backgroundColor: SUCCESS_GREEN,
    borderColor: 'rgba(0, 200, 83, 0.3)',
  },
  sendBackButtonText: {
    color: WHITE,
  },
  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  infoTitle: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  infoContent: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY_BLUE,
    marginTop: 6,
  },
  infoText: {
    color: LIGHT_TEXT,
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});

export default CouponTransactionsScreen;