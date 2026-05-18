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
      className="hidden sm:flex items-center gap-0.5 rounded-full"
      style={{
        height: 48,
        padding: "4px 8px",
        backgroundColor: "rgba(20,20,24,0.48)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
      }}
    >
      {items.map(({ page, label, icon }) => {
        const isActive = activePage === page;
        return (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="relative flex items-center justify-center gap-1 px-3 h-full rounded-full outline-none whitespace-nowrap"
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              WebkitFontSmoothing: "antialiased",
              color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)",
              backgroundColor: "transparent",
              border: isActive ? "1px solid rgba(201,168,76,0.6)" : "1px solid transparent",
              transition: "color 160ms ease-out, border-color 160ms ease-out",
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,1)";
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)";
              }
            }}
          >
            {icon && (
              <span style={{
                display: "flex", alignItems: "center",
                color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.75)",
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
