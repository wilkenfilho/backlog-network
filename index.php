<?php
/**
 * BACKLOG NETWORK API — Backend completo em PHP puro
 * Compatível com Hostgator shared hosting (PHP 7.4+)
 * 
 * Coloque este arquivo em: public_html/backlog-network-api/index.php
 * Configure o .htaccess abaixo para roteamento
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'soraia05_backlognetwork');
define('DB_USER', 'soraia05_wilkenp');
define('DB_PASS', 'Soraia2605*');
define('JWT_SECRET', 'troque_por_string_aleatoria_longa_aqui_min_32_chars');
define('JWT_EXPIRES_HOURS', 720);             // 30 dias
define('RAWG_API_KEY', 'sua_chave_rawg');    // rawg.io/apiv2 — gratuito

// ─── TWITCH / IGDB ───────────────────────────────────────────────────────────
define('TWITCH_CLIENT_ID',     'q2vh0f2s6y5qc8ses1rlrxprflrhmo');
define('TWITCH_CLIENT_SECRET', 'z5qzgqrdsnu39tmhbvbdirzw0a9mze');
define('TWITCH_API',           'https://api.twitch.tv/helix');
define('TWITCH_AUTH',          'https://id.twitch.tv/oauth2/token');
define('IGDB_API',             'https://api.igdb.com/v4');

// ─── STEAM ───────────────────────────────────────────────────────────────────
define('STEAM_API_KEY',   'E409C7E63D6D8D9CC506C5412FDF9381');
define('STEAM_API',       'https://api.steampowered.com');
define('STEAM_STORE_API', 'https://store.steampowered.com');

// ─── CORS + HEADERS ──────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ─── DB CONNECTION ───────────────────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    } catch (PDOException $e) {
        respond(500, ['error' => 'Erro de conexão com banco de dados']);
    }
    return $pdo;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function respond(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function uuid(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff),
        mt_rand(0,0x0fff)|0x4000, mt_rand(0,0x3fff)|0x8000,
        mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff)
    );
}

function body(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function required_fields(array $data, array $fields): void {
    foreach ($fields as $f) {
        if (empty($data[$f])) respond(422, ['error' => "Campo obrigatório: $f"]);
    }
}

// ─── JWT ──────────────────────────────────────────────────────────────────────
function jwt_create(string $userId): string {
    $header  = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode([
        'sub' => $userId,
        'iat' => time(),
        'exp' => time() + (JWT_EXPIRES_HOURS * 3600),
    ]));
    $sig = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwt_verify(string $token): ?string {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $expected = base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode($payload), true);
    if (!$data || $data['exp'] < time()) return null;
    return $data['sub'];
}

function auth_required(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $header, $m)) respond(401, ['error' => 'Token necessário']);
    $userId = jwt_verify($m[1]);
    if (!$userId) respond(401, ['error' => 'Token inválido ou expirado']);
    $user = db()->prepare('SELECT * FROM users WHERE id = ? AND is_active = 1 AND is_banned = 0');
    $user->execute([$userId]);
    $row = $user->fetch();
    if (!$row) respond(401, ['error' => 'Usuário não encontrado']);
    return $row;
}

function paginate(): array {
    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(50, max(1, (int)($_GET['limit'] ?? 20)));
    return ['page' => $page, 'limit' => $limit, 'offset' => ($page - 1) * $limit];
}

function user_public(array $u): array {
    return [
        'id'              => $u['id'],
        'username'        => $u['username'],
        'display_name'    => $u['display_name'],
        'avatar_url'      => $u['avatar_url'],
        'bio'             => $u['bio'],
        'level'           => (int)$u['level'],
        'xp'              => (int)$u['xp'],
        'is_premium'      => (bool)$u['is_premium'],
        'created_at'      => $u['created_at'],
    ];
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = preg_replace('#^/backlog-network-api#', '', $uri);  // remove base path
$parts  = explode('/', trim($uri, '/'));

$route  = $parts[0] ?? '';        // ex: "auth", "feed", "games"
$sub    = $parts[1] ?? '';        // ex: "login", "me", "trending"
$id     = $parts[2] ?? '';        // ex: UUID do game/user/post
$action = $parts[3] ?? '';        // ex: "like", "follow", "comments"

// ============================================================
// AUTH
// ============================================================
if ($route === 'auth') {

    // POST /auth/register
    if ($sub === 'register' && $method === 'POST') {
        $b = body();
        required_fields($b, ['username', 'email', 'password', 'display_name']);

        if (strlen($b['username']) < 3 || strlen($b['username']) > 30)
            respond(422, ['error' => 'Username deve ter entre 3 e 30 caracteres']);
        if (!preg_match('/^[a-zA-Z0-9_.]+$/', $b['username']))
            respond(422, ['error' => 'Username só pode ter letras, números, _ e .']);
        if (!filter_var($b['email'], FILTER_VALIDATE_EMAIL))
            respond(422, ['error' => 'Email inválido']);
        if (strlen($b['password']) < 8)
            respond(422, ['error' => 'Senha deve ter ao menos 8 caracteres']);

        $db = db();
        $check = $db->prepare('SELECT id FROM users WHERE email = ? OR username = ?');
        $check->execute([$b['email'], $b['username']]);
        if ($check->fetch()) respond(409, ['error' => 'Email ou username já em uso']);

        $id = uuid();
        $hash = password_hash($b['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare('INSERT INTO users (id, username, display_name, email, password_hash) VALUES (?, ?, ?, ?, ?)')
           ->execute([$id, strtolower($b['username']), $b['display_name'], strtolower($b['email']), $hash]);

        $user = $db->prepare('SELECT * FROM users WHERE id = ?');
        $user->execute([$id]);
        $row = $user->fetch();

        respond(201, ['token' => jwt_create($id), 'user' => user_public($row)]);
    }

    // POST /auth/login
    if ($sub === 'login' && $method === 'POST') {
        $b = body();
        required_fields($b, ['email', 'password']);

        $stmt = db()->prepare('SELECT * FROM users WHERE email = ? AND is_active = 1');
        $stmt->execute([strtolower($b['email'])]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($b['password'], $user['password_hash']))
            respond(401, ['error' => 'Email ou senha incorretos']);
        if ($user['is_banned'])
            respond(403, ['error' => 'Conta suspensa']);

        respond(200, ['token' => jwt_create($user['id']), 'user' => user_public($user)]);
    }

    // GET /auth/me
    if ($sub === 'me' && $method === 'GET') {
        $me = auth_required();
        $db = db();

        // Contar seguidores e seguindo
        $stats = $db->prepare('
            SELECT
                (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
                (SELECT COUNT(*) FROM follows WHERE follower_id  = ?) AS following_count,
                (SELECT COUNT(*) FROM backlog  WHERE user_id = ?)     AS games_count,
                (SELECT COUNT(*) FROM reviews  WHERE user_id = ?)     AS reviews_count,
                (SELECT COALESCE(SUM(hours_played),0) FROM backlog WHERE user_id = ?) AS hours_played
        ');
        $stats->execute([$me['id'], $me['id'], $me['id'], $me['id'], $me['id']]);
        $s = $stats->fetch();

        respond(200, array_merge(user_public($me), [
            'followers_count' => (int)$s['followers_count'],
            'following_count' => (int)$s['following_count'],
            'games_count'     => (int)$s['games_count'],
            'reviews_count'   => (int)$s['reviews_count'],
            'hours_played'    => (int)$s['hours_played'],
        ]));
    }

    // POST /auth/logout
    if ($sub === 'logout' && $method === 'POST') {
        respond(200, ['ok' => true]);
    }
}

// ============================================================
// FEED
// ============================================================
if ($route === 'feed' && $method === 'GET') {
    $me = auth_required();
    $pg = paginate();
    $type = $_GET['type'] ?? 'friends';

    $db = db();

    if ($type === 'friends') {
        // Posts de quem o usuário segue + próprios
        $stmt = $db->prepare('
            SELECT p.*,
                   u.username, u.display_name, u.avatar_url,
                   g.title AS game_title, g.cover_url AS game_cover, g.developer AS game_dev,
                   (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS is_liked
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN games g ON g.id = p.game_id
            WHERE p.user_id IN (
                SELECT following_id FROM follows WHERE follower_id = ?
                UNION SELECT ?
            )
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $me['id'], $me['id'], $pg['limit'], $pg['offset']]);
    } else {
        // Global — todos os posts
        $stmt = $db->prepare('
            SELECT p.*,
                   u.username, u.display_name, u.avatar_url,
                   g.title AS game_title, g.cover_url AS game_cover, g.developer AS game_dev,
                   (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS is_liked
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN games g ON g.id = p.game_id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $pg['limit'], $pg['offset']]);
    }

    $posts = $stmt->fetchAll();
    foreach ($posts as &$post) {
        $post['is_liked'] = (bool)$post['is_liked'];
        $post['user'] = ['username' => $post['username'], 'display_name' => $post['display_name'], 'avatar_url' => $post['avatar_url']];
        if ($post['game_title']) {
            $post['game'] = ['id' => $post['game_id'], 'title' => $post['game_title'], 'cover_url' => $post['game_cover'], 'developer' => $post['game_dev']];
        }
        unset($post['username'], $post['display_name'], $post['avatar_url'], $post['game_title'], $post['game_cover'], $post['game_dev']);
    }
    respond(200, ['data' => $posts, 'meta' => ['page' => $pg['page'], 'limit' => $pg['limit']]]);
}

// ============================================================
// POSTS
// ============================================================
if ($route === 'posts') {

    // POST /posts — criar post
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        if (empty($b['text']) && empty($b['game_id'])) respond(422, ['error' => 'Post precisa de texto ou jogo']);

        $postId = uuid();
        db()->prepare('INSERT INTO posts (id, user_id, game_id, type, status, text, progress, hours_played) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([$postId, $me['id'], $b['game_id'] ?? null, $b['type'] ?? 'status_update', $b['status'] ?? null, $b['text'] ?? null, $b['progress'] ?? null, $b['hours_played'] ?? null]);

        respond(201, ['id' => $postId]);
    }

    // POST /posts/:id/like
    if ($id && $action === 'like' && $method === 'POST') {
        $me = auth_required();
        try {
            db()->prepare('INSERT INTO post_likes (user_id, post_id) VALUES (?,?)')->execute([$me['id'], $id]);
            db()->prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?')->execute([$id]);
        } catch (PDOException $e) {} // já curtiu, ignora
        respond(200, ['ok' => true]);
    }

    // DELETE /posts/:id/like
    if ($id && $action === 'like' && $method === 'DELETE') {
        $me = auth_required();
        $db = db();
        $del = $db->prepare('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?');
        $del->execute([$me['id'], $id]);
        if ($del->rowCount() > 0)
            $db->prepare('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?')->execute([$id]);
        respond(200, ['ok' => true]);
    }

    // GET /posts/:id/comments
    if ($id && $action === 'comments' && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT c.*, u.username, u.display_name, u.avatar_url
            FROM comments c JOIN users u ON u.id = c.user_id
            WHERE c.post_id = ? AND c.parent_id IS NULL
            ORDER BY c.created_at ASC LIMIT ? OFFSET ?
        ');
        $stmt->execute([$id, $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // POST /posts/:id/comments
    if ($id && $action === 'comments' && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['text']);
        $cId = uuid();
        db()->prepare('INSERT INTO comments (id, post_id, user_id, text, parent_id) VALUES (?,?,?,?,?)')
            ->execute([$cId, $id, $me['id'], $b['text'], $b['parent_id'] ?? null]);
        db()->prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?')->execute([$id]);
        respond(201, ['id' => $cId]);
    }
}

// ============================================================
// GAMES
// ============================================================
if ($route === 'games') {

    // GET /games/search?q=elden
    if ($sub === 'search' && $method === 'GET') {
        auth_required();
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) respond(200, ['data' => []]);

        // 1. Busca no cache local primeiro
        $stmt = db()->prepare('SELECT id, title, developer, cover_url, rawg_rating, backlog-network_rating FROM games WHERE title LIKE ? LIMIT 20');
        $stmt->execute(["%$q%"]);
        $local = $stmt->fetchAll();

        if (count($local) >= 5) {
            respond(200, ['data' => $local, 'source' => 'cache']);
        }

        // 2. Busca na RAWG API
        $url = 'https://api.rawg.io/api/games?key=' . RAWG_API_KEY . '&search=' . urlencode($q) . '&page_size=10';
        $raw = @file_get_contents($url);
        if (!$raw) respond(200, ['data' => $local]);

        $rawgData = json_decode($raw, true);
        $results  = [];

        foreach ($rawgData['results'] ?? [] as $rg) {
            // Salva no cache local
            $gameId = uuid();
            $slug   = $rg['slug'] ?? strtolower(str_replace(' ', '-', $rg['name']));
            try {
                db()->prepare('INSERT IGNORE INTO games (id, rawg_id, title, slug, cover_url, developer, rawg_rating, release_date) VALUES (?,?,?,?,?,?,?,?)')
                    ->execute([$gameId, $rg['id'], $rg['name'], $slug, $rg['background_image'], $rg['developers'][0]['name'] ?? null, $rg['rating'] ?? null, $rg['released'] ?? null]);
            } catch (PDOException $e) {
                // slug duplicado — busca o existente
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
            SELECT g.id, g.title, g.cover_url, g.developer, g.backlog-network_rating,
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
        // $sub aqui é o UUID do game
        auth_required();
        $stmt = db()->prepare('SELECT * FROM games WHERE id = ?');
        $stmt->execute([$sub]);
        $game = $stmt->fetch();
        if (!$game) respond(404, ['error' => 'Jogo não encontrado']);

        // Plataformas e gêneros
        $plat = db()->prepare('SELECT platform FROM game_platforms WHERE game_id = ?');
        $plat->execute([$sub]);
        $game['platforms'] = array_column($plat->fetchAll(), 'platform');

        $gen = db()->prepare('SELECT genre FROM game_genres WHERE game_id = ?');
        $gen->execute([$sub]);
        $game['genres'] = array_column($gen->fetchAll(), 'genre');

        respond(200, $game);
    }

    // GET /games/:id/reviews
    if ($id && $action === 'reviews' && $method === 'GET') {
        auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT r.*, u.username, u.display_name, u.avatar_url
            FROM reviews r JOIN users u ON u.id = r.user_id
            WHERE r.game_id = ?
            ORDER BY r.likes_count DESC, r.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$id, $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }
}

// ============================================================
// BACKLOG
// ============================================================
if ($route === 'backlog') {

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

// ============================================================
// REVIEWS
// ============================================================
if ($route === 'reviews') {

    // GET /reviews/me
    if ($sub === 'me' && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT r.*, g.title AS game_title, g.cover_url AS game_cover
            FROM reviews r JOIN games g ON g.id = r.game_id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // POST /reviews
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['game_id', 'rating', 'body']);
        if ($b['rating'] < 0.5 || $b['rating'] > 10) respond(422, ['error' => 'Nota deve ser entre 0.5 e 10']);

        $rId = uuid();
        try {
            db()->prepare('INSERT INTO reviews (id, user_id, game_id, rating, title, body, spoiler, platform, hours_played) VALUES (?,?,?,?,?,?,?,?,?)')
                ->execute([$rId, $me['id'], $b['game_id'], $b['rating'], $b['title'] ?? null, $b['body'], (int)($b['spoiler'] ?? 0), $b['platform'] ?? null, $b['hours_played'] ?? null]);
        } catch (PDOException $e) {
            respond(409, ['error' => 'Você já escreveu uma review para este jogo']);
        }

        // Atualiza nota média do jogo
        db()->prepare('UPDATE games SET backlog-network_rating = (SELECT AVG(rating) FROM reviews WHERE game_id = ?), reviews_count = (SELECT COUNT(*) FROM reviews WHERE game_id = ?) WHERE id = ?')
            ->execute([$b['game_id'], $b['game_id'], $b['game_id']]);

        // Cria post automático no feed
        $postId = uuid();
        db()->prepare('INSERT INTO posts (id, user_id, game_id, review_id, type, status, text) VALUES (?,?,?,?,?,?,?)')
            ->execute([$postId, $me['id'], $b['game_id'], $rId, 'review', 'finished', $b['body']]);

        respond(201, ['id' => $rId]);
    }

    // PATCH /reviews/:id
    if ($sub && !$id && $method === 'PATCH') {
        $me = auth_required();
        $b  = body();
        $allowed = ['rating', 'title', 'body', 'spoiler', 'platform', 'hours_played'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; }
        }
        $params[] = $sub; $params[] = $me['id'];
        db()->prepare('UPDATE reviews SET ' . implode(', ', $sets) . ' WHERE id = ? AND user_id = ?')->execute($params);
        respond(200, ['ok' => true]);
    }

    // DELETE /reviews/:id
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        $db = db();
        $r  = $db->prepare('SELECT game_id FROM reviews WHERE id = ? AND user_id = ?');
        $r->execute([$sub, $me['id']]);
        $row = $r->fetch();
        if (!$row) respond(404, ['error' => 'Review não encontrada']);
        $db->prepare('DELETE FROM reviews WHERE id = ?')->execute([$sub]);
        $db->prepare('UPDATE games SET backlog-network_rating = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE game_id = ?), reviews_count = (SELECT COUNT(*) FROM reviews WHERE game_id = ?) WHERE id = ?')
           ->execute([$row['game_id'], $row['game_id'], $row['game_id']]);
        respond(200, ['ok' => true]);
    }

    // POST /reviews/:id/like
    if ($sub && $id === 'like' && $method === 'POST') {
        $me = auth_required();
        try {
            db()->prepare('INSERT INTO review_likes (user_id, review_id) VALUES (?,?)')->execute([$me['id'], $sub]);
            db()->prepare('UPDATE reviews SET likes_count = likes_count + 1 WHERE id = ?')->execute([$sub]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }
}

// ============================================================
// USERS
// ============================================================
if ($route === 'users') {

    // GET /users/suggested
    if ($sub === 'suggested' && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT u.id, u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count
            FROM users u
            WHERE u.id != ?
              AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
              AND u.is_active = 1
            ORDER BY followers_count DESC
            LIMIT 5
        ');
        $stmt->execute([$me['id'], $me['id']]);
        respond(200, $stmt->fetchAll());
    }

    // GET /users/search?q=
    if ($sub === 'search' && $method === 'GET') {
        auth_required();
        $q = trim($_GET['q'] ?? '');
        if (strlen($q) < 2) respond(200, []);
        $stmt = db()->prepare('SELECT id, username, display_name, avatar_url FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND is_active = 1 LIMIT 20');
        $stmt->execute(["%$q%", "%$q%"]);
        respond(200, $stmt->fetchAll());
    }

    // GET /users/:id
    if ($sub && !$id && $method === 'GET') {
        $me   = auth_required();
        $stmt = db()->prepare('SELECT * FROM users WHERE id = ? AND is_active = 1');
        $stmt->execute([$sub]);
        $user = $stmt->fetch();
        if (!$user) respond(404, ['error' => 'Usuário não encontrado']);

        $stats = db()->prepare('
            SELECT
                (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
                (SELECT COUNT(*) FROM follows WHERE follower_id  = ?) AS following_count,
                (SELECT COUNT(*) FROM backlog  WHERE user_id = ?)     AS games_count,
                (SELECT COUNT(*) FROM reviews  WHERE user_id = ?)     AS reviews_count,
                (SELECT COUNT(*) FROM follows  WHERE follower_id = ? AND following_id = ?) AS is_following
        ');
        $stats->execute([$sub, $sub, $sub, $sub, $me['id'], $sub]);
        $s = $stats->fetch();

        respond(200, array_merge(user_public($user), [
            'followers_count' => (int)$s['followers_count'],
            'following_count' => (int)$s['following_count'],
            'games_count'     => (int)$s['games_count'],
            'reviews_count'   => (int)$s['reviews_count'],
            'is_following'    => (bool)$s['is_following'],
        ]));
    }

    // GET /users/:id/backlog
    if ($id && $action === 'backlog' && $method === 'GET') {
        auth_required();
        $status = $_GET['status'] ?? null;
        $query = 'SELECT b.*, g.title, g.cover_url FROM backlog b JOIN games g ON g.id = b.game_id WHERE b.user_id = ? AND b.is_private = 0';
        $params = [$sub];
        if ($status) { $query .= ' AND b.status = ?'; $params[] = $status; }
        $stmt = db()->prepare($query . ' ORDER BY b.updated_at DESC');
        $stmt->execute($params);
        respond(200, $stmt->fetchAll());
    }

    // POST /users/:id/follow
    if ($sub && $id === 'follow' && $method === 'POST') {
        $me = auth_required();
        if ($me['id'] === $sub) respond(400, ['error' => 'Você não pode se seguir']);
        try {
            db()->prepare('INSERT INTO follows (follower_id, following_id) VALUES (?,?)')->execute([$me['id'], $sub]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /users/:id/follow
    if ($sub && $id === 'follow' && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')->execute([$me['id'], $sub]);
        respond(200, ['ok' => true]);
    }

    // PATCH /users/me
    if ($sub === 'me' && !$id && $method === 'PATCH') {
        $me = auth_required();
        $b  = body();
        $allowed = ['display_name', 'bio', 'avatar_url'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; }
        }
        if (!$sets) respond(422, ['error' => 'Nada para atualizar']);
        $params[] = $me['id'];
        db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        respond(200, ['ok' => true]);
    }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
if ($route === 'notifications') {

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


// ─── IGDB HELPER ─────────────────────────────────────────────────────────────
function igdb_token() {
    // Cache token em sessão de banco
    $stmt = db()->prepare("SELECT value, updated_at FROM app_settings WHERE key_name = 'igdb_token' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    if ($row && strtotime($row['updated_at']) > time() - 3600 * 24 * 30) {
        return $row['value'];
    }
    $ch = curl_init(TWITCH_AUTH);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => TWITCH_CLIENT_ID,
            'client_secret' => TWITCH_CLIENT_SECRET,
            'grant_type' => 'client_credentials',
        ]),
    ]);
    $res = json_decode(curl_exec($ch), true);
    curl_close($ch);
    $token = $res['access_token'] ?? null;
    if ($token) {
        db()->prepare("INSERT INTO app_settings (key_name, value) VALUES ('igdb_token', ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()")
            ->execute([$token, $token]);
    }
    return $token;
}

function igdb_request(string $endpoint, string $body): array {
    $token = igdb_token();
    $ch = curl_init(IGDB_API . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            'Client-ID: ' . TWITCH_CLIENT_ID,
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    return json_decode($res, true) ?? [];
}

function steam_request(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $res = curl_exec($ch);
    curl_close($ch);
    return json_decode($res, true) ?? [];
}

// ─── ROUTE: /games/search ────────────────────────────────────────────────────
if ($resource === 'games' && $sub === 'search' && $method === 'GET') {
    $q = trim($_GET['q'] ?? '');
    if (!$q) respond(400, ['error' => 'Parâmetro q obrigatório']);

    // Tenta cache local primeiro
    $stmt = db()->prepare("SELECT * FROM games WHERE title LIKE ? LIMIT 10");
    $stmt->execute(["%$q%"]);
    $cached = $stmt->fetchAll();
    if (count($cached) >= 3) respond(200, ['data' => $cached, 'source' => 'cache']);

    // Busca no IGDB
    $results = igdb_request('/games', "search \"$q\"; fields name,slug,cover.url,first_release_date,involved_companies.company.name,rating,summary,genres.name; limit 10;");
    $games = [];
    foreach ($results as $g) {
        $cover = isset($g['cover']['url']) ? 'https:' . str_replace('t_thumb', 't_cover_big', $g['cover']['url']) : null;
        $games[] = [
            'id' => 'igdb_' . $g['id'],
            'title' => $g['name'],
            'slug' => $g['slug'] ?? '',
            'cover_url' => $cover,
            'rawg_rating' => isset($g['rating']) ? round($g['rating'] / 10, 1) : null,
            'description' => $g['summary'] ?? null,
            'release_date' => isset($g['first_release_date']) ? date('Y-m-d', $g['first_release_date']) : null,
            'genres' => array_map(fn($genre) => $genre['name'], $g['genres'] ?? []),
        ];
    }
    respond(200, ['data' => $games, 'source' => 'igdb']);
}

// ─── ROUTE: /games/trending ──────────────────────────────────────────────────
if ($resource === 'games' && $sub === 'trending' && $method === 'GET') {
    // Jogos populares no momento via IGDB
    $results = igdb_request('/games', 'fields name,slug,cover.url,rating,genres.name,first_release_date; where rating > 75 & first_release_date > ' . strtotime('-1 year') . '; sort rating desc; limit 20;');
    $games = [];
    foreach ($results as $g) {
        $cover = isset($g['cover']['url']) ? 'https:' . str_replace('t_thumb', 't_cover_big', $g['cover']['url']) : null;
        $games[] = [
            'id' => 'igdb_' . $g['id'],
            'title' => $g['name'],
            'slug' => $g['slug'] ?? '',
            'cover_url' => $cover,
            'rawg_rating' => isset($g['rating']) ? round($g['rating'] / 10, 1) : null,
            'genres' => array_map(fn($genre) => $genre['name'], $g['genres'] ?? []),
        ];
    }
    respond(200, ['data' => $games]);
}

// ─── ROUTE: /games/steam-top ─────────────────────────────────────────────────
if ($resource === 'games' && $sub === 'steam-top' && $method === 'GET') {
    $data = steam_request(STEAM_API . '/ISteamChartsService/GetMostPlayedGames/v1/');
    $ranks = $data['response']['ranks'] ?? [];
    $games = [];
    foreach (array_slice($ranks, 0, 10) as $r) {
        $appid = $r['appid'];
        $detail = steam_request(STEAM_STORE_API . "/api/appdetails?appids=$appid&cc=br&l=pt");
        $info = $detail[$appid]['data'] ?? null;
        if ($info) {
            $games[] = [
                'steam_id' => $appid,
                'title' => $info['name'],
                'cover_url' => $info['header_image'] ?? null,
                'current_players' => $r['concurrent_in_game'] ?? 0,
                'price' => $info['price_overview']['final_formatted'] ?? 'Grátis',
            ];
        }
    }
    respond(200, ['data' => $games]);
}

// ─── ROUTE: /twitch/live ─────────────────────────────────────────────────────
if ($resource === 'twitch' && $sub === 'live' && $method === 'GET') {
    // Pega token do Twitch
    $ch = curl_init(TWITCH_AUTH);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => TWITCH_CLIENT_ID,
            'client_secret' => TWITCH_CLIENT_SECRET,
            'grant_type' => 'client_credentials',
        ]),
    ]);
    $auth = json_decode(curl_exec($ch), true);
    curl_close($ch);
    $token = $auth['access_token'] ?? null;

    $ch2 = curl_init(TWITCH_API . '/streams?first=20&language=pt');
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Client-ID: ' . TWITCH_CLIENT_ID,
            'Authorization: Bearer ' . $token,
        ],
    ]);
    $res = json_decode(curl_exec($ch2), true);
    curl_close($ch2);
    respond(200, ['data' => $res['data'] ?? []]);
}

// ─── ROUTE: /feed (real) ─────────────────────────────────────────────────────
if ($resource === 'feed' && !$sub && $method === 'GET') {
    $me = auth_required();
    $pg = paginate();
    $filter = $_GET['filter'] ?? 'all'; // all | following | global

    if ($filter === 'following') {
        $stmt = db()->prepare('
            SELECT p.*, COALESCE(p.content, p.text) AS content, u.username, u.display_name, u.avatar_url, u.level,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me
            FROM posts p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
            ORDER BY p.created_at DESC LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $me['id'], $pg['limit'], $pg['offset']]);
    } else {
        $stmt = db()->prepare('
            SELECT p.*, COALESCE(p.content, p.text) AS content, u.username, u.display_name, u.avatar_url, u.level,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me
            FROM posts p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $pg['limit'], $pg['offset']]);
    }
    respond(200, ['data' => $stmt->fetchAll()]);
}


// ─── ROUTE: /posts ────────────────────────────────────────────────────────────
if ($resource === 'posts' && !$sub && $method === 'POST') {
    $me = auth_required();
    $b = body();
    $content = trim($b['content'] ?? $b['text'] ?? '');
    if (!$content) respond(400, ['error' => 'Conteúdo obrigatório']);
    $id = uuid();
    db()->prepare('INSERT INTO posts (id, user_id, content, game_name, game_status, hours_played, created_at, updated_at) VALUES (?,?,?,?,?,?,NOW(),NOW())')
       ->execute([$id, $me['id'], $content, $b['game_name'] ?? null, $b['game_status'] ?? null, $b['hours_played'] ?? null]);
    respond(201, ['id' => $id, 'content' => $content]);
}
if ($resource === 'posts' && $sub && $id === 'like' && $method === 'POST') {
    $me = auth_required();
    try { db()->prepare('INSERT INTO post_likes (id, post_id, user_id, created_at) VALUES (?,?,?,NOW())')->execute([uuid(), $sub, $me['id']]); } catch (PDOException $e) {}
    respond(200, ['ok' => true]);
}
if ($resource === 'posts' && $sub && $id === 'like' && $method === 'DELETE') {
    $me = auth_required();
    db()->prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?')->execute([$sub, $me['id']]);
    respond(200, ['ok' => true]);
}
if ($resource === 'posts' && $sub && $id === 'comments' && $method === 'GET') {
    $me = auth_required();
    $stmt = db()->prepare('SELECT c.*, u.username, u.display_name, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT 50');
    $stmt->execute([$sub]);
    respond(200, ['data' => $stmt->fetchAll()]);
}
if ($resource === 'posts' && $sub && $id === 'comments' && $method === 'POST') {
    $me = auth_required();
    $b = body();
    $text = trim($b['text'] ?? '');
    if (!$text) respond(400, ['error' => 'Comentário vazio']);
    $cid = uuid();
    db()->prepare('INSERT INTO comments (id, post_id, user_id, content, parent_id, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())')
       ->execute([$cid, $sub, $me['id'], $text, $b['parent_id'] ?? null]);
    respond(201, ['id' => $cid, 'content' => $text]);
}

// ─── ROUTE: /lists ────────────────────────────────────────────────────────────
if ($resource === 'lists' && $sub === 'me' && $method === 'GET') {
    $me = auth_required();
    $stmt = db()->prepare('SELECT l.*, COUNT(li.id) as items_count FROM game_lists l LEFT JOIN game_list_items li ON li.list_id = l.id WHERE l.user_id = ? GROUP BY l.id ORDER BY l.created_at DESC');
    $stmt->execute([$me['id']]);
    respond(200, ['data' => $stmt->fetchAll()]);
}
if ($resource === 'lists' && !$sub && $method === 'POST') {
    $me = auth_required();
    $b = body();
    $title = trim($b['title'] ?? '');
    if (!$title) respond(400, ['error' => 'Título obrigatório']);
    $lid = uuid();
    db()->prepare('INSERT INTO game_lists (id, user_id, title, description, list_type, is_public, created_at, updated_at) VALUES (?,?,?,?,?,?,NOW(),NOW())')
       ->execute([$lid, $me['id'], $title, $b['description'] ?? null, $b['list_type'] ?? 'custom', ($b['is_public'] ?? true) ? 1 : 0]);
    respond(201, ['id' => $lid, 'title' => $title]);
}
if ($resource === 'lists' && $sub && $id === 'items' && $method === 'POST') {
    $me = auth_required();
    $b = body();
    $iid = uuid();
    db()->prepare('INSERT INTO game_list_items (id, list_id, game_id, notes, position, created_at) VALUES (?,?,?,?,?,NOW())')
       ->execute([$iid, $sub, $b['game_id'], $b['notes'] ?? null, $b['position'] ?? 0]);
    respond(201, ['id' => $iid]);
}
if ($resource === 'lists' && $sub && $id === 'items' && $action && $method === 'DELETE') {
    $me = auth_required();
    db()->prepare('DELETE FROM game_list_items WHERE id = ?')->execute([$action]);
    respond(200, ['ok' => true]);
}

// ─── ROUTE: /users/:id/lists ──────────────────────────────────────────────────
if ($resource === 'users' && $sub && $id === 'lists' && $method === 'GET') {
    auth_required();
    $stmt = db()->prepare('SELECT l.*, COUNT(li.id) as items_count FROM game_lists l LEFT JOIN game_list_items li ON li.list_id = l.id WHERE l.user_id = ? AND l.is_public = 1 GROUP BY l.id ORDER BY l.created_at DESC');
    $stmt->execute([$sub]);
    respond(200, ['data' => $stmt->fetchAll()]);
}


// ─── ROUTE: /communities ─────────────────────────────────────────────────────
if ($route === 'communities' || $resource === 'communities') {
    // GET /communities — lista todas
    if ($method === 'GET' && !$sub && !$id) {
        auth_required();
        $stmt = db()->prepare('SELECT c.*, COUNT(cm.user_id) AS members_count FROM communities c LEFT JOIN community_members cm ON cm.community_id = c.id GROUP BY c.id ORDER BY members_count DESC LIMIT 50');
        $stmt->execute();
        respond(200, ['data' => $stmt->fetchAll()]);
    }
    // POST /communities — criar
    if ($method === 'POST' && !$sub && !$id) {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['name', 'description']);
        $cid = uuid();
        db()->prepare('INSERT INTO communities (id, owner_id, name, description, icon_url, genre, is_private, created_at, updated_at) VALUES (?,?,?,?,?,?,?,NOW(),NOW())')
           ->execute([$cid, $me['id'], $b['name'], $b['description'], $b['icon'] ?? '🎮', $b['genre'] ?? null, ($b['is_private'] ?? false) ? 1 : 0]);
        db()->prepare('INSERT INTO community_members (community_id, user_id, role, joined_at) VALUES (?,?,"owner",NOW())')->execute([$cid, $me['id']]);
        respond(201, ['id' => $cid, 'name' => $b['name']]);
    }
    // GET /communities/:id — detalhes
    if ($method === 'GET' && ($sub || $id)) {
        $cid = $sub ?? $id;
        auth_required();
        $stmt = db()->prepare('SELECT c.*, COUNT(cm.user_id) AS members_count FROM communities c LEFT JOIN community_members cm ON cm.community_id = c.id WHERE c.id = ? GROUP BY c.id');
        $stmt->execute([$cid]);
        $c = $stmt->fetch();
        if (!$c) respond(404, ['error' => 'Comunidade não encontrada']);
        respond(200, $c);
    }
    // POST /communities/:id/join
    if ($method === 'POST' && $id === 'join') {
        $me = auth_required();
        $cid = $sub;
        try {
            db()->prepare('INSERT INTO community_members (community_id, user_id, role, joined_at) VALUES (?,?,"member",NOW())')->execute([$cid, $me['id']]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }
    // DELETE /communities/:id/join
    if ($method === 'DELETE' && $id === 'join') {
        $me = auth_required();
        db()->prepare('DELETE FROM community_members WHERE community_id = ? AND user_id = ?')->execute([$sub, $me['id']]);
        respond(200, ['ok' => true]);
    }
}

// ─── 404 FALLBACK ─────────────────────────────────────────────────────────────
respond(404, ['error' => 'Rota não encontrada', 'path' => $uri]);

