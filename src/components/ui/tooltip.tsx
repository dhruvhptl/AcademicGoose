"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProviderProps {
  children: React.ReactNode
  delay?: number
}

const TooltipProvider = ({ children }: TooltipProviderProps) => {
  return <>{children}</>
}

interface TooltipContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextValue>({
  open: false,
  setOpen: () => {},
})

interface TooltipProps {
  children: React.ReactNode
  defaultOpen?: boolean
}

const Tooltip = ({ children, defaultOpen = false }: TooltipProps) => {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </TooltipContext.Provider>
  )
}

interface TooltipTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

const TooltipTrigger = ({ children }: TooltipTriggerProps) => {
  const { setOpen } = React.useContext(TooltipContext)
  return (
    <div
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
    </div>
  )
}

interface TooltipContentProps {
  children: React.ReactNode
  className?: string
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}

const TooltipContent = ({ children, className, side = "top" }: TooltipContentProps) => {
  const { open } = React.useContext(TooltipContext)

  if (!open) return null

  const positionClass = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1",
    left: "right-full top-1/2 -translate-y-1/2 mr-1",
    right: "left-full top-1/2 -translate-y-1/2 ml-1",
  }[side]

  return (
    <div
      className={cn(
        "absolute z-50 rounded-md bg-gray-800 border border-gray-600 px-2 py-1 text-xs text-gray-100 shadow-md whitespace-nowrap pointer-events-none",
        positionClass,
        className
      )}
    >
      {children}
    </div>
  )
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
