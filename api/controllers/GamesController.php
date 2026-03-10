<?php
// GamesController
// Gerado automaticamente — parte de index.php

// ============================================================
// GAMES
// ============================================================
if ($resource === 'games') {

    // GET /games/search?q=elden
    if ($sub === 'search' && $method === 'GET') {
        auth_required();
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) respond(200, ['data' => []]);

        $stmt = db()->prepare('SELECT id, title, developer, cover_url, rawg_rating, `backlog-network_rating` FROM games WHERE title LIKE ? LIMIT 20');
        $stmt->execute(["%$q%"]);
        $local = $stmt->fetchAll();

        if (count($local) >= 5) {
            respond(200, ['data' => $local, 'source' => 'cache']);
        }

        $url = 'https://api.rawg.io/api/games?key=' . RAWG_API_KEY . '&search=' . urlencode($q) . '&page_size=10';
        $raw = @file_get_contents($url);
        if (!$raw) respond(200, ['data' => $local]);

        $rawgData = json_decode($raw, true);
        $results  = [];

        foreach ($rawgData['results'] ?? [] as $rg) {
            $gameId = uuid();
            $slug   = $rg['slug'] ?? strtolower(str_replace(' ', '-', $rg['name']));
            try {
                db()->prepare('INSERT IGNORE INTO games (id, rawg_id, title, slug, cover_url, developer, rawg_rating, release_date) VALUES (?,?,?,?,?,?,?,?)')
                    ->execute([$gameId, $rg['id'], $rg['name'], $slug, $rg['background_image'], $rg['developers'][0]['name'] ?? null, $rg['rating'] ?? null, $rg['released'] ?? null]);
            } catch (PDOException $e) {
                $ex = db()->prepare('SELECT id FROM games WHERE rawg_id = ?');
                $ex->execute([$rg['id']]);
                $exRow = $ex->fetch();
                $gameId = $exRow['id'] ?? $gameId;
            }
            $results[] = ['id' => $gameId, 'title' => $rg['name'], 'cover_url' => $rg['background_image'], 'rawg_rating' => $rg['rating']];
        }

        respond(200, ['data' => array_merge($local, $results), 'source' => 'rawg']);
    }

    // GET /games/trending
    if ($sub === 'trending' && $method === 'GET') {
        auth_required();
        $stmt = db()->prepare('
            SELECT g.id, g.title, g.cover_url, g.developer, g.`backlog-network_rating`,
                   COUNT(b.id) AS activity
            FROM games g
            LEFT JOIN backlog b ON b.game_id = g.id AND b.updated_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY g.id
            ORDER BY activity DESC, g.rawg_rating DESC
            LIMIT 10
        ');
        $stmt->execute();
        respond(200, $stmt->fetchAll());
    }

    // GET /games/:id
    if ($sub && !$id && $method === 'GET') {
        auth_required();

        $stmt = db()->prepare('SELECT * FROM games WHERE id = ?');
        $stmt->execute([$sub]);
        $game = $stmt->fetch();

        if (!$game) {
            $stmt2 = db()->prepare('SELECT * FROM games WHERE rawg_id = ?');
            $stmt2->execute([$sub]);
            $game = $stmt2->fetch();
        }

        if (!$game && is_numeric($sub)) {
            $url = 'https://api.rawg.io/api/games/' . $sub . '?key=' . RAWG_API_KEY;
            $raw = @file_get_contents($url);
            if ($raw) {
                $rg = json_decode($raw, true);
                if ($rg && isset($rg['id'])) {
                    $gameId = uuid();
                    $slug = $rg['slug'] ?? strtolower(str_replace(' ', '-', $rg['name']));
                    try {
                        db()->prepare('INSERT IGNORE INTO games (id, rawg_id, title, slug, cover_url, developer, rawg_rating, release_date, description) VALUES (?,?,?,?,?,?,?,?,?)')
                           ->execute([$gameId, $rg['id'], $rg['name'], $slug, $rg['background_image'], $rg['developers'][0]['name'] ?? null, $rg['rating'] ?? null, $rg['released'] ?? null, $rg['description_raw'] ?? null]);
                    } catch (PDOException $e) {
                        $stmt3 = db()->prepare('SELECT * FROM games WHERE rawg_id = ?');
                        $stmt3->execute([$sub]);
                        $game = $stmt3->fetch();
                    }
                    if (!$game) {
                        $stmt4 = db()->prepare('SELECT * FROM games WHERE id = ?');
                        $stmt4->execute([$gameId]);
                        $game = $stmt4->fetch();
                    }
                }
            }
        }

        if (!$game) respond(404, ['error' => 'Jogo não encontrado']);

        try {
            $plat = db()->prepare('SELECT platform FROM game_platforms WHERE game_id = ?');
            $plat->execute([$game['id']]);
            $game['platforms'] = array_column($plat->fetchAll(), 'platform');
        } catch (PDOException $e) { $game['platforms'] = []; }

        try {
            $gen = db()->prepare('SELECT genre FROM game_genres WHERE game_id = ?');
            $gen->execute([$game['id']]);
            $game['genres'] = array_column($gen->fetchAll(), 'genre');
        } catch (PDOException $e) { $game['genres'] = []; }

        respond(200, $game);
    }

    // POST /games/sync (cria jogo a partir de rawg_id)
    if ($sub === 'sync' && $method === 'POST') {
        $me = auth_required();
        $b = body();
        $rawgId = $b['rawg_id'] ?? null;
        if (!$rawgId) respond(400, ['error' => 'rawg_id obrigatório']);

        // Verifica se já existe
        $stmt = db()->prepare('SELECT * FROM games WHERE rawg_id = ?');
        $stmt->execute([$rawgId]);
        $game = $stmt->fetch();
        if ($game) respond(200, ['game' => $game]);

        // Busca na RAWG
        $url = 'https://api.rawg.io/api/games/' . $rawgId . '?key=' . RAWG_API_KEY;
        $raw = @file_get_contents($url);
        if (!$raw) respond(404, ['error' => 'Jogo não encontrado na RAWG']);
        $rg = json_decode($raw, true);
        if (!$rg) respond(500, ['error' => 'Resposta inválida da RAWG']);

        $gameId = uuid();
        $slug = $rg['slug'] ?? strtolower(str_replace(' ', '-', $rg['name']));
        db()->prepare('INSERT INTO games (id, rawg_id, title, slug, cover_url, developer, rawg_rating, release_date, description) VALUES (?,?,?,?,?,?,?,?,?)')
           ->execute([$gameId, $rg['id'], $rg['name'], $slug, $rg['background_image'], $rg['developers'][0]['name'] ?? null, $rg['rating'] ?? null, $rg['released'] ?? null, $rg['description_raw'] ?? null]);

        $new = db()->prepare('SELECT * FROM games WHERE id = ?');
        $new->execute([$gameId]);
        respond(200, ['game' => $new->fetch()]);
    }

    // GET /games/:id/reviews
    if ($sub && $id === 'reviews' && $method === 'GET') {
        auth_required();
        $pg = paginate();

        $resolvedGameId = $sub;
        $check = db()->prepare('SELECT id FROM games WHERE id = ? LIMIT 1');
        $check->execute([$sub]);
        $row = $check->fetch();
        if (!$row) {
            $check2 = db()->prepare('SELECT id FROM games WHERE rawg_id = ? LIMIT 1');
            $check2->execute([$sub]);
            $row2 = $check2->fetch();
            if ($row2) $resolvedGameId = $row2['id'];
        }

        $stmt = db()->prepare('
            SELECT r.*, u.username, u.display_name, u.avatar_url
            FROM reviews r JOIN users u ON u.id = r.user_id
            WHERE r.game_id = ?
            ORDER BY r.likes_count DESC, r.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$resolvedGameId, $pg['limit'], $pg['offset']]);
        $reviews = $stmt->fetchAll();
        foreach ($reviews as &$rv) {
            $rv['user'] = [
                'id' => $rv['user_id'],
                'username' => $rv['username'],
                'display_name' => $rv['display_name'],
                'avatar_url' => $rv['avatar_url'],
            ];
            unset($rv['username'], $rv['display_name'], $rv['avatar_url']);
        }
        respond(200, ['data' => $reviews]);
    }
}
