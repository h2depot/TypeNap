import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { motion as Motion, MotionConfig } from 'framer-motion'
import { photoPaths } from '../utils/imagePaths.js'
import { photoSource } from './photoImages.js'
import './WorldNode.css'
import TN_NodeTip from '../Components/TNDesignSystem/TN_NodeTip.jsx'

export default function WorldNode({ name = '', summary = '', theme, tooltipMaxLength = 120, tooltip = true, imagePath: singleImagePath = '', imagePaths = [], previousImagePath: suppliedPreviousImagePath = '', imageTransitionKey: suppliedTransitionKey = 0, width = 300, height = Number(width) * 388 / 499, interactive = true, hoverLift = false, hoverStroke = true, style, ...props }) {
  const paths = photoPaths(imagePaths)
  const pathsKey = JSON.stringify(paths)
  const [photo, setPhoto] = useState(null)
  const activePhoto = photo?.pathsKey === pathsKey ? photo : null
  const imagePath = paths.length ? paths[activePhoto?.index ?? 0] : singleImagePath
  const previousImagePath = paths.length ? activePhoto?.previous || '' : suppliedPreviousImagePath
  const imageTransitionKey = paths.length ? activePhoto?.revision || 0 : suppliedTransitionKey

  useEffect(() => {
    const sequence = JSON.parse(pathsKey)
    if (sequence.length < 2) return
    let index = 0
    let revision = 0
    let timer
    const schedule = () => {
      // 12 seconds, with a fresh random offset between -4 and +4 seconds.
      timer = setTimeout(() => {
        const previous = sequence[index]
        index = (index + 1) % sequence.length
        revision += 1
        setPhoto({ pathsKey, index, previous, revision })
        schedule()
      }, (12 + (Math.random() * 8 - 4)) * 1000)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [pathsKey])

  const id = useId()
  const textRef = useRef(null)
  const nameClipId = `${id}-name-clip`
  const imageClipId = `${id}-image-clip`
  const shadowId = `${id}-shadow`
  const fontFamily = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(name)
    ? "'M PLUS 1p', sans-serif"
    : /^[\x20-\x7E\s]*$/.test(name) ? "'Caveat', sans-serif" : 'sans-serif'
  const fontSize = fontFamily.includes('Caveat') ? 36 : 24

  useLayoutEffect(() => {
    const text = textRef.current
    let active = true
    const fitName = () => {
      if (!active) return
      text.textContent = name
      if (text.getComputedTextLength() <= 397) return
      const characters = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name), ({ segment }) => segment)
      let low = 0
      let high = characters.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        text.textContent = `${characters.slice(0, middle).join('')}...`
        if (text.getComputedTextLength() <= 397) low = middle
        else high = middle - 1
      }
      text.textContent = `${characters.slice(0, low).join('')}...`
    }
    fitName()
    document.fonts.ready.then(fitName)
    document.fonts.addEventListener('loadingdone', fitName)
    return () => {
      active = false
      document.fonts.removeEventListener('loadingdone', fitName)
    }
  }, [name, fontFamily, fontSize])

  return (
    <MotionConfig reducedMotion="never">
      <TN_NodeTip name={name} summary={summary} theme={theme} maxLength={tooltipMaxLength} disabled={!interactive || !tooltip}>
      <Motion.div
        className="world-node"
        initial="rest"
        animate="rest"
        whileHover={interactive && hoverLift ? 'hover' : undefined}
        whileTap={interactive ? 'tap' : undefined}
        variants={{
          rest: { transform: 'translateY(0px) scale(1)', filter: 'drop-shadow(0px 3px 2px rgba(0, 0, 0, 0.12))' },
          hover: { transform: 'translateY(-6px) scale(1.03)', filter: 'drop-shadow(0px 12px 8px rgba(0, 0, 0, 0.24))' },
          tap: {
            transform: 'translateY(2px) scale(0.97)',
            filter: 'drop-shadow(1px 2px 1px rgba(0, 0, 0, 0.18))',
            transition: { duration: 0.12, ease: [0.2, 0.8, 0.2, 1] },
          },
        }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'inline-block', width, maxWidth: '100%', flexShrink: 0, position: 'relative', transformOrigin: '50% 50%', willChange: interactive ? 'transform' : undefined, cursor: interactive ? 'pointer' : 'default' }}
      >
        <svg width={width} height={height} viewBox="0 0 499 388" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={name || 'World'} style={{ display: 'block', maxWidth: '100%', height: 'auto', overflow: 'visible', ...style }} {...props}>

<g filter={`url(#${shadowId})`}>
<rect width="488" height="377" rx="12" fill="#D4CFBF"/>
<rect x="33" y="26" width="421.429" height="284.749" rx="12" fill="#222221"/>
<g visibility={imagePath ? 'hidden' : 'visible'}>
<path d="M179.04 290.322L313.174 163.639C316.642 160.364 322.065 160.364 325.533 163.639L425.407 257.965C426.607 259.098 427.287 260.676 427.287 262.327V284.322C427.287 287.635 424.601 290.322 421.287 290.322H179.04ZM66.3126 290.322C62.9989 290.322 60.3126 287.635 60.3126 284.322V262.327C60.3126 260.676 60.9927 259.098 62.1929 257.965L129.687 194.221C133.155 190.945 138.577 190.945 142.046 194.221L243.8 290.322H66.3126Z" fill="#D4CFBF"/>
<path d="M141.863 167.997C164.382 167.997 182.638 149.741 182.638 127.222C182.638 104.702 164.382 86.4469 141.863 86.4469C119.343 86.4469 101.088 104.702 101.088 127.222C101.088 149.741 119.343 167.997 141.863 167.997Z" fill="#D4CFBF"/>
</g>
</g>
{imagePath && (
  <g clipPath={`url(#${imageClipId})`} style={{ pointerEvents: 'none', '--photo-slide-distance': '284.749px' }}>
    {previousImagePath && <image key={`outgoing-${imageTransitionKey}`} className="world-photo__outgoing" href={photoSource(previousImagePath)} x="33" y="26" width="421.429" height="284.749" preserveAspectRatio="xMidYMid slice" />}
    <image key={`${imagePath}-${imageTransitionKey}`} className={imageTransitionKey ? 'world-photo__incoming' : undefined} href={photoSource(imagePath)} x="33" y="26" width="421.429" height="284.749" preserveAspectRatio="xMidYMid slice" />
  </g>
)}
<text ref={textRef} x="244" y="344" textAnchor="middle" dominantBaseline="middle" fill="#222221" fontFamily={fontFamily} fontSize={fontSize} fontWeight="500" clipPath={`url(#${nameClipId})`} style={{ whiteSpace: 'pre', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' }}>{name}</text>
<defs>
<clipPath id={imageClipId}><rect x="33" y="26" width="421.429" height="284.749" rx="12" /></clipPath>
<clipPath id={nameClipId}><rect x="33" y="315" width="421.429" height="57" /></clipPath>
<filter id={shadowId} x="0" y="0" width="498.8" height="387.8" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
<feFlood floodOpacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="10" dy="10"/>
<feGaussianBlur stdDeviation="0.4"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_306_99"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_306_99" result="shape"/>
</filter>
</defs>
        </svg>
        {interactive && hoverStroke && <span className="world-node__stroke" aria-hidden="true" />}
      </Motion.div>
      </TN_NodeTip>
    </MotionConfig>
  )
}
