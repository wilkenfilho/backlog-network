<?php
// TopicsController
// Gerado automaticamente — parte de index.php

// ============================================================
// TOPICS (tópicos de comunidade)
// ============================================================
if ($resource === 'topics') {

    // GET /topics?community_id=xxx&sort=...
    if ($method === 'GET' && !$sub) {
        $me = auth_required();
        $communityId = $_GET['community_id'] ?? '';
        $sort = $_GET['sort'] ?? 'activity';
        $pg = paginate();

        if (!$communityId) respond(400, ['error' => 'community_id é obrigatório']);

        // Verifica se o usuário é membro (se a comunidade for privada)
        $check = db()->prepare('SELECT is_private FROM communities WHERE id = ?');
        $check->execute([$communityId]);
        $comm = $check->fetch();
        if (!$comm) respond(404, ['error' => 'Comunidade não encontrada']);

        if ($comm['is_private']) {
            $member = db()->prepare('SELECT id FROM community_members WHERE community_id = ? AND user_id = ?');
            $member->execute([$communityId, $me['id']]);
            if (!$member->fetch()) respond(403, ['error' => 'Você não é membro desta comunidade']);
        }

        $orderBy = 't.created_at DESC';
        if ($sort === 'activity') $orderBy = 't.last_reply_at DESC';
        elseif ($sort === 'top') $orderBy = 't.likes_count DESC';

        $stmt = db()->prepare("
            SELECT t.*, u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM topic_likes WHERE topic_id = t.id AND user_id = ?) AS is_liked
            FROM topics t
            JOIN users u ON u.id = t.user_id
            WHERE t.community_id = ?
            ORDER BY t.is_pinned DESC, $orderBy
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$me['id'], $communityId, $pg['limit'], $pg['offset']]);
        $topics = $stmt->fetchAll();
        foreach ($topics as &$t) {
            $t['is_liked'] = (bool)$t['is_liked'];
        }
        respond(200, ['data' => $topics]);
    }

    // POST /topics — criar novo tópico
    if ($method === 'POST' && !$sub) {
        $me = auth_required();
        $b = body();
        required_fields($b, ['community_id', 'title', 'body']);

        // Verifica permissão (membro da comunidade)
        $member = db()->prepare('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?');
        $member->execute([$b['community_id'], $me['id']]);
        $roleRow = $member->fetch();
        if (!$roleRow) respond(403, ['error' => 'Você não é membro desta comunidade']);

        $tid = uuid();
        db()->prepare('
            INSERT INTO topics (id, community_id, user_id, title, body, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ')->execute([$tid, $b['community_id'], $me['id'], $b['title'], $b['body']]);

        // Incrementa contador de tópicos na comunidade
        db()->prepare('UPDATE communities SET topics_count = topics_count + 1 WHERE id = ?')
            ->execute([$b['community_id']]);

        respond(201, ['id' => $tid, 'title' => $b['title']]);
    }

    // GET /topics/:id — detalhe do tópico
    if ($method === 'GET' && $sub && !$id) {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT t.*, u.username, u.display_name, u.avatar_url, u.id AS user_id,
                   c.name AS community_name, c.is_private,
                   (SELECT COUNT(*) FROM topic_likes WHERE topic_id = t.id AND user_id = ?) AS is_liked
            FROM topics t
            JOIN users u ON u.id = t.user_id
            JOIN communities c ON c.id = t.community_id
            WHERE t.id = ?
        ');
        $stmt->execute([$me['id'], $sub]);
        $topic = $stmt->fetch();
        if (!$topic) respond(404, ['error' => 'Tópico não encontrado']);

        // Incrementa visualização
        db()->prepare('UPDATE topics SET views_count = views_count + 1 WHERE id = ?')->execute([$sub]);

        $topic['is_liked'] = (bool)$topic['is_liked'];

        // Inclui replies diretamente na resposta (evita segunda requisição do cliente)
        $repliesStmt = db()->prepare('
            SELECT r.*, u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM reply_likes WHERE reply_id = r.id AND user_id = ?) AS is_liked,
                   cm.role AS user_role
            FROM topic_replies r
            JOIN users u ON u.id = r.user_id
            LEFT JOIN community_members cm ON cm.community_id = ? AND cm.user_id = r.user_id
            WHERE r.topic_id = ? AND r.parent_id IS NULL
            ORDER BY r.created_at ASC
        ');
        $repliesStmt->execute([$me['id'], $topic['community_id'], $sub]);
        $replies = $repliesStmt->fetchAll();
        foreach ($replies as &$r) {
            $r['is_liked'] = (bool)$r['is_liked'];
            $r['likes_count'] = (int)$r['likes_count'];
            $r['is_removed'] = (bool)($r['is_removed'] ?? false);
            // Replies aninhadas
            $child = db()->prepare('
                SELECT r2.*, u2.username, u2.display_name, u2.avatar_url,
                       (SELECT COUNT(*) FROM reply_likes WHERE reply_id = r2.id AND user_id = ?) AS is_liked,
                       cm2.role AS user_role
                FROM topic_replies r2
                JOIN users u2 ON u2.id = r2.user_id
                LEFT JOIN community_members cm2 ON cm2.community_id = ? AND cm2.user_id = r2.user_id
                WHERE r2.parent_id = ?
                ORDER BY r2.created_at ASC
            ');
            $child->execute([$me['id'], $topic['community_id'], $r['id']]);
            $r['replies'] = $child->fetchAll();
        }

        respond(200, array_merge($topic, ['replies' => $replies]));
    }

    // PATCH /topics/:id — editar (apenas autor ou moderador)
    if ($method === 'PATCH' && $sub && !$id) {
        $me = auth_required();
        $b = body();

        $topic = db()->prepare('SELECT user_id, community_id FROM topics WHERE id = ?');
        $topic->execute([$sub]);
        $t = $topic->fetch();
        if (!$t) respond(404, ['error' => 'Tópico não encontrado']);

        // Verifica permissão
        $role = db()->prepare('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?');
        $role->execute([$t['community_id'], $me['id']]);
        $r = $role->fetch();
        $isMod = $r && in_array($r['role'], ['mod', 'admin', 'owner']);
        if ($t['user_id'] !== $me['id'] && !$isMod) respond(403, ['error' => 'Sem permissão']);

        $allowed = ['title', 'body'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; }
        }
        if (!$sets) respond(422, ['error' => 'Nada para atualizar']);
        $params[] = $sub;
        db()->prepare('UPDATE topics SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        respond(200, ['ok' => true]);
    }

    // DELETE /topics/:id — remover (apenas autor ou moderador)
    if ($method === 'DELETE' && $sub && !$id) {
        $me = auth_required();
        $topic = db()->prepare('SELECT user_id, community_id FROM topics WHERE id = ?');
        $topic->execute([$sub]);
        $t = $topic->fetch();
        if (!$t) respond(404, ['error' => 'Tópico não encontrado']);

        $role = db()->prepare('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?');
        $role->execute([$t['community_id'], $me['id']]);
        $r = $role->fetch();
        $isMod = $r && in_array($r['role'], ['mod', 'admin', 'owner']);
        if ($t['user_id'] !== $me['id'] && !$isMod) respond(403, ['error' => 'Sem permissão']);

        db()->prepare('DELETE FROM topics WHERE id = ?')->execute([$sub]);
        db()->prepare('UPDATE communities SET topics_count = topics_count - 1 WHERE id = ?')
            ->execute([$t['community_id']]);
        respond(200, ['ok' => true]);
    }

    // POST /topics/:id/like
    if ($id === 'like' && $method === 'POST') {
        $me = auth_required();
        try {
            db()->prepare('INSERT INTO topic_likes (user_id, topic_id) VALUES (?,?)')->execute([$me['id'], $sub]);
            db()->prepare('UPDATE topics SET likes_count = likes_count + 1 WHERE id = ?')->execute([$sub]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /topics/:id/like
    if ($id === 'like' && $method === 'DELETE') {
        $me = auth_required();
        $del = db()->prepare('DELETE FROM topic_likes WHERE user_id = ? AND topic_id = ?');
        $del->execute([$me['id'], $sub]);
        if ($del->rowCount() > 0) {
            db()->prepare('UPDATE topics SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?')->execute([$sub]);
        }
        respond(200, ['ok' => true]);
    }

    // PATCH /topics/:id/pin — fixar/desafixar (moderadores)
    if ($id === 'pin' && $method === 'PATCH') {
        $me = auth_required();
        $topic = db()->prepare('SELECT community_id, is_pinned FROM topics WHERE id = ?');
        $topic->execute([$sub]);
        $t = $topic->fetch();
        if (!$t) respond(404, ['error' => 'Tópico não encontrado']);

        $role = db()->prepare('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?');
        $role->execute([$t['community_id'], $me['id']]);
        $r = $role->fetch();
        if (!$r || !in_array($r['role'], ['mod', 'admin', 'owner'])) respond(403, ['error' => 'Sem permissão']);

        $newPin = $t['is_pinned'] ? 0 : 1;
        db()->prepare('UPDATE topics SET is_pinned = ? WHERE id = ?')->execute([$newPin, $sub]);
        respond(200, ['is_pinned' => (bool)$newPin]);
    }

    // ========== REPLIES (respostas) ==========
    // GET /topics/:id/replies
    if ($id === 'replies' && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT r.*, u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM reply_likes WHERE reply_id = r.id AND user_id = ?) AS is_liked
            FROM topic_replies r
            JOIN users u ON u.id = r.user_id
            WHERE r.topic_id = ? AND r.parent_id IS NULL
            ORDER BY r.created_at ASC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $sub, $pg['limit'], $pg['offset']]);
        $replies = $stmt->fetchAll();

        // Buscar respostas aninhadas (filhas)
        foreach ($replies as &$r) {
            $child = db()->prepare('
                SELECT r.*, u.username, u.display_name, u.avatar_url,
                       (SELECT COUNT(*) FROM reply_likes WHERE reply_id = r.id AND user_id = ?) AS is_liked
                FROM topic_replies r
                JOIN users u ON u.id = r.user_id
                WHERE r.parent_id = ?
                ORDER BY r.created_at ASC
            ');
            $child->execute([$me['id'], $r['id']]);
            $r['replies'] = $child->fetchAll();
        }
        respond(200, ['data' => $replies]);
    }

    // POST /topics/:id/replies — criar resposta
    if ($id === 'replies' && $method === 'POST') {
        $me = auth_required();
        $b = body();
        required_fields($b, ['body']);

        $topic = db()->prepare('SELECT community_id FROM topics WHERE id = ?');
        $topic->execute([$sub]);
        $t = $topic->fetch();
        if (!$t) respond(404, ['error' => 'Tópico não encontrado']);

        // Verifica se é membro
        $member = db()->prepare('SELECT id FROM community_members WHERE community_id = ? AND user_id = ?');
        $member->execute([$t['community_id'], $me['id']]);
        if (!$member->fetch()) respond(403, ['error' => 'Você não é membro desta comunidade']);

        $rid = uuid();
        db()->prepare('
            INSERT INTO topic_replies (id, topic_id, user_id, body, parent_id, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ')->execute([$rid, $sub, $me['id'], $b['body'], $b['parent_id'] ?? null]);

        db()->prepare('UPDATE topics SET replies_count = replies_count + 1, last_reply_at = NOW() WHERE id = ?')
            ->execute([$sub]);

        respond(201, ['id' => $rid]);
    }

    // POST /topics/:id/replies/:replyId/like
    if ($id === 'replies' && $action && $method === 'POST') {
        $me = auth_required();
        $replyId = $action;
        try {
            db()->prepare('INSERT INTO reply_likes (user_id, reply_id) VALUES (?,?)')->execute([$me['id'], $replyId]);
            db()->prepare('UPDATE topic_replies SET likes_count = likes_count + 1 WHERE id = ?')->execute([$replyId]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /topics/:id/replies/:replyId/like
    if ($id === 'replies' && $action && $method === 'DELETE') {
        $me = auth_required();
        $replyId = $action;
        $del = db()->prepare('DELETE FROM reply_likes WHERE user_id = ? AND reply_id = ?');
        $del->execute([$me['id'], $replyId]);
        if ($del->rowCount() > 0) {
            db()->prepare('UPDATE topic_replies SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?')->execute([$replyId]);
        }
        respond(200, ['ok' => true]);
    }

    // DELETE /topics/:id/replies/:replyId — remover resposta (autor ou mod)
    if ($id === 'replies' && $action && $method === 'DELETE') {
        $me = auth_required();
        $replyId = $action;
        $reply = db()->prepare('SELECT user_id, topic_id FROM topic_replies WHERE id = ?');
        $reply->execute([$replyId]);
        $r = $reply->fetch();
        if (!$r) respond(404, ['error' => 'Resposta não encontrada']);

        $topic = db()->prepare('SELECT community_id FROM topics WHERE id = ?');
        $topic->execute([$r['topic_id']]);
        $t = $topic->fetch();

        $role = db()->prepare('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?');
        $role->execute([$t['community_id'], $me['id']]);
        $roleRow = $role->fetch();
        $isMod = $roleRow && in_array($roleRow['role'], ['mod', 'admin', 'owner']);

        if ($r['user_id'] !== $me['id'] && !$isMod) respond(403, ['error' => 'Sem permissão']);

        db()->prepare('DELETE FROM topic_replies WHERE id = ?')->execute([$replyId]);
        db()->prepare('UPDATE topics SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = ?')
            ->execute([$r['topic_id']]);
        respond(200, ['ok' => true]);
    }
}

    // POST /topics/replies/:replyId/like  (rota que o frontend usa)
    if ($sub === 'replies' && $id && $action === 'like' && $method === 'POST') {
        $me = auth_required();
        validate_id($id, 'Reply ID');
        try {
            db()->prepare('INSERT INTO reply_likes (user_id, reply_id) VALUES (?,?)')->execute([$me['id'], $id]);
            db()->prepare('UPDATE topic_replies SET likes_count = likes_count + 1 WHERE id = ?')->execute([$id]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /topics/replies/:replyId/like  (unlike)
    if ($sub === 'replies' && $id && $action === 'like' && $method === 'DELETE') {
        $me = auth_required();
        validate_id($id, 'Reply ID');
        $del = db()->prepare('DELETE FROM reply_likes WHERE user_id = ? AND reply_id = ?');
        $del->execute([$me['id'], $id]);
        if ($del->rowCount() > 0) {
            db()->prepare('UPDATE topic_replies SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?')->execute([$id]);
        }
        respond(200, ['ok' => true]);
    }

    // DELETE /topics/replies/:replyId  (remover resposta — autor ou mod)
    if ($sub === 'replies' && $id && !$action && $method === 'DELETE') {
        $me = auth_required();
        validate_id($id, 'Reply ID');
        $reply = db()->prepare('SELECT user_id, topic_id FROM topic_replies WHERE id = ?');
        $reply->execute([$id]);
        $r = $reply->fetch();
        if (!$r) respond(404, ['error' => 'Resposta não encontrada']);

        $topic = db()->prepare('SELECT community_id FROM topics WHERE id = ?');
        $topic->execute([$r['topic_id']]);
        $t = $topic->fetch();

        $role = db()->prepare('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?');
        $role->execute([$t['community_id'], $me['id']]);
        $roleRow = $role->fetch();
        $isMod = $roleRow && in_array($roleRow['role'], ['mod', 'admin', 'owner']);

        if ($r['user_id'] !== $me['id'] && !$isMod) respond(403, ['error' => 'Sem permissão']);

        db()->prepare('UPDATE topic_replies SET is_removed = 1 WHERE id = ?')->execute([$id]);
        db()->prepare('UPDATE topics SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = ?')
            ->execute([$r['topic_id']]);
        respond(200, ['ok' => true]);
    }
}
