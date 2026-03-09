// ─── USER ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  bio?: string;
  level: number;
  xp: number;
  followersCount: number;
  followingCount: number;
  gamesCount: number;
  reviewsCount: number;
  hoursPlayed: number;
  badges: Badge[];
  isFollowing?: boolean;
  isPremium?: boolean;
  createdAt: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt: string;
}

// ─── GAME ────────────────────────────────────────────────────────────────────
export interface Game {
  id: string;
  rawgId?: number;
  igdbId?: number;
  steamId?: number;
  title: string;
  coverUrl?: string;
  backgroundUrl?: string;
  developer: string;
  publisher?: string;
  genres: string[];
  platforms: Platform[];
  releaseDate?: string;
  rating?: number;           // RAWG community rating 0-100
  appRating?: number;     // Our community rating 0-10
  reviewsCount?: number;
  hltbMainStory?: number;    // HowLongToBeat hours
  hltbCompletionist?: number;
  description?: string;
  tags?: string[];
}

export type Platform = 'PC' | 'PS5' | 'PS4' | 'Xbox Series' | 'Xbox One' | 'Nintendo Switch' | 'iOS' | 'Android' | 'Mac';

// ─── BACKLOG ─────────────────────────────────────────────────────────────────
export type GameStatus = 'playing' | 'finished' | 'backlog' | 'dropped' | 'wishlist';

export interface BacklogEntry {
  id: string;
  userId: string;
  game: Game;
  status: GameStatus;
  progress?: number;       // 0-100 percentage
  hoursPlayed?: number;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
  notes?: string;
  platform?: Platform;
  isPrivate?: boolean;
}

// ─── REVIEW ──────────────────────────────────────────────────────────────────
export interface Review {
  id: string;
  user: User;
  game: Game;
  rating: number;          // 0.5-10 step 0.5
  title?: string;
  body: string;
  spoiler: boolean;
  platform?: Platform;
  hoursPlayed?: number;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── FEED / POSTS ────────────────────────────────────────────────────────────
export type PostType = 'status_update' | 'review' | 'list' | 'achievement' | 'clip';

export interface Post {
  id: string;
  user: User;
  type: PostType;
  game?: Game;
  status?: GameStatus;
  review?: Review;
  text?: string;
  imageUrl?: string;
  progress?: number;
  hoursPlayed?: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLiked?: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  user: User;
  text: string;
  likesCount: number;
  isLiked?: boolean;
  createdAt: string;
  replies?: Comment[];
}

// ─── LISTS ───────────────────────────────────────────────────────────────────
export interface GameList {
  id: string;
  userId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  games: Game[];
  isPublic: boolean;
  likesCount: number;
  createdAt: string;
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
export type NotificationType =
  | 'like_post'
  | 'like_review'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'friend_milestone'
  | 'game_release'
  | 'achievement';

export interface Notification {
  id: string;
  type: NotificationType;
  actor?: User;
  post?: Partial<Post>;
  game?: Partial<Game>;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  GameDetail: { gameId: string; game?: any };
  UserProfile: { userId: string; username?: string };
  ReviewDetail: { reviewId: string };
  ReviewCreate: { gameId?: string; game?: any };
  PostDetail: { postId: string };
  Comments: { postId: string };
  ListDetail: { listId: string; list?: any };
  Search: { initialQuery?: string };
  Settings: undefined;
  EditProfile: undefined;
  Notifications: undefined;
  CreatePost: { mode?: string };
  CreateList: undefined;
  Community: { communityId: string; community?: any };
  Communities: undefined;
  CreateCommunity: undefined;
  TopicDetail: { topicId: string };
  Messages: { userId?: string };
  Followers: { userId: string };
  Following: { userId: string };
};

export type MainTabParamList = {
  Feed: undefined;
  Explore: undefined;
  Backlog: undefined;
  Reviews: undefined;
  Profile: undefined;
};
