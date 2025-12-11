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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase, getUserSession } from './supabase';

const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";

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
          type: tx.type || 'transfer'
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
      'Transaction History',
      `Transaction Details:\n\n` +
      `Amount: $${transaction.amount}\n` +
      `Status: ${transaction.isReceived ? 'Received' : 'Sent'}\n` +
      `From: ${transaction.senderName}\n` +
      `To: ${transaction.receiverName}\n` +
      `Sender Phone: ${transaction.senderPhone}\n` +
      `Receiver Phone: ${transaction.receiverPhone}\n` +
      `Date: ${transaction.createdAt}\n` +
      `Type: ${transaction.type}`,
      [
        { text: 'OK', style: 'default' },
        transaction.isReceived && {
          text: 'Send Back',
          style: 'default',
          onPress: () => handleSendBack(transaction)
        }
      ].filter(Boolean)
    );
  };

  if (loading) {
    return (
      <View style={[styles.background, styles.centerContent]}>
        <ActivityIndicator size="large" color={LIGHT_TEXT} />
        <Text style={styles.loadingText}>Loading coupon transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Coupon Transactions</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>${parseFloat(userBalance).toFixed(2)}</Text>
          <Text style={styles.balanceSubtitle}>Tap balance on Home to view</Text>
        </View>

        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={LIGHT_TEXT}
              colors={[LIGHT_TEXT]}
            />
          }
        >
          <Text style={styles.sectionTitle}>
            Coupon Transactions ({couponTransactions.length})
          </Text>

          {couponTransactions.length === 0 ? (
            <View style={styles.emptyState}>
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
                    <View style={styles.merchantContainer}>
                      <View style={[
                        styles.merchantIcon,
                        { backgroundColor: transaction.isReceived ? '#4CAF50' : '#FF6B6B' }
                      ]}>
                        <Text style={styles.merchantIconText}>
                          {transaction.isReceived ? '↓' : '↑'}
                        </Text>
                      </View>
                      <View style={styles.merchantInfo}>
                        <Text style={styles.transactionName}>
                          {transaction.isReceived ? transaction.senderName : transaction.receiverName}
                        </Text>
                        <Text style={styles.transactionPhone}>
                          {transaction.isReceived ? transaction.senderPhone : transaction.receiverPhone}
                        </Text>
                        <Text style={styles.transactionDate}>
                          {transaction.createdAt}
                        </Text>
                        <Text style={styles.transactionType}>
                          {transaction.type} • {transaction.isReceived ? 'Received' : 'Sent'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      transaction.isReceived ? styles.receivedAmount : styles.sentAmount
                    ]}>
                      {transaction.isReceived ? '+' : '-'}${transaction.amount}
                    </Text>
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleViewTransactionHistory(transaction)}
                    >
                      <Text style={styles.actionButtonText}>Transaction History</Text>
                    </TouchableOpacity>
                    
                    {transaction.isReceived && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.sendBackButton]}
                        onPress={() => handleSendBack(transaction)}
                      >
                        <Text style={styles.actionButtonText}>Send Back</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}
          
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Coupon Rules:</Text>
            <Text style={styles.infoText}>• Coupons are amounts less than $1.00</Text>
            <Text style={styles.infoText}>• Received coupons can only be sent back to the original sender</Text>
            <Text style={styles.infoText}>• Click "Send Back" to automatically send the same amount back to the sender</Text>
            <Text style={styles.infoText}>• This prevents coupon misuse and ensures proper tracking</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: PRIMARY_BLUE,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: LIGHT_TEXT,
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    color: LIGHT_TEXT,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: LIGHT_TEXT,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  balanceCard: {
    backgroundColor: CARD_COLOR,
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
  },
  balanceAmount: {
    color: LIGHT_TEXT,
    fontSize: 36,
    fontWeight: '800',
  },
  balanceSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 5,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: LIGHT_TEXT,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: CARD_COLOR,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateText: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  transactionCard: {
    backgroundColor: CARD_COLOR,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  merchantContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  merchantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  merchantIconText: {
    color: LIGHT_TEXT,
    fontSize: 18,
    fontWeight: 'bold',
  },
  merchantInfo: {
    flex: 1,
  },
  transactionName: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionPhone: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  transactionDate: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 2,
  },
  transactionType: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  receivedAmount: {
    color: '#4CAF50',
  },
  sentAmount: {
    color: '#FF6B6B',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendBackButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  actionButtonText: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: CARD_COLOR,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  infoTitle: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default CouponTransactionsScreen;