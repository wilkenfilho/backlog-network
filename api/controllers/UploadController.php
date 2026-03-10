<?php
// UploadController
// Gerado automaticamente — parte de index.php

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
