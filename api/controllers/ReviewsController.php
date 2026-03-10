<?php
// ReviewsController
// Gerado automaticamente — parte de index.php

// ============================================================
// REVIEWS
// ============================================================
if ($resource === 'reviews') {

    // GET /reviews/me
    if ($sub === 'me' && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT r.*, g.title AS game_title, g.cover_url AS game_cover
            FROM reviews r JOIN games g ON g.id = r.game_id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // POST /reviews
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['game_id', 'rating', 'body']);
        if ($b['rating'] < 0.5 || $b['rating'] > 10) respond(422, ['error' => 'Nota deve ser entre 0.5 e 10']);

        $rId = uuid();
        try {
            db()->prepare('INSERT INTO reviews (id, user_id, game_id, rating, title, body, spoiler, platform, hours_played) VALUES (?,?,?,?,?,?,?,?,?)')
                ->execute([$rId, $me['id'], $b['game_id'], $b['rating'], $b['title'] ?? null, $b['body'], (int)($b['spoiler'] ?? 0), $b['platform'] ?? null, $b['hours_played'] ?? null]);
        } catch (PDOException $e) {
            respond(409, ['error' => 'Você já escreveu uma review para este jogo']);
        }

        db()->prepare('UPDATE games SET `backlog-network_rating` = (SELECT AVG(rating) FROM reviews WHERE game_id = ?), reviews_count = (SELECT COUNT(*) FROM reviews WHERE game_id = ?) WHERE id = ?')
            ->execute([$b['game_id'], $b['game_id'], $b['game_id']]);

        $postId = uuid();
        db()->prepare('INSERT INTO posts (id, user_id, game_id, review_id, type, status, text) VALUES (?,?,?,?,?,?,?)')
            ->execute([$postId, $me['id'], $b['game_id'], $rId, 'review', 'finished', $b['body']]);

        respond(201, ['id' => $rId]);
    }

    // PATCH /reviews/:id
    if ($sub && !$id && $method === 'PATCH') {
        $me = auth_required();
        $b  = body();
        $allowed = ['rating', 'title', 'body', 'spoiler', 'platform', 'hours_played'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; }
        }
        $params[] = $sub; $params[] = $me['id'];
        db()->prepare('UPDATE reviews SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?')->execute($params);
        respond(200, ['ok' => true]);
    }

    // DELETE /reviews/:id
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        $db = db();
        $r  = $db->prepare('SELECT game_id FROM reviews WHERE id = ? AND user_id = ?');
        $r->execute([$sub, $me['id']]);
        $row = $r->fetch();
        if (!$row) respond(404, ['error' => 'Review não encontrada']);
        $db->prepare('DELETE FROM reviews WHERE id = ?')->execute([$sub]);
        $db->prepare('UPDATE games SET `backlog-network_rating` = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE game_id = ?), reviews_count = (SELECT COUNT(*) FROM reviews WHERE game_id = ?) WHERE id = ?')
           ->execute([$row['game_id'], $row['game_id'], $row['game_id']]);
        respond(200, ['ok' => true]);
    }

    // POST /reviews/:id/like
    if ($sub && $id === 'like' && $method === 'POST') {
        $me = auth_required();
        try {
            db()->prepare('INSERT INTO review_likes (user_id, review_id) VALUES (?,?)')->execute([$me['id'], $sub]);
            db()->prepare('UPDATE reviews SET likes_count = likes_count + 1 WHERE id = ?')->execute([$sub]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }
}
