import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import BirthdayPrompt from "@/src/portal/home/BirthdayPrompt";

function mockFetchOnce(body: unknown, ok = true) {
  return { ok, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.restoreAllMocks();
});

const PROMPT_TITLE = "Help us celebrate you";

describe("BirthdayPrompt gating", () => {
  it("renders nothing while loading, then nothing when a birthday already exists", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchOnce({ hasBirthday: true, promptDismissedUntil: null }),
    );
    render(<BirthdayPrompt />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument();
  });

  it("renders nothing while snoozed", async () => {
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchOnce({ hasBirthday: false, promptDismissedUntil: future }),
    );
    render(<BirthdayPrompt />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument();
  });

  it("renders nothing when Vault says the caller is ineligible (403)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchOnce({ error: "Forbidden" }, false));
    render(<BirthdayPrompt />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument();
  });

  it("does not break when the state request fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network"));
    render(<BirthdayPrompt />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument();
  });

  it("shows the prompt for an eligible agent with no birthday", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchOnce({ hasBirthday: false, promptDismissedUntil: null }),
    );
    render(<BirthdayPrompt />);
    expect(await screen.findByText(PROMPT_TITLE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Birthday" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maybe Later" })).toBeInTheDocument();
  });
});

describe("BirthdayPrompt interactions", () => {
  async function renderEligible() {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchOnce({ hasBirthday: false, promptDismissedUntil: null }),
    );
    render(<BirthdayPrompt />);
    await screen.findByText(PROMPT_TITLE);
  }

  it("dismiss calls the dismiss endpoint and hides the card", async () => {
    await renderEligible();
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchOnce({ ok: true }));
    fireEvent.click(screen.getByRole("button", { name: "Maybe Later" }));
    await waitFor(() =>
      expect((global.fetch as jest.Mock).mock.calls.some((c) => c[0] === "/api/profile/birthday/dismiss")).toBe(true),
    );
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument();
  });

  it("opens an accessible modal with month/day/email and NO year field", async () => {
    await renderEligible();
    fireEvent.click(screen.getByRole("button", { name: "Add Birthday" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Month")).toBeInTheDocument();
    expect(screen.getByLabelText("Day")).toBeInTheDocument();
    // No year control anywhere in the form.
    expect(screen.queryByLabelText(/year/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/year/i)).not.toBeInTheDocument();
  });

  it("saves via PUT and shows the success state", async () => {
    await renderEligible();
    fireEvent.click(screen.getByRole("button", { name: "Add Birthday" }));
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "27" } });

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchOnce({ hasBirthday: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save Birthday" }));

    await screen.findByText(/we.?ve saved your birthday/i);
    const putCall = (global.fetch as jest.Mock).mock.calls.find(
      (c) => c[0] === "/api/profile/birthday" && c[1]?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse(putCall[1].body)).toEqual({ birthMonth: 7, birthDay: 27, birthdayEmailEnabled: true });
  });
});
