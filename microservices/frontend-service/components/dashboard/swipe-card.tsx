"use client"

import { motion, useMotionValue, useTransform } from "framer-motion"
import { Pencil, Trash2 } from "lucide-react"

interface SwipeCardProps {
  onDragStart: () => void
  onDragEnd: (swipedLeft: boolean, swipedRight: boolean) => void
  children: React.ReactNode
}

export function SwipeCard({ onDragStart, onDragEnd, children }: SwipeCardProps) {
  const x = useMotionValue(0)
  const editOpacity   = useTransform(x, [20, 85], [0, 1])
  const deleteOpacity = useTransform(x, [-85, -20], [1, 0])

  return (
    <div className="relative">
      {/* Edit hint — fades in when swiping right */}
      <motion.div
        className="absolute inset-0 flex items-center justify-start px-5 rounded-2xl pointer-events-none"
        style={{ opacity: editOpacity }}
      >
        <div className="flex items-center gap-1.5 text-primary">
          <Pencil className="w-4 h-4" />
          <span className="text-xs font-medium">Editar</span>
        </div>
      </motion.div>

      {/* Delete hint — fades in when swiping left */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end px-5 rounded-2xl pointer-events-none"
        style={{ opacity: deleteOpacity }}
      >
        <div className="flex items-center gap-1.5 text-destructive">
          <span className="text-xs font-medium">Eliminar</span>
          <Trash2 className="w-4 h-4" />
        </div>
      </motion.div>

      {/* Draggable layer */}
      <motion.div
        drag="x"
        style={{ x }}
        dragSnapToOrigin
        dragConstraints={{ left: -110, right: 110 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDragEnd={(_, info) => onDragEnd(info.offset.x < -75, info.offset.x > 75)}
      >
        {children}
      </motion.div>
    </div>
  )
}
