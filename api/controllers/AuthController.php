<?php
// AuthController
// Gerado automaticamente — parte de index.php

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
