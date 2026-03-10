<?php
// CommentsController
// Gerado automaticamente — parte de index.php

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
