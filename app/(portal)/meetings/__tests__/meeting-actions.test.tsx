// Renders MeetingActions and proves ONLY agent actions appear (cancel own /
// accept alternate / decline alternate). Broker decision controls
// (confirm / propose alternate / decline-on-behalf) must NEVER render.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingActions from "../_components/MeetingActions";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: jest.fn() }) }));
jest.mock("@/lib/supabase", () => ({ getAccessToken: async () => "tok" }));

function forbiddenControlsAbsent() {
  // No confirm / propose / broker-decline controls anywhere.
  expect(screen.queryByRole("button", { name: /confirm/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /propose/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /^decline request/i })).toBeNull();
}

describe("MeetingActions — agent-only affordances", () => {
  afterEach(() => jest.clearAllMocks());

  it("requested → Cancel only, no broker controls", () => {
    render(<MeetingActions id="m1" status="requested" alternateOptionId={null} />);
    expect(screen.getByRole("button", { name: /cancel request/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept alternate/i })).toBeNull();
    forbiddenControlsAbsent();
  });

  it("alternate_proposed → Accept + Decline alternate + Cancel; no broker controls", () => {
    render(<MeetingActions id="m1" status="alternate_proposed" alternateOptionId="opt-1" />);
    expect(screen.getByRole("button", { name: /accept alternate/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /decline alternate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel request/i })).toBeInTheDocument();
    forbiddenControlsAbsent();
  });

  it("confirmed → Cancel meeting only", () => {
    render(<MeetingActions id="m1" status="confirmed" alternateOptionId={null} />);
    expect(screen.getByRole("button", { name: /cancel meeting/i })).toBeInTheDocument();
    forbiddenControlsAbsent();
  });

  it("terminal statuses render nothing", () => {
    for (const s of ["completed", "cancelled", "declined", "expired"]) {
      const { container } = render(<MeetingActions id="m1" status={s} alternateOptionId={null} />);
      expect(container).toBeEmptyDOMElement();
    }
  });

  it("Accept posts to the respond proxy with the alternate optionId", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    // @ts-expect-error test global
    global.fetch = fetchMock;
    render(<MeetingActions id="m1" status="alternate_proposed" alternateOptionId="opt-1" />);
    fireEvent.click(screen.getByRole("button", { name: /accept alternate/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/meetings/m1/respond");
    expect(JSON.parse(init.body)).toEqual({ action: "accept_alternate", optionId: "opt-1" });
    expect(url).not.toMatch(/decision/);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
