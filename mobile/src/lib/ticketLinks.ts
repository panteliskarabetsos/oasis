import { Alert } from "react-native";

import { api } from "@/lib/api";

/**
 * Open a ticket or wallet link, carrying proof that this booking is ours.
 *
 * These URLs are handed to an external browser or to the OS, neither of which
 * carries the app's session — so the server sees a bare booking id and nothing
 * else. We fetch a short-lived token over the authenticated API first and put
 * that in the URL, which is the only part of the request that survives the
 * handover.
 */
export async function openWithTicketToken(
  bookingId: number | string,
  open: (url: string) => unknown,
  buildUrl: (bookingId: number | string, token?: string) => string
): Promise<void> {
  try {
    const token = await api.ticketToken(bookingId);
    await open(buildUrl(bookingId, token));
  } catch (e) {
    Alert.alert(
      "Ticket unavailable",
      e instanceof Error
        ? e.message
        : "We could not open your ticket. Please try again."
    );
  }
}
