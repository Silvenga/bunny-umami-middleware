import * as BunnySDK from "npm:@bunny.net/edgescript-sdk";

import { getLocaleByAlpha2 } from "npm:country-locale-map";

const TestingBackend = "https://echo.free.beeceptor.com/";

const WellKnownHeaders = {
  /**
   * The media types that are acceptable for the response.
   */
  accept: "accept",
  /**
   * The hostname of the CDN.
   */
  cdnHost: "cdn-host",
  /**
   * Indicates whether the request is from a mobile device.
   */
  cdnMobiledevice: "cdn-mobiledevice",
  /**
   * The origin host from which the CDN pulls the content.
   */
  cdnOriginHost: "cdn-origin-host",
  /**
   * The origin IP address.
   */
  cdnOriginIp: "cdn-origin-ip",
  /**
   * The origin port.
   */
  cdnOriginPort: "cdn-origin-port",
  /**
   * The protocol used by the origin server.
   */
  cdnOriginProto: "cdn-origin-proto",
  /**
   * The ID of the pull zone used by the CDN.
   */
  cdnPullzoneid: "cdn-pullzoneid",
  /**
   * The country code of the request origin.
   */
  cdnRequestCountryCode: "cdn-requestcountrycode",
  /**
   * The host header of the request.
   */
  host: "host",
  /**
   * The user agent string of the request.
   */
  userAgent: "user-agent",
  /**
   * The real IP address of the client.
   */
  xRealIp: "x-real-ip",
};

BunnySDK.net.http.servePullZone({ url: TestingBackend })
  .onOriginRequest(async (ctx: { request: Request }) => {
    // https://umami.is/docs/api/sending-stats
    // IP is undocumented.

    const ipAddr = ctx.request.headers.get(WellKnownHeaders.xRealIp);
    const userAgent = ctx.request.headers.get(WellKnownHeaders.userAgent);

    const hostname = ctx.request.headers.get(WellKnownHeaders.host);
    const countryCode = ctx.request.headers.get(
      WellKnownHeaders.cdnRequestCountryCode,
    );
    const language = countryCode
      ? getLocaleByAlpha2(countryCode)?.replace("_", "-")
      : undefined;

    const referrer = ctx.request.headers.get("referrer");
    const { pathname, search } = URL.parse(ctx.request.url) ?? {};
    const url = `${pathname}${search}`;
    const websiteId = Deno.env.get("SCRIPT_WEBSITE_ID");
    const eventName = Deno.env.get("SCRIPT_EVENT_NAME");

    const endpoint = Deno.env.get("SCRIPT_UMAMI_STATS_ENDPOINT");
    if (!endpoint) {
      throw "SCRIPT_UMAMI_STATS_ENDPOINT is missing but required.";
    }
    if (!websiteId) {
      throw "SCRIPT_WEBSITE_ID is missing but required.";
    }

    console.log(
      `Handling ${hostname}${url} (IP: ${ipAddr}, Lang: ${language})...`,
    );
    const body = {
      type: "event",
      payload: {
        "hostname": hostname,
        "language": language,
        "referrer": referrer ?? "",
        "url": url,
        "website": websiteId,
        "name": eventName,
        "ip": ipAddr,
      },
    };
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "user-agent": userAgent!,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return ctx.request;
  }).onOriginResponse((ctx: { request: Request; response: Response }) => {
    const response = ctx.response;
    response.headers.append("X-Via", "@silvenga/bunny-umami-middleware");
    return Promise.resolve(response);
  });
