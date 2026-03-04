# Metric Dictionary (Enhancements-v4)

## Core dashboard metrics
- **OTD %** = `on_time / total_delivered * 100`
- **Late** = `total_delivered - on_time`
- **WA Delivered %** = `wa_delivered_count / total_delivered_inc_wa * 100`

## Raw Delivery Stages focus
- Delivery KPI derived from expected vs actual delivery duration.
- Waiting Address uses explicit WA list and address-pattern fallback.

## Ingest quality metric
- Fill-forward warning count: number of Parcel Logs rows where blank timestamp was inherited from previous row.
