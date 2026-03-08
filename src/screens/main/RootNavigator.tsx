import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Shadows } from '../theme';
import type { RootStackParamList, MainTabParamList } from '../types';
import { useAuthStore } from '../store/authStore';

// ─── SCREENS ─────────────────────────────────────────────────────────────────
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import FeedScreen from '../screens/main/FeedScreen';
import ExploreScreen from '../screens/main/ExploreScreen';
import BacklogScreen from '../screens/main/BacklogScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ReviewsScreen from '../screens/main/ReviewsScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import GameDetailScreen from '../screens/game/GameDetailScreen';
import CommunityScreen from '../screens/community/CommunityScreen';
import TopicDetailScreen from '../screens/community/TopicDetailScreen';
import MessagesScreen from '../screens/social/MessagesScreen';
import { NotificationsScreen, ReviewCreateScreen } from '../screens/main/RemainingScreens';
import NotificationsScreenReal from '../screens/main/NotificationsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import CreatePostScreen from '../screens/main/CreatePostScreen';
import CommunitiesScreen from '../screens/community/CommunitiesScreen';
import CreateCommunityScreen from '../screens/community/CreateCommunityScreen';
import CreateListScreen from '../screens/main/CreateListScreen';

const UserProfileScreen = ProfileScreen;
const SearchScreen = ExploreScreen;

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

type TabItem = { name: keyof MainTabParamList; label: string; icon: string; activeIcon: string };
const TABS: TabItem[] = [
  { name: 'Feed',    label: 'Feed',     icon: '⊡', activeIcon: '⊟' },
  { name: 'Explore', label: 'Explorar', icon: '◎', activeIcon: '◉' },
  { name: 'Backlog', label: 'Backlog',  icon: '▱', activeIcon: '▰' },
  { name: 'Reviews', label: 'Reviews',  icon: '◇', activeIcon: '◆' },
  { name: 'Profile', label: 'Perfil',   icon: '○', activeIcon: '●' },
];

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8, ...Shadows.navBar }]}>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const tab = TABS[index];
        const scale = useSharedValue(1);
        const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
        const handlePress = () => {
          scale.value = withSpring(0.85, { damping: 10 }, () => { scale.value = withSpring(1, { damping: 12 }); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TouchableOpacity key={route.key} onPress={handlePress} activeOpacity={1} style={styles.tabItem}>
            <Animated.View style={[styles.tabItemInner, animStyle]}>
              {isFocused && <View style={styles.tabActiveIndicator} />}
              <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>
                {isFocused ? tab.activeIcon : tab.icon}
              </Text>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{tab.label}</Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Feed"    component={FeedScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Backlog" component={BacklogScreen} />
      <Tab.Screen name="Reviews" component={ReviewsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const NavTheme = {
  ...DefaultTheme, dark: true,
  colors: { ...DefaultTheme.colors, primary: Colors.accent, background: Colors.bg, card: Colors.surface, text: Colors.text, border: Colors.border, notification: Colors.red },
};

export default function RootNavigator() {
  const { isAuthenticated } = useAuthStore();
  return (
    <NavigationContainer theme={NavTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'default', contentStyle: { backgroundColor: Colors.bg } }}>
        {!isAuthenticated ? (
          <>
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
            <RootStack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen name="GameDetail" component={GameDetailScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="UserProfile" component={UserProfileScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="ReviewCreate" component={ReviewCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreenReal} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Search" component={SearchScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="Communities" component={CommunitiesScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Community" component={CommunityScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="CreateCommunity" component={CreateCommunityScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="TopicDetail" component={TopicDetailScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="CreateList" component={CreateListScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, paddingHorizontal: 8 },
  tabItem: { flex: 1, alignItems: 'center' },
  tabItemInner: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, minWidth: 48, position: 'relative' },
  tabActiveIndicator: { position: 'absolute', top: -10, width: 24, height: 3, borderRadius: 2, backgroundColor: Colors.accent },
  tabIcon: { fontSize: 18, color: Colors.muted, marginBottom: 3 },
  tabIconActive: { color: Colors.accent },
  tabLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 0.5, color: Colors.muted },
  tabLabelActive: { color: Colors.accent },
});
