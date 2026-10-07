# Overtime Request

A digital overtime order (Surat Perintah Lembur, SPL) for shop-floor teams: supervisors request overtime, managers approve it in one tap, and HR gets a monthly recap ready for payroll.

## Problem

In many plants the SPL is still a paper form. It travels between supervisor, manager and HR for signatures, gets lost or arrives late, and HR re-types every form into a spreadsheet at the end of the month. Approvals given verbally are forgotten, hours are miscounted, and overtime pay slips into the next payroll period.

## What the app does

- **Pengajuan** – supervisors create an SPL with date, shift, start and end time, reason and the employees involved. Duration is calculated automatically, including windows that cross midnight.
- **Rules at entry time** – an SPL longer than 4 hours per day is blocked, and a warning appears when an employee would pass 18 hours in a week (limits from PP 35/2021, art. 26). Rejected SPLs do not count towards the weekly total.
- **Persetujuan** – managers see pending SPLs with total person-hours and approve or reject them; a rejection requires a reason that the requester can read.
- **Rekap** – approved hours per employee for a chosen month, with a CSV export for payroll.

## Source

- `src/domain/overtime.ts` holds the business rules (duration, daily and weekly limits, monthly recap, CSV) as pure functions, covered by `overtime.test.ts`.
- `src/data/overtimeRepository.ts` maps two SharePoint lists to domain types through the Power Apps SDK.
- `src/pages` contains the three screens; `src/components/NewRequestPanel.tsx` is the SPL form.

## SharePoint lists

| List | Columns |
| --- | --- |
| `overtime request` | `WorkDate` (date), `Shift`, `StartTime`, `EndTime`, `Department`, `Reason` (text), `EmployeesJson` (multi-line text), `Status` (Pending / Approved / Rejected), `RequestedBy`, `DecidedBy`, `DecidedAt`, `DecisionNote` |
| `overtime employee` | `Title` (NIK), `FullName`, `Department` |

Employees on an SPL are stored as JSON on the request instead of a child list. This keeps one write per SPL and makes the recap a single query; the trade-off is that the recap cannot be filtered per employee on the server.

## Development

```bash
npm ci
npm test
npm run dev
npm run build
npm run lint
```

`config/dataSourcesInfo.example.ts` is a minimal descriptor that lets the app compile. Register both lists with the Power Apps CLI to generate the real descriptor. Restrict who can change `Status` with SharePoint permissions or a Power Automate flow; the UI does not enforce roles. See [integration setup](../../README.md#connecting-to-a-power-platform-environment).
