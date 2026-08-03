# 44. Portal — Calendar

The Calendar page in the Members Portal gives members a view of upcoming meetings
and events for your u3a's interest groups. Members can filter by group, adjust
the date range, and download a PDF copy.

> **Note:** This feature is only available if **Calendar** has been enabled in
> your [Public Links](58-public-links.md) configuration.

![The portal Calendar page](images/portal-calendar.png)

---

## Viewing the calendar [A]

The calendar displays a list of scheduled meetings and events, starting from
today and running to the end of the current year. Each entry shows details such
as the date, group name, time, and venue.

The columns that appear in the calendar are controlled by the **calendar_config**
setting in [Public Links](58-public-links.md). Your Site Administrator can choose
which columns are visible to portal members.

---

## Filtering [B]

At the top of the calendar, a filter lets you narrow down what is shown:

| Filter option | What it shows |
|---------------|---------------|
| **All** | All scheduled meetings and events across all groups. |
| **A specific group** | Only meetings for the group you select from the dropdown. |
| **Own groups and general meetings** | Meetings for groups you belong to, plus any general or open meetings. |

This makes it easy for members to focus on the groups they are involved in,
without being overwhelmed by the full schedule.

---

## Date range

The calendar shows events from **today** through to the **end of the year**. Past
events are not displayed.

---

## Downloading a PDF [C]

If PDF download has been enabled by your Site Administrator, a **Download PDF**
button appears at the top of the calendar. Clicking it generates a PDF document
of the currently filtered calendar view, which the member can save or print.

---

## Tips for administrators

- Use the **calendar_config** setting in [Public Links](58-public-links.md) to
  choose which columns appear in the portal calendar.
- Make sure your group schedules are kept up to date — the portal calendar pulls
  directly from the group schedule data, so any changes made in the
  [Group Schedule](19-group-record-schedule.md) are reflected immediately.
- Consider enabling the PDF download option so that members can print a copy of
  upcoming events to keep at home.

---

[← 43. Portal — Groups](43-portal-groups.md) | [Contents](index.md) | [45. Portal — Personal Details →](45-portal-personal-details.md)
