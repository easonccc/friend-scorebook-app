-- schema.sql - 数据库表结构（DB-first，由 Spring Boot 启动时执行）
--
-- 设计说明（给后端新手）：
-- 1. 这 4 张表对应原微信云开发的 4 个集合，字段名尽量保持一致，方便平滑迁移。
-- 2. 主键策略：
--      users / user_settings 用 openid 当主键（原云开发 _id = openid，天然唯一）；
--      spaces / match_records 用数据库自增 BIGINT（原云开发自动生成的 _id 不用了）。
-- 3. members / custom_types 这种「数组」字段，MySQL 用 JSON 类型存，
--    由后端 JsonStringListConverter 在 List<String> 和 JSON 文本之间自动转换。
-- 4. created_at / updated_at 由后端在写入/更新时填充，前端不传。
-- 5. 字符集统一 utf8mb4（支持 emoji，比如头像 emoji、比赛类型 emoji）。

SET NAMES utf8mb4;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  openid      VARCHAR(64)  NOT NULL,
  nickname    VARCHAR(32)  DEFAULT '',
  avatar      VARCHAR(32)  DEFAULT 'avatar_01',
  role        VARCHAR(16)  NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  created_at  DATETIME     DEFAULT NULL,
  updated_at  DATETIME     DEFAULT NULL,
  PRIMARY KEY (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 比赛空间（一个空间 = 我 + 一个朋友）
CREATE TABLE IF NOT EXISTS spaces (
  id             BIGINT       NOT NULL AUTO_INCREMENT,
  name           VARCHAR(64)  DEFAULT '我们的空间',
  invite_code    VARCHAR(6)   NOT NULL,                 -- 6 位邀请码，服务端生成且唯一
  creator_openid VARCHAR(64)  DEFAULT '',
  player_a_name  VARCHAR(32)  DEFAULT '我',            -- A 方（创建者）
  player_b_name  VARCHAR(32)  DEFAULT '小晗子',         -- B 方（朋友）
  members        JSON         DEFAULT NULL,             -- openid 数组，决定谁能读写本空间
  created_at     DATETIME     DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_invite_code (invite_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 比赛记录
CREATE TABLE IF NOT EXISTS match_records (
  id             BIGINT       NOT NULL AUTO_INCREMENT,
  space_id       BIGINT       DEFAULT NULL,             -- 关联 spaces.id
  type           VARCHAR(32)  DEFAULT '台球',
  time           BIGINT       DEFAULT NULL,             -- 比赛时间，epoch 毫秒（与原前端一致）
  loc            VARCHAR(128) DEFAULT '',
  duration       INT          DEFAULT 0,                -- 时长（分钟）
  a              INT          DEFAULT 0,                -- A 方得分
  b              INT          DEFAULT 0,                -- B 方得分
  winner         VARCHAR(16)  DEFAULT 'draw',           -- 'me' | 'friend' | 'draw'
  creator_openid VARCHAR(64)  DEFAULT '',
  created_at     DATETIME     DEFAULT NULL,
  updated_at     DATETIME     DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_records_space (space_id),
  KEY idx_records_space_time (space_id, time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 用户设置（一人一条，openid 当主键）
CREATE TABLE IF NOT EXISTS user_settings (
  openid          VARCHAR(64)  NOT NULL,
  default_type    VARCHAR(32)  DEFAULT '台球',          -- 默认比赛类型
  default_space_id VARCHAR(64) DEFAULT '',              -- 默认进入的空间 id
  custom_types    JSON         DEFAULT NULL,             -- 我的自定义比赛类型（字符串数组）
  updated_at      DATETIME     DEFAULT NULL,
  PRIMARY KEY (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
