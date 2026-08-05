// Cached, same-origin proxy for the tour's WordPress images.
//
// Every image the tour shows lives on the WordPress host, which answers with
// `cf-cache-status: DYNAMIC` and `ki-cf-cache-status: BYPASS` on every request
// — that environment has edge caching switched off, and no amount of
// `cache-control: max-age=315360000` on the response changes it. So all ~105
// images come uncached from origin, measured at roughly 450ms TTFB each from a
// fast desktop connection, on exactly the weak temple-grounds reception this
// tour is built for.
//
// Serving them from here puts them behind Cloudflare's edge cache, so the
// second visitor to a stop pays nothing, and makes them same-origin with the
// page, which drops a separate DNS + TLS handshake off the critical path.
//
// WordPress upload URLs are effectively content-addressed — a given
// `-1024x998.jpg` never changes in place, since an edit produces a new
// filename — so a long immutable TTL is safe here.
//
// Must stay in sync with DATA_URL in assets/js/script.js, which is what
// normalizeWpImageUrl() rewrites away from.
const UPSTREAM_BASE =
  "https://stg-apirakanjicom-stgrakanji.kinsta.cloud/wp-content/uploads/";

const ROUTE_PREFIX = "/img/";
const ONE_YEAR = 31536000;

// Keeps this from being a general-purpose proxy into wp-content/uploads.
const ALLOWED_EXTENSIONS = /\.(?:jpe?g|png|gif|webp|avif|svg)$/i;

async function serveImage(context) {
  const url = new URL(context.request.url);

  if (!url.pathname.startsWith(ROUTE_PREFIX)) {
    return new Response("Not found", { status: 404 });
  }

  // Read the still-encoded path straight off the request rather than using the
  // decoded route param. Many of these filenames are Japanese
  // (`%E2%91%A0-scaled.jpg`) and round-tripping them through decode/encode does
  // not reliably reproduce the bytes WordPress stored them under.
  const path = url.pathname.slice(ROUTE_PREFIX.length);

  if (!path || path.includes("..") || !ALLOWED_EXTENSIONS.test(path)) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = UPSTREAM_BASE + path + url.search;

  let response;
  try {
    response = await fetch(upstream, {
      cf: { cacheEverything: true, cacheTtl: ONE_YEAR },
      headers: {
        Accept: context.request.headers.get("Accept") || "image/*",
      },
    });
  } catch {
    // If this route is broken, a slow image still beats a missing one.
    return Response.redirect(upstream, 302);
  }

  // Pass upstream failures through as-is rather than caching them for a year.
  if (!response.ok) {
    return new Response("Not found", { status: response.status });
  }

  const headers = new Headers();
  const passthrough = ["Content-Type", "Content-Length", "ETag", "Last-Modified"];
  for (const name of passthrough) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", `public, max-age=${ONE_YEAR}, immutable`);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(response.body, { status: 200, headers });
}

export const onRequestGet = serveImage;

// Without this, HEAD falls through to the static asset handler and answers with
// index.html's headers instead of the image's. Nothing in the tour issues one,
// but a route that describes a different resource than it serves is a trap for
// whoever debugs this next.
export const onRequestHead = serveImage;
