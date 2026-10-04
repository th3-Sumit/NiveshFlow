import { ImageResponse } from "next/og";

export const alt = "NiveshFlow: personal finance management for accounts, expenses, debt, and savings goals.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f2fbf9", color: "#102c29", padding: 64, flexDirection: "column", borderTop: "12px solid #008b7e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 12, background: "#008b7e", color: "white" }}>
            {/* Static Lucide WalletCards mark: ImageResponse cannot invoke client icon components. */}
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11h3.75a2 2 0 0 1 1.6.8l.45.6a4 4 0 0 0 6.4 0l.45-.6a2 2 0 0 1 1.6-.8H21" />
              <path d="M3 7h18" />
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>NiveshFlow</div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", width: 620, flexDirection: "column" }}>
            <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.1 }}>A clearer view of your money.</div>
            <div style={{ marginTop: 24, fontSize: 26, lineHeight: 1.5, color: "#526760" }}>Track income and expenses. Manage debt. Plan your next savings goal.</div>
          </div>
          <div style={{ display: "flex", width: 380, flexDirection: "column", background: "white", border: "1px solid #cee8e0", borderRadius: 8, padding: 28 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#008b7e", marginBottom: 12 }}>Your personal workspace</div>
            {["Accounts & wallets", "Income & expenses", "Debt & repayments", "Bills & savings goals"].map((label) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "17px 0", borderBottom: "1px solid #e5f1ec", fontSize: 21 }}>
                <span style={{ display: "flex", width: 8, height: 8, borderRadius: 4, background: "#008b7e" }} />
                {label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 20, color: "#526760" }}>Personal finance management, in one place.</div>
      </div>
    ),
    size,
  );
}
