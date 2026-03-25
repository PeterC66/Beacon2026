/**
 * Red asterisk indicator for mandatory form fields.
 * Usage: <label>Surname <RequiredMark /></label>
 */
export default function RequiredMark() {
  return <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>;
}
