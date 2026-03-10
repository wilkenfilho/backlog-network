<?php
// NotificationsController
// Gerado automaticamente — parte de index.php

// ============================================================
// NOTIFICATIONS
// ============================================================
if ($resource === 'notifications') {

    // GET /notifications
    if (!$sub && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT n.*, u.username AS actor_username, u.avatar_url AS actor_avatar
            FROM notifications n
            LEFT JOIN users u ON u.id = n.actor_id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // GET /notifications/unread-count
    if ($sub === 'unread-count' && $method === 'GET') {
        $me   = auth_required();
        $stmt = db()->prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0');
        $stmt->execute([$me['id']]);
        respond(200, $stmt->fetch());
    }

    // PATCH /notifications/read-all
    if ($sub === 'read-all' && $method === 'PATCH') {
        $me = auth_required();
        db()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')->execute([$me['id']]);
        respond(200, ['ok' => true]);
    }

    // PATCH /notifications/:id/read
    if ($sub && $id === 'read' && $method === 'PATCH') {
        $me = auth_required();
        db()->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')->execute([$sub, $me['id']]);
        respond(200, ['ok' => true]);
    }
}
