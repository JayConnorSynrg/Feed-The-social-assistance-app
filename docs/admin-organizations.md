# Admin: Organizations

Platform admins manage local organizations (food banks, pantries, shelters, clinics, mutual aid,
nonprofits, government, community and other groups) from **Moderation → Organizations**. An active
organization appears in the Organizations directory, on the map, and on its public page
`/s/organization/<id>`.

## The list

The tab lists every organization, active or inactive, with its type, city/state and status.

- **Create organization**: the button at the top right of the list (also shown when the list is
  empty, as a quick action on **Overview**, and as **Add organization** on the feed's Organizations
  tab for platform admins).
- **Edit**: opens the same setup panel, filled in with the saved details.
- **More actions (⋯)**:
  - **Deactivate**: hides the organization and cancels all of its upcoming and in-progress event
    occurrences. Recorded attendance is kept. Reactivating does **not** restore cancelled occurrences;
    they must be re-added.
  - **Reactivate**: shows the organization again.
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
- **Hours**: new organizations start Monday–Friday, 9 AM–5 PM, with Saturday and Sunday closed.
  - Each day has an **Open/Closed** switch. Turning a closed day on fills in 9 AM–5 PM.
  - Times move in 15-minute steps. **Add hours** adds a second interval (for example, a lunch break).
  - **Open 24 hours** covers the whole day. A closing time earlier than the opening time runs into the
    next day and is labelled "(next day)".
  - **Copy to weekdays** and **Copy to all days** repeat a day's hours.
  - Overlapping hours, and hours that open and close at the same minute, are flagged and block saving.
  - When saved hours of zero length are found while editing, they are cleared and a notice asks you to
    set the hours again.
- **Photos**: a logo, a cover photo and a gallery (JPG, PNG or WebP). Photos upload when you press
  Save. If the save fails, the photos uploaded in that attempt are removed.
- **Linked resources**: **Browse directory** opens a searchable resource directory inside the panel.
  Filter it by state, city and category, then tick resources and use the arrows to set their order.
  **Done** keeps your selection; **Back** discards it.

## Privacy and logging

The screens log only closed-vocabulary events: panel close result and duration, save attempts,
duplicate-warning actions, invalid-hours kinds, and geocode outcome. Names, addresses, emails and
other free text are never logged. See [observability.md](observability.md).

## Languages

All text on these screens follows the admin's profile language (14 languages). The non-English text
is a draft awaiting native-speaker review.
