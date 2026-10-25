-- Database initialization script for Tactical Rock-Paper-Scissors Arena
-- Automatically executed on postgres container creation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: Users
CREATE TABLE IF NOT EXISTS "Users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "username" VARCHAR(50) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'STUDENT', -- 'STUDENT', 'TEACHER', 'ADMIN'
    "elo_rating" INT NOT NULL DEFAULT 1200,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: Bots
CREATE TABLE IF NOT EXISTS "Bots" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "name" VARCHAR(100) NOT NULL,
    "source_type" VARCHAR(20) NOT NULL DEFAULT 'file', -- 'file', 'git'
    "file_path_or_git_url" TEXT NOT NULL,
    "source_code" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'compiling', 'error'
    "error_count" INT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: Maps
CREATE TABLE IF NOT EXISTS "Maps" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "size" VARCHAR(10) NOT NULL DEFAULT '8x8', -- '8x8', '9x9'
    "difficulty" VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'easy', 'medium', 'hard', 'random'
    "grid_layout_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: Tournaments
CREATE TABLE IF NOT EXISTS "Tournaments" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR(150) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'UPCOMING', -- 'UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'
    "max_participants" INT NOT NULL DEFAULT 1000,
    "scheduled_start_at" TIMESTAMP WITH TIME ZONE,
    "brackets_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "settings_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table: Matches
CREATE TABLE IF NOT EXISTS "Matches" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tournament_id" UUID REFERENCES "Tournaments"("id") ON DELETE SET NULL,
    "player1_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "player2_id" UUID NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "player1_bot_id" UUID REFERENCES "Bots"("id") ON DELETE SET NULL,
    "player2_bot_id" UUID REFERENCES "Bots"("id") ON DELETE SET NULL,
    "map_id" UUID NOT NULL REFERENCES "Maps"("id") ON DELETE RESTRICT,
    "winner_id" UUID REFERENCES "Users"("id") ON DELETE SET NULL,
    "win_reason" VARCHAR(50), -- 'CHECKMATE', 'TIMEOUT', 'INVALID_MOVE', 'INFINITE_LOOP', 'DRAW', 'SURRENDER'
    "duration_ms" INT NOT NULL DEFAULT 0,
    "p1_elo_change" INT NOT NULL DEFAULT 0,
    "p2_elo_change" INT NOT NULL DEFAULT 0,
    "has_infinite_loop_error" BOOLEAN NOT NULL DEFAULT FALSE,
    "replay_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_users_elo ON "Users" ("elo_rating" DESC);
CREATE INDEX IF NOT EXISTS idx_bots_user ON "Bots" ("user_id");
CREATE INDEX IF NOT EXISTS idx_matches_p1 ON "Matches" ("player1_id");
CREATE INDEX IF NOT EXISTS idx_matches_p2 ON "Matches" ("player2_id");
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON "Matches" ("tournament_id");
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON "Tournaments" ("status");

-- Seed default tactical maps
INSERT INTO "Maps" ("name", "size", "difficulty", "grid_layout_json")
VALUES
('Standard Arena 8x8', '8x8', 'medium', '{
    "rows": 8,
    "cols": 8,
    "obstacles": [[3,3], [3,4], [4,3], [4,4]],
    "spawn_p1": [[0,0], [0,1], [0,2], [0,3], [0,4], [0,5], [0,6], [0,7]],
    "spawn_p2": [[7,0], [7,1], [7,2], [7,3], [7,4], [7,5], [7,6], [7,7]]
}'::jsonb),
('Grand Colosseum 9x9', '9x9', 'hard', '{
    "rows": 9,
    "cols": 9,
    "obstacles": [[2,2], [2,6], [4,4], [6,2], [6,6]],
    "spawn_p1": [[0,0], [0,2], [0,4], [0,6], [0,8]],
    "spawn_p2": [[8,0], [8,2], [8,4], [8,6], [8,8]]
}'::jsonb)
ON CONFLICT DO NOTHING;

-- Seed default System Administrator account
-- Username: admin | Password: admin123
INSERT INTO "Users" ("username", "password_hash", "role", "elo_rating")
VALUES (
    'admin',
    '$2a$10$GmlSkZDH4JCae4na6ALEMuKtLO5tFGPdA.RF.YDWPbuVlmsdjFAfe',
    'ADMIN',
    2000
)
ON CONFLICT ("username") DO NOTHING;
