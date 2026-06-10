"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  getRsvpAssignmentByToken,
  getRsvpResponseForAssignment,
  listRsvpServiceOptionsForYear,
  normalizeOptionalText,
  recordRsvpResponse,
} from "@/db/helpers";

type RsvpStatus = "accepted" | "declined";
type WantsReschedule = "yes" | "no" | "unsure";

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function getStatus(value: FormDataEntryValue | null): RsvpStatus {
  if (value === "accepted" || value === "declined") {
    return value;
  }

  throw new Error("A valid RSVP status is required.");
}

function getWantsReschedule(
  value: FormDataEntryValue | null,
  status: RsvpStatus
): WantsReschedule | null {
  if (status === "accepted") {
    return null;
  }

  if (value === "yes" || value === "no" || value === "unsure") {
    return value;
  }

  throw new Error("Please choose whether the office should try to reschedule.");
}

function selectedServiceIds(formData: FormData) {
  return formData
    .getAll("attendedServiceId")
    .map((value) => (typeof value === "string" ? Number(value) : NaN))
    .filter((value) => Number.isInteger(value));
}

export async function submitRsvp(formData: FormData) {
  const token = requiredText(formData, "token");
  const status = getStatus(formData.get("status"));
  const notes = formData.get("notes");
  const db = getDb();
  const assignment = await getRsvpAssignmentByToken(db, token);

  if (!assignment) {
    redirect(`/rsvp/${encodeURIComponent(token)}`);
  }

  const existingResponse = await getRsvpResponseForAssignment(db, assignment.id);
  if (existingResponse) {
    redirect(`/rsvp/${encodeURIComponent(token)}`);
  }

  const serviceIds =
    status === "declined" ? selectedServiceIds(formData) : [];
  const validServices = await listRsvpServiceOptionsForYear(
    db,
    assignment.yearId
  );
  const validServiceIds = new Set(validServices.map((service) => service.id));
  const attendedServiceIds = Array.from(
    new Set(serviceIds.filter((id) => validServiceIds.has(id)))
  );

  await recordRsvpResponse(
    db,
    {
      assignmentId: assignment.id,
      status,
      wantsReschedule: getWantsReschedule(
        formData.get("wantsReschedule"),
        status
      ),
      notes: normalizeOptionalText(
        typeof notes === "string" ? notes : null
      ),
    },
    attendedServiceIds
  );

  revalidatePath(`/rsvp/${token}`);
  redirect(`/rsvp/${encodeURIComponent(token)}?submitted=1`);
}
