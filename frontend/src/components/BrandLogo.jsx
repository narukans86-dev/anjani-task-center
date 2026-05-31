import { useState } from 'react'

export default function BrandLogo({
  className = 'h-10',
  fallbackClassName = '',
  alt = 'Anjani Medical',
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className={`font-bold text-[#0A3D91] tracking-tight ${fallbackClassName}`}>
        Anjani Medical
      </span>
    )
  }

  return (
    <img
      src="/brand/logo.png"
      alt={alt}
      className={`block w-auto object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
