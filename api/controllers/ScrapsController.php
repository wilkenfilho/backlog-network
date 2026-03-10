<?php
// ScrapsController

if ($resource === 'scraps') {

    // GET /scraps/:userId — scraps do perfil de um usuário
    if ($sub && !$id && $method === 'GET') {
        $me = auth_required();
        validate_id($sub, 'User ID');
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT s.*, u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar
            FROM scraps s
            JOIN users u ON u.id = s.author_id
            WHERE s.profile_id = ?
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$sub, $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // POST /scraps/:userId — escrever scrap no perfil de alguém
    if ($sub && !$id && $method === 'POST') {
        $me = auth_required();
        validate_id($sub, 'User ID');
        $b = body();
        if (empty($b['body'])) respond(422, ['error' => 'Corpo do scrap é obrigatório']);
        if (strlen($b['body']) > 500) respond(422, ['error' => 'Scrap não pode ter mais de 500 caracteres']);
        $sid = uuid();
        try {
            db()->prepare('INSERT INTO scraps (id, profile_id, author_id, body, created_at) VALUES (?,?,?,?,NOW())')
               ->execute([$sid, $sub, $me['id'], trim($b['body'])]);
        } catch (PDOException $e) {
            respond(500, ['error' => 'Erro ao salvar scrap']);
        }
        respond(201, ['id' => $sid]);
    }

    // DELETE /scraps/:scrapId — remover scrap (autor ou dono do perfil)
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        validate_id($sub, 'Scrap ID');
        $scrap = db()->prepare('SELECT author_id, profile_id FROM scraps WHERE id = ?');
        $scrap->execute([$sub]);
        $s = $scrap->fetch();
        if (!$s) respond(404, ['error' => 'Scrap não encontrado']);
        if ($s['author_id'] !== $me['id'] && $s['profile_id'] !== $me['id']) {
            respond(403, ['error' => 'Sem permissão para remover este scrap']);
        }
        db()->prepare('DELETE FROM scraps WHERE id = ?')->execute([$sub]);
        respond(200, ['ok' => true]);
    }
}
