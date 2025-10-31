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
} from "react-native";

const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";

const Icon = ({ name, size = 24, color = LIGHT_TEXT, style = {} }) => (
  <Text style={[{ fontSize: size, color }, style]}>{name}</Text>
);

const SpendCard = ({
  onPress,
  buttonScale,
  onPressIn,
  onPressOut,
  navigation, // Add navigation prop
  services = [
    { name: "Bill Payment", icon: "💰", available: true, screen: "Utilities" },
    {
      name: "Buy Airtime",
      icon: "📞",
      available: true,
      screen: "Airtime", 
    },
    { name: "Events Tickets", icon: "🎫", available: false },
    // { name: "Gift Cards", icon: "🎁", available: true },
    // { name: "Streaming", icon: "📺", available: true },
    // { name: "Games", icon: "🎮", available: false },
  ],
  onServiceSelect,
  userBalance = 0,
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
        <View style={styles.modalContent}>
          {/* <Text style={styles.modalTitle}>Spend Your Change</Text> */}
          {/* <Text style={styles.modalSubtitle}>
            Available Balance: ${userBalance.toFixed(2)}
          </Text> */}

          {/* Available Services */}
          <Text style={styles.sectionHeader}>Available Services</Text>
          {availableServices.map((service, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.serviceItem,
                styles.availableService,
                { backgroundColor: pressed ? "#f0f0f0" : LIGHT_TEXT },
              ]}
              onPress={() => handleServiceSelect(service)}
            >
              <Text style={styles.serviceIcon}>{service.icon}</Text>
              <Text style={styles.serviceText}>{service.name}</Text>
              <Icon name="➡️" size={16} color="#666" />
            </Pressable>
          ))}

          {/* Coming Soon Services */}
          {comingSoonServices.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Coming Soon</Text>
              {comingSoonServices.map((service, index) => (
                <Pressable
                  key={index}
                  style={styles.serviceItem}
                  onPress={() => handleServiceSelect(service)}
                >
                  <Text style={[styles.serviceIcon, styles.comingSoonIcon]}>
                    {service.icon}
                  </Text>
                  <Text style={[styles.serviceText, styles.comingSoonText]}>
                    {service.name}
                  </Text>
                  <Text style={styles.comingSoonBadge}>SOON</Text>
                </Pressable>
              ))}
            </>
          )}

          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={closeModal}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      <View style={[styles.card, styles.spendCard]}>
        <Text style={styles.spendTitle}>Spend My Change</Text>
        <Text style={styles.spendSubtitle}>
          Use your ${userBalance.toFixed(2)} extra change for music, movies,
          games & more.
        </Text>
        <TouchableOpacity
          onPress={openModal}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.9}
          style={{ alignSelf: "center", marginTop: 16 }}
        >
          <Animated.View
            style={[
              styles.getStartedButton,
              { transform: [{ scale: buttonScale }] },
            ]}
          >
            <Text style={styles.getStartedText}>
              {userBalance > 0 ? "Spend Now" : "Get Started"}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      <ServicesModal />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_COLOR,
    borderRadius: 15,
    padding: 18,
    marginBottom: 16,
  },
  spendCard: {
    paddingVertical: 25,
    alignItems: "center",
    marginBottom: 30,
  },
  spendTitle: {
    color: LIGHT_TEXT,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  spendSubtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 15,
    lineHeight: 20,
  },
  getStartedButton: {
    backgroundColor: LIGHT_TEXT,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    minWidth: 150,
    alignItems: "center",
  },
  getStartedText: {
    color: PRIMARY_BLUE,
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    backgroundColor: LIGHT_TEXT,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 30,
    width: "100%",
    paddingBottom: Platform.OS === "ios" ? 40 : 30,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: PRIMARY_BLUE,
    marginBottom: 20,
    textAlign: "center",
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginVertical: 4,
  },
  serviceIcon: {
    fontSize: 24,
    marginRight: 15,
    width: 30,
    textAlign: "center",
  },
  serviceText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  modalCloseButton: {
    marginTop: 30,
    backgroundColor: PRIMARY_BLUE,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCloseText: {
    color: LIGHT_TEXT,
    fontSize: 16,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "600",
    color: PRIMARY_BLUE,
    marginTop: 15,
    marginBottom: 10,
    paddingLeft: 10,
  },
  availableService: {
    // Already defined in serviceItem
  },
  comingSoonIcon: {
    opacity: 0.5,
  },
  comingSoonText: {
    color: "#999",
  },
  comingSoonBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFA726",
    backgroundColor: "rgba(255, 167, 38, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
});

export default SpendCard;
