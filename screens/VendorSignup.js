import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect } from 'react';
import { MaterialIcons, FontAwesome, Ionicons } from '@expo/vector-icons'; 
import { Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const VendorSignup = () => {
    const navigation = useNavigation();
    
    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, []);

    return (
        <LinearGradient
            colors={['#196edb', '#196edb']}
            style={styles.background}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
        >
            <View style={styles.container}>
                {/* Logo and Profile Header */}
                <View style={styles.profileHeader}>
                    <Image 
                        source={require('../assets/logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <View style={styles.profileInfo}>
                        <View style={styles.welcomeContainer}>
                            <Text style={styles.welcomeText}>Welcome,</Text>
                            <Text style={styles.userName}>Vendor Name</Text>
                        </View>
                        <View style={styles.balanceContainer}>
                            <Text style={styles.balanceAmount}>$1,245.80</Text>
                            <Text style={styles.balanceLabel}>Business Account</Text>
                        </View>
                    </View>
                </View>

                {/* Main Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('ReceivePayment')}
                    >
                        <View style={[styles.buttonIconContainer, styles.ReceiveButton]}>
                            <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
                        </View>
                        <Text style={styles.buttonText}>Receive Payment</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('Analytics')}
                    >
                        <View style={[styles.buttonIconContainer, styles.analyticsButton]}>
                            <FontAwesome name="bar-chart" size={20} color="#fff" />
                        </View>
                        <Text style={styles.buttonText}>Analytics</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('Products')}
                    >
                        <View style={[styles.buttonIconContainer, styles.productsButton]}>
                            <FontAwesome name="shopping-bag" size={20} color="#fff" />
                        </View>
                        <Text style={styles.buttonText}>My Products</Text>
                    </TouchableOpacity>
                </View>

                {/* Secondary Action Buttons */}
                <View style={styles.secondaryActions}>
                    <TouchableOpacity 
                        style={styles.secondaryButton}
                        onPress={() => navigation.navigate('Withdraw')}
                    >
                        <View style={styles.secondaryIconContainer}>
                            <Ionicons name="ios-cash" size={24} color="#ffffff" />
                        </View>
                        <Text style={styles.secondaryButtonText}>Withdraw Funds</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.secondaryButton}
                        onPress={() => navigation.navigate('SalesHistory')}
                    >
                        <View style={styles.secondaryIconContainer}>
                            <MaterialIcons name="history" size={24} color="#ffffff" />
                        </View>
                        <Text style={styles.secondaryButtonText}>Sales History</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Transactions Section */}
                <View style={styles.transactionsSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Sales</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('AllSales')}>
                            <Text style={styles.seeAllText}>See all</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Transaction items would go here */}
                    <View style={styles.placeholder}>
                        <Text style={styles.placeholderText}>No recent sales</Text>
                    </View>
                </View>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#196edb',
    },
    container: {
        flex: 1,
        padding: 20,
        paddingTop: 40, // Added proper spacing at the top
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    logo: {
        width: 60,
        height: 60,
        marginRight: 15,
    },
    profileInfo: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    welcomeContainer: {
        flex: 1,
    },
    welcomeText: {
        fontSize: 16,
        color: '#e2e8f0',
        marginBottom: 4,
    },
    userName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ffffff',
    },
    balanceContainer: {
        alignItems: 'flex-end',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 12,
        borderRadius: 12,
        minWidth: 120,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    balanceAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 2,
    },
    balanceLabel: {
        fontSize: 14,
        color: '#e2e8f0',
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    actionButton: {
        alignItems: 'center',
        width: width * 0.28,
    },
    buttonIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    ReceiveButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    analyticsButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    productsButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    buttonText: {
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '500',
        textAlign: 'center',
    },
    secondaryActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 15,
        borderRadius: 12,
        width: '48%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    secondaryIconContainer: {
        marginRight: 10,
    },
    secondaryButtonText: {
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '500',
    },
    transactionsSection: {
        flex: 1,
        marginTop: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
    },
    seeAllText: {
        fontSize: 14,
        color: '#e2e8f0',
        fontWeight: '500',
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    placeholderText: {
        color: '#e2e8f0',
        fontSize: 16,
    },
});

export default VendorSignup;