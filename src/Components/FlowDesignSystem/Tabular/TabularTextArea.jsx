// Tabular owns multiline editing; shared TN_TextField stays unchanged.
export default function TabularTextArea({ rows = 2, ...props }) {
  return <textarea {...props} className="tabular-textarea" rows={rows} />
}
