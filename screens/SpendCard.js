// components/SpendCard.js (Updated)
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get('window');
const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#e9edf9";
const CARD_BG = "rgba(255, 255, 255, 0.08)";
const CARD_BORDER = "rgba(255, 255, 255, 0.15)";
const SUCCESS_GREEN = "#00C853";
const ERROR_RED = "#FF5252";

const SpendCard = ({
  onPress,
  buttonScale,
  onPressIn,
  onPressOut,
  navigation,
  services = [
    { 
      name: "Bill Payment", 
      icon: "receipt-outline", 
      available: true, 
      screen: "Utilities",
      description: "Pay electricity, water, and other bills"
    },
    {
      name: "Buy Airtime",
      icon: "call-outline",
      available: true,
      screen: "Airtime",
      description: "Top up any mobile network"
    },
    { 
      name: "Events Tickets", 
      icon: "ticket-outline", 
      available: false,
      description: "Purchase event and concert tickets"
    },
  ],
  onServiceSelect,
  userBalance = 0,
  buttonText = "Use your $0.30 to pay for bills, airtime, event tickets on Spend MyChangeX"
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openModal = () => {
    setIsModalVisible(true);
    if (onPress) onPress();
  };

  const closeModal = () => setIsModalVisible(false);

  const handleServiceSelect = (service) => {
    if (!service.available) {
      Alert.alert("Coming Soon", `${service.name} will be available soon!`, [
        { text: "OK" },
      ]);
      return;
    }

    closeModal();
    console.log(`Selected service: ${service.name}`);

    // Navigate to specific screens if defined
    if (service.screen && navigation) {
      navigation.navigate(service.screen);
      return;
    }

    // Call the callback if provided
    if (onServiceSelect) {
      onServiceSelect(service);
    }
  };

  const availableServices = services.filter((service) => service.available);
  const comingSoonServices = services.filter((service) => !service.available);

  const ServicesModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isModalVisible}
      onRequestClose={closeModal}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Spend MyChangeX</Text>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceContainer}>
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
              style={styles.balanceGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.balanceHeader}>
                <Ionicons name="wallet-outline" size={20} color="rgba(255, 255, 255, 0.7)" />
                <Text style={styles.balanceLabel}>Available Balance</Text>
              </View>
              <Text style={styles.balanceAmount}>${userBalance.toFixed(2)}</Text>
              <Text style={styles.balanceCurrency}>USD</Text>
            </LinearGradient>
          </View>

          {/* Available Services */}
          <Text style={styles.sectionHeader}>Available Services</Text>
          <View style={styles.servicesGrid}>
            {availableServices.map((service, index) => (
              <TouchableOpacity
                key={index}
                style={styles.serviceCard}
                onPress={() => handleServiceSelect(service)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                  style={styles.serviceIconContainer}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={service.icon} size={24} color={WHITE} />
                </LinearGradient>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
                <View style={styles.serviceAction}>
                  <Text style={styles.serviceActionText}>Select</Text>
                  <Ionicons name="chevron-forward" size={16} color={PRIMARY_BLUE} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Coming Soon Services */}
          {comingSoonServices.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Coming Soon</Text>
              <View style={styles.comingSoonContainer}>
                {comingSoonServices.map((service, index) => (
                  <Pressable
                    key={index}
                    style={styles.comingSoonCard}
                    onPress={() => handleServiceSelect(service)}
                  >
                    <View style={styles.comingSoonIconContainer}>
                      <Ionicons name={service.icon} size={24} color="rgba(255, 255, 255, 0.5)" />
                    </View>
                    <View style={styles.comingSoonInfo}>
                      <Text style={styles.comingSoonName}>{service.name}</Text>
                      <Text style={styles.comingSoonDescription}>{service.description}</Text>
                    </View>
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonBadgeText}>SOON</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={closeModal}
          >
            <LinearGradient
              colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
              style={styles.modalCloseButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <View style={[styles.card, styles.spendCard]}>
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
          style={styles.spendCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.spendHeader}>
            <View style={styles.spendIcon}>
              <LinearGradient
                colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                style={styles.iconCircle}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="sparkles-outline" size={24} color={WHITE} />
              </LinearGradient>
            </View>
            <View style={styles.spendTextContainer}>
              <Text style={styles.spendTitle}>Spend MyChangeX</Text>
              <Text style={styles.spendSubtitle}>
                {buttonText}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={openModal}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            activeOpacity={0.9}
            style={styles.buttonContainer}
          >
            <Animated.View
              style={[
                styles.getStartedButton,
                { transform: [{ scale: buttonScale }] }
              ]}
            >
              <LinearGradient
                colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                style={styles.getStartedButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="rocket-outline" size={20} color={WHITE} />
                <Text style={styles.getStartedText}>
                  {userBalance > 0 ? "Spend Now" : "Get Started"}
                </Text>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      <ServicesModal />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  spendCard: {},
  spendCardGradient: {
    padding: 24,
    borderRadius: 20,
  },
  spendHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  spendIcon: {
    marginRight: 16,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spendTextContainer: {
    flex: 1,
  },
  spendTitle: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  spendSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    alignSelf: 'center',
    width: '100%',
  },
  getStartedButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  getStartedButtonGradient: {
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  getStartedText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY_BLUE,
  },
  balanceContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  balanceGradient: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    color: WHITE,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceCurrency: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  serviceCard: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  serviceAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  serviceActionText: {
    color: PRIMARY_BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  comingSoonContainer: {
    marginBottom: 20,
  },
  comingSoonCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  comingSoonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  comingSoonInfo: {
    flex: 1,
  },
  comingSoonName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
    marginBottom: 2,
  },
  comingSoonDescription: {
    fontSize: 12,
    color: '#aaa',
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255, 167, 38, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  comingSoonBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFA726',
    letterSpacing: 0.5,
  },
  modalCloseButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  modalCloseButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SpendCard;