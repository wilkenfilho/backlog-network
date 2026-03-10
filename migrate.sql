-- ─── Migration: tabelas novas e índices de performance ───────────────────────
-- Compatível com MySQL 5.7+
-- Todas as operações são idempotentes (seguro rodar mais de uma vez).

-- ─── fans ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fans (
    id          VARCHAR(36) PRIMARY KEY,
    user_id     VARCHAR(36) NOT NULL COMMENT 'dono do perfil (quem tem o fã)',
    fan_id      VARCHAR(36) NOT NULL COMMENT 'quem é fã',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY  uniq_fan (user_id, fan_id),
    INDEX       idx_user  (user_id),
    INDEX       idx_fan   (fan_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (fan_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── scraps ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraps (
    id          VARCHAR(36) PRIMARY KEY,
    profile_id  VARCHAR(36) NOT NULL COMMENT 'dono do perfil onde o scrap foi escrito',
    author_id   VARCHAR(36) NOT NULL COMMENT 'quem escreveu',
    body        TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX       idx_profile (profile_id),
    INDEX       idx_author  (author_id),
    FOREIGN KEY (profile_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── comment_likes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comment_likes (
    id          VARCHAR(36) PRIMARY KEY,
    user_id     VARCHAR(36) NOT NULL,
    comment_id  VARCHAR(36) NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY  uniq_like (user_id, comment_id),
    INDEX       idx_comment (comment_id),
    FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── likes_count em comments ──────────────────────────────────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'comments'
      AND COLUMN_NAME  = 'likes_count'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE comments ADD COLUMN likes_count INT DEFAULT 0',
    'SELECT ''likes_count já existe em comments, pulando'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── is_removed em topic_replies (soft delete) ────────────────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'topic_replies'
      AND COLUMN_NAME  = 'is_removed'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE topic_replies ADD COLUMN is_removed TINYINT(1) DEFAULT 0',
    'SELECT ''is_removed já existe em topic_replies, pulando'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── Índices de performance ───────────────────────────────────────────────────

-- notifications(user_id, is_read)
SET @idx_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'notifications'
      AND INDEX_NAME   = 'idx_user_read'
);
SET @cols_exist = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'notifications'
      AND COLUMN_NAME IN ('user_id', 'is_read')
);
SET @sql = IF(@idx_exists = 0 AND @cols_exist = 2,
    'ALTER TABLE notifications ADD INDEX idx_user_read (user_id, is_read)',
    'SELECT ''idx_user_read: pulando (índice já existe ou colunas ausentes)'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- messages(sender_id, receiver_id, created_at)
SET @idx_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'messages'
      AND INDEX_NAME   = 'idx_conv_created'
);
SET @cols_exist = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'messages'
      AND COLUMN_NAME IN ('sender_id', 'receiver_id', 'created_at')
);
-- Só adiciona se o índice não existe E as 3 colunas existem
SET @sql = IF(@idx_exists = 0 AND @cols_exist = 3,
    'ALTER TABLE messages ADD INDEX idx_conv_created (sender_id, receiver_id, created_at)',
    'SELECT ''idx_conv_created: pulando (índice já existe ou colunas ausentes)'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- topics(community_id, last_reply_at)
SET @idx_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'topics'
      AND INDEX_NAME   = 'idx_community_last'
);
SET @cols_exist = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'topics'
      AND COLUMN_NAME IN ('community_id', 'last_reply_at')
);
SET @sql = IF(@idx_exists = 0 AND @cols_exist = 2,
    'ALTER TABLE topics ADD INDEX idx_community_last (community_id, last_reply_at)',
    'SELECT ''idx_community_last: pulando (índice já existe ou colunas ausentes)'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
