'use client'

// apps/web/src/components/feed/card-actions-menu.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ⋯ actions menu of a feed card (event cards today; post cards reuse it). A WAI-ARIA menu
// button built on Radix DropdownMenu (the `radix-ui` umbrella, as in orgs-section.tsx): Enter /
// Space / ArrowDown open it, arrow keys rove, typeahead jumps, Escape closes it and focus returns to
// the trigger. The caller describes WHAT the menu offers; this file owns how it looks and behaves:
//
//   sections   groups of items, in order; empty sections are dropped and a separator sits between
//              the remaining ones (destructive items go in their own, last section).
//   item kinds 'action'      a command (onSelect); `destructive` = red text, never color alone
//                             (the label says what it does)
//              'unavailable' a command this viewer cannot use right now, with the reason in its
//                             name: arrow keys still reach it (aria-disabled, not Radix `disabled`,
//                             which skips it), so screen-reader users learn why; choosing it does
//                             nothing
//              'link'        an element rendered as the menu item itself (<Menu.Item asChild>), e.g.
//                             the "Edit in admin" <a>, which then carries role="menuitem"
//
// A dialog opened from an item has no DialogTrigger, so it must return focus to this trigger when it
// closes: pass `triggerRef` and give the dialog
//   onCloseAutoFocus={useCallback((e: Event) => { e.preventDefault(); triggerRef.current?.focus() }, [])}
// Targets: the trigger is 32×32, items at least 36 px tall (WCAG 2.5.8). Text: stone-800 / red-700
// on white (≥ 6.4:1), focus and highlight ring in the brand green #4a5d23 (≥ 3:1). The content is
// portalled under <body>, outside the card's lang wrapper, so it carries `lang` itself; `dir` comes
// from the root.

import type { ReactElement, ReactNode, Ref } from 'react'
import { DropdownMenu as Menu } from 'radix-ui'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { dir, type Locale } from '@/lib/i18n'

export type CardMenuItem =
  | {
      kind: 'action'
      id: string
      label: string
      onSelect: () => void
      icon?: ReactNode
      destructive?: boolean
      testId?: string
    }
  | {
      kind: 'unavailable'
      id: string
      label: string
      /** Why it cannot be used (read as part of the item's name). */
      reason: string
      icon?: ReactNode
      testId?: string
    }
  | {
      kind: 'link'
      id: string
      /** The element that becomes the item (it receives role="menuitem", the item class and the
       *  roving handlers through Radix Slot; it must forward them to its DOM element). */
      element: ReactElement
    }

export interface CardMenuSection {
  id: string
  items: readonly CardMenuItem[]
}

export interface CardActionsMenuProps {
  sections: readonly CardMenuSection[]
  /** The trigger's accessible name, naming the card ("Manage event: Saturday pantry"). */
  triggerLabel: string
  locale: Locale
  triggerRef?: Ref<HTMLButtonElement>
  /** data-testid of the trigger. */
  testId?: string
  /** Opened / closed (e.g. to start loading what an item will need). */
  onOpenChange?: (open: boolean) => void
  /** An item's work is in progress: the trigger shows a spinner and says so (aria-busy). */
  busy?: boolean
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

export const CARD_MENU_TRIGGER_CLASS =
  'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-200 data-[state=open]:bg-stone-200 ' +
  FOCUS_RING

const ITEM_COMMON =
  'flex min-h-9 select-none rounded-md px-3 py-1.5 text-sm outline-none ' +
  'data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-brand'
const ITEM_ROW = `${ITEM_COMMON} cursor-pointer items-center gap-2`

/** An ordinary item (also given to a 'link' item's element through Slot). */
export const CARD_MENU_ITEM_CLASS = `${ITEM_ROW} text-stone-800 data-[highlighted]:bg-stone-100`
export const CARD_MENU_DESTRUCTIVE_CLASS = `${ITEM_ROW} font-medium text-red-700 data-[highlighted]:bg-red-50`
export const CARD_MENU_UNAVAILABLE_CLASS = `${ITEM_COMMON} cursor-default flex-col items-start text-stone-600 data-[highlighted]:bg-stone-50`

/** The sections that render: empty ones dropped. */
export function visibleSections(sections: readonly CardMenuSection[]): CardMenuSection[] {
  return sections.filter((s) => s.items.length > 0)
}

/** True when the menu has anything to offer (the caller renders no trigger otherwise). */
export function hasMenuItems(sections: readonly CardMenuSection[]): boolean {
  return visibleSections(sections).length > 0
}

/** The items of an open menu, sections separated (render inside Menu.Content). */
export function CardMenuItems({ sections }: { sections: readonly CardMenuSection[] }) {
  return (
    <>
      {visibleSections(sections).map((section, i) => (
        <Menu.Group key={section.id}>
          {i > 0 && <Menu.Separator className="my-1 h-px bg-stone-200" />}
          {section.items.map((item) => {
            if (item.kind === 'link') {
              return (
                <Menu.Item key={item.id} asChild className={CARD_MENU_ITEM_CLASS}>
                  {item.element}
                </Menu.Item>
              )
            }
            if (item.kind === 'unavailable') {
              return (
                <Menu.Item
                  key={item.id}
                  className={CARD_MENU_UNAVAILABLE_CLASS}
                  aria-disabled="true"
                  data-testid={item.testId}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span className="inline-flex items-center gap-2">
                    {item.icon}
                    {item.label}
                  </span>
                  <span className="text-xs">{item.reason}</span>
                </Menu.Item>
              )
            }
            return (
              <Menu.Item
                key={item.id}
                className={item.destructive ? CARD_MENU_DESTRUCTIVE_CLASS : CARD_MENU_ITEM_CLASS}
                data-testid={item.testId}
                onSelect={item.onSelect}
              >
                {item.icon}
                {item.label}
              </Menu.Item>
            )
          })}
        </Menu.Group>
      ))}
    </>
  )
}

/** The ⋯ menu button and its menu. Renders nothing when no section has an item. */
export function CardActionsMenu({ sections, triggerLabel, locale, triggerRef, testId, onOpenChange, busy = false }: CardActionsMenuProps) {
  if (!hasMenuItems(sections)) return null
  return (
    <Menu.Root dir={dir(locale)} onOpenChange={onOpenChange}>
      <Menu.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={triggerLabel}
          aria-busy={busy || undefined}
          data-testid={testId}
          className={CARD_MENU_TRIGGER_CLASS}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          lang={locale}
          align="end"
          sideOffset={4}
          className="z-50 min-w-[12rem] max-w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-stone-200 bg-white p-1 shadow-lg"
        >
          <CardMenuItems sections={sections} />
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
