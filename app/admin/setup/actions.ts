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

function optionalNumberField(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be a whole number.`);
  }

  return parsed;
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
  redirect(`/admin/setup?yearId=${year.id}`);
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
  redirect(`/admin/setup?yearId=${id}`);
}

export async function deleteYear(formData: FormData) {
  const db = getDb();
  await db
    .delete(highHolidayYears)
    .where(eq(highHolidayYears.id, numberField(formData, "id")));

  revalidatePath("/admin");
  revalidatePath("/admin/setup");
  redirect("/admin/setup");
}

export async function createService(formData: FormData) {
  const db = getDb();
  const yearId = numberField(formData, "yearId");

  await upsertService(db, {
    yearId,
    name: requiredText(formData, "name"),
    serviceDate: requiredText(formData, "serviceDate"),
    serviceTime: optionalText(formData, "serviceTime"),
    sortOrder: optionalNumberField(formData, "sortOrder"),
  });

  revalidatePath("/admin/setup");
  redirect(`/admin/setup?yearId=${yearId}`);
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
      sortOrder: optionalNumberField(formData, "sortOrder"),
    })
    .where(and(eq(services.id, id), eq(services.yearId, yearId)));

  revalidatePath("/admin/setup");
  redirect(`/admin/setup?yearId=${yearId}`);
}

export async function deleteService(formData: FormData) {
  const db = getDb();
  const yearId = numberField(formData, "yearId");

  await db
    .delete(services)
    .where(and(eq(services.id, numberField(formData, "id")), eq(services.yearId, yearId)));

  revalidatePath("/admin/setup");
  redirect(`/admin/setup?yearId=${yearId}`);
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
    sortOrder: optionalNumberField(formData, "sortOrder"),
  });

  revalidatePath("/admin/setup");
  redirect(`/admin/setup?yearId=${yearId}`);
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
      sortOrder: optionalNumberField(formData, "sortOrder"),
    })
    .where(and(eq(honors.id, id), eq(honors.yearId, yearId)));

  revalidatePath("/admin/setup");
  redirect(`/admin/setup?yearId=${yearId}`);
}

export async function deleteHonor(formData: FormData) {
  const db = getDb();
  const yearId = numberField(formData, "yearId");

  await db
    .delete(honors)
    .where(and(eq(honors.id, numberField(formData, "id")), eq(honors.yearId, yearId)));

  revalidatePath("/admin/setup");
  redirect(`/admin/setup?yearId=${yearId}`);
}
