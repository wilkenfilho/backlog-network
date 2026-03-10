<?php
// ListsController
// Gerado automaticamente — parte de index.php

// ============================================================
// LISTS
// ============================================================
if ($resource === 'lists') {

    // GET /lists/me
    if ($sub === 'me' && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('SELECT l.*, COUNT(li.id) as items_count FROM game_lists l LEFT JOIN game_list_items li ON li.list_id = l.id WHERE l.user_id = ? GROUP BY l.id ORDER BY l.created_at DESC');
        $stmt->execute([$me['id']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // POST /lists
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b = body();
        if (empty($b['title'])) respond(422, ['error' => 'Título obrigatório']);
        $lid = uuid();
        try {
            db()->prepare('INSERT INTO game_lists (id, user_id, title, description, list_type, is_public, created_at, updated_at) VALUES (?,?,?,?,?,?,NOW(),NOW())')
               ->execute([$lid, $me['id'], trim($b['title']), $b['description'] ?? null, $b['list_type'] ?? 'custom', isset($b['is_public']) ? (int)$b['is_public'] : 1]);
        } catch (PDOException $e) {
            respond(500, ['error' => 'Erro ao criar lista: ' . $e->getMessage()]);
        }
        respond(201, ['id' => $lid, 'title' => trim($b['title'])]);
    }

    // POST /lists/:id/items
    if ($sub && $id === 'items' && $method === 'POST') {
        $me = auth_required();
        $b = body();
        $iid = uuid();
        db()->prepare('INSERT INTO game_list_items (id, list_id, game_id, notes, position, created_at) VALUES (?,?,?,?,?,NOW())')
           ->execute([$iid, $sub, $b['game_id'], $b['notes'] ?? null, $b['position'] ?? 0]);
        respond(201, ['id' => $iid]);
    }

    // DELETE /lists/:id/items/:itemId
    if ($sub && $id === 'items' && $action && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM game_list_items WHERE id = ?')->execute([$action]);
        respond(200, ['ok' => true]);
    }

    // PATCH /lists/:id
    if ($sub && !$id && $method === 'PATCH') {
        $me = auth_required();
        $b = body();
        $allowed = ['title', 'description', 'is_public', 'list_type'];
        $sets = []; $params = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; } }
        if ($sets) { $params[] = $sub; $params[] = $me['id']; db()->prepare('UPDATE game_lists SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?')->execute($params); }
        respond(200, ['ok' => true]);
    }

    // DELETE /lists/:id
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM game_lists WHERE id = ? AND user_id = ?')->execute([$sub, $me['id']]);
        respond(200, ['ok' => true]);
    }
}
