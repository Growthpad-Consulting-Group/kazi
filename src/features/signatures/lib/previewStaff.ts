export type PreviewStaff = {
  id: string;
  full_name: string;
  email: string;
  role_title: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
};

function escapeHtml(value: string | null | undefined) {
  return (value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}

export function renderPreviewHtml(html: string, staff: PreviewStaff | null) {
  if (!staff) return html;
  const values: Record<string, string | null | undefined> = {
    full_name: staff.full_name,
    email: staff.email,
    role_title: staff.role_title,
    department: staff.department,
    phone: staff.phone,
    mobile: staff.mobile,
    photo_url: staff.photo_url,
  };
  return html.replace(
    /\{\{(full_name|email|role_title|department|phone|mobile|photo_url)\}\}/g,
    (_match, key: string) => escapeHtml(values[key]),
  );
}
