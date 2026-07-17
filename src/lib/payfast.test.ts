import { describe, expect, it } from "vitest";
import { isPayfastItnIpAllowed } from "@/lib/payfast";

describe("isPayfastItnIpAllowed", () => {
  it("accepts documented PayFast CIDR ranges", () => {
    process.env.PAYFAST_SKIP_IP_CHECK = "";
    process.env.PAYFAST_SANDBOX = "false";
    expect(isPayfastItnIpAllowed("197.97.145.150")).toBe(true);
    expect(isPayfastItnIpAllowed("41.74.179.200")).toBe(true);
    expect(isPayfastItnIpAllowed("102.216.36.5")).toBe(true);
    expect(isPayfastItnIpAllowed("102.216.36.130")).toBe(true);
    expect(isPayfastItnIpAllowed("144.126.193.139")).toBe(true);
  });

  it("rejects unrelated public IPs when not skipped", () => {
    process.env.PAYFAST_SKIP_IP_CHECK = "";
    process.env.PAYFAST_SANDBOX = "false";
    expect(isPayfastItnIpAllowed("8.8.8.8")).toBe(false);
    expect(isPayfastItnIpAllowed("1.1.1.1")).toBe(false);
  });

  it("allows skip override", () => {
    process.env.PAYFAST_SKIP_IP_CHECK = "true";
    expect(isPayfastItnIpAllowed("8.8.8.8")).toBe(true);
  });
});
