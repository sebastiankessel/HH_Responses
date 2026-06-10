import { and, asc, desc, eq, isNull } from "drizzle-orm";
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

export function normalizeHonorKeyText(value: string | null | undefined) {
  return value?.trim() ?? "";
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

export async function listHighHolidayYears(db: AppDb) {
  return db
    .select()
    .from(highHolidayYears)
    .orderBy(desc(highHolidayYears.jewishYear));
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

export async function getHighHolidayYearById(db: AppDb, id: number) {
  const [year] = await db
    .select()
    .from(highHolidayYears)
    .where(eq(highHolidayYears.id, id))
    .limit(1);

  return year ?? null;
}

export async function getHighHolidayYearByJewishYear(
  db: AppDb,
  jewishYear: number
) {
  const [year] = await db
    .select()
    .from(highHolidayYears)
    .where(eq(highHolidayYears.jewishYear, jewishYear))
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

export async function listServicesForYear(db: AppDb, yearId: number) {
  return db
    .select()
    .from(services)
    .where(eq(services.yearId, yearId))
    .orderBy(asc(services.serviceDate), asc(services.serviceTime), asc(services.name));
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

export async function listHonorsForYear(db: AppDb, yearId: number) {
  return db
    .select({
      id: honors.id,
      yearId: honors.yearId,
      serviceId: honors.serviceId,
      honorType: honors.honorType,
      prayerName: honors.prayerName,
      pageNumber: honors.pageNumber,
      estimatedHonorTime: honors.estimatedHonorTime,
      serviceName: services.name,
      serviceDate: services.serviceDate,
      serviceTime: services.serviceTime,
    })
    .from(honors)
    .innerJoin(services, eq(honors.serviceId, services.id))
    .where(eq(honors.yearId, yearId))
    .orderBy(
      asc(services.serviceDate),
      asc(services.serviceTime),
      asc(honors.honorType)
    );
}

export async function upsertHonor(db: AppDb, values: NewHonor) {
  const insertValues = {
    ...values,
    prayerName: normalizeHonorKeyText(values.prayerName),
    pageNumber: normalizeHonorKeyText(values.pageNumber),
  };

  const [honor] = await db
    .insert(honors)
    .values(insertValues)
    .onConflictDoUpdate({
      target: [
        honors.yearId,
        honors.serviceId,
        honors.honorType,
        honors.prayerName,
        honors.pageNumber,
      ],
      set: {
        estimatedHonorTime: insertValues.estimatedHonorTime ?? null,
      },
    })
    .returning();

  return honor;
}

export async function upsertMember(db: AppDb, values: NewMember) {
  const email = normalizeEmail(values.email);
  const phone = normalizeOptionalText(values.phone);
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
          phone,
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
          phone,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(members.id, existing.id))
        .returning();

      return member;
    }
  }

  const noEmailConditions = [
    eq(members.name, values.name),
    isNull(members.email),
    isNull(members.externalMemberId),
  ];

  if (phone) {
    noEmailConditions.push(eq(members.phone, phone));
  } else {
    noEmailConditions.push(isNull(members.phone));
  }

  const [existingWithoutEmail] = await db
    .select()
    .from(members)
    .where(and(...noEmailConditions))
    .limit(1);

  if (existingWithoutEmail) {
    const [member] = await db
      .update(members)
      .set({
        name: values.name,
        phone,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(members.id, existingWithoutEmail.id))
      .returning();

    return member;
  }

  const [member] = await db
    .insert(members)
    .values({
      ...values,
      email,
      phone,
      externalMemberId: null,
    })
    .returning();

  return member;
}

export async function upsertAssignment(
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
    return { assignment, created: true };
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

  return existing ? { assignment: existing, created: false } : null;
}

export async function createAssignment(
  db: AppDb,
  values: Omit<NewAssignment, "rsvpToken">
) {
  const result = await upsertAssignment(db, values);
  return result?.assignment ?? null;
}

export async function listAssignmentsForYear(db: AppDb, yearId: number) {
  return db
    .select({
      id: assignments.id,
      yearId: assignments.yearId,
      honorId: assignments.honorId,
      memberId: assignments.memberId,
      emailStatus: assignments.emailStatus,
      responseStatus: assignments.responseStatus,
      createdAt: assignments.createdAt,
      memberName: members.name,
      memberEmail: members.email,
      memberPhone: members.phone,
      externalMemberId: members.externalMemberId,
      serviceName: services.name,
      serviceDate: services.serviceDate,
      serviceTime: services.serviceTime,
      honorType: honors.honorType,
      prayerName: honors.prayerName,
      pageNumber: honors.pageNumber,
    })
    .from(assignments)
    .innerJoin(members, eq(assignments.memberId, members.id))
    .innerJoin(honors, eq(assignments.honorId, honors.id))
    .innerJoin(services, eq(honors.serviceId, services.id))
    .where(eq(assignments.yearId, yearId))
    .orderBy(
      asc(services.sortOrder),
      asc(services.serviceDate),
      asc(honors.honorType),
      asc(members.name)
    );
}

export async function findAssignmentByToken(db: AppDb, token: string) {
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.rsvpToken, token))
    .limit(1);

  return assignment ?? null;
}

export async function getRsvpAssignmentByToken(db: AppDb, token: string) {
  const [assignment] = await db
    .select({
      id: assignments.id,
      yearId: assignments.yearId,
      honorId: assignments.honorId,
      memberId: assignments.memberId,
      rsvpToken: assignments.rsvpToken,
      responseStatus: assignments.responseStatus,
      yearLabel: highHolidayYears.label,
      jewishYear: highHolidayYears.jewishYear,
      memberName: members.name,
      serviceId: services.id,
      serviceName: services.name,
      serviceDate: services.serviceDate,
      serviceTime: services.serviceTime,
      honorType: honors.honorType,
      prayerName: honors.prayerName,
      pageNumber: honors.pageNumber,
      estimatedHonorTime: honors.estimatedHonorTime,
    })
    .from(assignments)
    .innerJoin(highHolidayYears, eq(assignments.yearId, highHolidayYears.id))
    .innerJoin(members, eq(assignments.memberId, members.id))
    .innerJoin(honors, eq(assignments.honorId, honors.id))
    .innerJoin(services, eq(honors.serviceId, services.id))
    .where(eq(assignments.rsvpToken, token))
    .limit(1);

  return assignment ?? null;
}

export async function getRsvpResponseForAssignment(
  db: AppDb,
  assignmentId: number
) {
  const [response] = await db
    .select()
    .from(rsvpResponses)
    .where(eq(rsvpResponses.assignmentId, assignmentId))
    .limit(1);

  if (!response) {
    return null;
  }

  const attendedServices = await db
    .select({
      id: services.id,
      name: services.name,
      serviceDate: services.serviceDate,
      serviceTime: services.serviceTime,
    })
    .from(rsvpResponseServices)
    .innerJoin(services, eq(rsvpResponseServices.serviceId, services.id))
    .where(eq(rsvpResponseServices.responseId, response.id))
    .orderBy(
      asc(services.serviceDate),
      asc(services.serviceTime),
      asc(services.name)
    );

  return { ...response, attendedServices };
}

export async function listRsvpServiceOptionsForYear(db: AppDb, yearId: number) {
  return listServicesForYear(db, yearId);
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
