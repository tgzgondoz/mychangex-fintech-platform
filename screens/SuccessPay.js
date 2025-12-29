import React from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  StyleSheet, 
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  Animated,
  Easing,
  TouchableOpacity
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#e9edf9";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.15)";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";

const SuccessPay = () => {
  const navigation = useNavigation();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    // Animation sequence
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(confettiAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleBackToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleViewReceipt = () => {
    // You can implement receipt viewing logic here
    Alert.alert('Receipt', 'Receipt feature will be implemented soon!');
  };

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
          {/* Confetti Animation Background */}
          <Animated.View 
            style={[
              styles.confettiContainer,
              { opacity: confettiAnim }
            ]}
          >
            {[...Array(20)].map((_, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.confetti,
                  {
                    backgroundColor: ['#FFD700', '#FF6B6B', '#4CAF50', '#2196F3'][index % 4],
                    transform: [
                      { translateX: Animated.multiply(confettiAnim, Math.random() * width - 50) },
                      { translateY: Animated.multiply(confettiAnim, Math.random() * height - 100) },
                      { rotate: Animated.multiply(confettiAnim, Math.random() * 360) + 'deg' }
                    ],
                    opacity: confettiAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.8, 0.6]
                    })
                  }
                ]}
              />
            ))}
          </Animated.View>

          <View style={styles.container}>
            {/* Header */}
            <Animated.View 
              style={[styles.header, { opacity: fadeAnim }]}
            >
              <TouchableOpacity 
                style={styles.backButton}
                onPress={handleBackToHome}
              >
                <Ionicons name="arrow-back" size={24} color={WHITE} />
              </TouchableOpacity>
              <View style={styles.headerLeft}>
                <Ionicons name="checkmark-done-circle-outline" size={28} color={WHITE} />
                <Text style={styles.headerTitle}>Payment Success</Text>
              </View>
              <View style={styles.headerPlaceholder} />
            </Animated.View>

            {/* Success Content */}
            <View style={styles.content}>
              {/* Success Icon Card */}
              <View style={[styles.card, styles.successCard]}>
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                  style={styles.successCardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.iconContainer}>
                    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                      <LinearGradient
                        colors={[SUCCESS_GREEN, "#00E676"]}
                        style={styles.iconCircle}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name="checkmark" size={48} color={WHITE} />
                      </LinearGradient>
                    </Animated.View>
                  </View>

                  {/* Success Message */}
                  <Animated.View 
                    style={[styles.messageContainer, { opacity: fadeAnim }]}
                  >
                    <Text style={styles.amount}>$2.40</Text>
                    <Text style={styles.message}>Payment Completed Successfully!</Text>
                    <Text style={styles.subMessage}>Transaction processed successfully</Text>
                  </Animated.View>

                  {/* Transaction Details Card */}
                  <Animated.View 
                    style={[styles.detailsCard, { opacity: fadeAnim }]}
                  >
                    <View style={styles.detailRow}>
                      <Ionicons name="receipt-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
                      <Text style={styles.detailLabel}>Transaction ID:</Text>
                      <Text style={styles.detailValue}>#PAY-789456123</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
                      <Text style={styles.detailLabel}>Time:</Text>
                      <Text style={styles.detailValue}>{new Date().toLocaleTimeString()}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
                      <Text style={styles.detailLabel}>Date:</Text>
                      <Text style={styles.detailValue}>{new Date().toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="flash-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
                      <Text style={styles.detailLabel}>Status:</Text>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>COMPLETED</Text>
                      </View>
                    </View>
                  </Animated.View>
                </LinearGradient>
              </View>

              {/* Action Buttons */}
              <Animated.View 
                style={[styles.buttonContainer, { opacity: fadeAnim }]}
              >
                <TouchableOpacity 
                  style={styles.primaryButton}
                  onPress={handleBackToHome}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                    style={styles.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="home-outline" size={24} color={WHITE} />
                    <Text style={styles.primaryButtonText}>BACK TO HOME</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={handleViewReceipt}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
                    style={styles.secondaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="document-text-outline" size={20} color={WHITE} />
                    <Text style={styles.secondaryButtonText}>VIEW RECEIPT</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Security Note */}
              <Animated.View 
                style={[styles.securityNote, { opacity: fadeAnim }]}
              >
                <Ionicons name="shield-checkmark" size={16} color="rgba(255, 255, 255, 0.7)" />
                <Text style={styles.securityText}>
                  Your payment is secured with end-to-end encryption
                </Text>
              </Animated.View>
            </View>
          </View>
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
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
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
  headerPlaceholder: {
    width: 40,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  successCard: {},
  successCardGradient: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: SUCCESS_GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  amount: {
    color: WHITE,
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  message: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subMessage: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  detailsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    width: 100,
  },
  detailValue: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 83, 0.3)',
  },
  statusText: {
    color: SUCCESS_GREEN,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  primaryButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  secondaryButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
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
});

export default SuccessPay;