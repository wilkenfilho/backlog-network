/**
 * BACKLOG NETWORK — API Service completo
 * Conecta todas as telas ao backend PHP no Hostgator
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://wilkenperez.com/backlog-network-api';

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
    try {
      const res = await api.post('/auth/register', data);
      await SecureStore.setItemAsync('backlog_network_token', res.data.token);
      const raw = res.data?.user ?? res.data;
      return { ...res.data, user: { ...raw, displayName: raw.display_name ?? raw.displayName ?? raw.username ?? '', avatarUrl: raw.avatar_url ?? raw.avatar } };
    } catch (err) { throw new Error(extractError(err)); }
  },
  async login(email: string, password: string) {
    try {
      const res = await api.post('/auth/login', { email, password });
      await SecureStore.setItemAsync('backlog_network_token', res.data.token);
      const raw = res.data?.user ?? res.data;
      return { ...res.data, user: { ...raw, displayName: raw.display_name ?? raw.displayName ?? raw.username ?? '', avatarUrl: raw.avatar_url ?? raw.avatar } };
    } catch (err) { throw new Error(extractError(err)); }
  },
  async me() {
    try {
      const res = await api.get('/auth/me');
      const raw = res.data?.user ?? res.data;
      return {
        ...raw,
        displayName: raw.display_name ?? raw.displayName ?? raw.username ?? '',
        avatar: raw.avatar_url ?? raw.avatar,
        avatarUrl: raw.avatar_url ?? raw.avatar,
      };
    } catch (err) { throw new Error(extractError(err)); }
  },
  async logout() { await api.post('/auth/logout').catch(() => {}); await SecureStore.deleteItemAsync('backlog_network_token'); },
  async changeEmail(newEmail: string, password: string) {
    try { return (await api.post('/auth/change-email', { new_email: newEmail, password })).data; }
    catch (err) { throw new Error(extractError(err)); }
  },
  async changePassword(currentPassword: string, newPassword: string) {
    try { return (await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword })).data; }
    catch (err) { throw new Error(extractError(err)); }
  },
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
  async addComment(postId: string, text: string, parentId?: string) { return (await api.post(`/posts/${postId}/comments`, { text, body: text, parent_id: parentId ?? null })).data; },
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
  async getUserReviews(userId: string, page = 1) {
    try {
      return api.get(`/users/${userId}/reviews`, { params: { page } });
    } catch {
      return api.get('/reviews/me', { params: { page } });
    }
  },
  async createReview(data: { game_id: string; rating: number; body: string; title?: string; spoiler?: boolean; platform?: string; hours_played?: number }) {
    try {
      return (await api.post('/reviews', data)).data;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? 'Erro ao criar review';
      const error = new Error(typeof msg === 'object' ? JSON.stringify(msg) : msg) as any;
      error.status = status;
      throw error;
    }
  },
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
  async getSuggested() {
    try {
      const res = await api.get('/users/suggested');
      const data = res.data?.data ?? res.data ?? [];
      if (Array.isArray(data) && data.length > 0) return res;
      return api.get('/users/search', { params: { q: '' } });
    } catch {
      return api.get('/users/search', { params: { q: '' } });
    }
  },
  async search(q: string) { return (await api.get('/users/search', { params: { q } })).data; },
  async updateProfile(data: object) { return (await api.patch('/users/me', data)).data; },
  async updateUsername(username: string) {
    return (await api.patch('/users/me', { username })).data;
  },
  async checkUsernameAvailable(username: string) {
    try {
      const res = await api.get('/users/check-username', { params: { username } });
      return res.data?.available ?? true;
    } catch { return true; }
  },
  async getUserPosts(userId: string, page = 1) {
    try {
      const res = await api.get(`/users/${userId}/posts`, { params: { page } });
      return res.data;
    } catch (e: any) {
      // Fallback: filter feed by user
      if (e?.response?.status === 404) {
        const res = await api.get('/feed', { params: { filter: 'global', page } });
        const all = res.data?.data ?? res.data ?? [];
        const filtered = all.filter((p: any) => String(p.user_id) === String(userId) || String(p.user?.id) === String(userId));
        return { data: filtered, has_more: false };
      }
      throw e;
    }
  },
  async getPrivacy() { return (await api.get('/users/me/privacy')).data; },
  async updatePrivacy(data: object) { return (await api.patch('/users/me/privacy', data)).data; },
  async getBlockedUsers() { return (await api.get('/users/me/blocked')).data; },
  async blockUser(userId: string) { return (await api.post(`/users/${userId}/block`)).data; },
  async unblockUser(userId: string) { return (await api.delete(`/users/${userId}/block`)).data; },
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
  async create(data: object) {
    try {
      const res = await api.post('/communities', data);
      const result = res.data;
      // Some backends return 200 with success:false
      if (result && result.success === false) {
        const msg = result.error ?? result.message ?? 'Erro ao criar comunidade';
        throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : String(msg));
      }
      return result;
    } catch (err: any) {
      if (err instanceof Error && !(err as any).isAxiosError) throw err; // Re-throw our custom errors
      const d = err?.response?.data;
      const msg = (typeof d === 'string' && d.length < 500 ? d : null)
        ?? d?.error ?? d?.message ?? d?.errors
        ?? err?.message ?? 'Erro ao criar comunidade';
      throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : String(msg).slice(0, 300));
    }
  },
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
  async getMessages(withUserId: string, page = 1) {
    // Try both endpoint patterns since backends vary
    try {
      return (await api.get(`/messages/conversation/${withUserId}`, { params: { page } })).data;
    } catch {
      return (await api.get('/messages', { params: { with: withUserId, page } })).data;
    }
  },
  async send(toUserId: string, body: string, imageUrl?: string) {
    try {
      return (await api.post('/messages', { to_user_id: toUserId, body, message: body, image_url: imageUrl ?? null })).data;
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message ?? 'Erro ao enviar mensagem';
      throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : String(msg));
    }
  },
  async startConversation(toUserId: string, body: string) {
    return (await api.post('/messages', { to_user_id: toUserId, body })).data;
  },
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
  async getList(listId: string) {
    try { return (await api.get(`/lists/${listId}`)).data; }
    catch { return null; }
  },
  async getItems(listId: string) {
    try { return (await api.get(`/lists/${listId}/items`)).data; }
    catch { return { data: [] }; }
  },
  async create(data: { title: string; description?: string | null; list_type?: string; is_public?: boolean }) {
    try {
      const payload: any = { title: data.title };
      if (data.description) payload.description = data.description;
      if (data.list_type) payload.list_type = data.list_type;
      payload.is_public = data.is_public !== false ? 1 : 0;
      return (await api.post('/lists', payload)).data;
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? 'Erro ao criar lista';
      throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    }
  },
  async update(listId: string, data: object) { return api.patch(`/lists/${listId}`, data); },
  async delete(listId: string) { return api.delete(`/lists/${listId}`); },
  async addGame(listId: string, gameId: string, notes?: string) { return api.post(`/lists/${listId}/items`, { game_id: gameId, notes }); },
  async removeGame(listId: string, itemId: string) { return api.delete(`/lists/${listId}/items/${itemId}`); },
};

export const rawgService = {
  RAWG_KEY: '089962d8173c4418813243d5de18e7eb',
  BASE: 'https://api.rawg.io/api',

  _map(g: any) {
    return {
      id: String(g.id),
      title: g.name,
      developer: g.developers?.[0]?.name ?? '',
      coverUrl: g.background_image,
      cover_url: g.background_image,
      rating: g.rating,
      rawg_rating: g.rating,
      genres: g.genres?.map((x: any) => x.name) ?? [],
      platforms: g.platforms?.map((x: any) => x.platform?.name ?? x.name) ?? [],
      released: g.released,
      rawg_id: g.id,
      metacritic: g.metacritic,
      description: g.description_raw ?? '',
    };
  },

  async search(q: string, page = 1) {
    const res = await axios.get(`${rawgService.BASE}/games`, {
      params: { key: rawgService.RAWG_KEY, search: q, page_size: 40, page },
    });
    return (res.data.results ?? []).map(rawgService._map);
  },

  async getTrending(page = 1) {
    const res = await axios.get(`${rawgService.BASE}/games`, {
      params: {
        key: rawgService.RAWG_KEY,
        ordering: '-added',
        page_size: 40,
        page,
      },
    });
    return (res.data.results ?? []).map(rawgService._map);
  },

  async getByGenre(genre: string, page = 1) {
    const res = await axios.get(`${rawgService.BASE}/games`, {
      params: {
        key: rawgService.RAWG_KEY,
        genres: genre.toLowerCase(),
        ordering: '-rating',
        page_size: 40,
        page,
      },
    });
    return (res.data.results ?? []).map(rawgService._map);
  },

  async getGame(rawgId: string) {
    const res = await axios.get(`${rawgService.BASE}/games/${rawgId}`, {
      params: { key: rawgService.RAWG_KEY },
    });
    const g = res.data;
    return {
      id: String(g.id),
      title: g.name,
      developer: g.developers?.[0]?.name ?? '',
      publisher: g.publishers?.[0]?.name ?? '',
      coverUrl: g.background_image,
      cover_url: g.background_image,
      rating: g.rating,
      rawg_rating: g.rating,
      description: g.description_raw ?? g.description ?? '',
      genres: g.genres?.map((x: any) => x.name) ?? [],
      platforms: g.platforms?.map((x: any) => x.platform?.name ?? x.name) ?? [],
      released: g.released,
      metacritic: g.metacritic,
      rawg_id: g.id,
      screenshots: g.short_screenshots?.map((s: any) => s.image) ?? [],
    };
  },
};

export const steamService = {
  STEAM_KEY: 'C240898DA51E2DC8D587EA61A4E47A7C',
  BASE: 'https://api.steampowered.com',

  async getTopGames() {
    // Use SteamSpy for top games list (no CORS), then enrich with Steam store details
    const TOP_APP_IDS = [
      730,      // CS2
      570,      // Dota 2
      1091500,  // Cyberpunk 2077
      1245620,  // Elden Ring
      1716740,  // DAVE THE DIVER
      1888160,  // They Always Run
      2358720,  // Black Myth: Wukong
      2767030,  // Hades II
      1203220,  // NARAKA: BLADEPOINT
      578080,   // PUBG
      1172470,  // Apex Legends
      252490,   // Rust
      440,      // Team Fortress 2
      550,      // Left 4 Dead 2
      359550,   // Rainbow Six Siege
      1086940,  // Baldur's Gate 3
      1151640,  // Fallout 76
      271590,   // GTA V
      381210,   // Dead by Daylight
      1623730,  // Palworld
    ];
    const results = await Promise.allSettled(
      TOP_APP_IDS.map(id =>
        axios.get(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=br&l=portuguese`, { timeout: 8000 })
          .then(r => {
            const d = r.data?.[id]?.data;
            if (!d) return null;
            return {
              steam_id: id,
              id: String(id),
              title: d.name,
              cover_url: d.header_image,
              price: d.is_free ? 'Grátis' : d.price_overview?.final_formatted ?? '',
              description: d.short_description ?? '',
              genres: d.genres?.map((g: any) => g.description) ?? [],
              developers: d.developers ?? [],
              release_date: d.release_date?.date ?? '',
            };
          }).catch(() => null)
      )
    );
    return results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map((r: any) => r.value);
  },

  async getNewsForApp(appId: number) {
    const res = await axios.get(
      `${steamService.BASE}/ISteamNews/GetNewsForApp/v0002/?appid=${appId}&count=5&maxlength=300`
    );
    return res.data?.appnews?.newsitems ?? [];
  },
};


