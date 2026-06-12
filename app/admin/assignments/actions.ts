"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  getHighHolidayYearByJewishYear,
  normalizeEmail,
  normalizeHonorKeyText,
  normalizeOptionalText,
  upsertAssignment,
  upsertMember,
} from "@/db/helpers";
import { assignments, honors, members, services } from "@/db/schema";
import { hasValidAdminSession } from "@/lib/adminAuth";

type AssignmentImportRow = {
  memberName: string;
  email: string | null;
  year: number | null;
  serviceName: string;
  honorType: string;
  prayerName: string;
  pageNumber: string;
  phone: string | null;
  externalMemberId: string | null;
};

type ImportCounts = {
  totalRows: number;
  createdAssignments: number;
  existingAssignments: number;
  duplicateRows: number;
  skippedRows: number;
  invalidEmailRows: number;
  unknownYearRows: number;
  unknownHonorRows: number;
};

function requiredNumber(formData: FormData, name: string) {
  const value = formData.get(name);
  const parsed = typeof value === "string" ? Number(value) : NaN;

  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} is required.`);
  }

  return parsed;
}

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function optionalText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? normalizeOptionalText(value) : null;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const isAuthorized = await hasValidAdminSession(cookieStore);

  if (!isAuthorized) {
    throw new Error("Admin access is required.");
  }
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function headerKey(value: string) {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "_");
}

function getCell(
  cells: string[],
  headers: Map<string, number>,
  names: string[]
) {
  for (const name of names) {
    const index = headers.get(name);
    if (index !== undefined) {
      return cells[index]?.trim() ?? "";
    }
  }

  return "";
}

function normalizeYear(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function isValidEmail(email: string | null) {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeAssignmentRow(
  cells: string[],
  headers: Map<string, number>
): AssignmentImportRow {
  return {
    memberName: getCell(cells, headers, ["member_name", "name"]),
    email: normalizeEmail(getCell(cells, headers, ["email", "member_email"])),
    year: normalizeYear(getCell(cells, headers, ["year", "jewish_year"])),
    serviceName: getCell(cells, headers, ["service_name", "service"]),
    honorType: getCell(cells, headers, ["honor_type", "honor"]),
    prayerName: normalizeHonorKeyText(
      getCell(cells, headers, ["prayer_name", "prayer"])
    ),
    pageNumber: normalizeHonorKeyText(
      getCell(cells, headers, ["page_number", "page"])
    ),
    phone: normalizeOptionalText(getCell(cells, headers, ["phone"])),
    externalMemberId: normalizeOptionalText(
      getCell(cells, headers, ["external_member_id", "member_id"])
    ),
  };
}

function rowIdentity(row: AssignmentImportRow, yearId: number) {
  const memberKey =
    row.externalMemberId ??
    row.email ??
    `${row.memberName.toLowerCase()}|${row.phone ?? ""}`;

  return [
    yearId,
    row.serviceName.toLowerCase(),
    row.honorType.toLowerCase(),
    row.prayerName.toLowerCase(),
    row.pageNumber.toLowerCase(),
    memberKey,
  ].join("::");
}

function redirectWithCounts(yearId: number, counts: ImportCounts) {
  const params = new URLSearchParams({ yearId: String(yearId) });

  for (const [key, value] of Object.entries(counts)) {
    params.set(key, String(value));
  }

  redirect(`/admin/assignments?${params.toString()}`);
}

function redirectToAssignments(yearId: number) {
  redirect(`/admin/assignments?yearId=${yearId}`);
}

async function requireHonorForYear(yearId: number, honorId: number) {
  const db = getDb();
  const [honor] = await db
    .select({ id: honors.id })
    .from(honors)
    .where(and(eq(honors.id, honorId), eq(honors.yearId, yearId)))
    .limit(1);

  if (!honor) {
    throw new Error("Selected honor does not belong to this year.");
  }
}

function normalizedMemberValues(formData: FormData) {
  const email = normalizeEmail(optionalText(formData, "email"));

  if (!isValidEmail(email)) {
    throw new Error("Enter a valid email address or leave email blank.");
  }

  return {
    name: requiredText(formData, "memberName"),
    email,
    phone: optionalText(formData, "phone"),
    externalMemberId: optionalText(formData, "externalMemberId"),
  };
}

export async function createManualAssignment(formData: FormData) {
  await requireAdmin();

  const db = getDb();
  const yearId = requiredNumber(formData, "yearId");
  const honorId = requiredNumber(formData, "honorId");

  await requireHonorForYear(yearId, honorId);
  const member = await upsertMember(db, normalizedMemberValues(formData));
  await upsertAssignment(db, {
    yearId,
    honorId,
    memberId: member.id,
    emailStatus: "not_sent",
    responseStatus: "pending",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/assignments");
  revalidatePath("/admin/email");
  redirectToAssignments(yearId);
}

export async function updateManualAssignment(formData: FormData) {
  await requireAdmin();

  const db = getDb();
  const yearId = requiredNumber(formData, "yearId");
  const assignmentId = requiredNumber(formData, "assignmentId");
  const honorId = requiredNumber(formData, "honorId");
  const memberValues = normalizedMemberValues(formData);

  await requireHonorForYear(yearId, honorId);
  const [assignment] = await db
    .select({
      id: assignments.id,
      memberId: assignments.memberId,
    })
    .from(assignments)
    .where(and(eq(assignments.id, assignmentId), eq(assignments.yearId, yearId)))
    .limit(1);

  if (!assignment) {
    throw new Error("Assignment was not found.");
  }

  await db
    .update(members)
    .set({
      ...memberValues,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(members.id, assignment.memberId));

  await db
    .update(assignments)
    .set({
      honorId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(assignments.id, assignment.id));

  revalidatePath("/admin");
  revalidatePath("/admin/assignments");
  revalidatePath("/admin/email");
  redirectToAssignments(yearId);
}

export async function importAssignments(formData: FormData) {
  await requireAdmin();

  const db = getDb();
  const selectedYearId = requiredNumber(formData, "yearId");
  const file = formData.get("assignmentCsv");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Assignment CSV is required.");
  }

  const rows = parseCsv(await file.text());
  const [headerRow, ...dataRows] = rows;
  const counts: ImportCounts = {
    totalRows: dataRows.length,
    createdAssignments: 0,
    existingAssignments: 0,
    duplicateRows: 0,
    skippedRows: 0,
    invalidEmailRows: 0,
    unknownYearRows: 0,
    unknownHonorRows: 0,
  };

  if (!headerRow) {
    redirectWithCounts(selectedYearId, counts);
  }

  const headers = new Map(
    headerRow.map((header, index) => [headerKey(header), index])
  );
  const seenRows = new Set<string>();

  for (const cells of dataRows) {
    const row = normalizeAssignmentRow(cells, headers);

    if (!row.memberName || !row.serviceName || !row.honorType) {
      counts.skippedRows += 1;
      continue;
    }

    if (!isValidEmail(row.email)) {
      counts.invalidEmailRows += 1;
      counts.skippedRows += 1;
      continue;
    }

    const targetYear = row.year
      ? await getHighHolidayYearByJewishYear(db, row.year)
      : null;
    const yearId = targetYear?.id ?? selectedYearId;

    if (row.year && !targetYear) {
      counts.unknownYearRows += 1;
      counts.skippedRows += 1;
      continue;
    }

    const identity = rowIdentity(row, yearId);
    if (seenRows.has(identity)) {
      counts.duplicateRows += 1;
      continue;
    }
    seenRows.add(identity);

    const [honor] = await db
      .select({ id: honors.id })
      .from(honors)
      .innerJoin(services, eq(honors.serviceId, services.id))
      .where(
        and(
          eq(honors.yearId, yearId),
          eq(services.name, row.serviceName),
          eq(honors.honorType, row.honorType),
          eq(honors.prayerName, row.prayerName),
          eq(honors.pageNumber, row.pageNumber)
        )
      )
      .limit(1);

    if (!honor) {
      counts.unknownHonorRows += 1;
      counts.skippedRows += 1;
      continue;
    }

    const member = await upsertMember(db, {
      name: row.memberName,
      email: row.email,
      phone: row.phone,
      externalMemberId: row.externalMemberId,
    });
    const assignment = await upsertAssignment(db, {
      yearId,
      honorId: honor.id,
      memberId: member.id,
      emailStatus: "not_sent",
      responseStatus: "pending",
    });

    if (assignment?.created) {
      counts.createdAssignments += 1;
    } else {
      counts.existingAssignments += 1;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/assignments");
  redirectWithCounts(selectedYearId, counts);
}
