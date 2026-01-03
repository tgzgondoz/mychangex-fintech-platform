import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
  Alert
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { 
  supabase, 
  getUserSession
} from './supabase';

const { width } = Dimensions.get('window');

// Updated colors to match original coupon transactions design
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

// Transaction Item Component - Updated to match coupon transactions style
const TransactionItem = ({ transaction, userId, onViewDetails, onSendBack }) => {
  const isReceived = transaction.receiver_id === userId;
  const isCoupon = parseFloat(transaction.amount) < 1.00;

  const formatAmount = () => {
    const amount = parseFloat(transaction.amount);
    return `${isReceived ? '+' : '-'}$${amount.toFixed(2)}`;
  };

  const getTransactionType = () => {
    return isReceived ? 'Received' : 'Sent';
  };

  const getTransactionIcon = () => {
    return isReceived ? "arrow-down" : "arrow-up";
  };

  const getTransactionColor = () => {
    return isReceived ? SUCCESS_GREEN : ERROR_RED;
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return new Date(dateString).toLocaleDateString();
    }
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return '';
    }
  };

  const getCounterpartyName = () => {
    if (isReceived) {
      return transaction.senderName || `User ${transaction.sender_id?.substring(0, 8)}...`;
    } else {
      return transaction.receiverName || `User ${transaction.receiver_id?.substring(0, 8)}...`;
    }
  };

  const getCounterpartyPhone = () => {
    if (isReceived) {
      return transaction.senderPhone || 'N/A';
    } else {
      return transaction.receiverPhone || 'N/A';
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone || phone === 'N/A') return phone;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("263") && cleaned.length === 12) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 12)}`;
    }
    return phone;
  };

  return (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionIconContainer}>
          <View style={[
            styles.transactionIcon,
            { backgroundColor: `${getTransactionColor()}20` }
          ]}>
            <Ionicons 
              name={getTransactionIcon()} 
              size={20} 
              color={getTransactionColor()} 
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionName}>
              {getTransactionType()}
            </Text>
            <Text style={styles.transactionPerson}>
              {getCounterpartyName()}
            </Text>
            <Text style={styles.transactionPhone}>
              {formatPhoneNumber(getCounterpartyPhone())}
            </Text>
          </View>
        </View>
        <View style={styles.transactionAmountContainer}>
          <Text style={[
            styles.transactionAmount,
            { color: getTransactionColor() }
          ]}>
            {formatAmount()}
          </Text>
          <Text style={styles.transactionDate}>
            {formatDate(transaction.created_at)}
          </Text>
          <Text style={styles.transactionTime}>
            {formatTime(transaction.created_at)}
          </Text>
        </View>
      </View>

      {transaction.type && (
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
      )}

      <View style={styles.buttonContainer}>
        <Pressable
          style={styles.actionButton}
          onPress={() => onViewDetails(transaction)}
        >
          <Ionicons name="information-circle-outline" size={16} color={PRIMARY_BLUE} />
          <Text style={styles.actionButtonText}>View Details</Text>
        </Pressable>
        
        {isReceived && isCoupon && (
          <Pressable
            style={[styles.actionButton, styles.sendBackButton]}
            onPress={() => onSendBack(transaction)}
          >
            <Ionicons name="arrow-redo-outline" size={16} color={WHITE} />
            <Text style={[styles.actionButtonText, styles.sendBackButtonText]}>Send Back</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

// Empty State Component - Updated design
const EmptyState = ({ onRefresh, refreshing }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <Ionicons name="receipt-outline" size={64} color={LIGHT_TEXT} />
    </View>
    <Text style={styles.emptyTitle}>No Transactions Yet</Text>
    <Text style={styles.emptySubtitle}>
      Your transaction history will appear here once you start sending or receiving coupons.
    </Text>
    <Pressable 
      style={styles.emptyButton}
      onPress={onRefresh}
      disabled={refreshing}
    >
      <Text style={styles.emptyButtonText}>
        {refreshing ? 'Refreshing...' : 'Refresh'}
      </Text>
    </Pressable>
  </View>
);

// Error State Component - Updated design
const ErrorState = ({ message, onRetry, loading }) => (
  <View style={styles.errorState}>
    <View style={styles.errorIcon}>
      <Ionicons name="alert-circle-outline" size={64} color={ERROR_RED} />
    </View>
    <Text style={styles.errorTitle}>Unable to Load Transactions</Text>
    <Text style={styles.errorMessage}>{message}</Text>
    <Pressable 
      style={styles.retryButton}
      onPress={onRetry}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={WHITE} />
      ) : (
        <Text style={styles.retryButtonText}>Try Again</Text>
      )}
    </Pressable>
  </View>
);

// Transaction Details Modal Component
const TransactionDetailsModal = ({ visible, transaction, onClose, onSendBack, userId }) => {
  if (!transaction) return null;

  const isReceived = transaction.receiver_id === userId;
  const isCoupon = parseFloat(transaction.amount) < 1.00;

  const formatPhoneNumber = (phone) => {
    if (!phone || phone === 'N/A') return phone;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("263") && cleaned.length === 12) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 12)}`;
    }
    return phone;
  };

  const getSenderName = () => {
    return transaction.senderName || `User ${transaction.sender_id?.substring(0, 8)}...`;
  };

  const getReceiverName = () => {
    return transaction.receiverName || `User ${transaction.receiver_id?.substring(0, 8)}...`;
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Transaction Details</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={LIGHT_TEXT} />
            </Pressable>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.modalAmountContainer}>
              <Text style={[
                styles.modalAmount,
                { color: isReceived ? SUCCESS_GREEN : ERROR_RED }
              ]}>
                {isReceived ? '+' : '-'}${parseFloat(transaction.amount).toFixed(2)}
              </Text>
              <Text style={styles.modalAmountLabel}>
                {isReceived ? 'Received' : 'Sent'}
              </Text>
            </View>
            
            <View style={styles.modalDivider} />
            
            <View style={styles.modalDetails}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>From:</Text>
                <Text style={styles.modalDetailValue}>{getSenderName()}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Sender Phone:</Text>
                <Text style={styles.modalDetailValue}>{formatPhoneNumber(transaction.senderPhone)}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>To:</Text>
                <Text style={styles.modalDetailValue}>{getReceiverName()}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Receiver Phone:</Text>
                <Text style={styles.modalDetailValue}>{formatPhoneNumber(transaction.receiverPhone)}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Date:</Text>
                <Text style={styles.modalDetailValue}>
                  {new Date(transaction.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Time:</Text>
                <Text style={styles.modalDetailValue}>
                  {new Date(transaction.created_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Type:</Text>
                <Text style={styles.modalDetailValue}>{transaction.type || 'transfer'}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Transaction ID:</Text>
                <Text style={styles.modalDetailValue}>{transaction.id}</Text>
              </View>
            </View>
            
            <View style={styles.modalButtonContainer}>
              {isReceived && isCoupon && (
                <Pressable
                  style={[styles.modalButton, styles.sendBackModalButton]}
                  onPress={() => {
                    onClose();
                    onSendBack(transaction);
                  }}
                >
                  <Ionicons name="arrow-redo-outline" size={18} color={WHITE} />
                  <Text style={styles.sendBackModalButtonText}>Send Back</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.modalButton, styles.closeModalButton]}
                onPress={onClose}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const TransactionHistory = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Process transaction data with profiles
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
          ...tx,
          amount: amount.toFixed(2),
          rawAmount: amount,
          isReceived,
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
      
      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Error processing transaction data:', error);
      const basicTransactions = data.map(tx => ({
        ...tx,
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
      setTransactions(basicTransactions);
    }
  };

  // Load transactions
  const loadTransactions = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      // Check authentication first
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        throw new Error('Authentication required');
      }

      const currentUserId = sessionResult.user.id;
      setUserId(currentUserId);
      setUserBalance(sessionResult.user.balance || 0);

      // Load transactions (coupon transactions are amounts < $1.00)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .lt('amount', 1.00)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.length > 0) {
        await processTransactionData(data, currentUserId);
      } else {
        setTransactions([]);
      }

    } catch (error) {
      console.error('Error loading transactions:', error);
      setError(error.message);
      setTransactions([]);
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isFocused) {
      loadTransactions();
      setAuthChecked(true);
    }
  }, [isFocused]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransactions(false);
  }, []);

  // Retry loading
  const handleRetry = () => {
    loadTransactions();
  };

  // Calculate totals for coupon transactions
  const calculateTotals = () => {
    let totalReceived = 0;
    let totalSent = 0;

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      if (transaction.receiver_id === userId) {
        totalReceived += amount;
      } else {
        totalSent += amount;
      }
    });

    return { totalReceived, totalSent };
  };

  const { totalReceived, totalSent } = calculateTotals();

  // Handle send back
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

  // Handle view details
  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setModalVisible(true);
  };

  // Close modal
  const closeModal = () => {
    setModalVisible(false);
    setSelectedTransaction(null);
  };

  // Group transactions by date
  const groupTransactionsByDate = () => {
    const groups = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
    });

    return groups;
  };

  const transactionGroups = groupTransactionsByDate();

  // Format group header date
  const formatGroupDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  if (loading && !authChecked) {
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
          <Pressable 
            onPress={() => navigation.goBack()}
            style={styles.backButtonContainer}
          >
            <Ionicons name="arrow-back" size={24} color={DARK_TEXT} />
          </Pressable>
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
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_BLUE}
              colors={[PRIMARY_BLUE]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {transactions.length > 0 && (
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryIconReceived}>
                  <Ionicons name="arrow-down" size={20} color={SUCCESS_GREEN} />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryLabel}>Coupons Received</Text>
                  <Text style={styles.summaryAmountReceived}>
                    +${totalReceived.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIconSent}>
                  <Ionicons name="arrow-up" size={20} color={ERROR_RED} />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryLabel}>Coupons Sent</Text>
                  <Text style={styles.summaryAmountSent}>
                    -${totalSent.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.transactionsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Coupon Transactions
              </Text>
              <View style={styles.transactionCountBadge}>
                <Text style={styles.transactionCountText}>
                  {transactions.length}
                </Text>
              </View>
            </View>

            {error ? (
              <ErrorState 
                message={error} 
                onRetry={handleRetry}
                loading={loading}
              />
            ) : transactions.length === 0 ? (
              <EmptyState 
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            ) : (
              Object.entries(transactionGroups).map(([date, dayTransactions]) => (
                <View key={date} style={styles.dateGroup}>
                  <Text style={styles.dateHeader}>
                    {formatGroupDate(date)}
                  </Text>
                  {dayTransactions.map((transaction) => (
                    <TransactionItem 
                      key={transaction.id} 
                      transaction={transaction} 
                      userId={userId}
                      onViewDetails={handleViewDetails}
                      onSendBack={handleSendBack}
                    />
                  ))}
                </View>
              ))
            )}
          </View>

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

          <View style={styles.footerSpacer} />
        </ScrollView>
      </SafeAreaView>

      <TransactionDetailsModal
        visible={modalVisible}
        transaction={selectedTransaction}
        onClose={closeModal}
        onSendBack={handleSendBack}
        userId={userId}
      />
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
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
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
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: LIGHT_BLUE,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  summaryIconReceived: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryIconSent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryText: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: LIGHT_TEXT,
    marginBottom: 4,
  },
  summaryAmountReceived: {
    fontSize: 18,
    fontWeight: '700',
    color: SUCCESS_GREEN,
  },
  summaryAmountSent: {
    fontSize: 18,
    fontWeight: '700',
    color: ERROR_RED,
  },
  transactionsSection: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  transactionCountText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  dateGroup: {
    marginBottom: 8,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_TEXT,
    marginBottom: 12,
    marginTop: 8,
  },
  transactionCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
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
    gap: 8,
  },
  actionButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  sendBackButton: {
    backgroundColor: SUCCESS_GREEN,
  },
  sendBackButtonText: {
    color: WHITE,
  },
  emptyState: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: LIGHT_TEXT,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  errorState: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    color: LIGHT_TEXT,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: PRIMARY_BLUE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
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
  footerSpacer: {
    height: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: WHITE,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  modalTitle: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  modalAmountContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalAmountLabel: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: '500',
  },
  modalDivider: {
    height: 1,
    backgroundColor: CARD_BORDER,
    marginVertical: 20,
  },
  modalDetails: {
    gap: 12,
    marginBottom: 24,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalDetailLabel: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: '500',
    width: '35%',
  },
  modalDetailValue: {
    color: DARK_TEXT,
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  modalButtonContainer: {
    gap: 12,
  },
  modalButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBackModalButton: {
    backgroundColor: SUCCESS_GREEN,
    flexDirection: 'row',
    gap: 8,
  },
  sendBackModalButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: LIGHT_BLUE,
  },
  closeModalButtonText: {
    color: PRIMARY_BLUE,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TransactionHistory;