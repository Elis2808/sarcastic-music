"use client";

interface NavItem { page: string; label: string; icon?: React.ReactNode; }
interface Props {
  items: NavItem[];
  activePage: string;
  onNavigate: (page: string) => void;
}

export default function DesktopNav({ items, activePage, onNavigate }: Props) {
  return (
    <nav
      className="hidden sm:flex items-center mb-6 rounded-full"
      style={{
        height: 58,
        gap: 2,
        padding: "6px 8px",
        backgroundColor: "rgba(20,20,24,0.48)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
      }}
    >
      {items.map(({ page, label, icon }) => {
        const isActive = activePage === page;
        return (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="relative flex items-center justify-center gap-1.5 px-5 h-full rounded-full outline-none whitespace-nowrap"
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              WebkitFontSmoothing: "antialiased",
              color: isActive ? "rgba(255,240,205,0.96)" : "rgba(255,255,255,0.48)",
              backgroundColor: isActive ? "rgba(201,168,76,0.06)" : "transparent",
              transition: "color 160ms ease-out, background-color 160ms ease-out, opacity 160ms ease-out",
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.045)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)";
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.48)";
              }
            }}
          >
            {icon && (
              <span style={{
                display: "flex", alignItems: "center",
                color: isActive ? "#C9A84C" : "rgba(255,255,255,0.40)",
                transition: "color 160ms ease-out",
              }}>
                {icon}
              </span>
            )}
            {label}
          </button>
        );
      })}
    </nav>
  );
}
