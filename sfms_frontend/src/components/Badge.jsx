const TONES = {
  pending: { bg: "var(--amber-tint)", text: "#9A5B0F" },
  approved: { bg: "var(--green-tint)", text: "var(--green)" },
  rejected: { bg: "var(--red-tint)", text: "var(--red)" },
  neutral: { bg: "var(--surface-sunken)", text: "var(--ink-soft)" },
  open: { bg: "var(--amber-tint)", text: "#9A5B0F" },
  in_progress: { bg: "var(--teal-tint)", text: "var(--teal-deep)" },
  resolved: { bg: "var(--green-tint)", text: "var(--green)" },
};

export default function Badge({ tone = "neutral", children }) {
  const c = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 11px",
        borderRadius: "999px",
        fontSize: "11.5px",
        fontWeight: 700,
        textTransform: "capitalize",
        background: c.bg,
        color: c.text,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
}
