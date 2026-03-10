<?php
// StoriesController
// Gerado automaticamente — parte de index.php

// ============================================================
// STORIES
// ============================================================
if ($resource === 'stories') {
    // GET /stories
    if (!$sub && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT s.*, u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) AS views_count,
                   (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id AND sv.user_id = ?) AS viewed_by_me
            FROM stories s
            JOIN users u ON u.id = s.user_id
            WHERE s.expires_at > NOW()
            ORDER BY s.created_at DESC
            LIMIT 100
        ');
        $stmt->execute([$me['id']]);
        $stories = $stmt->fetchAll();
        foreach ($stories as &$s) { $s['viewed_by_me'] = (bool)$s['viewed_by_me']; }
        respond(200, $stories);
    }

    // POST /stories
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        $sid = uuid();
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        try {
            db()->prepare('INSERT INTO stories (id, user_id, image_url, caption, duration, expires_at, created_at) VALUES (?,?,?,?,?,?,NOW())')
               ->execute([$sid, $me['id'], $b['image_url'] ?? null, $b['caption'] ?? null, $b['duration'] ?? 5, $expiresAt]);
        } catch (PDOException $e) {
            respond(500, ['error' => 'Erro ao criar story: ' . $e->getMessage()]);
        }
        respond(201, ['id' => $sid]);
    }

    // POST /stories/:id/view
    if ($sub && $id === 'view' && $method === 'POST') {
        $me = auth_required();
        try { db()->prepare('INSERT IGNORE INTO story_views (id, story_id, user_id, created_at) VALUES (?,?,?,NOW())')->execute([uuid(), $sub, $me['id']]); } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /stories/:id
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM stories WHERE id = ? AND user_id = ?')->execute([$sub, $me['id']]);
        respond(200, ['ok' => true]);
    }
}
