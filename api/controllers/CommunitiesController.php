<?php
// CommunitiesController
// Gerado automaticamente — parte de index.php

// ============================================================
// COMMUNITIES
// ============================================================
if ($resource === 'communities') {

    // GET /communities — lista todas
    if ($method === 'GET' && !$sub && !$id) {
        auth_required();
        $stmt = db()->prepare('
            SELECT c.*, COUNT(cm.user_id) AS members_count,
                   (SELECT role FROM community_members WHERE community_id = c.id AND user_id = ?) AS my_role
            FROM communities c
            LEFT JOIN community_members cm ON cm.community_id = c.id
            GROUP BY c.id
            ORDER BY members_count DESC
            LIMIT 50
        ');
        $stmt->execute([auth_required()['id']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // POST /communities — criar
    if ($method === 'POST' && !$sub && !$id) {
        $me = auth_required();
        $b  = body();
        if (empty($b['name'])) respond(400, ['error' => 'Nome é obrigatório']);
        if (empty($b['description'])) respond(400, ['error' => 'Descrição é obrigatória']);

        $cid  = uuid();
        $slug = $b['slug'] ?? strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $b['name'])));

        // Garante slug único
        $chk = db()->prepare('SELECT id FROM communities WHERE slug = ? LIMIT 1');
        $chk->execute([$slug]);
        if ($chk->fetch()) $slug = $slug . '-' . substr($cid, 0, 6);

        // Resolve game_id a partir de rawg_id, se fornecido
        $gameId = null;
        if (!empty($b['rawg_id'])) {
            $stmt = db()->prepare('SELECT id FROM games WHERE rawg_id = ?');
            $stmt->execute([$b['rawg_id']]);
            $existing = $stmt->fetch();
            if ($existing) {
                $gameId = $existing['id'];
            } else {
                $gameId = uuid();
                db()->prepare('INSERT INTO games (id, rawg_id, title) VALUES (?, ?, ?)')
                   ->execute([$gameId, $b['rawg_id'], $b['game_title'] ?? '']);
            }
        } elseif (!empty($b['game_id'])) {
            $gameId = $b['game_id']; // assume que é UUID válido
        }

        try {
            db()->prepare('
                INSERT INTO communities
                    (id, slug, name, description, cover_url, genre, is_private, created_by, game_id, game_title, created_at, updated_at)
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ')->execute([
                $cid,
                $slug,
                trim($b['name']),
                trim($b['description']),
                $b['cover_url']  ?? null,
                $b['genre']      ?? null,
                isset($b['is_private']) ? (int)$b['is_private'] : 0,
                $me['id'],
                $gameId,
                $b['game_title'] ?? null,
            ]);
        } catch (PDOException $e) {
            respond(500, ['error' => 'Erro ao criar comunidade: ' . $e->getMessage()]);
        }

        // Adiciona criador como owner
        try {
            db()->prepare('INSERT INTO community_members (community_id, user_id, role, joined_at) VALUES (?,?,"owner",NOW())')
               ->execute([$cid, $me['id']]);
        } catch (PDOException $e) {}

        respond(201, ['id' => $cid, 'slug' => $slug, 'name' => trim($b['name'])]);
    }

    // GET /communities/:id — detalhes
    if ($method === 'GET' && $sub && !$id) {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT c.*, COUNT(cm.user_id) AS members_count,
                   (SELECT role FROM community_members WHERE community_id = c.id AND user_id = ?) AS my_role
            FROM communities c
            LEFT JOIN community_members cm ON cm.community_id = c.id
            WHERE c.id = ?
            GROUP BY c.id
        ');
        $stmt->execute([$me['id'], $sub]);
        $c = $stmt->fetch();
        if (!$c) respond(404, ['error' => 'Comunidade não encontrada']);
        respond(200, $c);
    }

    // POST /communities/:id/join
    if ($id === 'join' && $method === 'POST') {
        $me = auth_required();
        try {
            db()->prepare('INSERT INTO community_members (community_id, user_id, role, joined_at) VALUES (?,?,"member",NOW())')
               ->execute([$sub, $me['id']]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /communities/:id/join
    if ($id === 'join' && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM community_members WHERE community_id = ? AND user_id = ?')
           ->execute([$sub, $me['id']]);
        respond(200, ['ok' => true]);
    }
}
