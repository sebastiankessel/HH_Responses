"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  normalizeHonorKeyText,
  normalizeOptionalText,
  upsertHighHolidayYear,
  upsertHonor,
  upsertService,
} from "@/db/helpers";
import { highHolidayYears, honors, services } from "@/db/schema";

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

function optionalKeyText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? normalizeHonorKeyText(value) : "";
}

function numberField(formData: FormData, name: string) {
  const value = Number(requiredText(formData, name));
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be a whole number.`);
  }

  return value;
}

function setupTab(formData: FormData, fallback: "years" | "services" | "honors") {
  const value = formData.get("tab");
  return value === "years" || value === "services" || value === "honors"
    ? value
    : fallback;
}

function setupRedirect(tab: "years" | "services" | "honors", yearId?: number) {
  const params = new URLSearchParams({ tab });
  if (tab !== "years" && yearId) {
    params.set("yearId", String(yearId));
  }

  redirect(`/admin/setup?${params.toString()}`);
}

async function clearActiveYearsIfNeeded(db: ReturnType<typeof getDb>, isActive: boolean) {
  if (!isActive) {
    return;
  }

  await db.update(highHolidayYears).set({
    isActive: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function createYear(formData: FormData) {
  const db = getDb();
  const isActive = formData.get("isActive") === "on";

  await clearActiveYearsIfNeeded(db, isActive);
  const year = await upsertHighHolidayYear(db, {
    jewishYear: numberField(formData, "jewishYear"),
    label: requiredText(formData, "label"),
    isActive,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/setup");
  setupRedirect(setupTab(formData, "years"), year.id);
}

export async function updateYear(formData: FormData) {
  const db = getDb();
  const id = numberField(formData, "id");
  const isActive = formData.get("isActive") === "on";

  await clearActiveYearsIfNeeded(db, isActive);
  await db
    .update(highHolidayYears)
    .set({
      jewishYear: numberField(formData, "jewishYear"),
      label: requiredText(formData, "label"),
      isActive,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(highHolidayYears.id, id));

  revalidatePath("/admin");
  revalidatePath("/admin/setup");
  setupRedirect(setupTab(formData, "years"), id);
}

export async function deleteYear(formData: FormData) {
  const db = getDb();
  await db
    .delete(highHolidayYears)
    .where(eq(highHolidayYears.id, numberField(formData, "id")));

  revalidatePath("/admin");
  revalidatePath("/admin/setup");
  setupRedirect("years");
}

export async function createService(formData: FormData) {
  const db = getDb();
  const yearId = numberField(formData, "yearId");

  await upsertService(db, {
    yearId,
    name: requiredText(formData, "name"),
    serviceDate: requiredText(formData, "serviceDate"),
    serviceTime: optionalText(formData, "serviceTime"),
    sortOrder: 0,
  });

  revalidatePath("/admin/setup");
  setupRedirect("services", yearId);
}

export async function updateService(formData: FormData) {
  const db = getDb();
  const id = numberField(formData, "id");
  const yearId = numberField(formData, "yearId");

  await db
    .update(services)
    .set({
      name: requiredText(formData, "name"),
      serviceDate: requiredText(formData, "serviceDate"),
      serviceTime: optionalText(formData, "serviceTime"),
      sortOrder: 0,
    })
    .where(and(eq(services.id, id), eq(services.yearId, yearId)));

  revalidatePath("/admin/setup");
  setupRedirect("services", yearId);
}

export async function deleteService(formData: FormData) {
  const db = getDb();
  const yearId = numberField(formData, "yearId");

  await db
    .delete(services)
    .where(and(eq(services.id, numberField(formData, "id")), eq(services.yearId, yearId)));

  revalidatePath("/admin/setup");
  setupRedirect("services", yearId);
}

export async function createHonor(formData: FormData) {
  const db = getDb();
  const yearId = numberField(formData, "yearId");

  await upsertHonor(db, {
    yearId,
    serviceId: numberField(formData, "serviceId"),
    honorType: requiredText(formData, "honorType"),
    prayerName: optionalKeyText(formData, "prayerName"),
    pageNumber: optionalKeyText(formData, "pageNumber"),
    estimatedHonorTime: optionalText(formData, "estimatedHonorTime"),
  });

  revalidatePath("/admin/setup");
  setupRedirect("honors", yearId);
}

export async function updateHonor(formData: FormData) {
  const db = getDb();
  const id = numberField(formData, "id");
  const yearId = numberField(formData, "yearId");

  await db
    .update(honors)
    .set({
      serviceId: numberField(formData, "serviceId"),
      honorType: requiredText(formData, "honorType"),
      prayerName: optionalKeyText(formData, "prayerName"),
      pageNumber: optionalKeyText(formData, "pageNumber"),
      estimatedHonorTime: optionalText(formData, "estimatedHonorTime"),
    })
    .where(and(eq(honors.id, id), eq(honors.yearId, yearId)));

  revalidatePath("/admin/setup");
  setupRedirect("honors", yearId);
}

export async function deleteHonor(formData: FormData) {
  const db = getDb();
  const yearId = numberField(formData, "yearId");

  await db
    .delete(honors)
    .where(and(eq(honors.id, numberField(formData, "id")), eq(honors.yearId, yearId)));

  revalidatePath("/admin/setup");
  setupRedirect("honors", yearId);
}
