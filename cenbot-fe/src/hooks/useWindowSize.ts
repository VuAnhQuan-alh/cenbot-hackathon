import { useLayoutEffect, useState, useRef } from "react"

export interface WindowSize {
  width: number
  height: number
}

// Hook
const useWindowSize = (): WindowSize => {
  const windowSizeRef = useRef<WindowSize>({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  const [windowSize, setWindowSize] = useState<WindowSize>(
    windowSizeRef.current,
  )

  useLayoutEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight

      // Check if window size has actually changed
      if (
        newWidth !== windowSizeRef.current.width ||
        newHeight !== windowSizeRef.current.height
      ) {
        windowSizeRef.current.width = newWidth
        windowSizeRef.current.height = newHeight
        setWindowSize({ ...windowSizeRef.current })
      }
    }

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return windowSize
}

export default useWindowSize
