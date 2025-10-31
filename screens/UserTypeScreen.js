import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  StatusBar,
  Modal,
  Pressable,
  SafeAreaView,
  Platform,
  Image,
  ScrollView,
  Animated
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const UserTypeScreen = () => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const scrollY = new Animated.Value(0);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, []);

  const handleSendPress = () => {
    setModalVisible(true);
  };

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [100, 70],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  return (
    <LinearGradient
      colors={['#0136c0', '#0051e8']}
      style={styles.background}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        {/* Animated Header */}
        <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain"/>
          </View>
          <TouchableOpacity 
            style={styles.notificationButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="notifications" size={24} color="#fff" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </Animated.View>
        
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>$273.50</Text>
            
          </View>
          
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleSendPress}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialIcons name="send" size={24} color="#fff" />
                </LinearGradient>
                <Text style={styles.buttonText}>Send</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Receive')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialIcons name="call-Received" size={24} color="#fff" />
                </LinearGradient>
                <Text style={styles.buttonText}>Receive</Text>
              </TouchableOpacity>
            
              
             
            </View>
          </View>
           {/* Spend My Change Section */}
          <View style={styles.spendCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
              style={styles.spendGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.spendTitle}>Spend My Change</Text>
              <Text style={styles.spendSubtitle}>Use your extra change for music, movies, games & more.</Text>
              <TouchableOpacity style={styles.spendButton}>
                <Text style={styles.spendButtonText}>Get Started</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
          
          {/* Recent Transactions Widget */}
          <View style={styles.transactionsWidget}>
            <View style={styles.widgetHeader}>
              <Text style={styles.widgetTitle}>Recent Transactions</Text>
              <TouchableOpacity>
                <Text style={styles.widgetAction}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.transactionsList}>
              {transactions.map((transaction, index) => (
                <View key={index} style={styles.transactionItem}>
                  <View style={styles.transactionIcon}>
                    <MaterialIcons name={transaction.icon} size={20} color="#fff" />
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionName}>{transaction.name}</Text>
                    <Text style={styles.transactionDate}>{transaction.date}</Text>
                  </View>
                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.type === 'credit' ? '#4CAF50' : '#F44336' }
                  ]}>
                    {transaction.type === 'credit' ? '+' : '-'}{transaction.amount}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          
         
          
          {/* Services Section */}
          <View style={styles.servicesContainer}>
            <Text style={styles.sectionTitle}>Other Services</Text>
            <View style={styles.servicesGrid}>
              {services.map((service, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.serviceItem}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                    style={styles.serviceIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <MaterialIcons name={service.icon} size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.serviceText}>{service.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Send Options Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Choose sending method</Text>
                
                {sendOptions.map((option, index) => (
                  <Pressable
                    key={index}
                    style={styles.optionButton}
                    onPress={() => {
                      setModalVisible(false);
                      navigation.navigate(option.route);
                    }}
                    android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    <Text style={styles.optionText}>{option.name}</Text>
                  </Pressable>
                ))}
                
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
      </SafeAreaView>
    </LinearGradient>
  );
};

const services = [
  { name: 'History', icon: 'history' },
  { name: 'Bill Pay', icon: 'receipt' },
  { name: 'Mobile', icon: 'phone-android' },
  { name: 'More', icon: 'more-horiz' }
];

const sendOptions = [
  { name: 'Ecocash', route: 'Econet' },
  { name: 'MyChange X', route: 'MyChangeX' },
  { name: 'Omari', route: 'Omari' }
];

const transactions = [
  { name: 'Amazon Purchase', date: 'Today, 10:45 AM', amount: '$24.99', type: 'debit', icon: 'shopping-cart' },
  { name: 'Salary Deposit', date: 'Yesterday', amount: '$1,200.00', type: 'credit', icon: 'account-balance' },
  { name: 'Netflix Subscription', date: 'May 15', amount: '$14.99', type: 'debit', icon: 'subscriptions' },
  { name: 'Transfer from John', date: 'May 14', amount: '$50.00', type: 'credit', icon: 'swap-horiz' }
];

const quickLinks = [
  { name: 'Support', icon: 'help-outline' },
  { name: 'Settings', icon: 'settings' },
  { name: 'Security', icon: 'security' },
  { name: 'Refer a Friend', icon: 'person-add' }
];

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  background: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 100,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'rgba(1, 54, 192, 0.9)',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.5,
    height: width * 0.15,
    resizeMode: 'contain',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4757',
  },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  trendWidget: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  trendItem: {
    flex: 1,
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  trendValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  quickActions: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    width: width * 0.21,
    marginBottom: 12,
  },
  buttonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    textAlign: 'center',
  },
  transactionsWidget: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  widgetAction: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  transactionsList: {
    marginTop: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  spendCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  spendGradient: {
    padding: 20,
  },
  spendTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  spendSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    lineHeight: 20,
    marginBottom: 16,
  },
  spendButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  spendButtonText: {
    color: '#0136c0',
    fontSize: 14,
    fontWeight: '600',
  },
  servicesContainer: {
    marginBottom: 24,
  },
  servicesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceItem: {
    alignItems: 'center',
    width: width * 0.21,
    marginBottom: 12,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  linksWidget: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  linksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  linkItem: {
    width: width * 0.45,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(1, 54, 192, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#0136c0',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
    color: '#0136c0',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  optionButton: {
    width: '100%',
    padding: 16,
    marginVertical: 8,
    backgroundColor: '#0136c0',
    borderRadius: 12,
    alignItems: 'center',
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  cancelButton: {
    width: '100%',
    padding: 16,
    marginTop: 16,
    backgroundColor: '#f1f1f1',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#0136c0',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default UserTypeScreen;