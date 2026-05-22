function RoleCard({ icon, title, description, onClick }) {
  return (
    <div className="role-card" onClick={onClick}>
      <div className="role-card-icon">{icon}</div>
      <div className="role-card-title">{title}</div>
      <div className="role-card-desc">{description}</div>
    </div>
  );
}

export default RoleCard;
