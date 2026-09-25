// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useVersion } from "./useVersion";
import * as persistence from "../utils/persistence";
import type { PersistedState } from "../utils/persistence";
import type { PRDVersion } from "../types";

// Setup Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  static channels: MockBroadcastChannel[] = [];
  close = vi.fn(() => {
    const idx = MockBroadcastChannel.channels.indexOf(this);
    if (idx !== -1) MockBroadcastChannel.channels.splice(idx, 1);
  });
  postMessage = vi.fn((data: unknown) => {
    for (const ch of MockBroadcastChannel.channels) {
      if (ch !== this && ch.name === this.name) {
        ch.onmessage?.({ data } as MessageEvent);
      }
    }
  });

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.channels.push(this);
  }
}

describe("useVersion - cross-tab sync", () => {
  let originalBroadcastChannel: unknown;
  let container: HTMLDivElement;

  beforeEach(() => {
    // @ts-expect-error React act environment flag
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    originalBroadcastChannel = (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as unknown as { BroadcastChannel: typeof MockBroadcastChannel }).BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.channels = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.useFakeTimers();
    vi.spyOn(persistence, "saveState").mockResolvedValue({ ok: true });
    vi.spyOn(persistence, "loadState").mockResolvedValue(null);
  });

  afterEach(() => {
    (globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel = originalBroadcastChannel;
    MockBroadcastChannel.channels = [];
    document.body.removeChild(container);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes BroadcastChannel on unmount", async () => {
    const root = createRoot(container);

    function TestComp() {
      useVersion();
      return null;
    }

    await act(async () => {
      root.render(React.createElement(TestComp));
    });

    expect(MockBroadcastChannel.channels).toHaveLength(1);
    const channel = MockBroadcastChannel.channels[0];

    await act(async () => {
      root.unmount();
    });

    expect(channel.close).toHaveBeenCalledTimes(1);
  });

  it("syncs state from another tab when receiving SAVED message and does not loop", async () => {
    const v1: PRDVersion = { id: "1", timestamp: 100, content: "c1", prompt: "p1", productType: "Unknown" };
    const v2: PRDVersion = { id: "2", timestamp: 200, content: "c2", prompt: "p2", productType: "Unknown" };

    const initialRemoteState: PersistedState = {
      schemaVersion: 1,
      versions: [v1],
      commentsByVersion: { "1": { sec1: "note" } },
      activeVersionId: "1",
      savedAt: 1000,
    };

    const updatedRemoteState: PersistedState = {
      schemaVersion: 1,
      versions: [v1, v2],
      commentsByVersion: { "1": { sec1: "note" }, "2": { sec2: "revised" } },
      activeVersionId: "2",
      savedAt: 2000,
    };

    let currentState = initialRemoteState;
    vi.spyOn(persistence, "loadState").mockImplementation(async () => currentState);
    const saveStateSpy = vi.spyOn(persistence, "saveState").mockResolvedValue({ ok: true });

    let latestHookResult!: ReturnType<typeof useVersion>;
    function TestComp() {
      latestHookResult = useVersion();
      return null;
    }

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(TestComp));
    });

    // Wait for initial loadState promise
    await act(async () => {
      await Promise.resolve();
    });

    expect(latestHookResult.versions).toEqual([v1]);
    expect(latestHookResult.activeVersionId).toBe("1");

    const hookChannel = MockBroadcastChannel.channels[0];
    expect(hookChannel).toBeDefined();

    // Reset postMessage spy count after mount
    hookChannel.postMessage.mockClear();
    saveStateSpy.mockClear();

    // Simulate Tab 2 saving state & broadcasting to Tab 1
    currentState = updatedRemoteState;
    await act(async () => {
      hookChannel.onmessage?.({
        data: {
          type: "SAVED",
          savedAt: 2000,
          senderId: "tab-2",
        },
      } as MessageEvent);
      // Wait for loadState in message handler
      await Promise.resolve();
    });

    // Verify Tab 1 updated its state to match updatedRemoteState
    expect(latestHookResult.versions).toEqual([v1, v2]);
    expect(latestHookResult.activeVersionId).toBe("2");
    expect(latestHookResult.comments).toEqual({ sec2: "revised" });

    // CRITICAL: Advance debounce timer to verify NO loop occurs (no secondary save & no re-broadcast)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(saveStateSpy).not.toHaveBeenCalled();
    expect(hookChannel.postMessage).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("ignores messages from the same sender (self-broadcast guard)", async () => {
    const loadStateSpy = vi.spyOn(persistence, "loadState").mockResolvedValue(null);

    let latestHookResult!: ReturnType<typeof useVersion>;
    function TestComp() {
      latestHookResult = useVersion();
      return null;
    }

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(TestComp));
      await Promise.resolve();
    });

    loadStateSpy.mockClear();
    const hookChannel = MockBroadcastChannel.channels[0];

    // Trigger save to capture own senderId
    await act(async () => {
      latestHookResult.handleSwitchVersion("test-version");
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    // If channel posted a message, extract senderId
    const lastCall = hookChannel.postMessage.mock.calls[0];
    expect(lastCall).toBeDefined();
    const ownSenderId = (lastCall[0] as { senderId: string }).senderId;

    loadStateSpy.mockClear();

    // Send message back with same senderId (simulating an echo)
    await act(async () => {
      hookChannel.onmessage?.({
        data: {
          type: "SAVED",
          savedAt: Date.now() + 5000,
          senderId: ownSenderId,
        },
      } as MessageEvent);
      await Promise.resolve();
    });

    // loadState should not be called because senderId matches self
    expect(loadStateSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it("ignores messages with savedAt older than or equal to current savedAt", async () => {
    const initialState: PersistedState = {
      schemaVersion: 1,
      versions: [],
      commentsByVersion: {},
      activeVersionId: null,
      savedAt: 5000,
    };
    vi.spyOn(persistence, "loadState").mockResolvedValue(initialState);

    function TestComp() {
      useVersion();
      return null;
    }

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(TestComp));
      await Promise.resolve();
    });

    const hookChannel = MockBroadcastChannel.channels[0];
    const loadStateSpy = vi.spyOn(persistence, "loadState");
    loadStateSpy.mockClear();

    // Send older savedAt (4000 <= 5000)
    await act(async () => {
      hookChannel.onmessage?.({
        data: {
          type: "SAVED",
          savedAt: 4000,
          senderId: "tab-2",
        },
      } as MessageEvent);
      await Promise.resolve();
    });

    expect(loadStateSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
