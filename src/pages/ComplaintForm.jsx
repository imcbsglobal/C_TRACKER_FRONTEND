import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createComplaint, getTeam } from "../api/complaints";
import { getSprints } from "../api/sprints";
import { STATUSES, PRIORITIES, CATEGORIES, defaultChoices, isAdminUser, useConfig } from "../constants";
import { useProjects } from "../projects";
import HelpersField from "../components/HelpersField";
import { AttachButton, PreviewStrip } from "./ComplaintDetail";
import { useAccess } from "../auth/access";
import { PRODUCT_TYPES, PRODUCTS, ALL_PRODUCTS, productTypeOf } from "./supportMeta";

// Product picker is hidden for now. Set to true to bring it back.
const SHOW_PRODUCT = false;
import "./ComplaintForm.scss";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const KIND_LABELS = { complaint: "Complaint", task: "Task", bug: "Bug" };

const empty = {
  kind: "",
  title: "",
  project: "",
  section: "",
  sprint: "",
  description: "",
  customer: "",
  phone: "",
  category: "General",
  product_name: "",
  priority: "medium",
  status: "open",
  assigned_to: "",
  helpers: [],
  due_date: "",
};

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function ComplaintForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The board "+" button opens this form with the type / status / project prefilled.
  const [form, setForm] = useState(() => ({
    ...empty,
    kind: params.get("kind") || "",
    status: params.get("status") || empty.status,
    project: params.get("project") || "",
    // Opened from a sprint (or a section inside it) on the board: start in that place.
    sprint: params.get("sprint") || "",
    section: params.get("section") || "",
  }));
  const [dragOver, setDragOver] = useState(false);
  const [team, setTeam] = useState([]);
  const [sprints, setSprints] = useState([]); // open sprints that include the chosen development project
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
  const [files, setFiles] = useState([]); // images filed together with the case
  const [imageError, setImageError] = useState("");
  const titleRef = useRef(null);

  const { access } = useAccess();
  const isAdmin = isAdminUser();
  const { projects, selected } = useProjects();
  // Support logs complaints, developers log tasks and bugs, admin can log any.
  const kindOptions = isAdmin
    ? ["task", "bug", "complaint"]
    : access === "support"
      ? ["complaint"]
      : access === "developer"
        ? ["task", "bug"]
        : ["task", "bug", "complaint"];
  // Start on the type that fits the project being viewed (support project -> complaint).
  const selectedProject = projects.find((p) => String(p.id) === String(selected));
  const preferredKind = selectedProject?.kind === "support" ? "complaint" : "task";
  const kind = kindOptions.includes(form.kind)
    ? form.kind
    : kindOptions.includes(preferredKind)
      ? preferredKind
      : kindOptions[0];
  const isComplaint = kind === "complaint";
  const kindName = KIND_LABELS[kind];
  const productName = ALL_PRODUCTS.includes(form.product_name) ? form.product_name : ALL_PRODUCTS[0];

  useConfig(); // statuses / priorities / categories are managed by the admin
  const def = defaultChoices();
  const status = STATUSES.some((s) => s.value === form.status) ? form.status : def.status;
  const priority = PRIORITIES.some((p) => p.value === form.priority) ? form.priority : def.priority;
  const category = CATEGORIES.includes(form.category) ? form.category : def.category;
  // Complaints go to support staff, tasks and bugs to developers (both fits either).
  const side = isComplaint ? ["support", "both"] : ["developer", "both"];
  const sidePeople = team.filter((t) => !t.access || side.includes(t.access));
  // Admin can pick any person directly; the project list then narrows to theirs.
  const pickedPerson = isAdmin ? sidePeople.find((t) => String(t.id) === String(form.assigned_to)) : null;

  // Complaints go in support projects, tasks and bugs in development projects.
  const kindProjects = projects.filter(
    (p) =>
      (p.kind || "development") === (isComplaint ? "support" : "development") &&
      (!pickedPerson || (p.members || []).includes(pickedPerson.id))
  );
  const projectId = kindProjects.some((p) => String(p.id) === String(form.project))
    ? String(form.project)
    : kindProjects.some((p) => String(p.id) === String(selected))
      ? String(selected)
      : kindProjects[0]
        ? String(kindProjects[0].id)
        : "";
  const proj = projects.find((p) => String(p.id) === projectId);
  const inProject = proj ? sidePeople.filter((t) => proj.members.includes(t.id)) : sidePeople;
  // Admin: assignee list is everyone on this side. Others: project members only.
  const teamHere = isAdmin ? sidePeople : inProject;
  // Helpers must always be members of the chosen project.
  const helperPool = inProject;

  useEffect(() => {
    getTeam().then(setTeam).catch(() => {});
  }, []);

  // Tasks and bugs sit under a section of the project (the admin creates the sections)...
  const sections = !isComplaint && proj ? proj.sections || [] : [];
  const sectionId = sections.some((x) => String(x.id) === String(form.section)) ? String(form.section) : "";
  const sectionObj = sections.find((x) => String(x.id) === sectionId);

  // ...and can go straight into a planned or active sprint that includes the project.
  useEffect(() => {
    if (isComplaint || !projectId) {
      setSprints([]);
      return;
    }
    getSprints({ project: projectId })
      .then((list) => setSprints(list.filter((s) => s.status !== "completed")))
      .catch(() => setSprints([]));
  }, [isComplaint, projectId]);
  // Untouched: the project's active sprint. "none" means the person chose the backlog.
  const activeSprint = sprints.find((s) => s.status === "active");
  const sprintId =
    form.sprint === "none"
      ? ""
      : sprints.some((s) => String(s.id) === String(form.sprint))
        ? String(form.sprint)
        : activeSprint
          ? String(activeSprint.id)
          : "";

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: "" }));
    setSuccess("");
  };
  const change = (e) => set(e.target.name, e.target.value);

  // Queue images (picked or pasted) to go up with the case
  const addFiles = (incoming) => {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    const fit = images.filter((f) => f.size <= MAX_IMAGE_BYTES);
    let msg = "";
    if (images.length < incoming.length) msg = "Only image files can be attached.";
    else if (fit.length < images.length) msg = "Each image must be 10 MB or smaller.";
    else if (files.length + fit.length > MAX_IMAGES) msg = `You can attach up to ${MAX_IMAGES} images.`;
    setImageError(msg);
    setFiles((prev) => [...prev, ...fit].slice(0, MAX_IMAGES));
  };
  const onPasteImages = (e) => {
    const pasted = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  const onDropImages = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer?.files || []));
  };

  const validate = () => {
    const e = {};
    // Admin raising a case must say what is wrong - the assignee reads this first.
    if (isAdmin && isComplaint && !form.description.trim() && files.length === 0)
      e.description = "Describe the issue or attach an image so the assignee knows what to fix";
    if (!projectId) e.project = "Choose a project";
    if (!isComplaint && sections.length > 0 && !sectionId) e.section = "Choose a section";
    if (!form.title.trim()) e.title = "Title is required";
    if (form.phone && !/^[0-9+\-\s]{6,20}$/.test(form.phone))
      e.phone = "Enter a valid phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setServerError("");
    setSuccess("");
    try {
      // product details belong to complaints only
      const { product_name, ...rest } = form;
      const created = await createComplaint({
        ...rest,
        ...(isComplaint && SHOW_PRODUCT
          ? { product_type: productTypeOf(productName), product_name: productName }
          : {}),
        kind,
        project: Number(projectId),
        status,
        priority,
        category,
        // customer details belong to complaints only
        customer: isComplaint ? form.customer : "",
        phone: isComplaint ? form.phone : "",
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        section: !isComplaint && sectionId ? Number(sectionId) : null,
        sprint: !isComplaint && sprintId ? Number(sprintId) : null,
      }, files);
      setFiles([]);
      setImageError("");
      if (isComplaint && created?.id) {
        navigate(`/complaints/${created.id}`);
        return;
      }
      setForm({ ...empty, kind });
      setSuccess(`${kindName} created successfully.`);
      titleRef.current?.focus();
    } catch (err) {
      const imgErr = err?.response?.data?.images;
      setServerError(
        imgErr
          ? Array.isArray(imgErr) ? imgErr[0] : imgErr
          : `Could not save the ${kindName.toLowerCase()}. Check that the backend is running.`
      );
    }
    setSaving(false);
  };

  const assignee = teamHere.find((t) => String(t.id) === String(form.assigned_to));

  return (
    <form className="cf" onSubmit={submit} noValidate>
      {isAdmin && isComplaint && (
        <div className="cf-intro">
          <strong>Open a new case</strong>
          <span>
            Write what the problem is and attach screenshots. The assignee gets it flagged as new and sees
            your description and images as soon as they open it.
          </span>
        </div>
      )}
      {serverError && <div className="cf-alert" role="alert">{serverError}</div>}
      {success && <div className="cf-alert cf-alert-ok" role="status">{success}</div>}

      <div className="cf-card">
        {/* ---------- Main details ---------- */}
        <section className="cf-section">
          <h3 className="cf-section-title">{isComplaint ? "Issue details" : kindName}</h3>

          {kindOptions.length > 1 && (
            <div className="cf-field" role="group" aria-labelledby="kind-label">
              <label id="kind-label">Type</label>
              <div className="cf-pills">
                {kindOptions.map((k) => (
                  <button
                    type="button"
                    key={k}
                    className={`cf-pill cf-pill-kind ${kind === k ? "active" : ""}`}
                    style={
                      kind === k
                        ? { background: "#4f7a46", borderColor: "#4f7a46", color: "#fff" }
                        : undefined
                    }
                    aria-pressed={kind === k}
                    onClick={() =>
                      setForm((f) => ({ ...f, kind: k, assigned_to: "", helpers: [] }))
                    }
                  >
                    {KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="cf-field">
            <label htmlFor="title">
              Title <span className="cf-req">*</span>
            </label>
            <input
              id="title"
              name="title"
              ref={titleRef}
              value={form.title}
              onChange={change}
              placeholder={isComplaint ? "e.g. Water leakage in room 204" : "e.g. Fix login error on mobile"}
              className={errors.title ? "has-error" : ""}
              aria-invalid={errors.title ? "true" : "false"}
              aria-describedby={errors.title ? "title-err" : undefined}
              autoFocus
            />
            {errors.title && <small id="title-err" className="cf-err">{errors.title}</small>}
          </div>

          <div className="cf-field">
            <label htmlFor="description">
              {isComplaint ? "What is the issue?" : "Description"}
              {isAdmin && isComplaint && <span className="cf-req"> *</span>}
            </label>
            <textarea
              id="description"
              name="description"
              rows={isComplaint ? 8 : 5}
              value={form.description}
              className={errors.description ? "has-error" : ""}
              onChange={change}
              placeholder={isComplaint ? "Describe the complaint in detail..." : "Describe the work or the bug in detail..."}
              maxLength={1000}
              onPaste={onPasteImages}
            />
            {errors.description && <small className="cf-err">{errors.description}</small>}
            <small className="cf-count">{form.description.length}/1000</small>
          </div>

          <div className="cf-field">
            <label>Images</label>
            <div
              className={`cf-drop ${dragOver ? "is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDropImages}
            >
              <AttachButton
                label="Add images"
                onPick={addFiles}
                disabled={saving || files.length >= MAX_IMAGES}
              />
              <small className="cf-count">
                Drag &amp; drop, browse, or paste with Ctrl+V · JPG, PNG, GIF or WebP · up to {MAX_IMAGES}
              </small>
            </div>
            <PreviewStrip
              files={files}
              onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
            {imageError && <small className="cf-err">{imageError}</small>}
          </div>
        </section>

        {/* ---------- Customer (complaints only) ---------- */}
        {isComplaint && (
          <section className="cf-section">
            <h3 className="cf-section-title">Customer</h3>

            <div className="cf-row">
              <div className="cf-field">
                <label htmlFor="customer">Customer name</label>
                <input
                  id="customer"
                  name="customer"
                  value={form.customer}
                  onChange={change}
                  placeholder="Customer name"
                />
              </div>
              <div className="cf-field">
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={change}
                  placeholder="+91 98765 43210"
                  className={errors.phone ? "has-error" : ""}
                  aria-invalid={errors.phone ? "true" : "false"}
                  aria-describedby={errors.phone ? "phone-err" : undefined}
                />
                {errors.phone && <small id="phone-err" className="cf-err">{errors.phone}</small>}
              </div>
            </div>
          </section>
        )}

        {/* ---------- Product (complaints only, hidden for now) ---------- */}
        {SHOW_PRODUCT && isComplaint && (
          <section className="cf-section">
            <h3 className="cf-section-title">Product</h3>

            <div className="cf-field">
              <label htmlFor="product_name">Product</label>
              <select
                id="product_name"
                name="product_name"
                value={productName}
                onChange={change}
              >
                {PRODUCT_TYPES.map((t) => (
                  <optgroup key={t.value} label={t.label}>
                    {PRODUCTS[t.value].map((p) => <option key={p}>{p}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* ---------- Assignment ---------- */}
        <section className="cf-section">
          <h3 className="cf-section-title">Assignment</h3>

          <div className="cf-field">
            <label htmlFor="project">
              Project <span className="cf-req">*</span>
            </label>
            <select
              id="project"
              name="project"
              value={projectId}
              className={errors.project ? "has-error" : ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  project: e.target.value,
                  assigned_to: isAdmin ? f.assigned_to : "",
                  helpers: [],
                  section: "",
                  sprint: "",
                }))
              }
            >
              {kindProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {kindProjects.length === 0 && (
              <small className="cf-err">
                {pickedPerson
                  ? `${pickedPerson.full_name} is not in any ${isComplaint ? "support" : "development"} project yet.`
                  : `You are not in any ${isComplaint ? "support" : "development"} project yet.`}
              </small>
            )}
            {errors.project && <small className="cf-err">{errors.project}</small>}
          </div>

          {!isComplaint && projectId && (
            <div className="cf-field">
              <label htmlFor="section">
                Section {sections.length > 0 && <span className="cf-req">*</span>}
              </label>
              <select
                id="section"
                name="section"
                value={sectionId}
                className={errors.section ? "has-error" : ""}
                onChange={(e) => {
                  const sec = sections.find((x) => String(x.id) === e.target.value);
                  const owners = (sec?.owners || []).filter((id) => teamHere.some((t) => t.id === id));
                  setForm((f) => ({
                    ...f,
                    section: e.target.value,
                    // a section with one owner: give the task to them unless someone is already picked
                    assigned_to: !f.assigned_to && owners.length === 1 ? String(owners[0]) : f.assigned_to,
                  }));
                  setErrors((er) => ({ ...er, section: "" }));
                }}
                disabled={sections.length === 0}
              >
                <option value="">
                  {sections.length === 0 ? "No sections in this project yet" : "Choose a section"}
                </option>
                {sections.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
              {sectionObj && (sectionObj.owner_names || []).length > 0 && (
                <small className="cf-count">Section owners: {sectionObj.owner_names.join(", ")}</small>
              )}
              {sections.length === 0 && (
                <small className="cf-count">The admin adds sections under Projects.</small>
              )}
              {errors.section && <small className="cf-err">{errors.section}</small>}
            </div>
          )}

          {!isComplaint && sprints.length > 0 && (
            <div className="cf-field">
              <label htmlFor="sprint">Sprint</label>
              <select
                id="sprint"
                name="sprint"
                value={sprintId || "none"}
                onChange={(e) => set("sprint", e.target.value)}
              >
                <option value="none">Backlog (no sprint)</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === "active" ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="cf-row">
            <div className="cf-field">
              <label htmlFor="assigned_to">Assign to</label>
              <div className="cf-assignee">
                <span className={`cf-avatar ${assignee ? "on" : ""}`} aria-hidden="true">
                  {assignee ? initials(assignee.full_name) : "?"}
                </span>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  value={form.assigned_to}
                  onChange={change}
                >
                  <option value="">Unassigned</option>
                  {teamHere.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <small className="cf-count">
                  {assignee
                    ? `${assignee.full_name} and the ${proj ? proj.name : "project"} team will be notified.`
                    : proj
                      ? `The ${proj.name} team will be notified.`
                      : ""}
                </small>
              )}
            </div>
            <div className="cf-field">
              <label htmlFor="due_date">Due date</label>
              <input
                id="due_date"
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={change}
              />
            </div>
          </div>

          {!isComplaint && (
            <div className="cf-field">
              <label>Helpers</label>
              <HelpersField
                team={helperPool}
                value={form.helpers}
                excludeId={form.assigned_to}
                onChange={(ids) => set("helpers", ids)}
              />
            </div>
          )}

          <div className="cf-row">
            <div className="cf-field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" value={status} onChange={change}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="cf-field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category" value={category} onChange={change}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="cf-field" role="group" aria-labelledby="priority-label">
            <label id="priority-label">Priority</label>
            <div className="cf-pills">
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  className={`cf-pill p-${p.value} ${priority === p.value ? "active" : ""}`}
                  aria-pressed={priority === p.value}
                  onClick={() => set("priority", p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="cf-actions">
          <Link to="/" className="cf-btn cf-btn-ghost">Cancel</Link>
          <button type="submit" className="cf-btn cf-btn-primary" disabled={saving}>
            {saving ? "Creating..." : `Create ${kindName.toLowerCase()}`}
          </button>
        </div>
      </div>
    </form>
  );
}