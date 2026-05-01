-- ============================================================
-- setup.sql — Run this once in phpMyAdmin to create the tables
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255)    NOT NULL,
    password_hash VARCHAR(255)    NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS diagrams (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id       INT UNSIGNED    NOT NULL,
    diagram_id    VARCHAR(100)    NOT NULL,
    name          VARCHAR(255)    NOT NULL DEFAULT 'Untitled Diagram',
    diagram_type  VARCHAR(50)     NOT NULL DEFAULT 'class',
    language      VARCHAR(50)     NOT NULL DEFAULT 'Java',
    elements      MEDIUMTEXT      NOT NULL,
    connections   MEDIUMTEXT      NOT NULL,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_diagrams_user_diagram (user_id, diagram_id),
    CONSTRAINT fk_diagrams_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
