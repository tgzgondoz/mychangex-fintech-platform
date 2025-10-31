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
  Platform
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { 
  supabase, 
  getUserSession, 
  getUserTransactions 
} from './supabase';

const { width } = Dimensions.get('window');

// Transaction Item Component
const TransactionItem = ({ transaction, userId }) => {
  const navigation = useNavigation();

  const formatAmount = (transaction, userId) => {
    const amount = parseFloat(transaction.amount);
    if (transaction.sender_id === userId) {
      return `-$${amount.toFixed(2)}`;
    } else {
      return `+$${amount.toFixed(2)}`;
    }
  };

  const getTransactionType = (transaction, userId) => {
    if (transaction.sender_id === userId) {
      return 'Sent';
    } else {
      return 'Received';
    }
  };

  const getTransactionIcon = (transaction, userId) => {
    if (transaction.sender_id === userId) {
      return 'arrow-up';
    } else {
      return 'arrow-down';
    }
  };

  const getTransactionColor = (transaction, userId) => {
    if (transaction.sender_id === userId) {
      return '#FF6B6B'; // Red for sent
    } else {
      return '#4CAF50'; // Green for received
    }
  };

  const getTransactionCounterparty = (transaction, userId) => {
    if (transaction.sender_id === userId) {
      return 'To User';
    } else {
      return 'From User';
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Unknown date';
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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FFA726';
      case 'failed':
        return '#FF6B6B';
      default:
        return '#666';
    }
  };

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.transactionItem,
        pressed && styles.transactionItemPressed
      ]}
      onPress={() => navigation.navigate('TransactionDetails', { transactionId: transaction.id })}
    >
      <View style={styles.transactionLeft}>
        <View 
          style={[
            styles.transactionIcon,
            { backgroundColor: `${getTransactionColor(transaction, userId)}20` }
          ]}
        >
          <Ionicons 
            name={getTransactionIcon(transaction, userId)} 
            size={20} 
            color={getTransactionColor(transaction, userId)} 
          />
        </View>
        
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionType}>
            {getTransactionType(transaction, userId)}
          </Text>
          <Text style={styles.transactionCounterparty}>
            {getTransactionCounterparty(transaction, userId)}
          </Text>
          <View style={styles.transactionMeta}>
            <Text style={styles.transactionDate}>
              {formatDate(transaction.created_at)}
            </Text>
            <Text style={styles.transactionTime}>
              {formatTime(transaction.created_at)}
            </Text>
            {transaction.status && (
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(transaction.status)}20` }]}>
                <Text style={[styles.statusText, { color: getStatusColor(transaction.status) }]}>
                  {transaction.status}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.transactionRight}>
        <Text style={[
          styles.transactionAmount,
          { color: getTransactionColor(transaction, userId) }
        ]}>
          {formatAmount(transaction, userId)}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#999" />
      </View>
    </Pressable>
  );
};

// Empty State Component
const EmptyState = ({ onRefresh, refreshing }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIcon}>
      <Ionicons name="receipt-outline" size={64} color="#ccc" />
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

// Error State Component
const ErrorState = ({ message, onRetry, loading }) => (
  <View style={styles.errorState}>
    <View style={styles.errorIcon}>
      <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
    </View>
    <Text style={styles.errorTitle}>Unable to Load Transactions</Text>
    <Text style={styles.errorMessage}>{message}</Text>
    <Pressable 
      style={styles.retryButton}
      onPress={onRetry}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text style={styles.retryButtonText}>Try Again</Text>
      )}
    </Pressable>
  </View>
);

const TransactionHistory = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Load transactions
  const loadTransactions = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      console.log('📊 Loading transaction history...');

      // Check authentication first
      const sessionResult = await getUserSession();
      
      if (!sessionResult.success || !sessionResult.user) {
        throw new Error('Authentication required');
      }

      setUserId(sessionResult.user.id);

      // Load transactions using your existing function
      const result = await getUserTransactions(sessionResult.user.id, 5);

      if (result.success) {
        console.log(`✅ Loaded ${result.data?.length || 0} transactions`);
        setTransactions(result.data || []);
      } else {
        throw new Error(result.error || 'Failed to load transactions');
      }

    } catch (error) {
      console.error('❌ Error loading transactions:', error);
      setError(error.message);
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

  // Calculate totals
  const calculateTotals = () => {
    let totalReceived = 0;
    let totalSent = 0;

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      if (transaction.sender_id === userId) {
        totalSent += amount;
      } else {
        totalReceived += amount;
      }
    });

    return { totalReceived, totalSent };
  };

  const { totalReceived, totalSent } = calculateTotals();

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
      <LinearGradient
        colors={['#0136c0', '#0136c0']}
        style={styles.background}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Loading transactions...</Text>
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
          <Pressable 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.headerTitle}>Transaction History</Text>
          <Pressable 
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color="#ffffff" 
              style={refreshing && styles.refreshingIcon} 
            />
          </Pressable>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ffffff"
              colors={['#ffffff']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Cards */}
          {transactions.length > 0 && (
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryIconReceived}>
                  <Ionicons name="arrow-down" size={20} color="#4CAF50" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryLabel}>Total Received</Text>
                  <Text style={styles.summaryAmountReceived}>
                    +${totalReceived.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIconSent}>
                  <Ionicons name="arrow-up" size={20} color="#FF6B6B" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryLabel}>Total Sent</Text>
                  <Text style={styles.summaryAmountSent}>
                    -${totalSent.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Transactions List */}
          <View style={styles.transactionsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Recent Transactions {transactions.length > 0 && `(${transactions.length})`}
              </Text>
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
                    />
                  ))}
                </View>
              ))
            )}
          </View>

          {/* View All Transactions Button */}
          {transactions.length >= 5 && (
            <Pressable 
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('FullTransactionHistory')}
            >
              <Text style={styles.viewAllText}>View All Transactions</Text>
              <Ionicons name="chevron-forward" size={16} color="#0136c0" />
            </Pressable>
          )}

          {/* Footer Spacer */}
          <View style={styles.footerSpacer} />
        </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
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
  refreshButton: {
    padding: 8,
  },
  refreshingIcon: {
    transform: [{ rotate: '360deg' }],
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
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
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  summaryAmountReceived: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
  },
  summaryAmountSent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  transactionsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  dateGroup: {
    marginBottom: 8,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
    marginTop: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  transactionItemPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  transactionLeft: {
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
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  transactionCounterparty: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  transactionDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginRight: 8,
  },
  transactionTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  transactionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#0136c0',
    fontSize: 14,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  viewAllText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  footerSpacer: {
    height: 20,
  },
});

export default TransactionHistory;