<?php
// FansController

// ============================================================
// FANS & SCRAPS (social connections)
// ============================================================
if ($resource === 'fans') {

    // GET /fans/me — lista fãs do usuário autenticado
    if ($sub === 'me' && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT f.id AS fan_id, f.created_at AS fan_since,
                   u.id, u.username, u.display_name, u.avatar_url, u.level
            FROM fans f
            JOIN users u ON u.id = f.fan_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // GET /fans/:userId — lista fãs de qualquer usuário
    if ($sub && $sub !== 'me' && !$id && $method === 'GET') {
        auth_required();
        validate_id($sub, 'User ID');
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT f.id AS fan_id, f.created_at AS fan_since,
                   u.id, u.username, u.display_name, u.avatar_url, u.level
            FROM fans f
            JOIN users u ON u.id = f.fan_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$sub, $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // POST /fans/:userId — virar fã de alguém
    if ($sub && !$id && $method === 'POST') {
        $me = auth_required();
        validate_id($sub, 'User ID');
        if ($sub === $me['id']) respond(422, ['error' => 'Você não pode ser fã de si mesmo']);
        try {
            db()->prepare('INSERT INTO fans (id, user_id, fan_id, created_at) VALUES (?,?,?,NOW())')
               ->execute([uuid(), $sub, $me['id']]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /fans/:userId — deixar de ser fã
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        validate_id($sub, 'User ID');
        db()->prepare('DELETE FROM fans WHERE user_id = ? AND fan_id = ?')
           ->execute([$sub, $me['id']]);
        respond(200, ['ok' => true]);
    }
}
