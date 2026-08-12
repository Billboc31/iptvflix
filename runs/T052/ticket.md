# T052 — Surface followed-media arrivals and newly available items in the Web app

**Source**: GitHub Issue #101

## Description

## Objective

Turn the existing follow-release and source availability lifecycle into a visible user feature so IPTVFlix clearly shows when a followed/upcoming Movie or Series becomes available on one of the user's sources.

## Context / Problem

IPTVFlix already tracks followed media and source appearance/disappearance events. Once automatic synchronization is added, these transitions can happen in the background. The user needs a clear product surface for “this thing I wanted is now available to me” instead of requiring manual catalog searching.

## Included

- Build a profile-scoped arrival/activity surface based on existing durable release/source lifecycle events rather than re-detecting availability in the frontend.
- Highlight followed media that transitioned to available on a configured source.
- Include enough context to understand what arrived and where, without duplicating provider-specific catalog cards.
- Add read/dismiss semantics so the same arrival does not behave like a permanent unread alert.
- Surface recent arrivals on Home and/or a dedicated activity/radar area consistent with the existing design.
- Link arrival items to canonical detail/play actions.
- Preserve events across restarts and avoid duplicate notifications for repeated idempotent syncs.
- Keep future push/email/mobile delivery as an extension point; this ticket is the in-product Web experience.

## Acceptance Criteria

- [ ] When a followed Media transitions from not available to available on a configured source, one user-visible arrival item is created/exposed.
- [ ] Repeated syncs with no new transition do not create duplicate arrival items.
- [ ] Reappearance after a genuine disappearance can produce a new meaningful arrival according to documented semantics.
- [ ] Arrival items identify the canonical Media and relevant source without duplicating the Media identity.
- [ ] Users can mark arrivals read/dismissed and that state persists.
- [ ] Recent unread arrivals are discoverable from the Web UI and link to the Media detail/play flow.
- [ ] Non-followed source appearances do not flood the followed-arrivals inbox unless explicitly presented in a separate “new on your sources” surface.
- [ ] Automated tests cover first arrival, duplicate sync, read/dismiss and disappearance/reappearance.

## Excluded / Out of scope

- Native mobile push notifications.
- Email/SMS notifications.
- Browser push permissions/service workers.

## Dependencies

Consumes the existing follow-release/source lifecycle model. Benefits from #100 automatic synchronization; can implement the event/read model in parallel and become fully useful once scheduling is active.
