// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { getUser, requireRole } from '../utils/auth.js';
import {
  DAY_IN_REQUIRED,
  businessDateForNow,
  closingDateStorageKey,
  expectedCashAtDayOut,
  findOpenShift,
  lastClosedShiftCarry,
  needsDayOutReminder,
  resolveUserByDayPin,
  serializeShift,
  sumMovementTotals,
  tallyShiftDaySales,
  ymdInStoreTz,
} from '../services/shiftService.js';

const dayPinSchema = z.string().regex(/^\d{4,8}$/, 'Day PIN must be 4–8 digits');

const dayInSchema = z.object({
  dayPin: dayPinSchema,
  pettyCash: z.number().min(0),
  notes: z.string().optional(),
});

const dayOutSchema = z.object({
  dayPin: dayPinSchema,
  cashTakenHome: z.number().min(0),
  pettyCashCarryForward: z.number().min(0),
  closingCash: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const movementSchema = z.object({
  dayPin: dayPinSchema,
  type: z.enum(['IN', 'OUT']),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
});

const overrideSchema = z.object({
  reason: z.string().min(3).max(500),
  pettyCash: z.number().min(0).optional(),
});

function dayPinFailure(reply: FastifyReply, reason: string | null) {
  if (reason === 'NO_DAY_PIN_CONFIGURED') {
    reply.code(400).send({
      error:
        'No Day PIN is set for any staff. Go to Settings → Staff and set a Day In/Out PIN first.',
      code: 'NO_DAY_PIN_CONFIGURED',
    });
    return;
  }
  if (reason === 'INVALID_FORMAT') {
    reply.code(400).send({ error: 'Day PIN must be 4–8 digits', code: 'INVALID_DAY_PIN' });
    return;
  }
  reply.code(401).send({ error: 'Invalid Day PIN', code: 'INVALID_DAY_PIN' });
}

export async function shiftRoutes(fastify: FastifyInstance) {
  // Current day session status
  fastify.get(
    '/current',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER', 'DRIVER')] },
    async (request: any, reply: FastifyReply) => {
      const { storeId, role } = getUser(request) as any;
      const open = await findOpenShift(storeId);
      const suggestedCarry = await lastClosedShiftCarry(storeId);

      let daySummary = null;
      if (open) {
        const ymd = open.businessDate
          ? ymdInStoreTz(new Date(open.businessDate))
          : ymdInStoreTz(new Date(open.openedAt));
        const tally = await tallyShiftDaySales(storeId, ymd);
        const { cashIn, cashOut } = sumMovementTotals(open.cashMovements || []);
        const expectedCash = expectedCashAtDayOut(
          open.openingCash || 0,
          tally.cashSales || 0,
          cashIn,
          cashOut
        );
        daySummary = {
          businessYmd: ymd,
          totalSales: tally.totalSales,
          totalRevenue: tally.totalRevenue,
          cashSales: tally.cashSales,
          cardSales: tally.cardSales,
          upiSales: tally.upiSales,
          creditSales: tally.creditSales ?? 0,
          expectedCash,
          cashInTotal: cashIn,
          cashOutTotal: cashOut,
        };
      }

      // Stuck open from a previous calendar day → owner may override
      const todayYmd = ymdInStoreTz();
      let stuckOpen = false;
      if (open) {
        const openYmd = open.businessDate
          ? ymdInStoreTz(new Date(open.businessDate))
          : ymdInStoreTz(new Date(open.openedAt));
        stuckOpen = openYmd < todayYmd;
      }

      return {
        open: !!open,
        shift: open ? serializeShift(open) : null,
        suggestedCarry,
        daySummary,
        needsDayOutReminder: needsDayOutReminder(!!open),
        canOverride: role === 'OWNER' && (!open || stuckOpen),
        stuckOpen,
        code: open ? undefined : DAY_IN_REQUIRED,
      };
    }
  );

  // Day In
  fastify.post(
    '/day-in',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER', 'DRIVER')] },
    async (request: any, reply: FastifyReply) => {
      const { storeId } = getUser(request) as any;
      const data = dayInSchema.parse(request.body);

      const existing = await findOpenShift(storeId);
      if (existing) {
        reply.code(400).send({ error: 'Day already open. Complete Day Out first.', code: 'DAY_ALREADY_OPEN' });
        return;
      }

      const { user: pinUser, reason } = await resolveUserByDayPin(storeId, data.dayPin);
      if (!pinUser) {
        dayPinFailure(reply, reason);
        return;
      }

      const businessDate = businessDateForNow();
      const shift = await prisma.shift.create({
        data: {
          storeId,
          openedByUserId: pinUser.id,
          openingCash: data.pettyCash,
          notes: data.notes || null,
          businessDate,
        },
        include: {
          openedBy: { select: { id: true, name: true, role: true } },
          cashMovements: true,
        },
      });

      return {
        ok: true,
        shift: serializeShift(shift),
        openedBy: pinUser,
      };
    }
  );

  // Mid-day cash movement
  fastify.post(
    '/movements',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER', 'DRIVER')] },
    async (request: any, reply: FastifyReply) => {
      const { storeId } = getUser(request) as any;
      const data = movementSchema.parse(request.body);

      const open = await findOpenShift(storeId);
      if (!open) {
        reply.code(403).send({ error: 'Day In required', code: DAY_IN_REQUIRED });
        return;
      }

      const { user: pinUser, reason } = await resolveUserByDayPin(storeId, data.dayPin);
      if (!pinUser) {
        dayPinFailure(reply, reason);
        return;
      }

      const movement = await prisma.cashMovement.create({
        data: {
          storeId,
          shiftId: open.id,
          type: data.type,
          amount: data.amount,
          reason: data.reason.trim(),
          createdByUserId: pinUser.id,
        },
        include: { createdBy: { select: { id: true, name: true } } },
      });

      return {
        ok: true,
        movement: {
          id: movement.id,
          type: movement.type,
          amount: movement.amount,
          reason: movement.reason,
          createdAt: movement.createdAt,
          createdBy: movement.createdBy,
        },
      };
    }
  );

  // Day Out — closes shift + finalizes DailyClosing
  fastify.post(
    '/day-out',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER', 'DRIVER')] },
    async (request: any, reply: FastifyReply) => {
      const { storeId } = getUser(request) as any;
      const data = dayOutSchema.parse(request.body);

      const open = await findOpenShift(storeId);
      if (!open) {
        reply.code(400).send({ error: 'No open day to close', code: 'NO_OPEN_DAY' });
        return;
      }

      const { user: pinUser, reason } = await resolveUserByDayPin(storeId, data.dayPin);
      if (!pinUser) {
        dayPinFailure(reply, reason);
        return;
      }

      const ymd = open.businessDate
        ? ymdInStoreTz(new Date(open.businessDate))
        : ymdInStoreTz(new Date(open.openedAt));
      const closingDateObj = closingDateStorageKey(ymd);
      const tally = await tallyShiftDaySales(storeId, ymd);
      const { cashIn, cashOut } = sumMovementTotals(open.cashMovements || []);
      const cashExpected = expectedCashAtDayOut(
        open.openingCash || 0,
        tally.cashSales || 0,
        cashIn,
        cashOut
      );
      const closingCash =
        data.closingCash !== undefined
          ? data.closingCash
          : Math.round((data.cashTakenHome + data.pettyCashCarryForward) * 1000) / 1000;
      const cashDifference = Math.round((closingCash - cashExpected) * 1000) / 1000;
      const cashReceived = tally.cashSales || 0;

      const now = new Date();

      const result = await prisma.$transaction(async (tx) => {
        const closingPayload = {
          shiftId: open.id,
          closedBy: pinUser.id,
          openingCash: open.openingCash || 0,
          cashSales: tally.cashSales || 0,
          cardSales: tally.cardSales || 0,
          upiSales: tally.upiSales || 0,
          cashReceived,
          cashExpected,
          cashDifference,
          closingCash,
          cashTakenHome: data.cashTakenHome,
          pettyCashCarryForward: data.pettyCashCarryForward,
          cashInTotal: cashIn,
          cashOutTotal: cashOut,
          totalWeightSoldKg: tally.totalWeightSoldKg,
          totalWastageKg: tally.totalWastageKg,
          totalSales: tally.totalSales,
          totalRevenue: tally.totalRevenue,
          totalDiscounts: tally.totalDiscounts,
          totalTax: tally.totalTax,
          notes: data.notes || null,
          isFinalized: true,
          finalizedAt: now,
        };

        const existing = await tx.dailyClosing.findUnique({
          where: {
            storeId_closingDate: { storeId, closingDate: closingDateObj },
          },
        });

        let dailyClosing;
        if (existing) {
          // Day Out is the source of truth: replace any prior closing for this store day
          // (manual Daily Closing, cron draft, or another shift) while this shift is open.
          const replaceNote =
            existing.isFinalized && existing.shiftId && existing.shiftId !== open.id
              ? '[Day Out updated closing for this date]'
              : null;
          const mergedNotes = [replaceNote, data.notes || existing.notes || null]
            .filter(Boolean)
            .join('\n');
          dailyClosing = await tx.dailyClosing.update({
            where: { id: existing.id },
            data: {
              ...closingPayload,
              notes: mergedNotes || null,
            },
          });
        } else {
          dailyClosing = await tx.dailyClosing.create({
            data: {
              storeId,
              closingDate: closingDateObj,
              ...closingPayload,
            },
          });
        }

        const shift = await tx.shift.update({
          where: { id: open.id },
          data: {
            closedAt: now,
            closedByUserId: pinUser.id,
            closingCash,
            cashTakenHome: data.cashTakenHome,
            pettyCashCarryForward: data.pettyCashCarryForward,
            notes: data.notes || open.notes,
          },
          include: {
            openedBy: { select: { id: true, name: true, role: true } },
            closedBy: { select: { id: true, name: true, role: true } },
            cashMovements: {
              include: { createdBy: { select: { id: true, name: true } } },
            },
          },
        });

        return { shift, dailyClosing };
      });

      return {
        ok: true,
        shift: serializeShift(result.shift),
        dailyClosing: result.dailyClosing,
        closedBy: pinUser,
        expectedCash: cashExpected,
        cashDifference,
      };
    }
  );

  // History
  fastify.get(
    '/history',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER', 'DRIVER')] },
    async (request: any) => {
      const { storeId } = getUser(request) as any;
      const q = request.query as any;
      const take = Math.min(Number(q.limit) || 30, 100);
      const skip = Math.max(Number(q.offset) || 0, 0);

      const shifts = await prisma.shift.findMany({
        where: { storeId },
        orderBy: { openedAt: 'desc' },
        take,
        skip,
        include: {
          openedBy: { select: { id: true, name: true, role: true } },
          closedBy: { select: { id: true, name: true, role: true } },
          cashMovements: { select: { type: true, amount: true } },
          dailyClosings: {
            select: {
              id: true,
              cashExpected: true,
              cashDifference: true,
              totalRevenue: true,
              totalSales: true,
              isFinalized: true,
            },
          },
        },
      });

      return {
        items: shifts.map((s) => {
          const { cashIn, cashOut } = sumMovementTotals(s.cashMovements);
          const closing = s.dailyClosings?.[0];
          return {
            id: s.id,
            businessDate: s.businessDate,
            openedAt: s.openedAt,
            closedAt: s.closedAt,
            openingCash: s.openingCash,
            closingCash: s.closingCash,
            cashTakenHome: s.cashTakenHome,
            pettyCashCarryForward: s.pettyCashCarryForward,
            overrideReason: s.overrideReason,
            openedBy: s.openedBy,
            closedBy: s.closedBy,
            cashInTotal: cashIn,
            cashOutTotal: cashOut,
            cashExpected: closing?.cashExpected ?? null,
            cashDifference: closing?.cashDifference ?? null,
            totalRevenue: closing?.totalRevenue ?? null,
            totalSales: closing?.totalSales ?? null,
            isFinalized: closing?.isFinalized ?? false,
          };
        }),
      };
    }
  );

  // Owner override — force-close stuck open day and open a new one
  fastify.post(
    '/override-open',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      const { storeId, userId } = getUser(request) as any;
      const data = overrideSchema.parse(request.body);

      const open = await findOpenShift(storeId);
      const suggested = await lastClosedShiftCarry(storeId);
      const pettyCash =
        data.pettyCash !== undefined ? data.pettyCash : open ? open.openingCash : suggested;
      const now = new Date();
      const businessDate = businessDateForNow();

      const result = await prisma.$transaction(async (tx) => {
        if (open) {
          await tx.shift.update({
            where: { id: open.id },
            data: {
              closedAt: now,
              closedByUserId: userId,
              notes: [
                open.notes,
                `[OVERRIDE closed] ${data.reason.trim()}`,
              ]
                .filter(Boolean)
                .join('\n'),
              closingCash: open.closingCash ?? open.openingCash,
              cashTakenHome: open.cashTakenHome ?? 0,
              pettyCashCarryForward: open.pettyCashCarryForward ?? 0,
            },
          });
        }

        const shift = await tx.shift.create({
          data: {
            storeId,
            openedByUserId: userId,
            openingCash: pettyCash,
            overrideReason: data.reason.trim(),
            notes: `Opened via owner override: ${data.reason.trim()}`,
            businessDate,
          },
          include: {
            openedBy: { select: { id: true, name: true, role: true } },
            cashMovements: true,
          },
        });

        return shift;
      });

      return {
        ok: true,
        shift: serializeShift(result),
        forcedClosedPrevious: !!open,
      };
    }
  );
}
