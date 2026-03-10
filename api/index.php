<?php
/**
 * BACKLOG NETWORK API — Bootstrap + Router
 * Compatível com Hostgator shared hosting (PHP 7.4+)
 *
 * Estrutura:
 *   api/
 *   ├── index.php              ← este arquivo (entry point)
 *   ├── core/
 *   │   ├── env.php            ← config e constantes
 *   │   ├── db.php             ← conexão PDO
 *   │   ├── helpers.php        ← uuid, respond, paginate, etc.
 *   │   └── auth.php           ← JWT + auth_required()
 *   └── controllers/
 *       ├── AuthController.php
 *       ├── FeedController.php
 *       ├── GamesController.php
 *       ├── BacklogController.php
 *       ├── ReviewsController.php
 *       ├── UsersController.php
 *       ├── NotificationsController.php
 *       ├── CommunitiesController.php
 *       ├── TopicsController.php
 *       ├── MessagesController.php
 *       ├── UploadController.php
 *       ├── StoriesController.php
 *       ├── ListsController.php
 *       ├── CommentsController.php
 *       ├── FansController.php
 *       └── ScrapsController.php
 */

// ─── CORE ────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/core/env.php';
require_once __DIR__ . '/core/helpers.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/auth.php';

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno no servidor. Tente novamente em instantes.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

set_error_handler(function (int $errno, string $errstr) {
    if (!(error_reporting() & $errno)) return false;
    // Apenas erros fatais viram 500; Notices/Warnings são ignorados silenciosamente
    if ($errno === E_ERROR || $errno === E_PARSE || $errno === E_CORE_ERROR || $errno === E_COMPILE_ERROR) {
        http_response_code(500);
        echo json_encode(['error' => 'Erro no servidor.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return false; // deixa o PHP lidar com Notices e Warnings normalmente
});

// ─── CORS + HEADERS ──────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ─── ROUTING ─────────────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = preg_replace('#^/backlog-network-api#', '', $uri);
$parts  = explode('/', trim($uri, '/'));

$resource = $parts[0] ?? '';
$sub      = $parts[1] ?? '';
$id       = $parts[2] ?? '';
$action   = $parts[3] ?? '';

// ─── CONTROLLERS ─────────────────────────────────────────────────────────────
$controllerMap = [
    'setup'         => 'SetupController',
    'auth'          => 'AuthController',
    'feed'          => 'FeedController',
    'posts'         => 'FeedController',
    'games'         => 'GamesController',
    'backlog'       => 'BacklogController',
    'reviews'       => 'ReviewsController',
    'users'         => 'UsersController',
    'notifications' => 'NotificationsController',
    'communities'   => 'CommunitiesController',
    'topics'        => 'TopicsController',
    'messages'      => 'MessagesController',
    'upload'        => 'UploadController',
    'stories'       => 'StoriesController',
    'lists'         => 'ListsController',
    'comments'      => 'CommentsController',
    'fans'          => 'FansController',
    'scraps'        => 'ScrapsController',
];

if (isset($controllerMap[$resource])) {
    require_once __DIR__ . '/controllers/' . $controllerMap[$resource] . '.php';
}

// ─── FALLBACK ─────────────────────────────────────────────────────────────────
respond(404, ['error' => 'Rota não encontrada', 'path' => $uri]);
