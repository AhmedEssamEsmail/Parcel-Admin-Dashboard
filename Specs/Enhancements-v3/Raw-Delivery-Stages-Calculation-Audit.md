# Raw Delivery Stages — Calculation Audit (Enhancements-v3)

## Scope
- Source of truth: **Excel tab `Raw Data - Delivery Stages`**.
- Reviewed implementation source: `public.v_raw_delivery_stages` and upstream views.
- Requested behavior: keep open/incomplete-stage values as `null/0` (no running `NOW()` logic).

## Executive findings
1. **Waiting Address identification** was partial (regex only).  
   ✅ Fixed by adding `wa_orders` source and using `regex OR explicit WA list`.
2. **Delivery timing expectations** were simplified to warehouse/city SLA minutes only.  
   ✅ Fixed by adding `warehouse_delivery_timing_rules` and using city-level timing mode (`SAME_DAY` / `FIXED_HOURS`) in delivery expected/actual status.
3. **Raw SLA subsection columns** mostly matched in structure, but delivery expected-time semantics were partially mismatched vs Excel.
4. **WoW/MoM Late metric** missing in source view caused blank UI values.  
   ✅ Fixed by adding `late` in `v_wow_summary` and `v_mom_summary`.

---

## Column-by-column audit

### A) Identity + timestamps
| Column | Excel concept | SQL status | Classification | Action |
|---|---|---|---|---|
| warehouse | static warehouse label | `warehouse_code` | Match | none |
| parcel_id | unique parcel | parcel key | Match | none |
| order_placed | order placed timestamp | `order_local` | Match | none |
| collecting / ready_for_preparing / prepare / ready_for_delivery / on_the_way_ts / delivered | min status timestamps per stage | from `v_parcel_status_min` localized by warehouse tz | Match | none |
| order_hour / order_date | derived from order timestamp | derived from `order_local` | Match | none |

### B) Address + WA classification
| Column | Excel concept | SQL status | Classification | Action |
|---|---|---|---|---|
| address | delivery address text | from `delivery_details.delivery_address` | Match | none |
| waiting_address | regex + WA sheet list | regex only (before fix) | Mismatch | integrated `wa_orders` list + regex |

### C) Phase durations
| Column | Excel concept | SQL status | Classification | Action |
|---|---|---|---|---|
| processing | order→collecting | interval diff, clamped | Match (per chosen null/0 policy) | none |
| collect_wait_time | processing minus before-shift expected wait logic | present | Partial | retained current shift-adjusted behavior |
| picker_phase | collecting→ready_for_preparing | present | Match | none |
| prepare_wait_time | ready_for_preparing→prepare | present | Match | none |
| wrapping_phase | prepare→ready_for_delivery | present | Match | none |
| delivery_wait_time | ready_for_delivery→on_the_way | present | Match | none |
| on_the_way_duration | on_the_way→delivered | present | Match | none |
| time_to_deliver | end-to-end duration | present | Match | none |
| ops_time | stage subtotal with cutoff adjustment | present | Partial | retained, clamped at output |
| iftar_time | optional additive input from raw source | currently fixed zero | Partial | retained as zero placeholder |

### D) Delivery expected/actual + KPI
| Column | Excel concept | SQL status | Classification | Action |
|---|---|---|---|---|
| expected_time_delivery | city timing rule / same-day logic | previously effective SLA only | Mismatch | added delivery timing rules and expected-time logic by mode/cutoff |
| actual_time_delivery | on-the-way duration | present | Match | none |
| delivery_time_status | compare actual vs expected | previously vs warehouse/city SLA minutes | Partial | now compares with timing-rule expected duration |
| expected_delivery_time | expected timestamp-like output | existed but tied to old SLA deadline | Partial | now derived from `order_local + delivery_expected_time` |
| delivery_kpi | On Time/Late | previously from `v_parcel_kpi.is_on_time` | Partial | now aligned to delivery status outcome |
| order_status | delivered/not delivered | present | Match | none |

### E) Processing SLA subsection
| Column | Excel concept | SQL status | Classification | Action |
|---|---|---|---|---|
| cutoff_status | before/normal/after shift | present | Match | none |
| expected_time_processing | wait-to-shift expected amount | present | Match | none |
| processing_time | raw processing duration | present | Match | none |
| actual_time_processing | processing minus expected wait | present | Match | none |
| processing_time_status | within/OOSLA | present | Match | none |

### F) Preparing SLA subsection (hidden in sheet)
| Column | Excel concept | SQL status | Classification | Action |
|---|---|---|---|---|
| expected_time_preparing | fixed 20 min | present | Match | none |
| actual_time_preparing | prep subtotal (+processing delta if non-WA) | present | Match | none |
| preparing_time_status | within/OOSLA | present | Match | none |

### G) Operational + attribution
| Column | Excel concept | SQL status | Classification | Action |
|---|---|---|---|---|
| number_of_items | from items report | joined | Match | none |
| collector | from collector report | joined | Match | none |
| wrapper | from prepare report | joined | Match | none |
| has_a_ticket / ticket_type | from Freshdesk | joined | Match | none |
| ops_exceeded_30_mins | late + no WA + no ticket + ops threshold | present | Match/Partial | aligned with delivery-status-derived late logic |
| zone / city / area | delivery geo fields | present | Match | none |

---

## Related dashboard aggregation impacts
- Added `wa_delivered_count` to `v_dod_summary`.
- Added `late` + `wa_delivered_count` to `v_wow_summary` / `v_mom_summary`.
- Enables:
  - non-blank WoW/MoM `Late`
  - WA delivered % line in dashboard chart.

---

## Concept sanity-check notes (external references)
- **OTD formula** validated with Oracle SCM style definition: on-time deliveries / total deliveries.
- **Cycle-time interpretation** aligned with standard logistics usage (order-to-delivery elapsed windows).
- For open-order aging references, retained project-specific chosen behavior (`null/0 until complete`) per stakeholder direction.

References:
- Oracle SCM OTD concept: https://docs.oracle.com/en/cloud/saas/warehouse-management/24d/owmol/onlinehelp/topics/on_time_delivery.html
- MetricHQ cycle-time primer: https://www.metrichq.org/supply-chain/order-cycle-time/
- APQC process perspective: https://www.apqc.org/process-performance-measures/order-cycle-time
- Sage aging reference (contextual): https://help-sage100.na.sage.com/2022/Subsystems/PO/POConcept/Aged_Purchase_Orders_Report.htm
