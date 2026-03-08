/**
 * BACKLOG NETWORK — API Service completo
 * Conecta todas as telas ao backend PHP no Hostgator
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = __DEV__
  ? 'http://localhost:8000'
  : 'https://wilkenperez.com/backlog-network-api';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL, timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('backlog_network_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(res => res, async (err: AxiosError) => {
  if (err.response?.status === 401) await SecureStore.deleteItemAsync('backlog_network_token');
  return Promise.reject(err);
});

function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) return (err.response?.data as any)?.error ?? 'Erro desconhecido';
  return 'Erro de conexão';
}

export const authService = {
  async register(data: { username: string; email: string; password: string; display_name: string }) {
    try { const res = await api.post('/auth/register', data); await SecureStore.setItemAsync('backlog_network_token', res.data.token); return res.data; }
    catch (err) { throw new Error(extractError(err)); }
  },
  async login(email: string, password: string) {
    try { const res = await api.post('/auth/login', { email, password }); await SecureStore.setItemAsync('backlog_network_token', res.data.token); return res.data; }
    catch (err) { throw new Error(extractError(err)); }
  },
  async me() { try { return (await api.get('/auth/me')).data; } catch (err) { throw new Error(extractError(err)); } },
  async logout() { await api.post('/auth/logout').catch(() => {}); await SecureStore.deleteItemAsync('backlog_network_token'); },
};

export const feedService = {
  async getFeed(params: { filter?: string; page?: number } = {}) { return api.get('/feed', { params }); },
  async createPost(data: any) {
    return (await api.post('/posts', {
      text: data.content ?? data.text,
      game_id: data.game_id ?? null,
      type: data.type ?? 'status_update',
      status: data.game_status ?? data.status ?? null,
      progress: data.progress ?? null,
      hours_played: data.hours_played ?? null,
      image_url: data.image_url ?? null,
    })).data;
  },
  async likePost(postId: string) { await api.post(`/posts/${postId}/like`); },
  async unlikePost(postId: string) { await api.delete(`/posts/${postId}/like`); },
  async getComments(postId: string, page = 1) { return (await api.get(`/posts/${postId}/comments`, { params: { page } })).data; },
  async addComment(postId: string, text: string, parentId?: string) { return (await api.post(`/posts/${postId}/comments`, { text, parent_id: parentId })).data; },
};

export const gamesService = {
  async search(q: string) { return (await api.get('/games/search', { params: { q } })).data; },
  async getTrending() { return api.get('/games/trending'); },
  async getSteamTop() { return api.get('/games/steam-top'); },
  async getGame(gameId: string) { return (await api.get(`/games/${gameId}`)).data; },
  async getReviews(gameId: string, page = 1) { return (await api.get(`/games/${gameId}/reviews`, { params: { page } })).data; },
};

export const backlogService = {
  async getMyBacklog(status?: string) { return api.get('/backlog', { params: status ? { status } : {} }); },
  async getBacklog(userId: string, status?: string) { return api.get(`/users/${userId}/backlog`, { params: status ? { status } : {} }); },
  async getStats() { return (await api.get('/backlog/stats')).data; },
  async addGame(data: { game_id: string; status: string; platform?: string; progress?: number; hours_played?: number }) { return (await api.post('/backlog', data)).data; },
  async updateEntry(entryId: string, data: object) { return (await api.patch(`/backlog/${entryId}`, data)).data; },
  async removeGame(entryId: string) { await api.delete(`/backlog/${entryId}`); },
};

export const reviewsService = {
  async getMyReviews(page = 1) { return api.get('/reviews/me', { params: { page } }); },
  async getUserReviews(userId: string, page = 1) { return api.get(`/users/${userId}/reviews`, { params: { page } }); },
  async createReview(data: { game_id: string; rating: number; body: string; title?: string; spoiler?: boolean; platform?: string; hours_played?: number }) { return (await api.post('/reviews', data)).data; },
  async updateReview(reviewId: string, data: object) { return (await api.patch(`/reviews/${reviewId}`, data)).data; },
  async deleteReview(reviewId: string) { await api.delete(`/reviews/${reviewId}`); },
  async likeReview(reviewId: string) { await api.post(`/reviews/${reviewId}/like`); },
};

export const usersService = {
  async getUser(userId: string) { return api.get(`/users/${userId}`); },
  async getProfile(userId: string) { return api.get(`/users/${userId}`); },
  async getUserBacklog(userId: string, status?: string) { return (await api.get(`/users/${userId}/backlog`, { params: status ? { status } : {} })).data; },
  async follow(userId: string) { await api.post(`/users/${userId}/follow`); },
  async unfollow(userId: string) { await api.delete(`/users/${userId}/follow`); },
  async getSuggested() { return api.get('/users/suggested'); },
  async search(q: string) { return (await api.get('/users/search', { params: { q } })).data; },
  async updateProfile(data: object) { return (await api.patch('/users/me', data)).data; },
};

export const notificationsService = {
  async getAll(page = 1) { return api.get('/notifications', { params: { page } }); },
  async getUnreadCount(): Promise<number> { return (await api.get('/notifications/unread-count')).data.count; },
  async markRead(notifId: string) { await api.patch(`/notifications/${notifId}/read`); },
  async markAllRead() { await api.patch('/notifications/read-all'); },
};

export const communitiesService = {
  async getAll(params?: object) { return api.get('/communities', { params }); },
  async list(params?: object) { return (await api.get('/communities', { params })).data; },
  async get(idOrSlug: string) { return (await api.get(`/communities/${idOrSlug}`)).data; },
  async create(data: object) { return (await api.post('/communities', data)).data; },
  async update(id: string, data: object) { return (await api.patch(`/communities/${id}`, data)).data; },
  async join(id: string, message?: string) { return (await api.post(`/communities/${id}/join`, { message })).data; },
  async leave(id: string) { await api.delete(`/communities/${id}/join`); },
  async getMembers(id: string, params?: object) { return (await api.get(`/communities/${id}/members`, { params })).data; },
  async moderate(id: string, data: object) { return (await api.post(`/communities/${id}/moderate`, data)).data; },
  async getRequests(id: string) { return (await api.get(`/communities/${id}/requests`)).data; },
  async getReports(id: string) { return (await api.get(`/communities/${id}/reports`)).data; },
  async getLogs(id: string, page = 1) { return (await api.get(`/communities/${id}/logs`, { params: { page } })).data; },
};

export const topicsService = {
  async list(communityId: string, params?: object) { return (await api.get('/topics', { params: { community_id: communityId, ...params as any } })).data; },
  async get(topicId: string, page = 1) { return (await api.get(`/topics/${topicId}`, { params: { page } })).data; },
  async create(data: object) { return (await api.post('/topics', data)).data; },
  async reply(topicId: string, body: string, parentId?: string) { return (await api.post(`/topics/${topicId}/replies`, { body, parent_id: parentId })).data; },
  async like(topicId: string) { await api.post(`/topics/${topicId}/like`); },
  async unlike(topicId: string) { await api.delete(`/topics/${topicId}/like`); },
  async remove(topicId: string, reason?: string) { await api.delete(`/topics/${topicId}`, { data: { reason } }); },
  async pin(topicId: string) { return (await api.patch(`/topics/${topicId}/pin`)).data; },
  async report(topicId: string, reason: string, description?: string) { await api.post(`/topics/${topicId}/report`, { reason, description }); },
};

export const scrapsService = {
  async getUserScraps(userId: string, page = 1) { return (await api.get(`/scraps/${userId}`, { params: { page } })).data; },
  async send(toUserId: string, body: string, isPrivate = false) { return (await api.post('/scraps', { to_user_id: toUserId, body, is_private: isPrivate })).data; },
  async remove(scrapId: string) { await api.delete(`/scraps/${scrapId}`); },
};

export const messagesService = {
  async getConversations() { return (await api.get('/messages')).data; },
  async getMessages(conversationId: string, page = 1) { return (await api.get(`/messages/${conversationId}`, { params: { page } })).data; },
  async send(toUserId: string, body: string, imageUrl?: string) { return (await api.post('/messages', { to_user_id: toUserId, body, image_url: imageUrl })).data; },
};

export const fansService = {
  async becomeFan(idolId: string) { await api.post(`/fans/${idolId}`); },
  async stopBeingFan(idolId: string) { await api.delete(`/fans/${idolId}`); },
  async getFans(userId: string, page = 1) { return (await api.get(`/fans/${userId}/list`, { params: { page } })).data; },
  async getFansCount(userId: string): Promise<number> { return (await api.get(`/fans/${userId}/count`)).data.fans_count; },
};

export default api;

export const uploadService = {
  async uploadImage(base64: string) { return (await api.post('/upload', { image_base64: base64 })).data; },
};

export const storiesService = {
  async getStories() { return (await api.get('/stories')).data; },
  async createStory(data: any) { return (await api.post('/stories', data)).data; },
  async deleteStory(id: string) { await api.delete(`/stories/${id}`); },
};

export const listsService = {
  async getMyLists() { return api.get('/lists/me'); },
  async getUserLists(userId: string) { return api.get(`/users/${userId}/lists`); },
  async create(data: { title: string; description?: string; list_type?: string; is_public?: boolean }) { return api.post('/lists', data); },
  async update(listId: string, data: object) { return api.patch(`/lists/${listId}`, data); },
  async delete(listId: string) { return api.delete(`/lists/${listId}`); },
  async addGame(listId: string, gameId: string, notes?: string) { return api.post(`/lists/${listId}/items`, { game_id: gameId, notes }); },
  async removeGame(listId: string, itemId: string) { return api.delete(`/lists/${listId}/items/${itemId}`); },
};
