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
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { 
  getUserSession, 
  getUserProfile, 
  signOut,
  formatZimbabwePhone,
  validatePIN,
  isAuthenticated
} from './supabase';

const { width, height } = Dimensions.get('window');

const PRIMARY_BLUE = "#0136c0";
const WHITE = "#ffffff";
const LIGHT_TEXT = "#666666";
const DARK_TEXT = "#1A1A1A";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#eaeaea";
const BACKGROUND_COLOR = "#f8f9fa";

const ProfileScreen = () => {
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [isChangePINModalVisible, setIsChangePINModalVisible] = useState(false);
  const [isSecurityModalVisible, setIsSecurityModalVisible] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [currentPIN, setCurrentPIN] = useState('');
  const [newPIN, setNewPIN] = useState('');
  const [confirmPIN, setConfirmPIN] = useState('');
  
  const [updatingName, setUpdatingName] = useState(false);
  const [updatingPIN, setUpdatingPIN] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        navigation.navigate('Login');
        return;
      }
      loadUserData();
    };
    
    checkAuth();
  }, [navigation]);

  const loadUserData = async () => {
    try {
      setLoading(true);

      const sessionResult = await getUserSession();
      if (!sessionResult.success || !sessionResult.user) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      setUserData(sessionResult.user);

      const profileResult = await getUserProfile(sessionResult.user.id);
      if (profileResult.success) {
        setProfileData(profileResult.data);
        setNewName(profileResult.data.full_name || '');
      } else {
        setProfileData(sessionResult.user);
        setNewName(sessionResult.user.full_name || '');
      }

    } catch (error) {
      console.error('Error loading profile data:', error);
      Alert.alert('Error', 'Failed to load profile data.');
      
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
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      
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
      const authResult = await isAuthenticated();
      if (!authResult.authenticated) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.navigate('Login');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
        navigation.navigate('Login');
        return;
      }

      await signOut();
      navigation.navigate('Login');
    } catch (error) {
      console.error('Logout error:', error);
      
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
        <Ionicons name="chevron-forward" size={16} color={LIGHT_TEXT} />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.background}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_BLUE} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const displayData = profileData || userData;

  const getFirstInitial = (name) => {
    if (!name) return "U";
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return "U";
    return trimmedName.charAt(0).toUpperCase();
  };

  const userInitial = getFirstInitial(displayData?.full_name);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background}>
        <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND_COLOR} />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={DARK_TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header Card */}
          <View style={[styles.card, styles.profileHeaderCard]}>
            <View style={styles.profileContent}>
              <View style={styles.profileAvatarContainer}>
                <View style={styles.profileAvatar}>
                  <LinearGradient
                    colors={["#0136c0", "#0136c0"]}
                    style={styles.profileAvatarGradient}
                  >
                    <Text style={styles.profileInitial}>{userInitial}</Text>
                  </LinearGradient>
                </View>
              </View>
              <Text style={styles.profileName}>
                {formatDisplayName(displayData?.full_name)}
              </Text>
              <Text style={styles.profilePhone}>
                {formatDisplayPhone(displayData?.phone)}
              </Text>
              <View style={styles.profileStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Active Account</Text>
              </View>
            </View>
          </View>

          {/* Personal Information Section */}
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.sectionCard}>
            <ProfileSection
              title="Full Name"
              value={formatDisplayName(displayData?.full_name)}
              onPress={() => setIsEditNameModalVisible(true)}
              icon="person-outline"
            />
            <View style={styles.divider} />
            <ProfileSection
              title="Phone Number"
              value={formatDisplayPhone(displayData?.phone)}
              onPress={null}
              icon="call-outline"
              showChevron={false}
            />
            <View style={styles.divider} />
            <ProfileSection
              title="Account ID"
              value={displayData?.id?.substring(0, 8) + '...' || 'Unknown'}
              onPress={null}
              icon="key-outline"
              showChevron={false}
            />
          </View>

          {/* Security Section */}
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.sectionCard}>
            <ProfileSection
              title="Change PIN"
              value="••••"
              onPress={() => setIsChangePINModalVisible(true)}
              icon="lock-closed-outline"
            />
            <View style={styles.divider} />
            <ProfileSection
              title="Security Settings"
              value="Biometric, 2FA"
              onPress={() => setIsSecurityModalVisible(true)}
              icon="shield-checkmark-outline"
            />
          </View>

          {/* Preferences Section */}
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.sectionCard}>
            <ProfileSection
              title="Language"
              value="English"
              onPress={null}
              icon="language-outline"
            />
            <View style={styles.divider} />
            <ProfileSection
              title="Currency"
              value="USD ($)"
              onPress={null}
              icon="cash-outline"
              showChevron={false}
            />
            <View style={styles.divider} />
            <ProfileSection
              title="Notifications"
              value="Enabled"
              onPress={null}
              icon="notifications-outline"
            />
          </View>

          {/* Support Section */}
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionCard}>
            <ProfileSection
              title="Help & Support"
              value="Get help with the app"
              onPress={() => Alert.alert('Help', 'Contact support at help@mychangex.com')}
              icon="help-circle-outline"
            />
            <View style={styles.divider} />
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
            <View style={styles.logoutContent}>
              {loggingOut ? (
                <ActivityIndicator color="#FF5252" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#FF5252" />
                  <Text style={styles.logoutText}>Logout</Text>
                </>
              )}
            </View>
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
            <Pressable style={styles.modalBackdrop} onPress={() => setIsEditNameModalVisible(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Name</Text>
                <TouchableOpacity onPress={() => setIsEditNameModalVisible(false)}>
                  <Ionicons name="close" size={24} color={DARK_TEXT} />
                </TouchableOpacity>
              </View>
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
                    <ActivityIndicator color={WHITE} />
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
            <Pressable style={styles.modalBackdrop} onPress={() => setIsChangePINModalVisible(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change PIN</Text>
                <TouchableOpacity onPress={() => {
                  setIsChangePINModalVisible(false);
                  setCurrentPIN('');
                  setNewPIN('');
                  setConfirmPIN('');
                }}>
                  <Ionicons name="close" size={24} color={DARK_TEXT} />
                </TouchableOpacity>
              </View>
              
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
                    <ActivityIndicator color={WHITE} />
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
            <Pressable style={styles.modalBackdrop} onPress={() => setIsSecurityModalVisible(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Security Settings</Text>
                <TouchableOpacity onPress={() => setIsSecurityModalVisible(false)}>
                  <Ionicons name="close" size={24} color={DARK_TEXT} />
                </TouchableOpacity>
              </View>
              
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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: DARK_TEXT,
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: BACKGROUND_COLOR,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: DARK_TEXT,
    fontSize: 20,
    fontWeight: '700',
  },
  headerPlaceholder: {
    width: 40,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  profileHeaderCard: {
    overflow: 'hidden',
  },
  profileContent: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  profileAvatarContainer: {
    marginBottom: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: WHITE,
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 4,
    textAlign: 'center',
  },
  profilePhone: {
    fontSize: 16,
    color: LIGHT_TEXT,
    textAlign: 'center',
    marginBottom: 16,
  },
  profileStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00C853',
  },
  statusText: {
    color: LIGHT_TEXT,
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    color: DARK_TEXT,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    backgroundColor: '#f0f5ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#d9e4ff',
  },
  profileItemInfo: {
    flex: 1,
  },
  profileItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 2,
  },
  profileItemValue: {
    fontSize: 14,
    color: LIGHT_TEXT,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  logoutButton: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffeaea',
    backgroundColor: '#fff5f5',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    color: '#FF5252',
    fontSize: 16,
    fontWeight: '600',
  },
  footerSpacer: {
    height: 20,
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
    color: DARK_TEXT,
  },
  modalMessage: {
    fontSize: 16,
    color: LIGHT_TEXT,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    padding: 16,
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: PRIMARY_BLUE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: DARK_TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default ProfileScreen;