import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get('window');
const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#666666";
const DARK_TEXT = "#1A1A1A";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#eaeaea";
const BACKGROUND_COLOR = "#f8f9fa";

const SpendCard = ({
  onServiceSelect,
  navigation,
  services = [
    { 
      name: "Bill Payment", 
      icon: "receipt-outline", 
      available: true, 
      screen: "Utilities",
      description: "Pay electricity, water bills"
    },
    {
      name: "Buy Airtime",
      icon: "call-outline",
      available: true,
      screen: "Airtime",
      description: "Top up mobile credit"
    },
    { 
      name: "Events Tickets", 
      icon: "ticket-outline", 
      available: false,
      description: "Purchase event tickets"
    },
  ],
  userBalance = 0,
  buttonText = "Use your $0.30 to pay for bills, airtime, event tickets on Spend MyChangeX"
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const openModal = () => setIsModalVisible(true);
  const closeModal = () => setIsModalVisible(false);

  const handleServiceSelect = (service) => {
    if (!service.available) {
      Alert.alert("Coming Soon", `${service.name} will be available soon!`, [
        { text: "OK" },
      ]);
      return;
    }

    closeModal();
    
    if (service.screen && navigation) {
      navigation.navigate(service.screen);
      return;
    }

    if (onServiceSelect) {
      onServiceSelect(service);
    }
  };

  const availableServices = services.filter((service) => service.available);

  const ServicesModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isModalVisible}
      onRequestClose={closeModal}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal} />
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Available Services</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeModal}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={LIGHT_TEXT} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Choose a service to use your balance
            </Text>

            <ScrollView 
              style={styles.servicesScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.servicesContainer}
            >
              {availableServices.map((service, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.serviceItem}
                  onPress={() => handleServiceSelect(service)}
                  activeOpacity={0.7}
                >
                  <View style={styles.serviceIconContainer}>
                    <Ionicons name={service.icon} size={22} color={PRIMARY_BLUE} />
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceDescription} numberOfLines={1}>
                      {service.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeModal}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <View style={[styles.card, styles.spendCard]}>
        <View style={styles.spendContent}>
          <View style={styles.spendHeader}>
            <View style={styles.spendTextContainer}>
              <Text style={styles.spendTitle}>Spend MyChangeX</Text>
              <Text style={styles.spendSubtitle}>
                {buttonText}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={openModal}
            activeOpacity={0.9}
            style={styles.buttonContainer}
          >
            <View style={styles.getStartedButton}>
              <LinearGradient
                colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
                style={styles.getStartedButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.getStartedText}>
                  {userBalance > 0 ? "Spend Now" : "Get Started"}
                </Text>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ServicesModal />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  spendCard: {},
  spendContent: {
    padding: 24,
    borderRadius: 16,
  },
  spendHeader: {
    marginBottom: 20,
  },
  spendTextContainer: {
    alignItems: 'center',
  },
  spendTitle: {
    color: DARK_TEXT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  spendSubtitle: {
    color: LIGHT_TEXT,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    alignSelf: 'center',
    width: '100%',
  },
  getStartedButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  getStartedButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: width * 0.85,
    maxHeight: height * 0.5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  modalContent: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT,
    marginBottom: 20,
    textAlign: 'center',
  },
  servicesScroll: {
    maxHeight: height * 0.3,
  },
  servicesContainer: {
    paddingBottom: 10,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(1, 54, 192, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: LIGHT_TEXT,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f3f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_TEXT,
  },
});

export default SpendCard;