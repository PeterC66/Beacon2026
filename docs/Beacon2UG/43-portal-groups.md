# 43. Portal — Groups

The Groups page in the Members Portal lets members browse all of your u3a's
active interest groups, see whether they are already a member of each group, and
join or leave groups with a single click.

> **Note:** This feature is only available if **Groups** has been enabled in your
> [Public Links](58-public-links.md) configuration.

![The portal Groups page](images/portal-groups.png)

---

## Viewing groups

The page shows a list of all active groups [A]. Each group displays:

- The **group name** — click or tap to expand and see more details.
- A **status badge** showing the member's relationship to the group:

| Badge | Meaning |
|-------|---------|
| **MEMBER** | You are a member of this group. |
| **WAITING** | The group is full and you have been placed on the waiting list. |
| *(no badge)* | You are not a member of this group. |

---

## Expanded group details [B]

Clicking on a group name expands it to show additional information. The fields
displayed depend on what your Site Administrator has configured in the
**group_info_config** setting within [Public Links](58-public-links.md):

| Field | Description |
|-------|-------------|
| **When** | The day and time the group meets. |
| **Venue** | Where the group meets. |
| **Contact** | The group leader's contact details. |
| **Enquiries** | Who to contact for enquiries about the group. |
| **Information** | A free-text description of the group and what it does. |

Not all of these fields may be visible — your administrator controls which ones
are shown to portal members.

---

## Joining a group [C]

To join a group, expand the group and click the **Join group** button. A
confirmation dialog will appear asking you to confirm that you want to join.

- If the group has space, you are added as a member immediately and the badge
  changes to **MEMBER**.
- If the group is full, you are placed on the **waiting list** and the badge
  changes to **WAITING**. You will be moved into the group automatically when a
  space becomes available.

The group leader is notified by email whenever a member joins through the portal.

---

## Leaving a group [D]

If you are already a member of a group (or on its waiting list), click the
**Leave group** button. A confirmation dialog will appear to make sure you want
to leave.

Once confirmed, you are removed from the group (or from the waiting list), and
the badge is cleared.

The group leader is notified by email whenever a member leaves through the portal.

---

## Tips for administrators

- Use the **group_info_config** setting in [Public Links](58-public-links.md) to
  control exactly which group details are visible to members in the portal.
- Make sure group leaders know that they will receive email notifications when
  members join or leave their group through the portal.
- If a group uses a waiting list, the list is managed automatically — when a
  member leaves, the next person on the waiting list is promoted.

---

[← 42. The Members Portal](42-members-portal.md) | [Contents](index.md) | [44. Portal — Calendar →](44-portal-calendar.md)
