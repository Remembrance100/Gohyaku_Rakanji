export async function onRequestPost(context) {
  const STRIPE_SECRET = context.env.STRIPE_SECRET_KEY;
  const PRICE_ID = context.env.STRIPE_PRICE_ID;
  const origin = new URL(context.request.url).origin;

  if (!STRIPE_SECRET) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch {}

  const successUrl = `${origin}/tour.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/pay.html?cancelled=1`;

  // Build line items — use a Price ID if configured, otherwise inline price
  const lineItems = PRICE_ID
    ? [{ price: PRICE_ID, quantity: 1 }]
    : [
        {
          price_data: {
            currency: "jpy",
            unit_amount: 1500,
            product_data: {
              name: "Memorial Tour Guide",
              description: "24-hour access to the interactive audio tour",
            },
          },
          quantity: 1,
        },
      ];

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", successUrl);
  params.append("cancel_url", cancelUrl);
  lineItems.forEach((item, i) => {
    if (item.price) {
      params.append(`line_items[${i}][price]`, item.price);
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
    } else {
      params.append(`line_items[${i}][price_data][currency]`, item.price_data.currency);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      params.append(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
      params.append(`line_items[${i}][price_data][product_data][description]`, item.price_data.product_data.description);
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
    }
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const session = await res.json();

  if (!res.ok) {
    return Response.json({ error: session.error?.message || "Stripe error" }, { status: 502 });
  }

  return Response.json({ url: session.url });
}
