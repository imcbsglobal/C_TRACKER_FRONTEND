import "./HelpersField.scss";

const initials = (name = "") =>
  name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// value = array of team member ids, onChange(newIds). excludeId = the main assignee.
export default function HelpersField({ team, value = [], onChange, excludeId }) {
  const ids = value.map(String);
  const chosen = team.filter((t) => ids.includes(String(t.id)));
  const options = team.filter(
    (t) => !ids.includes(String(t.id)) && String(t.id) !== String(excludeId || "")
  );

  const add = (e) => {
    if (!e.target.value) return;
    onChange([...value, Number(e.target.value)]);
  };
  const remove = (id) => onChange(value.filter((v) => String(v) !== String(id)));

  return (
    <div className="hf">
      {chosen.length > 0 && (
        <ul className="hf-chips">
          {chosen.map((t) => (
            <li key={t.id} className="hf-chip">
              <span className="hf-av" aria-hidden="true">{initials(t.full_name)}</span>
              {t.full_name}
              <button
                type="button"
                className="hf-x"
                aria-label={`Remove ${t.full_name}`}
                onClick={() => remove(t.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <select className="hf-select" value="" onChange={add} aria-label="Add helper">
        <option value="">+ Add a assignee</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>{t.full_name}</option>
        ))}
      </select>
    </div>
  );
}