// COMM-1C — useTextPractice: call sequence, sessionStorage keying, assessment
// resume. All grading/session logic is Vault's; here we assert the hook drives
// the existing APIs in the right order and holds view state correctly.

import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@/lib/ring/vault-ring-client", () => {
  class RingApiError extends Error {
    status: number;
    code: string | null;
    notEnabled: boolean;
    constructor(status: number, code: string | null, notEnabled: boolean) {
      super(code ?? String(status));
      this.status = status;
      this.code = code;
      this.notEnabled = notEnabled;
    }
  }
  return {
    ACQUISITION_CERTIFICATION_ID: "acq",
    RingApiError,
    prepareText: jest.fn(),
    beginText: jest.fn(),
    sendTurn: jest.fn(),
    getTextState: jest.fn(),
    completeText: jest.fn(),
    getTextResult: jest.fn(),
  };
});

import { useTextPractice } from "../_lib/use-text-practice";
import * as client from "@/lib/ring/vault-ring-client";

const m = client as unknown as {
  prepareText: jest.Mock;
  beginText: jest.Mock;
  sendTurn: jest.Mock;
  getTextState: jest.Mock;
  completeText: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
});

describe("practice flow", () => {
  it("enter → prepare → briefing, persisting only the session id under the practice key", async () => {
    m.prepareText.mockResolvedValue({ sessionId: "sess-1", scenarioLabel: "Seller Discovery", attemptNumber: 1, countsTowardProgression: false, reused: false, level: 1 });
    const { result } = renderHook(() => useTextPractice("acq"));

    await act(async () => {
      result.current.enter(null);
    });
    await waitFor(() => expect(result.current.phase).toBe("briefing"));

    expect(m.prepareText).toHaveBeenCalledWith("acq", null);
    expect(result.current.session?.sessionId).toBe("sess-1");
    expect(window.sessionStorage.getItem("ring:text:session:acq")).toBe("sess-1");
  });

  it("begin seeds the opening counterparty message and goes active", async () => {
    m.prepareText.mockResolvedValue({ sessionId: "s", scenarioLabel: "L", attemptNumber: 1, countsTowardProgression: false, reused: false, level: 1 });
    m.beginText.mockResolvedValue({ sessionId: "s", openingMessage: "Hi, who is this?", resumed: false });
    const { result } = renderHook(() => useTextPractice("acq"));
    await act(async () => result.current.enter(null));
    await waitFor(() => expect(result.current.phase).toBe("briefing"));

    await act(async () => result.current.begin());
    await waitFor(() => expect(result.current.phase).toBe("active"));
    expect(result.current.messages).toEqual([{ id: expect.any(Number), role: "counterparty", content: "Hi, who is this?" }]);
  });

  it("send appends the learner turn and the counterparty reply", async () => {
    m.prepareText.mockResolvedValue({ sessionId: "s", scenarioLabel: "L", attemptNumber: 1, countsTowardProgression: false, reused: false, level: 1 });
    m.beginText.mockResolvedValue({ sessionId: "s", openingMessage: "Hello?", resumed: false });
    m.sendTurn.mockResolvedValue({ counterpartyMessage: "I might sell.", ended: false, counterpartyDisengaging: false });
    const { result } = renderHook(() => useTextPractice("acq"));
    await act(async () => result.current.enter(null));
    await waitFor(() => expect(result.current.phase).toBe("briefing"));
    await act(async () => result.current.begin());
    await waitFor(() => expect(result.current.phase).toBe("active"));

    await act(async () => {
      await result.current.send("Are you thinking of selling?");
    });
    await waitFor(() => expect(result.current.phase).toBe("active"));
    const contents = result.current.messages.map((x) => x.content);
    expect(contents).toEqual(["Hello?", "Are you thinking of selling?", "I might sell."]);
    expect(m.sendTurn).toHaveBeenCalledWith("acq", "s", "Are you thinking of selling?");
  });

  it("complete → ready coaching → done and clears the stored session id", async () => {
    m.prepareText.mockResolvedValue({ sessionId: "s", scenarioLabel: "L", attemptNumber: 1, countsTowardProgression: false, reused: false, level: 1 });
    m.completeText.mockResolvedValue({ status: "ready", sessionId: "s", coaching: { strengths: ["a"], improvements: [], missedOpportunities: [], coaching: [] } });
    const { result } = renderHook(() => useTextPractice("acq"));
    await act(async () => result.current.enter(null));
    await waitFor(() => expect(result.current.phase).toBe("briefing"));

    await act(async () => result.current.complete());
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(result.current.coaching?.strengths).toEqual(["a"]);
    expect(window.sessionStorage.getItem("ring:text:session:acq")).toBeNull();
  });
});

describe("assessment mode", () => {
  it("resumes the injected session via getTextState and uses the :assessment storage key", async () => {
    m.getTextState.mockResolvedValue({ sessionId: "as-1", status: "active", sealed: false, scenarioLabel: "Objection Handling", level: 3, ended: false, messages: [{ role: "counterparty", content: "Go on." }] });
    const { result } = renderHook(() => useTextPractice("acq", { initialSessionId: "as-1" }));

    await waitFor(() => expect(m.getTextState).toHaveBeenCalledWith("acq", "as-1"));
    await waitFor(() => expect(result.current.phase).toBe("active"));
    expect(window.sessionStorage.getItem("ring:text:session:acq:assessment")).toBe("as-1");
    // never touches the practice key
    expect(window.sessionStorage.getItem("ring:text:session:acq")).toBeNull();
  });
});
