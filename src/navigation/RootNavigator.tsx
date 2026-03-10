import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Fonts, Shadows } from '../theme';
import type { RootStackParamList, MainTabParamList } from '../types';
import { useAuthStore } from '../store/authStore';
import { notificationsService, messagesService } from '../services/api';

// ─── SCREENS ─────────────────────────────────────────────────────────────────
// Auth
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main Tabs
import FeedScreen from '../screens/main/FeedScreen';
import ExploreScreen from '../screens/main/ExploreScreen';
import BacklogScreen from '../screens/main/BacklogScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ReviewsScreen from '../screens/main/ReviewsScreen';

// Pushed / Modal
import GameDetailScreen from '../screens/game/GameDetailScreen';
import CommunityScreen from '../screens/community/CommunityScreen';
import CommunitiesScreen from '../screens/community/CommunitiesScreen';
import CreateCommunityScreen from '../screens/community/CreateCommunityScreen';
import CommunitySettingsScreen from '../screens/community/CommunitySettingsScreen';
import TopicDetailScreen from '../screens/community/TopicDetailScreen';
import { MessagesScreen } from '../screens/social/MessagesScreen';
import CommentsScreen from '../screens/main/CommentsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import CreatePostScreen from '../screens/main/CreatePostScreen';
import CreateListScreen from '../screens/main/CreateListScreen';
import ListDetailScreen from '../screens/main/ListDetailScreen';
import ReviewCreateScreen from '../screens/main/ReviewCreateScreen';

// ─── STACKS ───────────────────────────────────────────────────────────────────
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// ─── CUSTOM TAB BAR ──────────────────────────────────────────────────────────
type TabItem = { name: keyof MainTabParamList; label: string; icon: string; activeIcon: string };

const TABS: TabItem[] = [
  { name: 'Feed',    label: 'Feed',     icon: '⊡',  activeIcon: '⊟' },
  { name: 'Explore', label: 'Explorar', icon: '◎',  activeIcon: '◉' },
  { name: 'Backlog', label: 'Backlog',  icon: '▱',  activeIcon: '▰' },
  { name: 'Reviews', label: 'Reviews',  icon: '◇',  activeIcon: '◆' },
  { name: 'Profile', label: 'Perfil',   icon: '○',  activeIcon: '●' },
];

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  // ─── Badges de não lidos ───────────────────────────────────────────────────
  const { data: unreadNotifs } = useQuery({
    queryKey: ['unread-notifs-count'],
    queryFn: () => notificationsService.getUnreadCount(),
    select: (res: any) => Number(res?.count ?? res?.data?.count ?? 0),
    refetchInterval: 30_000,
  });
  const { data: unreadMessages } = useQuery({
    queryKey: ['unread-messages-count'],
    queryFn: () => messagesService.getConversations(),
    select: (res: any) => {
      const convs = res?.data ?? res ?? [];
      return Array.isArray(convs)
        ? convs.reduce((sum: number, c: any) => sum + Number(c.unread_count ?? 0), 0)
        : 0;
    },
    refetchInterval: 30_000,
  });

  // tabName → badge count
  const badgeMap: Record<string, number> = {
    Feed:    (unreadNotifs ?? 0),
    Profile: (unreadMessages ?? 0),
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8, ...Shadows.navBar }]}>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const tab = TABS[index];
        const scale = useSharedValue(1);
        const badgeCount = badgeMap[route.name] ?? 0;

        const animStyle = useAnimatedStyle(() => ({
          transform: [{ scale: scale.value }],
        }));

        const handlePress = () => {
          scale.value = withSpring(0.85, { damping: 10 }, () => {
            scale.value = withSpring(1, { damping: 12 });
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={handlePress}
            activeOpacity={1}
            style={styles.tabItem}
          >
            <Animated.View style={[styles.tabItemInner, animStyle]}>
              {isFocused && <View style={styles.tabActiveIndicator} />}
              <View style={{ position: 'relative' }}>
                <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>
                  {isFocused ? tab.activeIcon : tab.icon}
                </Text>
                {badgeCount > 0 && !isFocused && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── MAIN TABS ────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Feed"    component={FeedScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Backlog" component={BacklogScreen} />
      <Tab.Screen name="Reviews" component={ReviewsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── NAV THEME ───────────────────────────────────────────────────────────────
const NavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.accent,
    background: Colors.bg,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.red,
  },
};

// ─── ROOT NAVIGATOR ───────────────────────────────────────────────────────────
export default function RootNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer theme={NavTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'default',
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        {!isAuthenticated ? (
          // Auth flow
          <>
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
            <RootStack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        ) : (
          // App flow
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen name="GameDetail" component={GameDetailScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="UserProfile" component={ProfileScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="ReviewCreate" component={ReviewCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="ReviewDetail" component={FeedScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Search" component={ExploreScreen} options={{ animation: 'fade' }} />
            <RootStack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="CreateList" component={CreateListScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="ListDetail" component={ListDetailScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Community" component={CommunityScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Communities" component={CommunitiesScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="CreateCommunity" component={CreateCommunityScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="CommunitySettings" component={CommunitySettingsScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="TopicDetail" component={TopicDetailScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Messages" component={MessagesScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Comments" component={CommentsScreen} options={{ animation: 'slide_from_bottom' }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabItemInner: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 48,
    position: 'relative',
  },
  tabActiveIndicator: {
    position: 'absolute',
    top: -10,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
  tabIcon: {
    fontSize: 18,
    color: Colors.muted,
    marginBottom: 3,
  },
  tabIconActive: {
    color: Colors.accent,
  },
  tabLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: Colors.muted,
  },
  tabLabelActive: {
    color: Colors.accent,
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  tabBadgeText: { fontFamily: Fonts.mono, fontSize: 9, color: '#fff', lineHeight: 13 },
});
