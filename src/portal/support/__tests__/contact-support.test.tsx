/**
 * @jest-environment jsdom
 */
// ============================================================================
// RELEASE.002B — Contact Support modal (Portal 2.0)
// ============================================================================
// UI-only surface over the verified POST /api/support flow. These tests prove
// the contract the release requires: read-only identity, required-field
// validation, correct endpoint/body, success + error states, double-submit
// prevention, and Escape-to-close. No backend is exercised — fetch is mocked.
// ============================================================================

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import ContactSupport from "../ContactSupport";

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const fn = jest.fn((url: string, init: RequestInit) => Promise.resolve(impl(url, init)));
  (global as unknown as { fetch: unknown }).fetch = fn;
  return fn;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function openModal() {
  fireEvent.click(screen.getByTestId("contact-support-trigger"));
  return screen.getByRole("dialog");
}

afterEach(() => {
  jest.restoreAllMocks();
  delete (global as unknown as { fetch?: unknown }).fetch;
});

describe("ContactSupport", () => {
  it("renders a trigger and does not show the dialog until clicked", () => {
    render(<ContactSupport agentName="Ada Agent" agentEmail="ada@example.test" />);
    expect(screen.getByTestId("contact-support-trigger")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens an accessible dialog with read-only, pre-populated identity", () => {
    render(<ContactSupport agentName="Ada Agent" agentEmail="ada@example.test" />);
    const dialog = openModal();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Contact Support");

    const name = within(dialog).getByLabelText("Name") as HTMLInputElement;
    const email = within(dialog).getByLabelText("Email") as HTMLInputElement;
    expect(name.value).toBe("Ada Agent");
    expect(email.value).toBe("ada@example.test");
    expect(name.readOnly).toBe(true);
    expect(email.readOnly).toBe(true);
  });

  it("falls back to the email-local part when no display name is provided", () => {
    render(<ContactSupport agentName={null} agentEmail="jordan@example.test" />);
    openModal();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("jordan");
  });

  it("blocks submission and shows validation when subject/message are empty", () => {
    const fetchFn = mockFetch(() => jsonResponse(200, { success: true, id: "x" }));
    render(<ContactSupport agentName="Ada" agentEmail="ada@example.test" />);
    openModal();

    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));

    expect(screen.getByTestId("contact-support-validation")).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("posts { name, email, subject, message } to /api/support and shows the success copy", async () => {
    const fetchFn = mockFetch(() => jsonResponse(200, { success: true, id: "abc" }));
    render(<ContactSupport agentName="Ada Agent" agentEmail="ada@example.test" />);
    openModal();

    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: "Cannot log in" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "The page 500s." } });
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));

    await screen.findByTestId("contact-support-success");
    expect(
      screen.getByText(/your support request has been received/i)
    ).toBeInTheDocument();
    // No mention of email in the success copy.
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/support");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Ada Agent",
      email: "ada@example.test",
      subject: "Cannot log in",
      message: "The page 500s.",
    });
  });

  it("surfaces the API error message cleanly (no stack trace) on a non-2xx", async () => {
    mockFetch(() => jsonResponse(500, { error: "Failed to save support request" }));
    render(<ContactSupport agentName="Ada" agentEmail="ada@example.test" />);
    openModal();

    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: "S" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "M" } });
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));

    const err = await screen.findByTestId("contact-support-error");
    expect(err).toHaveTextContent("Failed to save support request");
    // Still on the form (no false success).
    expect(screen.queryByTestId("contact-support-success")).not.toBeInTheDocument();
  });

  it("prevents double submission — the submit button disables while in flight", async () => {
    // Never-resolving fetch keeps the request 'in flight'.
    const fetchFn = jest.fn(() => new Promise<Response>(() => {}));
    (global as unknown as { fetch: unknown }).fetch = fetchFn;

    render(<ContactSupport agentName="Ada" agentEmail="ada@example.test" />);
    openModal();
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: "S" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "M" } });

    const submit = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled()
    );
    // A second click cannot fire another request.
    fireEvent.click(screen.getByRole("button", { name: /submitting/i }));
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    render(<ContactSupport agentName="Ada" agentEmail="ada@example.test" />);
    openModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
