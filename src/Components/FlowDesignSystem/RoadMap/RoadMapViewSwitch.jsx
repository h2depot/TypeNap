import { useRef } from 'react'
import { RoadMap, ListViewIcon } from '../../../assets/IconList.js'
import TN_Tooltip from '../../TNDesignSystem/TN_Tooltip.jsx'
import './RoadMapViewSwitch.css'

const options = [
  { value: 'roadmap', label: 'RoadMap表示', Icon: RoadMap },
  { value: 'list', label: 'ListView表示', Icon: ListViewIcon },
]

export default function RoadMapViewSwitch({ value, onChange, theme }) {
  const buttons = useRef([])
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  const keyboard = event => {
    let next
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (selectedIndex + 1) % options.length
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (selectedIndex + options.length - 1) % options.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = options.length - 1
    if (next === undefined) return
    event.preventDefault()
    onChange(options[next].value)
    buttons.current[next]?.focus()
  }

  return <div data-tn-ui data-theme={theme} className="roadmap-view-switch" role="radiogroup"
    aria-label="RoadMapの表示形式" onKeyDown={keyboard} style={{ '--roadmap-view-index': selectedIndex }}>
    <span className="roadmap-view-switch__indicator" aria-hidden="true" />
    {options.map(({ value: optionValue, label, Icon }, index) => <TN_Tooltip key={optionValue} content={label} position="bottom" theme={theme} subtle>
      <button ref={element => { buttons.current[index] = element }} type="button" role="radio"
        className="roadmap-view-switch__option" aria-label={label} aria-checked={index === selectedIndex}
        tabIndex={index === selectedIndex ? 0 : -1} onClick={() => onChange(optionValue)}>
        <Icon size={20} aria-hidden="true" />
      </button>
    </TN_Tooltip>)}
  </div>
}
