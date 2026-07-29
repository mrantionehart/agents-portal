import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ProfileBirthdaySection from "@/src/portal/profile/ProfileBirthdaySection";

function mockFetchOnce(body: unknown, ok = true) {
  return { ok, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  global.fetch = jest.fn();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("ProfileBirthdaySection", () => {
  it("hides itself when Vault reports the caller ineligible (403)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchOnce({ error: "Forbidden" }, false));
    const { container } = render(<ProfileBirthdaySection />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the current birthday and email preference read-only", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchOnce({ hasBirthday: true, birthMonth: 7, birthDay: 27, birthdayEmailEnabled: true }),
    );
    render(<ProfileBirthdaySection />);
    expect(await screen.findByText("July 27")).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows 'Not set' + Add when no birthday, and reveals month/day on edit with NO year field", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchOnce({ hasBirthday: false, birthMonth: null, birthDay: null, birthdayEmailEnabled: true }),
    );
    render(<ProfileBirthdaySection />);
    const addBtn = await screen.findByRole("button", { name: "Add" });
    expect(screen.getByText("Not set")).toBeInTheDocument();
    fireEvent.click(addBtn);
    expect(screen.getByLabelText("Birthday month")).toBeInTheDocument();
    expect(screen.getByLabelText("Birthday day")).toBeInTheDocument();
    expect(screen.queryByLabelText(/year/i)).not.toBeInTheDocument();
  });

  it("saves through the Vault-proxied PUT", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchOnce({ hasBirthday: false, birthMonth: null, birthDay: null, birthdayEmailEnabled: true }),
    );
    render(<ProfileBirthdaySection />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("Birthday month"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Birthday day"), { target: { value: "10" } });

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchOnce({ hasBirthday: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find(
        (c) => c[0] === "/api/profile/birthday" && c[1]?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      expect(JSON.parse(putCall[1].body)).toEqual({ birthMonth: 5, birthDay: 10, birthdayEmailEnabled: true });
    });
  });
});
