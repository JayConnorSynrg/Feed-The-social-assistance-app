'use client'

import { useState, useEffect } from 'react'

type Frequency = 'none' | 'daily' | 'weekly' | 'monthly'

const DAYS = [
  { key: 'MO', label: 'Mo' },
  { key: 'TU', label: 'Tu' },
  { key: 'WE', label: 'We' },
  { key: 'TH', label: 'Th' },
  { key: 'FR', label: 'Fr' },
  { key: 'SA', label: 'Sa' },
  { key: 'SU', label: 'Su' },
]

interface Props {
  value: string | null
  onChange: (rrule: string | null) => void
}

function parseFreq(rrule: string | null): { freq: Frequency; days: string[] } {
  if (!rrule) return { freq: 'none', days: [] }
  if (rrule.startsWith('FREQ=DAILY')) return { freq: 'daily', days: [] }
  if (rrule.startsWith('FREQ=MONTHLY')) return { freq: 'monthly', days: [] }
  if (rrule.startsWith('FREQ=WEEKLY')) {
    const match = rrule.match(/BYDAY=([A-Z,]+)/)
    const days = match ? match[1].split(',') : []
    return { freq: 'weekly', days }
  }
  return { freq: 'none', days: [] }
}

function buildRrule(freq: Frequency, days: string[]): string | null {
  if (freq === 'none') return null
  if (freq === 'daily') return 'FREQ=DAILY'
  if (freq === 'monthly') return 'FREQ=MONTHLY'
  if (freq === 'weekly') {
    const byDay = days.length > 0 ? `;BYDAY=${days.join(',')}` : ''
    return `FREQ=WEEKLY${byDay}`
  }
  return null
}

export function RecurrencePicker({ value, onChange }: Props) {
  const parsed = parseFreq(value)
  const [freq, setFreq] = useState<Frequency>(parsed.freq)
  const [selectedDays, setSelectedDays] = useState<string[]>(parsed.days)

  useEffect(() => {
    const p = parseFreq(value)
    Promise.resolve().then(() => {
      setFreq(p.freq)
      setSelectedDays(p.days)
    })
  }, [value])

  function handleFreqChange(f: Frequency) {
    setFreq(f)
    const newDays = f === 'weekly' ? selectedDays : []
    onChange(buildRrule(f, newDays))
  }

  function toggleDay(day: string) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day]
    setSelectedDays(next)
    onChange(buildRrule('weekly', next))
  }

  const pills: { key: Frequency; label: string }[] = [
    { key: 'none', label: 'None' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => (
          <button
            key={pill.key}
            type="button"
            onClick={() => handleFreqChange(pill.key)}
            className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              freq === pill.key
                ? 'bg-[#4a5d23] text-white border-[#4a5d23]'
                : 'bg-white text-stone-700 border-stone-300 hover:border-[#4a5d23] hover:text-[#4a5d23]'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {freq === 'weekly' && (
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => toggleDay(day.key)}
              className={`min-h-[44px] min-w-[44px] rounded-full text-sm font-medium border transition-colors ${
                selectedDays.includes(day.key)
                  ? 'bg-lime-600 text-white border-lime-600'
                  : 'bg-white text-stone-700 border-stone-300 hover:border-lime-600 hover:text-lime-700'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

      {value && (
        <p className="text-xs text-stone-400 font-mono">{value}</p>
      )}
    </div>
  )
}
