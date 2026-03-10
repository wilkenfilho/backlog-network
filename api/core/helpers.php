<?php
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

function paginate(): array {
    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(50, max(1, (int)($_GET['limit'] ?? 20)));
    return ['page' => $page, 'limit' => $limit, 'offset' => ($page - 1) * $limit];
}

// Defensivo: usa ?? para colunas que podem não existir na tabela users
function user_public(array $u): array {
    return [
        'id'           => $u['id']               ?? null,
        'username'     => $u['username']          ?? null,
        'display_name' => $u['display_name']      ?? null,
        'avatar_url'   => $u['avatar_url']        ?? null,
        'bio'          => $u['bio']               ?? null,
        'level'        => (int)($u['level']       ?? 0),
        'xp'           => (int)($u['xp']          ?? 0),
        'is_premium'   => (bool)($u['is_premium'] ?? false),
        'created_at'   => $u['created_at']        ?? null,
    ];
}
