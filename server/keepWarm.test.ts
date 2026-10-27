import { describe, it, expect, vi, afterEach } from "vitest";
import { startKeepWarm } from "./keepWarm";

const BASE = "https://prd.test";

// fetch palsu — tidak pernah menyentuh jaringan sungguhan
function fakeFetch(impl: () => Promise<Response> = () => Promise.resolve(new Response("ok"))) {
  const fn = vi.fn(impl);
  return { fn, fetchImpl: fn as unknown as typeof fetch };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("startKeepWarm", () => {
  it("pings <baseUrl>/health after the first interval, not on boot", async () => {
    vi.useFakeTimers();
    const { fn, fetchImpl } = fakeFetch();

    startKeepWarm(BASE, { intervalMs: 1000, fetchImpl });

    expect(fn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(
      `${BASE}/health`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("pings once per interval", async () => {
    vi.useFakeTimers();
    const { fn, fetchImpl } = fakeFetch();

    startKeepWarm(BASE, { intervalMs: 1000, fetchImpl });
    await vi.advanceTimersByTimeAsync(3000);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("honours the intervalMs override", async () => {
    vi.useFakeTimers();
    const { fn, fetchImpl } = fakeFetch();

    startKeepWarm(BASE, { intervalMs: 500, fetchImpl });
    await vi.advanceTimersByTimeAsync(499);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("defaults to a 5 minute interval", async () => {
    vi.useFakeTimers();
    const { fn, fetchImpl } = fakeFetch();

    startKeepWarm(BASE, { fetchImpl });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reports a rejected ping via onError and keeps the next interval running", async () => {
    vi.useFakeTimers();
    const { fn, fetchImpl } = fakeFetch(() => Promise.reject(new Error("boom")));
    const onError = vi.fn();

    startKeepWarm(BASE, { intervalMs: 1000, fetchImpl, onError });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("stop() prevents further pings", async () => {
    vi.useFakeTimers();
    const { fn, fetchImpl } = fakeFetch();

    const stop = startKeepWarm(BASE, { intervalMs: 1000, fetchImpl });
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("no-ops without a timer when baseUrl is empty", async () => {
    vi.useFakeTimers();
    const { fn, fetchImpl } = fakeFetch();

    const stop = startKeepWarm("", { intervalMs: 1000, fetchImpl });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(fn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => stop()).not.toThrow();
  });
});
