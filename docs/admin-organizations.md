# Admin: Organizations

Platform admins manage local organizations (food banks, pantries, shelters, clinics, mutual aid,
nonprofits, government, community and other groups) from **Moderation → Organizations**. An active
organization appears in the Organizations directory, on the map, and on its public page
`/s/organization/<id>`.

## The list

The tab lists every organization, active or inactive, with its type, city/state and status. Each
organization's name links to its [organization admin page](#the-organization-admin-page).

- **Create organization**: the button at the top right of the list (also shown when the list is
  empty, as a quick action on **Overview**, and as **Add organization** on the feed's Organizations
  tab for platform admins).
- **Edit**: opens the same setup panel, filled in with the saved details.
- **More actions (⋯)**:
  - **Deactivate**: hides the organization and cancels all of its upcoming and in-progress event
    occurrences. Recorded attendance is kept. Reactivating does **not** restore cancelled occurrences;
    they must be re-added.
  - **Reactivate**: shows the organization again.
  - **Open admin**: opens the organization admin page.
  - **View public page**: only while the organization is active.
- **Members**: expands the organization's member roster (add by user id, change role, remove).

## The setup panel

The panel slides in from the right (full screen on a phone). **Save** stores everything at once and
returns you to the list. **Cancel**, **Escape**, the close button or the phone's Back button ask
**Discard changes?** when you have unsaved changes. Clicking outside the panel does nothing while
there are unsaved changes.

You can link straight to the panel: `/moderation?tab=organizations&org=new` (create) or
`/moderation?tab=organizations&org=<id>` (edit).

### Sections

- **Basics**: name, type, description. If another organization has a very similar name, a warning
  offers **Edit existing**. The warning never blocks saving.
- **Contact**: phone, email, website. A website without `https://` gets it added.
- **Location**: street, city, state, ZIP, then **Find on map**.
  - The address is looked up on FEED's server with the US Census Geocoder. Nothing is sent to a map
    vendor, and lookup results are never stored on their own.
  - An exact match drops a pin to check. An approximate match is flagged "approximate — please adjust
    the pin". With no match, or no street, click the map to place the pin.
  - Drag the pin to the exact spot, then click **Confirm pin**. Only a confirmed pin is saved, and the
    form will not save while a pin is waiting to be confirmed. **Remove pin** clears the location.
  - Without a mouse: focus the map (it shows a focus ring), move it with the arrow keys until the
    crosshair sits on the spot, then press **Place pin at map center**; focus moves to **Confirm pin**.
- **Hours**: new organizations start Monday–Friday, 9 AM–5 PM, with Saturday and Sunday closed.
  - Each day has an **Open/Closed** switch. Turning a closed day on fills in 9 AM–5 PM.
  - Times move in 15-minute steps. **Add hours** adds a second interval (for example, a lunch break).
  - **Open 24 hours** covers the whole day. A closing time earlier than the opening time runs into the
    next day and is labelled "(next day)".
  - **Copy to weekdays** and **Copy to all days** repeat a day's hours.
  - Overlapping hours, and hours that open and close at the same minute, are flagged and block saving.
  - When saved hours of zero length are found while editing, they are cleared and a notice asks you to
    set the hours again.
- **Photos**: a logo, a cover photo and a gallery (JPG, PNG or WebP). Originals up to 10 MB are
  accepted; each photo must be under 5 MB after compression. Photos upload when you press Save. If
  the save is rejected, the photos uploaded in that attempt are removed. If the connection drops
  mid-save, they are kept, because the save may have gone through and would then show them. A later
  Save removes them only if that failed save had in fact gone through (they are then the replaced
  photos it reports). Otherwise they stay behind as unreferenced files in the photo bucket, which
  cannot be listed from the app.
- **Linked resources**: **Browse directory** opens a searchable resource directory inside the panel.
  Filter it by state, city and category, then tick resources and use the arrows to set their order.
  **Done** keeps your selection; **Back** discards it. A linked resource that is no longer approved
  is marked **No longer approved**; remove it before saving.

## The organization admin page

`/moderation/org/<id>` is the admin for one organization: **Overview** (that organization's active
events, upcoming event dates, check-ins in the last 30 days, members), **Events**, **Profile** (the
setup panel for that organization only) and **Members**.

- **Who can open it**: a platform admin, for any non-business organization (active or inactive),
  and an admin of that organization while it is active. Guest accounts are refused. Anyone else, an
  unknown id and a malformed id all get the same "not found" page.
- **Getting there**: platform admins click an organization's name (or **Open admin**) in the list.
  An organization admin without a moderation role opens **Settings → Administration**, which goes
  straight to their organization, or to `/moderation/org` (a list) when they run several.
- **Organization admins** can edit the profile (name, description, contact, hours, pin, photos,
  linked resources). They see the organization type read-only; only platform admins change it, and
  a save always sends the stored type unchanged. They see the member roster read-only. Activating,
  deactivating and membership changes stay with platform admins.
- **Inactive organizations**: platform admins can still open their admin page, and only platform
  admins see an inactive organization's event dates in the Events panel. Its own admins, members
  and signed-out visitors see none, and the community feed shows its events to nobody until the
  organization is reactivated.

### Events

- **New event** creates the event and its first date in one step: title, type, optional
  description, start and end, the **time zone** of the venue, and the location. Enter times as they
  are at the event location; every card and list shows the time in that zone. The time zone cannot
  change after the event is created. A time that does not exist or happens twice on a
  daylight-saving change is refused with a message naming it.
- **Location**: the organization's own map pin by default. **Enter an address** instead looks it up
  with the US Census Geocoder; confirm the pin on the map before saving.
- **Add dates** schedules more dates in the event's time zone. A date that is already scheduled is
  left as it is; re-adding a cancelled date schedules it again (unless it already has check-ins).
- **Cancel date** cancels one date. Ended dates keep their attendance history and cannot be
  cancelled.
- **Edit** changes the details; **Retire event** cancels the dates that have not started (a date in
  progress finishes normally).
- **Community feed**: an event appears on the feed for everyone, signed in or not, while the event
  and its organization are active and it has a date within the next 30 days.
- Pressing Create twice, or retrying after a dropped connection, never creates a second event.
- Every event change writes one row to the admin audit log (`admin_actions`).

## Keyboard and screen readers

- Closing the panel (Save, Cancel, Escape, Back) returns focus to the button that opened it, or to
  **Create organization** when that button is gone.
- After Deactivate/Reactivate, focus returns to the row's **More actions** button and the result is
  announced.
- After **Edit existing**, focus moves to the Name field of the organization that opened.
- The map's own buttons (zoom, attribution, logo) are read in the admin's language. The pin itself is
  not announced; the status line under **Find on map** says where the pin stands.
- When Save finds a problem, focus moves to the first field to fix (name, email, website, the first
  invalid hours, or **Confirm pin**).

## Known follow-ups

These predate the Organizations screens and are left for a separate change:

- The admin header's organization selector has no visible label.
- The admin tab icons are not marked `aria-hidden`.
- The Open/Closed switch thumb does not mirror in right-to-left languages.
- The switch thumb uses `bg-background`, which turns dark in the OS dark mode.

## Privacy and logging

The screens log only closed-vocabulary events: panel close result and duration, save attempts,
duplicate-warning actions, invalid-hours kinds, and geocode outcome. Names, addresses, emails and
other free text are never logged. See [observability.md](observability.md).

## Languages

All text on these screens follows the admin's profile language (14 languages). The non-English text
is a draft awaiting native-speaker review.
