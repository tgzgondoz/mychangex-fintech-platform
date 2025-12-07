// screens/ProfileScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { 
  getUserSession, 
  getUserProfile, 
  updateUserPIN, 
  signOut,
  formatZimbabwePhone,
  validatePIN,
  hashPIN,
  isAuthenticated // Import isAuthenticated
} from './supabase';

const { width } = Dimensions.get('window');

const PRIMARY_BLUE = "#0136c0";
const LIGHT_TEXT = "#ffffff";
const CARD_COLOR = "rgba(255, 255, 255, 0.15)";

const ProfileScreen = () => {
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  
  // Modals state
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [isChangePINModalVisible, setIsChangePINModalVisible] = useState(false);
  const [isSecurityModalVisible, setIsSecurityModalVisible] = useState(false);
  
  // Form states
  const [newName, setNewName] = useState('');
  const [currentPIN, setCurrentPIN] = useState('');
  const [newPIN, setNewPIN] = useState('');
  const [confirmPIN, setConfirmPIN] = useState('');
  
  // Loading states
  const [updatingName, setUpdatingName] = useState(false);
  const [updatingPIN, setUpdatingPIN] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        console.log('🔒 ProfileScreen: User not authenticated, redirecting to Login');
        navigation.navigate('Login');
        return;
      }
      // If authenticated, load user data
      loadUserData();
    };
    
    checkAuth();
  }, [navigation]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      console.log('👤 Loading profile data...');

      const sessionResult = await getUserSession();
      if (!sessionResult.success || !sessionResult.user) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      setUserData(sessionResult.user);

      // Get user profile
      const profileResult = await getUserProfile(sessionResult.user.id);
      if (profileResult.success) {
        setProfileData(profileResult.data);
        setNewName(profileResult.data.full_name || '');
      } else {
        setProfileData(sessionResult.user);
        setNewName(sessionResult.user.full_name || '');
      }

    } catch (error) {
      console.error('❌ Error loading profile data:', error);
      Alert.alert('Error', 'Failed to load profile data.');
      
      // If there's an error, check if user is still authenticated
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        navigation.navigate('Login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter your name.');
      return;
    }

    if (newName.trim() === profileData?.full_name) {
      setIsEditNameModalVisible(false);
      return;
    }

    setUpdatingName(true);
    try {
      // Check authentication before proceeding
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      // Simulate API call to update name
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update local state
      setProfileData(prev => ({ ...prev, full_name: newName.trim() }));
      
      Alert.alert('Success', 'Name updated successfully!');
      setIsEditNameModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update name. Please try again.');
    } finally {
      setUpdatingName(false);
    }
  };

  const handleChangePIN = async () => {
    if (!currentPIN || !newPIN || !confirmPIN) {
      Alert.alert('Error', 'Please fill in all PIN fields.');
      return;
    }

    if (!validatePIN(currentPIN) || !validatePIN(newPIN) || !validatePIN(confirmPIN)) {
      Alert.alert('Error', 'PIN must be exactly 4 digits.');
      return;
    }

    if (newPIN !== confirmPIN) {
      Alert.alert('Error', 'New PIN and confirmation do not match.');
      return;
    }

    if (currentPIN === newPIN) {
      Alert.alert('Error', 'New PIN must be different from current PIN.');
      return;
    }

    setUpdatingPIN(true);
    try {
      // Check authentication before proceeding
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      // Simulate PIN verification and update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real app, you would verify current PIN and update to new PIN
      // For now, we'll simulate success
      Alert.alert('Success', 'PIN changed successfully!');
      setIsChangePINModalVisible(false);
      setCurrentPIN('');
      setNewPIN('');
      setConfirmPIN('');
    } catch (error) {
      Alert.alert('Error', 'Failed to change PIN. Please try again.');
    } finally {
      setUpdatingPIN(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        // Already logged out, just navigate
        navigation.navigate('Login');
        return;
      }

      await signOut();
      console.log('✅ Logout successful');
      navigation.navigate('Login');
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      // If logout fails, still navigate to login
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        navigation.navigate('Login');
      } else {
        Alert.alert('Error', 'Failed to logout. Please try again.');
      }
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: handleLogout
        }
      ]
    );
  };

  const formatDisplayPhone = (phone) => {
    if (!phone) return 'Not set';
    return formatZimbabwePhone(phone) || phone;
  };

  const formatDisplayName = (name) => {
    return name || 'Not set';
  };

  const ProfileSection = ({ title, value, onPress, icon, showChevron = true }) => (
    <TouchableOpacity style={styles.profileItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.profileItemLeft}>
        <View style={styles.profileItemIcon}>
          <Ionicons name={icon} size={20} color={PRIMARY_BLUE} />
        </View>
        <View style={styles.profileItemInfo}>
          <Text style={styles.profileItemTitle}>{title}</Text>
          <Text style={styles.profileItemValue}>{value}</Text>
        </View>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={['#0136c0', '#0136c0']}
        style={styles.background}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const displayData = profileData || userData;

  return (
    <LinearGradient
      colors={['#0136c0', '#0136c0']}
      style={styles.background}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={40} color={PRIMARY_BLUE} />
            </View>
            <Text style={styles.profileName}>
              {formatDisplayName(displayData?.full_name)}
            </Text>
            <Text style={styles.profilePhone}>
              {formatDisplayPhone(displayData?.phone)}
            </Text>
          </View>

          {/* Personal Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <ProfileSection
              title="Full Name"
              value={formatDisplayName(displayData?.full_name)}
              onPress={() => setIsEditNameModalVisible(true)}
              icon="person-outline"
            />
            <ProfileSection
              title="Phone Number"
              value={formatDisplayPhone(displayData?.phone)}
              onPress={null} // Phone number shouldn't be editable for security
              icon="call-outline"
              showChevron={false}
            />
            <ProfileSection
              title="Account ID"
              value={displayData?.id?.substring(0, 8) + '...' || 'Unknown'}
              onPress={null}
              icon="key-outline"
              showChevron={false}
            />
          </View>

          {/* Security Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            <ProfileSection
              title="Change PIN"
              value="••••"
              onPress={() => setIsChangePINModalVisible(true)}
              icon="lock-closed-outline"
            />
            <ProfileSection
              title="Security Settings"
              value="Biometric, 2FA"
              onPress={() => setIsSecurityModalVisible(true)}
              icon="shield-checkmark-outline"
            />
          </View>

          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <ProfileSection
              title="Language"
              value="English"
              onPress={null}
              icon="language-outline"
            />
            <ProfileSection
              title="Currency"
              value="USD ($)"
              onPress={null}
              icon="cash-outline"
              showChevron={false}
            />
            <ProfileSection
              title="Notifications"
              value="Enabled"
              onPress={null}
              icon="notifications-outline"
            />
          </View>

          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <ProfileSection
              title="Help & Support"
              value="Get help with the app"
              onPress={() => Alert.alert('Help', 'Contact support at help@mychangex.com')}
              icon="help-circle-outline"
            />
            <ProfileSection
              title="About MyChangeX"
              value="Version 1.0.0"
              onPress={() => Alert.alert('About', 'MyChangeX - Digital Payments Made Easy')}
              icon="information-circle-outline"
            />
          </View>

          {/* Logout Button */}
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={confirmLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator color="#FF6B6B" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
                <Text style={styles.logoutText}>Logout</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Footer Spacer */}
          <View style={styles.footerSpacer} />
        </ScrollView>

        {/* Edit Name Modal */}
        <Modal
          visible={isEditNameModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsEditNameModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your full name"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButtonCancel}
                  onPress={() => setIsEditNameModalVisible(false)}
                  disabled={updatingName}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButtonConfirm, updatingName && styles.disabledButton]}
                  onPress={handleUpdateName}
                  disabled={updatingName}
                >
                  {updatingName ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.modalButtonTextConfirm}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change PIN Modal */}
        <Modal
          visible={isChangePINModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsChangePINModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change PIN</Text>
              
              <Text style={styles.inputLabel}>Current PIN</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter current PIN"
                value={currentPIN}
                onChangeText={setCurrentPIN}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />

              <Text style={styles.inputLabel}>New PIN</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter new PIN"
                value={newPIN}
                onChangeText={setNewPIN}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />

              <Text style={styles.inputLabel}>Confirm New PIN</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Confirm new PIN"
                value={confirmPIN}
                onChangeText={setConfirmPIN}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButtonCancel}
                  onPress={() => {
                    setIsChangePINModalVisible(false);
                    setCurrentPIN('');
                    setNewPIN('');
                    setConfirmPIN('');
                  }}
                  disabled={updatingPIN}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButtonConfirm, updatingPIN && styles.disabledButton]}
                  onPress={handleChangePIN}
                  disabled={updatingPIN}
                >
                  {updatingPIN ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.modalButtonTextConfirm}>Change PIN</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Security Settings Modal */}
        <Modal
          visible={isSecurityModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsSecurityModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Security Settings</Text>
              
              <Text style={styles.modalMessage}>
                Enhanced security features will be available in future updates.
                {'\n\n'}
                Coming soon:
                • Biometric authentication
                • Two-factor authentication
                • Login notifications
              </Text>

              <TouchableOpacity 
                style={styles.modalButtonConfirm}
                onPress={() => setIsSecurityModalVisible(false)}
              >
                <Text style={styles.modalButtonTextConfirm}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    paddingBottom: 40,
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
  headerPlaceholder: {
    width: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  profilePhone: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    marginLeft: 8,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileItemInfo: {
    flex: 1,
  },
  profileItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  profileItemValue: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  logoutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  footerSpacer: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY_BLUE,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: PRIMARY_BLUE,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default ProfileScreen;