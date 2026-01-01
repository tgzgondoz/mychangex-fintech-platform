import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get('window');
const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#666666";
const DARK_TEXT = "#1A1A1A";

const SpendCard = ({
  navigation,
  services = [
    { 
      name: "Bill Payment", 
      available: true, 
      screen: "Utilities",
      description: "Pay electricity, water bills"
    },
    {
      name: "Buy Airtime",
      available: true,
      screen: "Airtime",
      description: "Top up mobile credit"
    },
    { 
      name: "Events Tickets", 
      available: false,
      description: "Purchase event tickets"
    },
  ],
  userBalance = 0,
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
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Available Services</Text>
          </View>
          
          <Text style={styles.modalSubtitle}>
            Choose a service to use your balance
          </Text>

          <ScrollView 
            style={styles.servicesScroll}
            showsVerticalScrollIndicator={false}
          >
            {availableServices.map((service, index) => (
              <TouchableOpacity
                key={index}
                style={styles.serviceItem}
                onPress={() => handleServiceSelect(service)}
                activeOpacity={0.7}
              >
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.serviceDescription}>
                    {service.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={closeModal}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <View style={styles.card}>
        <View style={styles.content}>
          <Text style={styles.title}>Spend Your Change</Text>
          <Text style={styles.subtitle}>
             To pay for bills, airtime, and event tickets
          </Text>
          <TouchableOpacity
            onPress={openModal}
            activeOpacity={0.8}
            style={styles.button}
          >
            <LinearGradient
              colors={[PRIMARY_BLUE, PRIMARY_BLUE]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.buttonText}>
                {userBalance > 0 ? "Spend Now" : "Get Started"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <ServicesModal />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: LIGHT_TEXT,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: width * 0.85,
    maxHeight: height * 0.6,
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    marginBottom: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
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
  serviceItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 2,
  },
  serviceDescription: {
    fontSize: 13,
    color: LIGHT_TEXT,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_TEXT,
  },
});

export default SpendCard;