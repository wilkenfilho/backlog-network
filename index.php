<?php
/**
 * BACKLOG NETWORK API — Backend completo em PHP puro
 * Compatível com Hostgator shared hosting (PHP 7.4+)
 * 
 * Coloque este arquivo em: public_html/backlog-network-api/index.php
 */

// ─── CONFIG — carrega do .env se existir, usa fallback caso contrário ─────────
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line && $line[0] !== '#' && str_contains($line, '=')) {
            [$k, $v] = explode('=', $line, 2);
            $_ENV[trim($k)] = trim($v);
        }
    }
}
function env(string $key, string $default = ''): string {
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

define('DB_HOST',        env('DB_HOST',        'localhost'));
define('DB_NAME',        env('DB_NAME',        'soraia05_backlognetwork'));
define('DB_USER',        env('DB_USER',        'soraia05_wilkenp'));
define('DB_PASS',        env('DB_PASS',        ''));
define('JWT_SECRET',     env('JWT_SECRET',     'CHANGE_ME_MIN_32_CHARS_XXXXXXXXXX'));
define('JWT_EXPIRES_HOURS', (int)env('JWT_EXPIRES_HOURS', '720'));
define('RAWG_API_KEY',   env('RAWG_API_KEY',   ''));

// ─── TWITCH / IGDB ───────────────────────────────────────────────────────────
define('TWITCH_CLIENT_ID',     env('TWITCH_CLIENT_ID',     ''));
define('TWITCH_CLIENT_SECRET', env('TWITCH_CLIENT_SECRET', ''));
define('TWITCH_API',           'https://api.twitch.tv/helix');
define('TWITCH_AUTH',          'https://id.twitch.tv/oauth2/token');
define('IGDB_API',             'https://api.igdb.com/v4');

// ─── STEAM ───────────────────────────────────────────────────────────────────
define('STEAM_API_KEY',   env('STEAM_API_KEY',   ''));
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

function is_valid_uuid(string $s): bool {
    return (bool)preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $s);
}

function validate_id(string $id, string $label = 'ID'): void {
    if (!is_valid_uuid($id)) respond(400, ['error' => "$label inválido"]);
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

$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = preg_replace('#^/backlog-network-api#', '', $uri);  // remove base path
$parts  = explode('/', trim($uri, '/'));

$resource = $parts[0] ?? '';
$sub      = $parts[1] ?? '';
$id       = $parts[2] ?? '';
$action   = $parts[3] ?? '';

// ============================================================
// SETUP (cria tabelas faltantes) – pode ser chamado quantas vezes quiser
// ============================================================
if ($resource === 'setup' && $method === 'GET') {
    $db = db();
    $tables = [];

    $db->exec("CREATE TABLE IF NOT EXISTS stories (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        image_url TEXT,
        caption TEXT,
        duration INT DEFAULT 5,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expires (expires_at),
        INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $tables[] = 'stories';

    $db->exec("CREATE TABLE IF NOT EXISTS story_views (
        id VARCHAR(36) PRIMARY KEY,
        story_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_view (story_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $tables[] = 'story_views';

    $db->exec("CREATE TABLE IF NOT EXISTS game_lists (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(120) NOT NULL,
        description TEXT,
        list_type VARCHAR(30) DEFAULT 'custom',
        is_public TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $tables[] = 'game_lists';

    $db->exec("CREATE TABLE IF NOT EXISTS game_list_items (
        id VARCHAR(36) PRIMARY KEY,
        list_id VARCHAR(36) NOT NULL,
        game_id VARCHAR(36),
        notes TEXT,
        position INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_list (list_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $tables[] = 'game_list_items';

    $db->exec("CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY,
        sender_id VARCHAR(36) NOT NULL,
        receiver_id VARCHAR(36) NOT NULL,
        body TEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender (sender_id),
        INDEX idx_receiver (receiver_id),
        INDEX idx_conversation (sender_id, receiver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $tables[] = 'messages';

    $db->exec("CREATE TABLE IF NOT EXISTS communities (
        id VARCHAR(36) PRIMARY KEY,
        slug VARCHAR(120) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        cover_url TEXT,
        genre VARCHAR(60),
        is_private TINYINT(1) DEFAULT 0,
        created_by VARCHAR(36) NOT NULL,
        game_id VARCHAR(36),
        game_title VARCHAR(200),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_created_by (created_by),
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $tables[] = 'communities';

    $db->exec("CREATE TABLE IF NOT EXISTS community_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        community_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        role VARCHAR(20) DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_member (community_id, user_id),
        INDEX idx_community (community_id),
        INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $tables[] = 'community_members';

    respond(200, ['ok' => true, 'tables_ensured' => $tables]);
}

// ============================================================
// AUTH
// ============================================================
if ($resource === 'auth') {

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

    // POST /auth/change-email
    if ($sub === 'change-email' && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['new_email', 'password']);

        if (!filter_var($b['new_email'], FILTER_VALIDATE_EMAIL))
            respond(422, ['error' => 'Email inválido']);

        $user = db()->prepare('SELECT * FROM users WHERE id = ?');
        $user->execute([$me['id']]);
        $u = $user->fetch();

        if (!password_verify($b['password'], $u['password_hash']))
            respond(401, ['error' => 'Senha incorreta']);

        $check = db()->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
        $check->execute([strtolower($b['new_email']), $me['id']]);
        if ($check->fetch()) respond(409, ['error' => 'Email já em uso por outra conta']);

        db()->prepare('UPDATE users SET email = ? WHERE id = ?')
            ->execute([strtolower($b['new_email']), $me['id']]);

        respond(200, ['ok' => true, 'email' => strtolower($b['new_email'])]);
    }

    // POST /auth/change-password
    if ($sub === 'change-password' && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['current_password', 'new_password']);

        if (strlen($b['new_password']) < 8)
            respond(422, ['error' => 'Nova senha deve ter ao menos 8 caracteres']);

        $user = db()->prepare('SELECT * FROM users WHERE id = ?');
        $user->execute([$me['id']]);
        $u = $user->fetch();

        if (!password_verify($b['current_password'], $u['password_hash']))
            respond(401, ['error' => 'Senha atual incorreta']);

        $hash = password_hash($b['new_password'], PASSWORD_BCRYPT, ['cost' => 12]);
        db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
            ->execute([$hash, $me['id']]);

        respond(200, ['ok' => true]);
    }
}

// ============================================================
// FEED
// ============================================================
if ($resource === 'feed' && $method === 'GET') {
    $me = auth_required();
    $pg = paginate();
    $type = $_GET['type'] ?? 'friends';

    $db = db();

    if ($type === 'friends') {
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
        $post['user'] = [
            'id' => $post['user_id'],
            'username' => $post['username'],
            'display_name' => $post['display_name'],
            'avatar_url' => $post['avatar_url'],
        ];
        if ($post['game_title']) {
            $post['game'] = [
                'id' => $post['game_id'],
                'title' => $post['game_title'],
                'cover_url' => $post['game_cover'],
                'developer' => $post['game_dev'],
            ];
        }
        unset($post['username'], $post['display_name'], $post['avatar_url'], $post['game_title'], $post['game_cover'], $post['game_dev']);
    }
    $nextPage = count($posts) === $pg['limit'] ? $pg['page'] + 1 : null;
    respond(200, ['data' => $posts, 'nextPage' => $nextPage, 'meta' => ['page' => $pg['page'], 'limit' => $pg['limit']]]);
}

// ============================================================
// POSTS
// ============================================================
if ($resource === 'posts') {

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

    // DELETE /posts/:id
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        $postId = $sub;
        $stmt = db()->prepare('SELECT user_id FROM posts WHERE id = ?');
        $stmt->execute([$postId]);
        $post = $stmt->fetch();
        if (!$post) respond(404, ['error' => 'Post não encontrado']);
        if ($post['user_id'] !== $me['id']) respond(403, ['error' => 'Não autorizado']);
        db()->prepare('DELETE FROM posts WHERE id = ?')->execute([$postId]);
        respond(200, ['ok' => true]);
    }

    // POST /posts/:id/like
    if ($id === 'like' && $method === 'POST') {
        $me = auth_required();
        try {
            db()->prepare('INSERT INTO post_likes (user_id, post_id) VALUES (?,?)')->execute([$me['id'], $sub]);
            db()->prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?')->execute([$sub]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /posts/:id/like
    if ($id === 'like' && $method === 'DELETE') {
        $me = auth_required();
        $db = db();
        $del = $db->prepare('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?');
        $del->execute([$me['id'], $sub]);
        if ($del->rowCount() > 0)
            $db->prepare('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?')->execute([$sub]);
        respond(200, ['ok' => true]);
    }

    // GET /posts/:id/comments
    if ($id === 'comments' && $method === 'GET') {
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT c.*, u.username, u.display_name, u.avatar_url
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.post_id = ? AND c.parent_id IS NULL
            ORDER BY c.created_at ASC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$sub, $pg['limit'], $pg['offset']]);
        $comments = $stmt->fetchAll();
        // Buscar respostas aninhadas
        foreach ($comments as &$c) {
            $replies = db()->prepare('
                SELECT c.*, u.username, u.display_name, u.avatar_url
                FROM comments c
                JOIN users u ON u.id = c.user_id
                WHERE c.parent_id = ?
                ORDER BY c.created_at ASC
            ');
            $replies->execute([$c['id']]);
            $c['replies'] = $replies->fetchAll();
        }
        respond(200, ['data' => $comments]);
    }

    // POST /posts/:id/comments
    if ($id === 'comments' && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        required_fields($b, ['text']);
        $cId = uuid();
        db()->prepare('INSERT INTO comments (id, post_id, user_id, text, parent_id) VALUES (?,?,?,?,?)')
            ->execute([$cId, $sub, $me['id'], $b['text'], $b['parent_id'] ?? null]);
        db()->prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?')->execute([$sub]);
        respond(201, ['id' => $cId]);
    }
}

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

// ============================================================
// REVIEWS
// ============================================================
if ($resource === 'reviews') {

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

        db()->prepare('UPDATE games SET `backlog-network_rating` = (SELECT AVG(rating) FROM reviews WHERE game_id = ?), reviews_count = (SELECT COUNT(*) FROM reviews WHERE game_id = ?) WHERE id = ?')
            ->execute([$b['game_id'], $b['game_id'], $b['game_id']]);

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
        $db->prepare('UPDATE games SET `backlog-network_rating` = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE game_id = ?), reviews_count = (SELECT COUNT(*) FROM reviews WHERE game_id = ?) WHERE id = ?')
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
if ($resource === 'users') {

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
    if ($id === 'backlog' && $method === 'GET') {
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
    if ($id === 'follow' && $method === 'POST') {
        $me = auth_required();
        if ($me['id'] === $sub) respond(400, ['error' => 'Você não pode se seguir']);
        try {
            db()->prepare('INSERT INTO follows (follower_id, following_id) VALUES (?,?)')->execute([$me['id'], $sub]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /users/:id/follow
    if ($id === 'follow' && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')->execute([$me['id'], $sub]);
        respond(200, ['ok' => true]);
    }

    // PATCH /users/me
    if ($sub === 'me' && !$id && $method === 'PATCH') {
        $me = auth_required();
        $b  = body();

        if (array_key_exists('username', $b)) {
            $newUsername = strtolower(trim($b['username']));
            if (strlen($newUsername) < 3 || strlen($newUsername) > 30)
                respond(422, ['error' => 'Username deve ter entre 3 e 30 caracteres']);
            if (!preg_match('/^[a-z0-9_.]+$/', $newUsername))
                respond(422, ['error' => 'Username só pode ter letras, números, _ e .']);
            $check = db()->prepare('SELECT id FROM users WHERE username = ? AND id != ?');
            $check->execute([$newUsername, $me['id']]);
            if ($check->fetch()) respond(409, ['error' => 'Este handle já está em uso']);
            db()->prepare('UPDATE users SET username = ? WHERE id = ?')->execute([$newUsername, $me['id']]);
            respond(200, ['ok' => true, 'username' => $newUsername]);
        }

        $allowed = ['display_name', 'bio', 'avatar_url', 'is_profile_public', 'backlog_visibility'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; }
        }
        if (!$sets) respond(422, ['error' => 'Nada para atualizar']);
        $params[] = $me['id'];
        db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        respond(200, ['ok' => true]);
    }

    // GET /users/check-username?username=
    if ($sub === 'check-username' && $method === 'GET') {
        auth_required();
        $username = strtolower(trim($_GET['username'] ?? ''));
        if (strlen($username) < 3) respond(200, ['available' => false, 'reason' => 'Muito curto']);
        $stmt = db()->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        respond(200, ['available' => !$stmt->fetch()]);
    }

    // PATCH /users/me/privacy
    if ($sub === 'me' && $id === 'privacy' && $method === 'PATCH') {
        $me = auth_required();
        $b  = body();
        $allowed = ['is_profile_public', 'backlog_visibility'];
        $sets = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $params[] = $b[$f]; }
        }
        if (!$sets) respond(422, ['error' => 'Nada para atualizar']);
        $params[] = $me['id'];
        db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        respond(200, ['ok' => true]);
    }

    // GET /users/me/privacy
    if ($sub === 'me' && $id === 'privacy' && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('SELECT is_profile_public, backlog_visibility, totp_enabled FROM users WHERE id = ?');
        $stmt->execute([$me['id']]);
        respond(200, $stmt->fetch());
    }

    // GET /users/me/blocked
    if ($sub === 'me' && $id === 'blocked' && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT b.id AS block_id, b.blocked_id, u.username, u.display_name, u.avatar_url, b.created_at
            FROM blocked_users b
            JOIN users u ON u.id = b.blocked_id
            WHERE b.blocker_id = ?
            ORDER BY b.created_at DESC
        ');
        $stmt->execute([$me['id']]);
        respond(200, $stmt->fetchAll());
    }

    // POST /users/:id/block
    if ($id === 'block' && $method === 'POST') {
        $me = auth_required();
        $targetId = $sub;
        if ($targetId === $me['id']) respond(422, ['error' => 'Não pode bloquear a si mesmo']);
        try {
            db()->prepare('INSERT INTO blocked_users (id, blocker_id, blocked_id) VALUES (?,?,?)')
                ->execute([uuid(), $me['id'], $targetId]);
            db()->prepare('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)')
                ->execute([$me['id'], $targetId, $targetId, $me['id']]);
        } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /users/:id/block
    if ($id === 'block' && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?')
            ->execute([$me['id'], $sub]);
        respond(200, ['ok' => true]);
    }

    // GET /users/:id/posts
    if ($id === 'posts' && $method === 'GET') {
        $me = auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT p.id, p.user_id, p.type, p.status,
                   COALESCE(p.content, p.text) AS content,
                   p.game_id, p.hours_played, p.progress,
                   p.likes_count, p.comments_count, p.created_at,
                   g.title AS game_title, g.cover_url AS game_cover,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me
            FROM posts p
            LEFT JOIN games g ON g.id = p.game_id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ');
        $stmt->execute([$me['id'], $sub, $pg['limit'], $pg['offset']]);
        $posts = $stmt->fetchAll();
        foreach ($posts as &$p) { $p['liked_by_me'] = (bool)$p['liked_by_me']; }
        $total = db()->prepare('SELECT COUNT(*) FROM posts WHERE user_id = ?');
        $total->execute([$sub]);
        $count = (int)$total->fetchColumn();
        respond(200, ['data' => $posts, 'has_more' => ($pg['offset'] + $pg['limit']) < $count]);
    }

    // GET /users/:id/reviews
    if ($id === 'reviews' && $method === 'GET') {
        auth_required();
        $pg = paginate();
        $stmt = db()->prepare('
            SELECT r.*, g.title AS game_title, g.cover_url AS game_cover
            FROM reviews r JOIN games g ON g.id = r.game_id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC LIMIT ? OFFSET ?
        ');
        $stmt->execute([$sub, $pg['limit'], $pg['offset']]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }

    // GET /users/:id/lists
    if ($id === 'lists' && $method === 'GET') {
        auth_required();
        $stmt = db()->prepare('SELECT l.*, COUNT(li.id) as items_count FROM game_lists l LEFT JOIN game_list_items li ON li.list_id = l.id WHERE l.user_id = ? AND l.is_public = 1 GROUP BY l.id ORDER BY l.created_at DESC');
        $stmt->execute([$sub]);
        respond(200, ['data' => $stmt->fetchAll()]);
    }
}

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

// ============================================================
// UPLOAD
// ============================================================
if ($resource === 'upload' && $method === 'POST') {
    $me = auth_required();
    $b  = body();

    $base64 = $b['image_base64'] ?? $b['base64'] ?? null;
    if (!$base64) respond(400, ['error' => 'Campo image_base64 obrigatório']);

    $decoded = base64_decode($base64, true);
    if ($decoded === false) respond(400, ['error' => 'Base64 inválido']);
    if (strlen($decoded) > 2 * 1024 * 1024) respond(422, ['error' => 'Imagem muito grande. Máximo 2 MB.']);

    // Valida MIME real com finfo (não apenas extensão pelos primeiros bytes)
    $allowedMimes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->buffer($decoded);
    if (!isset($allowedMimes[$mimeType])) {
        respond(422, ['error' => 'Tipo de arquivo não permitido. Envie JPG, PNG, GIF ou WebP.']);
    }
    $ext = $allowedMimes[$mimeType];

    $uploadDir = __DIR__ . '/uploads/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $filename = uuid() . '.' . $ext;
    $filepath = $uploadDir . $filename;

    if (file_put_contents($filepath, $decoded) === false) {
        respond(500, ['error' => 'Erro ao salvar imagem no servidor']);
    }

    $proto    = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host     = $_SERVER['HTTP_HOST'] ?? 'wilkenperez.com';
    $basePath = '/backlog-network-api/uploads/';
    $url      = $proto . '://' . $host . $basePath . $filename;

    respond(201, ['url' => $url, 'image_url' => $url, 'filename' => $filename]);
}

// ============================================================
// STORIES
// ============================================================
if ($resource === 'stories') {
    // GET /stories
    if (!$sub && $method === 'GET') {
        $me = auth_required();
        $stmt = db()->prepare('
            SELECT s.*, u.username, u.display_name, u.avatar_url,
                   (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) AS views_count,
                   (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id AND sv.user_id = ?) AS viewed_by_me
            FROM stories s
            JOIN users u ON u.id = s.user_id
            WHERE s.expires_at > NOW()
            ORDER BY s.created_at DESC
            LIMIT 100
        ');
        $stmt->execute([$me['id']]);
        $stories = $stmt->fetchAll();
        foreach ($stories as &$s) { $s['viewed_by_me'] = (bool)$s['viewed_by_me']; }
        respond(200, $stories);
    }

    // POST /stories
    if (!$sub && $method === 'POST') {
        $me = auth_required();
        $b  = body();
        $sid = uuid();
        $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
        try {
            db()->prepare('INSERT INTO stories (id, user_id, image_url, caption, duration, expires_at, created_at) VALUES (?,?,?,?,?,?,NOW())')
               ->execute([$sid, $me['id'], $b['image_url'] ?? null, $b['caption'] ?? null, $b['duration'] ?? 5, $expiresAt]);
        } catch (PDOException $e) {
            respond(500, ['error' => 'Erro ao criar story: ' . $e->getMessage()]);
        }
        respond(201, ['id' => $sid]);
    }

    // POST /stories/:id/view
    if ($sub && $id === 'view' && $method === 'POST') {
        $me = auth_required();
        try { db()->prepare('INSERT IGNORE INTO story_views (id, story_id, user_id, created_at) VALUES (?,?,?,NOW())')->execute([uuid(), $sub, $me['id']]); } catch (PDOException $e) {}
        respond(200, ['ok' => true]);
    }

    // DELETE /stories/:id
    if ($sub && !$id && $method === 'DELETE') {
        $me = auth_required();
        db()->prepare('DELETE FROM stories WHERE id = ? AND user_id = ?')->execute([$sub, $me['id']]);
        respond(200, ['ok' => true]);
    }
}

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

// ============================================================
// COMMENTS — like/unlike
// ============================================================
if ($resource === 'comments') {

    // POST /comments/:id/like
    if ($sub && $id === 'like' && $method === 'POST') {
        $me = auth_required();
        validate_id($sub, 'Comment ID');
        try {
            db()->prepare('INSERT INTO comment_likes (id, user_id, comment_id, created_at) VALUES (?,?,?,NOW())')
               ->execute([uuid(), $me['id'], $sub]);
            db()->prepare('UPDATE comments SET likes_count = likes_count + 1 WHERE id = ?')->execute([$sub]);
        } catch (PDOException $e) {} // IGNORE duplicate
        respond(200, ['ok' => true]);
    }

    // DELETE /comments/:id/like
    if ($sub && $id === 'like' && $method === 'DELETE') {
        $me = auth_required();
        validate_id($sub, 'Comment ID');
        $del = db()->prepare('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?');
        $del->execute([$me['id'], $sub]);
        if ($del->rowCount() > 0) {
            db()->prepare('UPDATE comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?')->execute([$sub]);
        }
        respond(200, ['ok' => true]);
    }
}

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

// ============================================================
// FALLBACK
// ============================================================
respond(404, ['error' => 'Rota não encontrada', 'path' => $uri]);