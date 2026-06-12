'use client'

import * as React from 'react'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import { motion, AnimatePresence } from 'framer-motion'

import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        'bg-background group/calendar p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit mx-auto', defaultClassNames.root),
        months: cn(
          'flex gap-4 flex-col md:flex-row relative',
          defaultClassNames.months,
        ),
        month: cn('flex flex-col w-full gap-4', defaultClassNames.month),
        nav: cn(
          'flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) aria-disabled:opacity-50 p-0 select-none',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) aria-disabled:opacity-50 p-0 select-none',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'relative has-focus:border-ring border border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          'absolute bg-popover inset-0 opacity-0',
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          'select-none font-medium',
          captionLayout === 'label'
            ? 'text-sm'
            : 'rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5',
          defaultClassNames.caption_label,
        ),
        table: 'w-full border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none',
          defaultClassNames.weekday,
        ),
        week: cn('flex w-full mt-2', defaultClassNames.week),
        week_number_header: cn(
          'select-none w-(--cell-size)',
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          'text-[0.8rem] select-none text-muted-foreground',
          defaultClassNames.week_number,
        ),
        day: cn(
          'relative w-full h-full p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md group/day aspect-square select-none',
          defaultClassNames.day,
        ),
        range_start: cn(
          'rounded-l-md bg-accent',
          defaultClassNames.range_start,
        ),
        range_middle: cn('rounded-none', defaultClassNames.range_middle),
        range_end: cn('rounded-r-md bg-accent', defaultClassNames.range_end),
        today: cn(
          'bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside,
        ),
        disabled: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.disabled,
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === 'left') {
            return (
              <ChevronLeftIcon className={cn('size-4', className)} {...props} />
            )
          }

          if (orientation === 'right') {
            return (
              <ChevronRightIcon
                className={cn('size-4', className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn('size-4', className)} {...props} />
          )
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  )
}

// ── CalendarWithNav ──────────────────────────────────────────────────────────
// A Calendar wrapper with a custom month/year picker header, replacing the
// native <select> dropdowns with a polished inline grid selector.

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const MONTH_ABBR_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

function shiftMonth(date: Date, delta: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + delta)
  return d
}

interface CalendarWithNavProps {
  selected?: DateRange | undefined
  onSelect?: (range: DateRange | undefined) => void
  disabled?: React.ComponentProps<typeof DayPicker>['disabled']
  locale?: React.ComponentProps<typeof DayPicker>['locale']
  className?: string
}

function CalendarWithNav({
  selected,
  onSelect,
  disabled,
  locale,
  className,
}: CalendarWithNavProps) {
  const today = React.useMemo(() => new Date(), [])
  const maxYear = today.getFullYear()
  const maxMonth = today.getMonth()

  const [viewDate, setViewDate] = React.useState<Date>(() => {
    const ref = selected?.from ?? new Date()
    return new Date(ref.getFullYear(), ref.getMonth())
  })

  const [pickerMode, setPickerMode] = React.useState<'days' | 'months' | 'years'>('days')

  const viewMonth = viewDate.getMonth()
  const viewYear = viewDate.getFullYear()
  const isAtMaxMonth = viewYear === maxYear && viewMonth === maxMonth

  const years = React.useMemo(
    () => Array.from({ length: maxYear - 1999 }, (_, i) => maxYear - i),
    [maxYear],
  )

  return (
    <div className={cn('select-none', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-1">
        {pickerMode === 'days' ? (
          <>
            <button
              type="button"
              onClick={() => setViewDate(shiftMonth(viewDate, -1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors cursor-pointer shrink-0"
              aria-label="Mes anterior"
            >
              <ChevronLeftIcon className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPickerMode('months')}
                className="px-2.5 py-1.5 rounded-lg text-sm font-semibold hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1"
              >
                {MONTH_NAMES_ES[viewMonth]}
                <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => setPickerMode('years')}
                className="px-2.5 py-1.5 rounded-lg text-sm font-semibold hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1"
              >
                {viewYear}
                <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => !isAtMaxMonth && setViewDate(shiftMonth(viewDate, 1))}
              disabled={isAtMaxMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default shrink-0"
              aria-label="Mes siguiente"
            >
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        ) : pickerMode === 'months' ? (
          <>
            <button
              type="button"
              disabled={viewYear <= 2000}
              onClick={() => setViewDate(new Date(viewYear - 1, viewMonth))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default shrink-0"
              aria-label="Año anterior"
            >
              <ChevronLeftIcon className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => setPickerMode('years')}
              className="px-2.5 py-1.5 rounded-lg text-sm font-semibold hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1"
            >
              {viewYear}
              <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              disabled={viewYear >= maxYear}
              onClick={() => setViewDate(new Date(viewYear + 1, viewMonth))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default shrink-0"
              aria-label="Año siguiente"
            >
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        ) : (
          <p className="w-full text-center text-sm font-semibold text-foreground py-1">
            Seleccioná el año
          </p>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait" initial={false}>
        {pickerMode === 'days' && (
          <motion.div
            key="days"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <Calendar
              mode="range"
              selected={selected}
              onSelect={(range: DateRange | undefined) => onSelect?.(range)}
              locale={locale}
              disabled={disabled}
              month={viewDate}
              onMonthChange={setViewDate}
              hideNavigation
              classNames={{ month_caption: 'hidden' }}
              className="bg-transparent mx-auto"
            />
          </motion.div>
        )}

        {pickerMode === 'months' && (
          <motion.div
            key="months"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-3 gap-1.5 px-3 pt-1 pb-3"
          >
            {MONTH_ABBR_ES.map((abbr, idx) => {
              const isActive = idx === viewMonth
              const isDisabled = viewYear === maxYear && idx > maxMonth
              return (
                <button
                  key={abbr}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    setViewDate(new Date(viewYear, idx))
                    setPickerMode('days')
                  }}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer',
                    isDisabled ? 'opacity-30 cursor-not-allowed' :
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-secondary text-foreground',
                  )}
                >
                  {abbr}
                </button>
              )
            })}
          </motion.div>
        )}

        {pickerMode === 'years' && (
          <motion.div
            key="years"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-4 gap-1.5 px-3 pt-1 pb-3 max-h-[196px] overflow-y-auto [scrollbar-width:thin]"
          >
            {years.map(year => (
              <button
                key={year}
                type="button"
                onClick={() => {
                  setViewDate(new Date(year, viewMonth))
                  setPickerMode('months')
                }}
                className={cn(
                  'py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer',
                  year === viewYear
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'hover:bg-secondary text-foreground',
                )}
              >
                {year}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { Calendar, CalendarDayButton, CalendarWithNav }
