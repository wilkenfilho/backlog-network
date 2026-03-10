<?php
// SetupController
// Gerado automaticamente — parte de index.php

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
