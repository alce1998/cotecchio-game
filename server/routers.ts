import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { closeOnlineInHand, createPrivateRoom, joinMatchmaking, joinPrivateByCode, leaveOnlineRoom, nextOnlineDeal, playOnlineCard, postRoomChat, resumeOnlinePause, roomChat, roomMediaStates, sendWebrtcSignal, setProfileAvatar, setReady, setRoomMediaState, snapshot, useOnlinePause, voteAfterDeparture, webRtcSignals } from "./matchmaking";
import { getSeasonLeaderboard } from "./season";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
