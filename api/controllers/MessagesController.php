<?php
// MessagesController
// Gerado automaticamente — parte de index.php

// ============================================================
// MESSAGES
// ============================================================
if ($resource === 'messages') {

    // GET /messages — lista conversas (query otimizada sem subquery correlacionada)
    if (!$sub && $method === 'GET') {
        $me = auth_required();
        // Passo 1: encontrar a última mensagem de cada conversa de forma eficiente
        $stmt = db()->prepare('
            SELECT
                LEAST(m.sender_id, m.receiver_id)    AS user_a,
                GREATEST(m.sender_id, m.receiver_id) AS user_b,
                MAX(m.created_at) AS last_at
            FROM messages m
            WHERE m.sender_id = ? OR m.receiver_id = ?
            GROUP BY user_a, user_b
        ');
        $stmt->execute([$me['id'], $me['id']]);
        $pairs = $stmt->fetchAll();

        $conversations = [];
        foreach ($pairs as $pair) {
            $otherId = ($pair['user_a'] === $me['id']) ? $pair['user_b'] : $pair['user_a'];
            // Buscar a mensagem mais recente desta conversa
            $msgStmt = db()->prepare('
                SELECT m.id, m.body AS last_message, m.created_at AS last_message_at,
                       u.username AS other_username, u.display_name AS other_name, u.avatar_url AS other_avatar
                FROM messages m
                JOIN users u ON u.id = ?
                WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
                  AND m.created_at = ?
                LIMIT 1
            ');
            $msgStmt->execute([$otherId, $me['id'], $otherId, $otherId, $me['id'], $pair['last_at']]);
            $msg = $msgStmt->fetch();
            if (!$msg) continue;

            // Contar não lidas desta conversa
            $unread = db()->prepare('SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND sender_id = ? AND is_read = 0');
            $unread->execute([$me['id'], $otherId]);
            $msg['other_id']    = $otherId;
            $msg['unread_count'] = (int)$unread->fetchColumn();
            $conversations[] = $msg;
        }

        // Ordena por última mensagem desc
        usort($conversations, fn($a, $b) => strcmp($b['last_message_at'], $a['last_message_at']));
        respond(200, ['data' => $conversations]);
    }

    // GET /messages/conversation/:userId — histórico com um usuário
    if ($sub === 'conversation' && $id && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $sub, $sub, $me['id'], $pg['limit'], $pg['offset']]);
        $msgs = array_reverse($stmt->fetchAll());

        db()->prepare('UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?')
           ->execute([$me['id'], $sub]);

        respond(200, ['data' => $msgs]);
    }

    // POST /messages — enviar mensagem
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b  = body();

        // Aceita vários nomes de campo
        $toId = $b['to_user_id'] ?? $b['receiver_id'] ?? $b['recipient_id'] ?? null;
        $body = $b['body'] ?? $b['message'] ?? $b['content'] ?? null;

        if (!$toId) respond(400, ['error' => 'Destinatário obrigatório (to_user_id)']);
        if (!$body) respond(400, ['error' => 'Mensagem vazia']);
        if ($toId === $me['id']) respond(400, ['error' => 'Não pode enviar mensagem para si mesmo']);

        $dest = db()->prepare('SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1');
        $dest->execute([$toId]);
        if (!$dest->fetch()) respond(404, ['error' => 'Destinatário não encontrado']);

        $mid = uuid();
        try {
            db()->prepare('
                INSERT INTO messages (id, sender_id, receiver_id, body, is_read, created_at)
                VALUES (?, ?, ?, ?, 0, NOW())
            ')->execute([$mid, $me['id'], $toId, trim($body)]);
        } catch (PDOException $e) {
            respond(500, ['error' => 'Erro ao enviar mensagem: ' . $e->getMessage()]);
        }

        respond(201, ['id' => $mid, 'body' => trim($body), 'sender_id' => $me['id'], 'receiver_id' => $toId]);
    }
}
