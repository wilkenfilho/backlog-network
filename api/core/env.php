<?php
// ─── Carrega .env se existir ──────────────────────────────────────────────────
$envFile = __DIR__ . '/../.env';
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
define('DB_PASS',        env('DB_PASS',        ''));  // Defina em .env — nunca deixe a senha aqui
define('JWT_SECRET',     env('JWT_SECRET',     ''));
define('JWT_EXPIRES_HOURS', (int)env('JWT_EXPIRES_HOURS', '720'));
define('RAWG_API_KEY',   env('RAWG_API_KEY',   ''));
define('TWITCH_CLIENT_ID',     env('TWITCH_CLIENT_ID',     ''));
define('TWITCH_CLIENT_SECRET', env('TWITCH_CLIENT_SECRET', ''));
define('TWITCH_API',           'https://api.twitch.tv/helix');
define('TWITCH_AUTH',          'https://id.twitch.tv/oauth2/token');
define('IGDB_API',             'https://api.igdb.com/v4');
define('STEAM_API_KEY',   env('STEAM_API_KEY',   ''));
define('STEAM_API',       'https://api.steampowered.com');
define('STEAM_STORE_API', 'https://store.steampowered.com');
