<?php
// UsersController
// Gerado automaticamente — parte de index.php

// ============================================================
// USERS
// ============================================================
if ($resource === 'users') {

    // GET /users/suggested
    if ($sub === 'suggested' && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT u.id, u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count
            FROM users u
            WHERE u.id != ?
              AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
              AND u.is_active = 1
            ORDER BY followers_count DESC
            LIMIT 5
        ');
        $stmt->execute([$me['id'], $me['id']]);
        respond(200, $stmt->fetchAll());
    }

    // GET /users/search?q=
    if ($sub === 'search' && $method === 'GET') {
        auth_required();
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) respond(200, []);
        $stmt = db()->prepare('SELECT id, username, display_name, avatar_url FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND is_active = 1 LIMIT 20');
        $stmt->execute(["%$q%", "%$q%"]);
        respond(200, $stmt->fetchAll());
    }

    // GET /users/:id
    if ($sub && !$id && $method === 'GET') {
        $me   = auth_required();
        $stmt = db()->prepare('SELECT * FROM users WHERE id = ? AND is_active = 1');
        $stmt->execute([$sub]);
        $user = $stmt->fetch();
        if (!$user) respond(404, ['error' => 'Usuário não encontrado']);

        $stats = db()->prepare('
            SELECT
                (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
                (SELECT COUNT(*) FROM follows WHERE follower_id  = ?) AS following_count,
                (SELECT COUNT(*) FROM backlog  WHERE user_id = ?)     AS games_count,
                (SELECT COUNT(*) FROM reviews  WHERE user_id = ?)     AS reviews_count,
                (SELECT COUNT(*) FROM follows  WHERE follower_id = ? AND following_id = ?) AS is_following
        ');
        $stats->execute([$sub, $sub, $sub, $sub, $me['id'], $sub]);
        $s = $stats->fetch();

        respond(200, array_merge(user_public($user), [
            'followers_count' => (int)$s['followers_count'],
            'following_count' => (int)$s['following_count'],
            'games_count'     => (int)$s['games_count'],
            'reviews_count'   => (int)$s['reviews_count'],
            'is_following'    => (bool)$s['is_following'],
        ]));
    }

    // GET /users/:id/backlog
    if ($id === 'backlog' && $method === 'GET') {
        auth_required();
        $status = $_GET['status'] ?? null;
        $query = 'SELECT b.*, g.title, g.cover_url FROM backlog b JOIN games g ON g.id = b.game_id WHERE b.user_id = ? AND b.is_private = 0';
        $params = [$sub];
        if ($status) { $query .= ' AND b.status = ?'; $params[] = $status; }
        $stmt = db()->prepare($query . ' ORDER BY b.updated_at DESC');
        $stmt->execute($params);
        respond(200, $stmt->fetchAll());
    }

    // POST /users/:id/follow
    if ($id === 'follow' && $method === 'POST') {
        $me = auth_required();
        if ($me['id'] === $sub) respond(400, ['error' => 'Você não pode se seguir']);
        try {
            db()->prepare('INSERT INTO follows (follower_id, following_id) VALUES (?,?)')->execute([$me['id'], $sub]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /users/:id/follow
    if ($id === 'follow' && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')->execute([$me['id'], $sub]);
        respond(200, ['ok' => true]);
    }

    // PATCH /users/me
    if ($sub === 'me' && !$id && $method === 'PATCH') {
        $me = auth_required();
        $b  = body();

        if (array_key_exists('username', $b)) {
            $newUsername = strtolower(trim($b['username']));
            if (strlen($newUsername) < 3 || strlen($newUsername) > 30)
                respond(422, ['error' => 'Username deve ter entre 3 e 30 caracteres']);
            if (!preg_match('/^[a-z0-9_.]+$/', $newUsername))
                respond(422, ['error' => 'Username só pode ter letras, números, _ e .']);
            $check = db()->prepare('SELECT id FROM users WHERE username = ? AND id != ?');
            $check->execute([$newUsername, $me['id']]);
            if ($check->fetch()) respond(409, ['error' => 'Este handle já está em uso']);
            db()->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$newUsername, $me['id']]);
            respond(200, ['ok' => true, 'username' => $newUsername]);
        }

        $allowed = ['display_name', 'bio', 'avatar_url', 'is_profile_public', 'backlog_visibility'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; }
        }
        if (!$sets) respond(422, ['error' => 'Nada para atualizar']);
        $params[] = $me['id'];
        db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        respond(200, ['ok' => true]);
    }

    // GET /users/check-username?username=
    if ($sub === 'check-username' && $method === 'GET') {
        auth_required();
        $username = strtolower(trim($_GET['username'] ?? ''));
        if (strlen($username) < 3) respond(200, ['available' => false, 'reason' => 'Muito curto']);
        $stmt = db()->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        respond(200, ['available' => !$stmt->fetch()]);
    }

    // PATCH /users/me/privacy
    if ($sub === 'me' && $id === 'privacy' && $method === 'PATCH') {
        $me = auth_required();
        $b  = body();
        $allowed = ['is_profile_public', 'backlog_visibility'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; }
        }
        if (!$sets) respond(422, ['error' => 'Nada para atualizar']);
        $params[] = $me['id'];
        db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        respond(200, ['ok' => true]);
    }

    // GET /users/me/privacy
    if ($sub === 'me' && $id === 'privacy' && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('SELECT is_profile_public, backlog_visibility, totp_enabled FROM users WHERE id = ?');
        $stmt->execute([$me['id']]);
        respond(200, $stmt->fetch());
    }

    // GET /users/me/blocked
    if ($sub === 'me' && $id === 'blocked' && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT b.id AS block_id, b.blocked_id, u.username, u.display_name, u.avatar_url, b.created_at
            FROM blocked_users b
            JOIN users u ON u.id = b.blocked_id
            WHERE b.blocker_id = ?
            ORDER BY b.created_at DESC
        ');
        $stmt->execute([$me['id']]);
        respond(200, $stmt->fetchAll());
    }

    // POST /users/:id/block
    if ($id === 'block' && $method === 'POST') {
        $me = auth_required();
        $targetId = $sub;
        if ($targetId === $me['id']) respond(422, ['error' => 'Não pode bloquear a si mesmo']);
        try {
            db()->prepare('INSERT INTO blocked_users (id, blocker_id, blocked_id) VALUES (?,?,?)')
                ->execute([uuid(), $me['id'], $targetId]);
            db()->prepare('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)')
                ->execute([$me['id'], $targetId, $targetId, $me['id']]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /users/:id/block
    if ($id === 'block' && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?')
            ->execute([$me['id'], $sub]);
        respond(200, ['ok' => true]);
    }

    // GET /users/:id/posts
    if ($id === 'posts' && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT p.id, p.user_id, p.type, p.status,
                   COALESCE(p.content, p.text) AS content,
                   p.game_id, p.hours_played, p.progress,
                   p.likes_count, p.comments_count, p.created_at,
                   g.title AS game_title, g.cover_url AS game_cover,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me
            FROM posts p
            LEFT JOIN games g ON g.id = p.game_id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $sub, $pg['limit'], $pg['offset']]);
        $posts = $stmt->fetchAll();
        foreach ($posts as &$p) { $p['liked_by_me'] = (bool)$p['liked_by_me']; }
        $total = db()->prepare('SELECT COUNT(*) FROM posts WHERE user_id = ?');
        $total->execute([$sub]);
        $count = (int)$total->fetchColumn();
        respond(200, ['data' => $posts, 'has_more' => ($pg['offset'] + $pg['limit']) < $count]);
    }

    // GET /users/:id/reviews
    if ($id === 'reviews' && $method === 'GET') {
        auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT r.*, g.title AS game_title, g.cover_url AS game_cover
            FROM reviews r JOIN games g ON g.id = r.game_id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC LIMIT ? OFFSET ?
        ');
        $stmt->execute([$sub, $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // GET /users/:id/lists
    if ($id === 'lists' && $method === 'GET') {
        auth_required();
        $stmt = db()->prepare('SELECT l.*, COUNT(li.id) as items_count FROM game_lists l LEFT JOIN game_list_items li ON li.list_id = l.id WHERE l.user_id = ? AND l.is_public = 1 GROUP BY l.id ORDER BY l.created_at DESC');
        $stmt->execute([$sub]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }
}
