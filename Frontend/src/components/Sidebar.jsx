function Sidebar({ items, active, onSelect, accentClass = "active" }) {
  return (
    <aside className="sidebar">
      {items.map((section, si) => (
        <div key={si}>
          {section.title && (
            <div className="sidebar-section-title">{section.title}</div>
          )}
          {section.links.map((link) => (
            <div
              key={link.id}
              className={`sidebar-item ${active === link.id ? accentClass : ""}`}
              onClick={() => onSelect(link.id)}
            >
              <span className="sidebar-icon">{link.icon}</span>
              {link.label}
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

export default Sidebar;
