import TN_IconButton from '../../TNDesignSystem/TN_IconButton.jsx'
import TN_Button from '../../TNDesignSystem/TN_Button.jsx'

export default function TabularActionButton({ icon, children, theme, variant = 'ghost', trailingIcon, ...props }) {
  const label = <span className="tabular__action-label">{icon}{children}{trailingIcon}</span>
  if (variant !== 'ghost') return <TN_Button {...props} theme={theme} variant={variant} borderRadius="14px"
    style={{ height: 44, whiteSpace: 'nowrap' }}>{label}</TN_Button>
  return <TN_IconButton {...props} theme={theme} subtle variant="ghost" size="small" borderRadius="10px"
    className="tabular__quiet-action" style={{ width: 'auto', height: 32, padding: '0 10px' }} icon={label} />
}
