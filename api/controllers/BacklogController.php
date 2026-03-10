<?php
// BacklogController
// Gerado automaticamente — parte de index.php

// ============================================================
// BACKLOG
// ============================================================
if ($resource === 'backlog') {

    // GET /backlog — meu backlog
    if (!$sub && $method === 'GET') {
        $me = auth_required();
        $status = $_GET['status'] ?? null;
        $query  = 'SELECT b.*, g.title, g.cover_url, g.developer, g.rawg_rating FROM backlog b JOIN games g ON g.id = b.game_id WHERE b.user_id = ?';
        $params = [$me['id']];
        if ($status) { $query .= ' AND b.status = ?'; $params[] = $status; }
        $query .= ' ORDER BY b.updated_at DESC';
        $stmt = db()->prepare($query);
        $stmt->execute($params);
        respond(200, $stmt->fetchAll());
    }

    // GET /backlog/stats
    if ($sub === 'stats' && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT
                SUM(status = "playing")  AS playing,
                SUM(status = "finished") AS finished,
                SUM(status = "backlog")  AS backlog,
                SUM(status = "dropped")  AS dropped,
                COUNT(*)                 AS total,
                COALESCE(SUM(hours_played), 0) AS hours_played
            FROM backlog WHERE user_id = ?
        ');
        $stmt->execute([$me['id']]);
        $s = $stmt->fetch();
        foreach ($s as &$v) $v = (int)$v;
        respond(200, $s);
    }

    // POST /backlog — adicionar jogo
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['game_id', 'status']);

        $entryId = uuid();
        try {
            db()->prepare('INSERT INTO backlog (id, user_id, game_id, status, platform, progress, hours_played) VALUES (?,?,?,?,?,?,?)')
                ->execute([$entryId, $me['id'], $b['game_id'], $b['status'], $b['platform'] ?? null, $b['progress'] ?? null, $b['hours_played'] ?? null]);
        } catch (PDOException $e) {
            respond(409, ['error' => 'Jogo já está na sua biblioteca']);
        }
        respond(201, ['id' => $entryId]);
    }

    // PATCH /backlog/:id — atualizar entrada
    if ($sub && !$id && $method === 'PATCH') {
        $me = auth_required();
        $b  = body();
        $allowed = ['status', 'platform', 'progress', 'hours_played', 'notes', 'started_at', 'finished_at', 'is_private'];
        $sets = []; $params = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $b)) {
                $sets[]   = "$field = ?";
                $params[] = $b[$field];
            }
        }
        if (!$sets) respond(422, ['error' => 'Nenhum campo para atualizar']);
        $params[] = $sub; $params[] = $me['id'];
        db()->prepare('UPDATE backlog SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?')
            ->execute($params);
        respond(200, ['ok' => true]);
    }

    // DELETE /backlog/:id
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM backlog WHERE id = ? AND user_id = ?')->execute([$sub, $me['id']]);
        respond(200, ['ok' => true]);
    }
}
