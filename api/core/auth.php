<?php
function jwt_create(string $userId): string {
    $b64 = fn($v) => rtrim(strtr(base64_encode(json_encode($v)), '+/', '-_'), '=');
    $header  = $b64(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload = $b64([
        'sub' => $userId,
        'iat' => time(),
        'exp' => time() + (JWT_EXPIRES_HOURS * 3600),
    ]);
    $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)), '+/', '-_'), '=');
    return "$header.$payload.$sig";
}

function jwt_verify(string $token): ?string {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    // Usa base64url (sem padding) igual ao jwt_create
    $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)), '+/', '-_'), '=');
    if (!hash_equals($expected, $sig)) return null;
    $decoded = base64_decode(strtr($payload, '-_', '+/'));
    $data = json_decode($decoded, true);
    if (!$data || !isset($data['exp'], $data['sub'])) return null;
    if ($data['exp'] < time()) return null;
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
