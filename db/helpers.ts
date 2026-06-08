import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "./index";
import {
  assignments,
  emailEvents,
  highHolidayYears,
  honors,
  members,
  rsvpResponses,
  rsvpResponseServices,
  services,
  type NewAssignment,
  type NewEmailEvent,
  type NewHighHolidayYear,
  type NewHonor,
  type NewMember,
  type NewRsvpResponse,
  type NewService,
} from "./schema";

export function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeEmail(value: string | null | undefined) {
  return normalizeOptionalText(value)?.toLowerCase() ?? null;
}

export function createRsvpToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export async function getMostRecentYear(db: AppDb) {
  const [year] = await db
    .select()
    .from(highHolidayYears)
    .orderBy(desc(highHolidayYears.jewishYear))
    .limit(1);

  return year ?? null;
}

export async function getActiveYear(db: AppDb) {
  const [year] = await db
    .select()
    .from(highHolidayYears)
    .where(eq(highHolidayYears.isActive, true))
    .orderBy(desc(highHolidayYears.jewishYear))
    .limit(1);

  return year ?? null;
}

export async function upsertHighHolidayYear(
  db: AppDb,
  values: NewHighHolidayYear
) {
  const [year] = await db
    .insert(highHolidayYears)
    .values(values)
    .onConflictDoUpdate({
      target: highHolidayYears.jewishYear,
      set: {
        label: values.label,
        isActive: values.isActive ?? false,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();

  return year;
}

export async function upsertService(db: AppDb, values: NewService) {
  const [service] = await db
    .insert(services)
    .values(values)
    .onConflictDoUpdate({
      target: [services.yearId, services.name],
      set: {
        serviceDate: values.serviceDate,
        serviceTime: values.serviceTime ?? null,
        sortOrder: values.sortOrder ?? 0,
      },
    })
    .returning();

  return service;
}

export async function upsertHonor(db: AppDb, values: NewHonor) {
  const [honor] = await db
    .insert(honors)
    .values(values)
    .onConflictDoUpdate({
      target: [
        honors.yearId,
        honors.serviceId,
        honors.honorType,
        honors.prayerName,
        honors.pageNumber,
      ],
      set: {
        estimatedHonorTime: values.estimatedHonorTime ?? null,
        sortOrder: values.sortOrder ?? 0,
      },
    })
    .returning();

  return honor;
}

export async function upsertMember(db: AppDb, values: NewMember) {
  const email = normalizeEmail(values.email);
  const externalMemberId = normalizeOptionalText(values.externalMemberId);

  if (externalMemberId) {
    const [member] = await db
      .insert(members)
      .values({ ...values, email, externalMemberId })
      .onConflictDoUpdate({
        target: members.externalMemberId,
        set: {
          name: values.name,
          email,
          phone: normalizeOptionalText(values.phone),
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    return member;
  }

  if (email) {
    const [existing] = await db
      .select()
      .from(members)
      .where(eq(members.email, email))
      .limit(1);

    if (existing) {
      const [member] = await db
        .update(members)
        .set({
          name: values.name,
          phone: normalizeOptionalText(values.phone),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(members.id, existing.id))
        .returning();

      return member;
    }
  }

  const [member] = await db
    .insert(members)
    .values({
      ...values,
      email,
      phone: normalizeOptionalText(values.phone),
      externalMemberId: null,
    })
    .returning();

  return member;
}

export async function createAssignment(
  db: AppDb,
  values: Omit<NewAssignment, "rsvpToken">
) {
  const [assignment] = await db
    .insert(assignments)
    .values({ ...values, rsvpToken: createRsvpToken() })
    .onConflictDoNothing({
      target: [assignments.yearId, assignments.honorId, assignments.memberId],
    })
    .returning();

  if (assignment) {
    return assignment;
  }

  const [existing] = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.yearId, values.yearId),
        eq(assignments.honorId, values.honorId),
        eq(assignments.memberId, values.memberId)
      )
    )
    .limit(1);

  return existing ?? null;
}

export async function findAssignmentByToken(db: AppDb, token: string) {
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.rsvpToken, token))
    .limit(1);

  return assignment ?? null;
}

export async function recordEmailEvent(db: AppDb, values: NewEmailEvent) {
  const [event] = await db.insert(emailEvents).values(values).returning();
  return event;
}

export async function recordRsvpResponse(
  db: AppDb,
  response: NewRsvpResponse,
  attendedServiceIds: number[] = []
) {
  const [savedResponse] = await db
    .insert(rsvpResponses)
    .values(response)
    .onConflictDoNothing({ target: rsvpResponses.assignmentId })
    .returning();

  if (!savedResponse) {
    return null;
  }

  if (attendedServiceIds.length > 0) {
    await db.insert(rsvpResponseServices).values(
      attendedServiceIds.map((serviceId) => ({
        responseId: savedResponse.id,
        serviceId,
      }))
    );
  }

  await db
    .update(assignments)
    .set({
      responseStatus: response.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(assignments.id, response.assignmentId));

  return savedResponse;
}
