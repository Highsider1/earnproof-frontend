import { render, screen } from "@testing-library/react";
import SecurityPage from "@/app/security/page";

describe("SecurityPage", () => {
  it("renders the security page with implemented controls and recommendations", () => {
    render(<SecurityPage />);

    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Implemented controls")).toBeInTheDocument();
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Wallet authentication")).toBeInTheDocument();
    expect(screen.getByText("Optional Stellar anchoring")).toBeInTheDocument();
    expect(screen.getByText("Responsible disclosure")).toBeInTheDocument();
    expect(screen.getByText("Privacy policy")).toBeInTheDocument();
    expect(screen.getByText("System status")).toBeInTheDocument();
  });
});
