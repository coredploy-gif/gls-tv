import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

type SecureFetchOptions = {
  headers?: Record<string, string>;
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  allowedHost?: (hostname: string) => boolean;
};

export type SecureFetchResult = {
  status: number;
  finalUrl: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

function ipv4Number(address: string) {
  return address
    .split(".")
    .reduce((value, octet) => (value << 8) + Number(octet), 0) >>> 0;
}

function inV4Range(address: string, network: string, prefix: number) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(network) & mask);
}

export function isReservedAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (net.isIPv4(normalized)) {
    return [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ].some(([network, prefix]) =>
      inV4Range(normalized, String(network), Number(prefix)),
    );
  }
  if (!net.isIPv6(normalized)) return true;
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  ) {
    return true;
  }
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isReservedAddress(mapped[1]) : false;
}

export async function validatePublicUrl(
  raw: string,
  allowedHost?: (hostname: string) => boolean,
) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP(S) URLs are allowed");
  }
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    (allowedHost && !allowedHost(hostname))
  ) {
    throw new Error("Host is not allowed");
  }
  const addresses = net.isIP(hostname)
    ? [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }]
    : await dns.promises.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isReservedAddress(entry.address))) {
    throw new Error("Private or reserved network targets are blocked");
  }
  return { url, address: addresses[0] };
}

export async function secureFetchBuffered(
  raw: string,
  options: SecureFetchOptions,
): Promise<SecureFetchResult> {
  const maxRedirects = options.maxRedirects ?? 4;
  const timeoutMs = options.timeoutMs ?? 15_000;

  async function requestUrl(target: string, redirects: number): Promise<SecureFetchResult> {
    const { url, address } = await validatePublicUrl(target, options.allowedHost);
    const client = url.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
      const request = client.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || undefined,
          path: `${url.pathname}${url.search}`,
          method: "GET",
          headers: { ...options.headers, Host: url.host },
          servername: url.hostname,
          lookup: (_hostname, _opts, callback) =>
            callback(null, address.address, address.family),
        },
        (response) => {
          const status = response.statusCode || 502;
          const location = response.headers.location;
          if (status >= 300 && status < 400 && location) {
            response.resume();
            if (redirects >= maxRedirects) {
              reject(new Error("Too many redirects"));
              return;
            }
            const next = new URL(location, url).href;
            requestUrl(next, redirects + 1).then(resolve, reject);
            return;
          }
          const announced = Number(response.headers["content-length"] || 0);
          if (announced > options.maxBytes) {
            response.destroy();
            reject(new Error("Upstream response is too large"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > options.maxBytes) {
              response.destroy(new Error("Upstream response is too large"));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () =>
            resolve({
              status,
              finalUrl: url.href,
              headers: response.headers,
              body: Buffer.concat(chunks),
            }),
          );
          response.on("error", reject);
        },
      );
      request.setTimeout(timeoutMs, () =>
        request.destroy(new Error("Upstream request timed out")),
      );
      request.on("error", reject);
      request.end();
    });
  }

  return requestUrl(raw, 0);
}

