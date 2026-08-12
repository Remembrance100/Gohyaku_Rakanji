import { deriveCashCode, todayJstDateKey } from "../_lib/cash-code.js";

// Lets front-desk staff look up today's cash code without anyone having to
// hand-edit an env var each morning. Gated by STAFF_ACCESS_KEY, a passphrase
// shared with the front desk out of band — separate from CASH_CODE_SECRET so
// rotating one never requires touching the other.
export async function onRequestGet(context) {
  const staffKey = context.env.STAFF_ACCESS_KEY;
  const secret = context.env.CASH_CODE_SECRET || context.env.TOKEN_SECRET || context.env.STRIPE_SECRET_KEY;

  if (!staffKey || !secret) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const url = new URL(context.request.url);
  const submittedKey = url.searchParams.get("key") || "";

  if (submittedKey !== staffKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dateKey = todayJstDateKey();
  const code = await deriveCashCode(secret, dateKey);

  return Response.json({ code, date: dateKey });
}
