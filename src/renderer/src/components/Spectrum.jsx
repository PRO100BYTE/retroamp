import React, { useRef, useEffect, useState } from 'react'

export default function Spectrum({ analyserRef, playing, intensity = 1, mode = 'bars', onContextMenu }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const barsRef = useRef([])
  const peaksRef = useRef([])
  const peakVelRef = useRef([])
  const isPlayingRef = useRef(playing)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    isPlayingRef.current = playing
  }, [playing])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    setIsReady(true)
    const dpr = window.devicePixelRatio || 1

    // Setup canvas with proper DPR scaling
    const updateCanvasSize = () => {
      const rect = wrap.getBoundingClientRect()
      const w = Math.max(32, rect.width)
      const h = Math.max(32, rect.height)
      
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      
      barsRef.current = []
      peaksRef.current = []
      peakVelRef.current = []
    }

    updateCanvasSize()
    
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize()
    })
    resizeObserver.observe(wrap)

    window.addEventListener('resize', updateCanvasSize)

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let frequencyData = null
    let prevFrequencyData = null
    let barCount = 0
    let currentBars = []
    let peaks = []
    let peakVelocity = []

    const getBarCount = (width) => Math.max(16, Math.floor(width / 8))
    
    const drawFrame = () => {
      rafRef.current = requestAnimationFrame(drawFrame)

      const analyser = analyserRef?.current
      if (!analyser) {
        // Draw "no signal" state
        const w = canvas.width / dpr
        const h = canvas.height / dpr
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = 'rgba(0, 255, 65, 0.1)'
        ctx.font = '11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('NO SIGNAL', w / 2, h / 2)
        return
      }

      const w = Math.round(canvas.width / dpr)
      const h = Math.round(canvas.height / dpr)
      
      // Reinitialize bars if size changed
      const newBarCount = getBarCount(w)
      if (newBarCount !== barCount) {
        barCount = newBarCount
        currentBars = new Array(barCount).fill(0)
        peaks = new Array(barCount).fill(0)
        peakVelocity = new Array(barCount).fill(0)
        barsRef.current = currentBars
        peaksRef.current = peaks
        peakVelRef.current = peakVelocity
      }

      // Get frequency data
      const fftSize = analyser.frequencyBinCount
      if (!frequencyData || frequencyData.length !== fftSize) {
        frequencyData = new Uint8Array(fftSize)
        prevFrequencyData = new Uint8Array(fftSize)
      }

      if (isPlayingRef.current) {
        analyser.getByteFrequencyData(frequencyData)
      } else {
        // Decay when not playing
        for (let i = 0; i < frequencyData.length; i++) {
          frequencyData[i] = Math.max(0, frequencyData[i] - 5)
        }
      }

      // Clear canvas
      ctx.fillStyle = '#020702'
      ctx.fillRect(0, 0, w, h)

      // Draw grid
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.05)'
      ctx.lineWidth = 1
      for (let i = 0; i < h; i += Math.max(1, Math.floor(h / 10))) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(w, i)
        ctx.stroke()
      }

      // Process bars
      const barWidth = Math.max(2, Math.floor(w / barCount) - 1)
      const barGap = Math.max(1, Math.floor(w / barCount) - barWidth)
      
      for (let i = 0; i < barCount; i++) {
        // Map frequency bins to bar
        const binStart = Math.floor((i / barCount) * fftSize)
        const binEnd = Math.floor(((i + 1) / barCount) * fftSize)
        
        let sum = 0
        let changeSum = 0
        for (let b = binStart; b < binEnd; b++) {
          sum += frequencyData[b]
          changeSum += Math.abs(frequencyData[b] - (prevFrequencyData[b] || 0))
        }
        
        const binCount = binEnd - binStart
        const avg = sum / binCount
        const changeVal = changeSum / binCount

        // Smooth the bar value
        const target = (avg / 255) * intensity
        currentBars[i] = currentBars[i] * 0.7 + target * 0.3
        
        const barHeight = currentBars[i] * h

        // Update peaks
        if (barHeight > peaks[i]) {
          peaks[i] = barHeight
          peakVelocity[i] = 0
        } else {
          peakVelocity[i] = Math.min(10, peakVelocity[i] + 0.5)
          peaks[i] = Math.max(0, peaks[i] - peakVelocity[i])
        }

        const x = i * (barWidth + barGap)

        // Draw based on mode
        if (mode === 'bars') {
          drawBar(ctx, x, w, h, barHeight, barWidth)
        } else if (mode === 'dots') {
          drawDots(ctx, x, w, h, barHeight, barWidth)
        } else if (mode === 'mirror') {
          drawMirror(ctx, x, w, h, barHeight, barWidth)
        }

        // Draw peak indicator
        if (peaks[i] > 1) {
          ctx.fillStyle = '#99ffbb'
          ctx.fillRect(x, h - peaks[i], barWidth, 2)
        }
      }

      // Copy current to previous
      if (frequencyData && prevFrequencyData) {
        prevFrequencyData.set(frequencyData)
      }
    }

    const drawBar = (ctx2d, x, w, h, barHeight, barWidth) => {
      const gradient = ctx2d.createLinearGradient(0, h - barHeight, 0, h)
      gradient.addColorStop(0, '#00ff41')
      gradient.addColorStop(0.5, '#00aa33')
      gradient.addColorStop(1, '#003311')
      ctx2d.fillStyle = gradient
      ctx2d.fillRect(x, h - barHeight, barWidth, barHeight)
    }

    const drawDots = (ctx2d, x, w, h, barHeight, barWidth) => {
      const dotSize = 3
      for (let y = h; y > h - barHeight; y -= dotSize + 1) {
        const alpha = 0.4 + ((h - y) / Math.max(1, barHeight)) * 0.6
        ctx2d.fillStyle = `rgba(0, 255, 65, ${alpha})`
        ctx2d.fillRect(x + (barWidth - dotSize) / 2, y, dotSize, dotSize)
      }
    }

    const drawMirror = (ctx2d, x, w, h, barHeight, barWidth) => {
      const halfH = barHeight / 2
      const centerY = h / 2
      
      const gradient = ctx2d.createLinearGradient(0, centerY - halfH, 0, centerY + halfH)
      gradient.addColorStop(0, '#00ff41')
      gradient.addColorStop(0.5, '#00aa33')
      gradient.addColorStop(1, '#003311')
      
      ctx2d.fillStyle = gradient
      ctx2d.fillRect(x, centerY - halfH, barWidth, halfH)
      ctx2d.fillRect(x, centerY, barWidth, halfH)
    }

    drawFrame()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateCanvasSize)
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [intensity, mode, analyserRef])

  return (
    <div 
      ref={wrapRef} 
      className="spectrum-wrap" 
      onContextMenu={onContextMenu}
      style={{ width: '100%', height: '100%' }}
    >
      <canvas 
        ref={canvasRef} 
        className="spectrum-canvas"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {!isReady && (
        <div className="spectrum-loading">Initializing...</div>
      )}
    </div>
  )
}
