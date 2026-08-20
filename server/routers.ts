import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { closeOnlineInHand, createPrivateRoom, joinMatchmaking, joinPrivateByCode, leaveOnlineRoom, nextOnlineDeal, playOnlineCard, postRoomChat, resumeOnlinePause, roomChat, roomMediaStates, sendWebrtcSignal, setProfileAvatar, setReady, setRoomMediaState, snapshot, useOnlinePause, voteAfterDeparture, webRtcSignals } from "./matchmaking";
import { getSeasonLeaderboard } from "./season";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { getUserByEmail, getUserByOpenId, upsertUser } from "./db";

import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = "cotecchio_salt_2026";
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    registerEmail: publicProcedure
      .input(z.object({ email: z.string().email(), nickname: z.string().min(2).max(30), password: z.string().min(6) }))
      .mutation(async ({ ctx, input }) => {
        const cleanEmail = input.email.toLowerCase().trim();
        const existing = await getUserByEmail(cleanEmail);
        if (existing) {
          throw new Error("Un account con questa email esiste già. Accedi con le tue credenziali.");
        }
        const nickname = input.nickname.trim();
        const passwordHash = hashPassword(input.password);
        const openId = `email_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;

        await upsertUser({
          openId,
          name: nickname,
          email: cleanEmail,
          loginMethod: "email",
          passwordHash,
          lastSignedIn: new Date(),
        });

        const token = await sdk.createSessionToken(openId, { name: nickname });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        const user = await getUserByOpenId(openId);
        return { success: true, user };
      }),
    loginEmail: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const cleanEmail = input.email.toLowerCase().trim();
        const user = await getUserByEmail(cleanEmail);
        if (!user || user.passwordHash !== hashPassword(input.password)) {
          throw new Error("Email o password errati.");
        }
        const token = await sdk.createSessionToken(user.openId, { name: user.name });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, user };
      }),
    loginGoogle: publicProcedure
      .input(z.object({ credential: z.string().min(1), nickname: z.string().min(1).max(50).optional() }))
      .mutation(async ({ ctx, input }) => {
        const parts = input.credential.split(".");
        if (parts.length !== 3) {
          throw new Error("Token Google non valido");
        }
        const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
        const payload = JSON.parse(payloadJson);
        const googleSub = payload.sub || `g_${Date.now()}`;
        const email = payload.email || `${googleSub}@google.com`;
        const googleDefaultName = payload.name || payload.given_name || "Giocatore Google";
        const name = (input.nickname?.trim() || googleDefaultName).replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ_\s]/g, "") || "Giocatore";
        const openId = `google_${googleSub}`;

        await upsertUser({
          openId,
          name,
          email,
          loginMethod: "google",
          lastSignedIn: new Date(),
        });

        const token = await sdk.createSessionToken(openId, { name });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        const user = await getUserByOpenId(openId);
        return { success: true, user };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  profile: router({
    setAvatar: protectedProcedure.input(z.object({ avatarUrl: z.string().max(2048) })).mutation(({ ctx, input }) => setProfileAvatar(ctx.user.id, input.avatarUrl)),
  }),
  match: router({
    join: protectedProcedure.input(z.object({ scoreLimit: z.number().int().min(50).max(150) })).mutation(({ ctx, input }) => joinMatchmaking(ctx.user.id, input.scoreLimit)),
    createPrivate: protectedProcedure.input(z.object({ scoreLimit: z.number().int().min(50).max(150) })).mutation(({ ctx, input }) => createPrivateRoom(ctx.user.id, input.scoreLimit)),
    joinPrivate: protectedProcedure.input(z.object({ inviteCode: z.string().min(1).max(24) })).mutation(({ ctx, input }) => joinPrivateByCode(ctx.user.id, input.inviteCode)),
    snapshot: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).query(({ ctx, input }) => snapshot(input.roomId, ctx.user.id)),
    ready: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).mutation(({ ctx, input }) => setReady(input.roomId, ctx.user.id)),
    playCard: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32), cardId: z.string().min(1).max(32) })).mutation(({ ctx, input }) => playOnlineCard(input.roomId, ctx.user.id, input.cardId)),
    closeInHand: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).mutation(({ ctx, input }) => closeOnlineInHand(input.roomId, ctx.user.id)),
    pause: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).mutation(({ ctx, input }) => useOnlinePause(input.roomId, ctx.user.id)),
    resume: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).mutation(({ ctx, input }) => resumeOnlinePause(input.roomId, ctx.user.id)),
    leave: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).mutation(({ ctx, input }) => leaveOnlineRoom(input.roomId, ctx.user.id)),
    voteDeparture: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32), vote: z.enum(["continue", "end"]) })).mutation(({ ctx, input }) => voteAfterDeparture(input.roomId, ctx.user.id, input.vote)),
    nextDeal: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).mutation(({ ctx, input }) => nextOnlineDeal(input.roomId, ctx.user.id)),
    chat: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).query(({ ctx, input }) => roomChat(input.roomId, ctx.user.id)),
    sendChat: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32), body: z.string().min(1).max(600) })).mutation(({ ctx, input }) => postRoomChat(input.roomId, ctx.user.id, input.body)),
    media: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32) })).query(({ ctx, input }) => roomMediaStates(input.roomId, ctx.user.id)),
    setMedia: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32), audioEnabled: z.boolean(), videoEnabled: z.boolean() })).mutation(({ ctx, input }) => setRoomMediaState(input.roomId, ctx.user.id, input.audioEnabled, input.videoEnabled)),
    signal: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32), toUserId: z.number().int().positive(), kind: z.enum(["offer", "answer", "candidate"]), payload: z.string().min(1).max(20_000) })).mutation(({ ctx, input }) => sendWebrtcSignal(input.roomId, ctx.user.id, input.toUserId, input.kind, input.payload)),
    signals: protectedProcedure.input(z.object({ roomId: z.string().min(1).max(32), afterId: z.number().int().nonnegative().optional() })).query(({ ctx, input }) => webRtcSignals(input.roomId, ctx.user.id, input.afterId)),
  }),
  leaderboard: router({
    current: publicProcedure.query(() => getSeasonLeaderboard()),
  }),
});

export type AppRouter = typeof appRouter;
