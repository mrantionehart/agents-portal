import { render, screen } from "@testing-library/react";
import FromTheHart from "@/src/portal/home/FromTheHart";

describe("FromTheHart", () => {
  it("renders the header, quote, author, and tagline", () => {
    render(<FromTheHart quote="The agent who follows up wins." author="Tony Hart" />);

    expect(screen.getByText("From The Hart")).toBeInTheDocument();
    expect(screen.getByText(/The agent who follows up wins\./)).toBeInTheDocument();
    expect(screen.getByText(/Tony Hart/)).toBeInTheDocument();
    expect(screen.getByText("Because Choices Matter.")).toBeInTheDocument();
  });

  it("is labelled as a From The Hart region", () => {
    render(<FromTheHart quote="Q" author="A" />);
    expect(screen.getByRole("region", { name: "From The Hart" })).toBeInTheDocument();
  });

  it("has no interactive controls (read-only)", () => {
    render(<FromTheHart quote="Q" author="A" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
