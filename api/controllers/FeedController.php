<?php
// FeedController
// Gerado automaticamente — parte de index.php

// ============================================================
// FEED
// ============================================================
if ($resource === 'feed' && $method === 'GET') {
    $me = auth_required();
    $pg = paginate();
    $type = $_GET['type'] ?? 'friends';

    $db = db();

    if ($type === 'friends') {
        $stmt = $db->prepare('
            SELECT p.*,
                   u.username, u.display_name, u.avatar_url,
                   g.title AS game_title, g.cover_url AS game_cover, g.developer AS game_dev,
                   (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS is_liked
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN games g ON g.id = p.game_id
            WHERE p.user_id IN (
                SELECT following_id FROM follows WHERE follower_id = ?
                UNION SELECT ?
            )
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $me['id'], $me['id'], $pg['limit'], $pg['offset']]);
    } else {
        $stmt = $db->prepare('
            SELECT p.*,
                   u.username, u.display_name, u.avatar_url,
                   g.title AS game_title, g.cover_url AS game_cover, g.developer AS game_dev,
                   (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS is_liked
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN games g ON g.id = p.game_id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $pg['limit'], $pg['offset']]);
    }

    $posts = $stmt->fetchAll();
    foreach ($posts as &$post) {
        $post['is_liked'] = (bool)$post['is_liked'];
        $post['user'] = [
            'id' => $post['user_id'],
            'username' => $post['username'],
            'display_name' => $post['display_name'],
            'avatar_url' => $post['avatar_url'],
        ];
        if ($post['game_title']) {
            $post['game'] = [
                'id' => $post['game_id'],
                'title' => $post['game_title'],
                'cover_url' => $post['game_cover'],
                'developer' => $post['game_dev'],
            ];
        }
        unset($post['username'], $post['display_name'], $post['avatar_url'], $post['game_title'], $post['game_cover'], $post['game_dev']);
    }
    $nextPage = count($posts) === $pg['limit'] ? $pg['page'] + 1 : null;
    respond(200, ['data' => $posts, 'nextPage' => $nextPage, 'meta' => ['page' => $pg['page'], 'limit' => $pg['limit']]]);
}

// ============================================================
// POSTS
// ============================================================
if ($resource === 'posts') {

    // POST /posts — criar post
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        if (empty($b['text']) && empty($b['game_id'])) respond(422, ['error' => 'Post precisa de texto ou jogo']);

        $postId = uuid();
        db()->prepare('INSERT INTO posts (id, user_id, game_id, type, status, text, progress, hours_played) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([$postId, $me['id'], $b['game_id'] ?? null, $b['type'] ?? 'status_update', $b['status'] ?? null, $b['text'] ?? null, $b['progress'] ?? null, $b['hours_played'] ?? null]);

        respond(201, ['id' => $postId]);
    }

    // DELETE /posts/:id
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        $postId = $sub;
        $stmt = db()->prepare('SELECT user_id FROM posts WHERE id = ?');
        $stmt->execute([$postId]);
        $post = $stmt->fetch();
        if (!$post) respond(404, ['error' => 'Post não encontrado']);
        if ($post['user_id'] !== $me['id']) respond(403, ['error' => 'Não autorizado']);
        db()->prepare('DELETE FROM posts WHERE id = ?')->execute([$postId]);
        respond(200, ['ok' => true]);
    }

    // POST /posts/:id/like
    if ($id === 'like' && $method === 'POST') {
        $me = auth_required();
        try {
            db()->prepare('INSERT INTO post_likes (user_id, post_id) VALUES (?,?)')->execute([$me['id'], $sub]);
            db()->prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?')->execute([$sub]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /posts/:id/like
    if ($id === 'like' && $method === 'DELETE') {
        $me = auth_required();
        $db = db();
        $del = $db->prepare('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?');
        $del->execute([$me['id'], $sub]);
        if ($del->rowCount() > 0)
            $db->prepare('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?')->execute([$sub]);
        respond(200, ['ok' => true]);
    }

    // GET /posts/:id/comments
    if ($id === 'comments' && $method === 'GET') {
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT c.*, u.username, u.display_name, u.avatar_url
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.post_id = ? AND c.parent_id IS NULL
            ORDER BY c.created_at ASC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$sub, $pg['limit'], $pg['offset']]);
        $comments = $stmt->fetchAll();
        // Buscar respostas aninhadas
        foreach ($comments as &$c) {
            $replies = db()->prepare('
                SELECT c.*, u.username, u.display_name, u.avatar_url
                FROM comments c
                JOIN users u ON u.id = c.user_id
                WHERE c.parent_id = ?
                ORDER BY c.created_at ASC
            ');
            $replies->execute([$c['id']]);
            $c['replies'] = $replies->fetchAll();
        }
        respond(200, ['data' => $comments]);
    }

    // POST /posts/:id/comments
    if ($id === 'comments' && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['text']);
        $cId = uuid();
        db()->prepare('INSERT INTO comments (id, post_id, user_id, text, parent_id) VALUES (?,?,?,?,?)')
            ->execute([$cId, $sub, $me['id'], $b['text'], $b['parent_id'] ?? null]);
        db()->prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?')->execute([$sub]);
        respond(201, ['id' => $cId]);
    }
}
