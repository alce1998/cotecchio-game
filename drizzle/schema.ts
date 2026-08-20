import { boolean, int, longtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"),
  avatarUrl: varchar("avatarUrl", { length: 2048 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** A persistent matchmaking room. The complete, authoritative game state is stored as JSON. */
export const gameRooms = mysqlTable("game_rooms", {
  id: varchar("id", { length: 32 }).primaryKey(),
  matchId: varchar("matchId", { length: 32 }),
  ownerUserId: int("ownerUserId").notNull(),
  visibility: mysqlEnum("visibility", ["public", "private"]).default("public").notNull(),
  inviteCode: varchar("inviteCode", { length: 16 }),
  playerCount: int("playerCount").notNull(),
  scoreLimit: int("scoreLimit").notNull(),
  status: mysqlEnum("status", ["waiting", "playing", "finished", "cancelled"]).default("waiting").notNull(),
  gameState: longtext("gameState"),
  turnDeadlineAt: timestamp("turnDeadlineAt"),
  version: int("version").default(1).notNull(),
  readyDeadlineAt: timestamp("readyDeadlineAt"),
  departureUserId: int("departureUserId"),
  departureVotes: longtext("departureVotes"),
  departureOpenedAt: timestamp("departureOpenedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("game_room_invite_code_unique").on(table.inviteCode)]);

/** A seat in a room; user identity determines permission to play that seat. */
export const gameRoomPlayers = mysqlTable("game_room_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("roomId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  seat: int("seat").notNull(),
  ready: boolean("ready").default(false).notNull(),
  pauseUsed: boolean("pauseUsed").default(false).notNull(),
  pausedUntil: timestamp("pausedUntil"),
  leftAt: timestamp("leftAt"),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("game_room_player_unique").on(table.roomId, table.userId),
]);

/** Chat testuale della sala, disponibile solo ai partecipanti attivi. */
export const gameRoomMessages = mysqlTable("game_room_messages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("roomId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  body: varchar("body", { length: 600 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Preferenze di condivisione dichiarate volontariamente da ogni partecipante. */
export const gameRoomMediaStates = mysqlTable("game_room_media_states", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("roomId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  audioEnabled: boolean("audioEnabled").default(false).notNull(),
  videoEnabled: boolean("videoEnabled").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("game_room_media_state_unique").on(table.roomId, table.userId)]);

/** Messaggi temporanei di segnalazione per collegamenti browser-to-browser. */
export const gameRoomWebrtcSignals = mysqlTable("game_room_webrtc_signals", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("roomId", { length: 32 }).notNull(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId").notNull(),
  kind: mysqlEnum("kind", ["offer", "answer", "candidate"]).notNull(),
  payload: longtext("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** One complete online match, retained after its temporary room is no longer active. */
export const gameMatches = mysqlTable("game_matches", {
  id: varchar("id", { length: 32 }).primaryKey(),
  roomId: varchar("roomId", { length: 32 }).notNull(),
  playerCount: int("playerCount").notNull(),
  scoreLimit: int("scoreLimit").notNull(),
  status: mysqlEnum("status", ["playing", "finished", "abandoned"]).default("playing").notNull(),
  finalState: longtext("finalState"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

/** Final score and league reward for a participant in a completed online match. */
export const gameMatchResults = mysqlTable("game_match_results", {
  id: int("id").autoincrement().primaryKey(),
  matchId: varchar("matchId", { length: 32 }).notNull(),
  userId: int("userId").notNull(),
  placement: int("placement").notNull(),
  finalScore: int("finalScore").notNull(),
  leaguePoints: int("leaguePoints").notNull(),
}, (table) => [uniqueIndex("game_match_result_unique").on(table.matchId, table.userId)]);

export type GameRoom = typeof gameRooms.$inferSelect;
export type GameRoomPlayer = typeof gameRoomPlayers.$inferSelect;
export type GameRoomMessage = typeof gameRoomMessages.$inferSelect;
export type GameRoomMediaState = typeof gameRoomMediaStates.$inferSelect;
export type GameMatch = typeof gameMatches.$inferSelect;
export type GameMatchResult = typeof gameMatchResults.$inferSelect;
