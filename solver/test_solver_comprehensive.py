"""Comprehensive automated test suite for the TKB CP-SAT Solver."""

import unittest
from tkb_solver import build_and_solve


class TestTkbSolver(unittest.TestCase):
    def setUp(self):
        self.standard_days = [
            {"id": 1, "weekday": 2},
            {"id": 2, "weekday": 3},
            {"id": 3, "weekday": 4},
            {"id": 4, "weekday": 5},
            {"id": 5, "weekday": 6},
        ]
        self.standard_periods_morning = [
            {"id": 1, "shift": "morning", "orderNo": 1},
            {"id": 2, "shift": "morning", "orderNo": 2},
            {"id": 3, "shift": "morning", "orderNo": 3},
            {"id": 4, "shift": "morning", "orderNo": 4},
            {"id": 5, "shift": "morning", "orderNo": 5},
        ]
        self.standard_periods_afternoon = [
            {"id": 6, "shift": "afternoon", "orderNo": 1},
            {"id": 7, "shift": "afternoon", "orderNo": 2},
            {"id": 8, "shift": "afternoon", "orderNo": 3},
            {"id": 9, "shift": "afternoon", "orderNo": 4},
            {"id": 10, "shift": "afternoon", "orderNo": 5},
        ]
        self.all_standard_periods = self.standard_periods_morning + self.standard_periods_afternoon

    def test_basic_feasible_solve(self):
        """Test basic schedule generation for 1 class with multiple subjects."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [
                {"id": 1, "maxPeriodsPerDay": 5},
                {"id": 2, "maxPeriodsPerDay": 5},
                {"id": 3, "maxPeriodsPerDay": 5},
            ],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 4},
                {"id": 2, "classId": 1, "subjectId": 102, "teacherId": 2, "periodsPerWeek": 4},
                {"id": 3, "classId": 1, "subjectId": 103, "teacherId": 3, "periodsPerWeek": 4},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {"teacherGaps": 1, "subjectSpread": 1},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 12)
        self.assertEqual(len(res["missing"]), 0)

    def test_lns_keeps_hard_constraints_and_never_worsens_incumbent(self):
        """LNS starts from CP-SAT's feasible solution and only accepts equal or better scores."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [
                {"id": 1, "maxPeriodsPerDay": 5},
                {"id": 2, "maxPeriodsPerDay": 5},
                {"id": 3, "maxPeriodsPerDay": 5},
            ],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 4},
                {"id": 2, "classId": 1, "subjectId": 102, "teacherId": 2, "periodsPerWeek": 4},
                {"id": 3, "classId": 1, "subjectId": 103, "teacherId": 3, "periodsPerWeek": 4},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {"teacherGaps": 2, "subjectSpread": 2, "avoidSinglePeriod": 1},
        }

        res = build_and_solve(data)

        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertTrue(res["lnsUsed"])
        self.assertLessEqual(res["score"], res["initialScore"])
        self.assertEqual(len(res["entries"]), 12)
        slots = [(entry["classId"], entry["dayId"], entry["periodId"]) for entry in res["entries"]]
        self.assertEqual(len(slots), len(set(slots)), "LNS introduced a hard class-slot collision")

    def test_no_teacher_conflict(self):
        """Test that 1 teacher cannot teach 2 classes at the same slot."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [
                {"id": 1, "shift": "morning", "maxPeriodsPerDay": 5},
                {"id": 2, "shift": "morning", "maxPeriodsPerDay": 5},
            ],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 10},
                {"id": 2, "classId": 2, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 10},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 20)

        # Verify no overlapping slots for teacher 1
        teacher_slots = set()
        for e in res["entries"]:
            slot = (e["teacherId"], e["dayId"], e["periodId"])
            self.assertNotIn(slot, teacher_slots, f"Teacher double-booked at slot {slot}")
            teacher_slots.add(slot)

    def test_no_class_conflict(self):
        """Test that 1 class cannot have 2 subjects at the same slot."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}, {"id": 2, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 10},
                {"id": 2, "classId": 1, "subjectId": 102, "teacherId": 2, "periodsPerWeek": 10},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        class_slots = set()
        for e in res["entries"]:
            slot = (e["classId"], e["dayId"], e["periodId"])
            self.assertNotIn(slot, class_slots, f"Class double-booked at slot {slot}")
            class_slots.add(slot)

    def test_no_room_conflict(self):
        """Test that 2 classes sharing 1 special room cannot use it at the same slot."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [
                {"id": 1, "shift": "morning", "maxPeriodsPerDay": 5},
                {"id": 2, "shift": "morning", "maxPeriodsPerDay": 5},
            ],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}, {"id": 2, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "roomId": 99, "periodsPerWeek": 5},
                {"id": 2, "classId": 2, "subjectId": 102, "teacherId": 2, "roomId": 99, "periodsPerWeek": 5},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        room_slots = set()
        for e in res["entries"]:
            slot = (e["roomId"], e["dayId"], e["periodId"])
            self.assertNotIn(slot, room_slots, f"Room double-booked at slot {slot}")
            room_slots.add(slot)

    def test_teacher_busy_enforcement(self):
        """Test that slots marked as teacher busy are never assigned."""
        busy_slots = [
            {"teacherId": 1, "dayId": 1, "periodId": 1},
            {"teacherId": 1, "dayId": 1, "periodId": 2},
            {"teacherId": 1, "dayId": 2, "periodId": 1},
        ]
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 15},
            ],
            "fixedEntries": [],
            "teacherBusy": busy_slots,
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        busy_set = {(b["teacherId"], b["dayId"], b["periodId"]) for b in busy_slots}
        for e in res["entries"]:
            slot = (e["teacherId"], e["dayId"], e["periodId"])
            self.assertNotIn(slot, busy_set, f"Assignment placed on busy slot {slot}")

    def test_class_off_enforcement(self):
        """Test that slots marked as class off are never assigned."""
        off_slots = [
            {"classId": 1, "dayId": 5, "periodId": 4},
            {"classId": 1, "dayId": 5, "periodId": 5},
        ]
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 15},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": off_slots,
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        off_set = {(o["classId"], o["dayId"], o["periodId"]) for o in off_slots}
        for e in res["entries"]:
            slot = (e["classId"], e["dayId"], e["periodId"])
            self.assertNotIn(slot, off_set, f"Assignment placed on off slot {slot}")

    def test_shift_enforcement_morning_and_afternoon(self):
        """Test that morning classes only get morning periods and afternoon classes only get afternoon periods."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.all_standard_periods,
            "classes": [
                {"id": 1, "shift": "morning", "maxPeriodsPerDay": 5},
                {"id": 2, "shift": "afternoon", "maxPeriodsPerDay": 5},
            ],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 5},
                {"id": 2, "classId": 2, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 5},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        morning_pids = {p["id"] for p in self.standard_periods_morning}
        afternoon_pids = {p["id"] for p in self.standard_periods_afternoon}

        for e in res["entries"]:
            if e["classId"] == 1:
                self.assertIn(e["periodId"], morning_pids, "Morning class placed in non-morning period")
            elif e["classId"] == 2:
                self.assertIn(e["periodId"], afternoon_pids, "Afternoon class placed in non-afternoon period")

    def test_primary_school_model(self):
        """Test primary school 4 morning + 3 afternoon = 7 periods/day full shift."""
        primary_morning = [
            {"id": 1, "shift": "morning", "orderNo": 1},
            {"id": 2, "shift": "morning", "orderNo": 2},
            {"id": 3, "shift": "morning", "orderNo": 3},
            {"id": 4, "shift": "morning", "orderNo": 4},
        ]
        primary_afternoon = [
            {"id": 5, "shift": "afternoon", "orderNo": 1},
            {"id": 6, "shift": "afternoon", "orderNo": 2},
            {"id": 7, "shift": "afternoon", "orderNo": 3},
        ]
        primary_periods = primary_morning + primary_afternoon

        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": primary_periods,
            "classes": [{"id": 1, "shift": "full", "maxPeriodsPerDay": 7}],
            "teachers": [
                {"id": 1, "maxPeriodsPerDay": 7},
                {"id": 2, "maxPeriodsPerDay": 7},
            ],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 15},
                {"id": 2, "classId": 1, "subjectId": 102, "teacherId": 2, "periodsPerWeek": 15},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {"subjectSpread": 3, "avoidSinglePeriod": 1},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 30)

    def test_max_periods_per_day_limits(self):
        """Test max periods per day for class, teacher, and subject."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 4}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 3}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 6, "maxPerDay": 2},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])

        # Count per day
        day_counts = {}
        for e in res["entries"]:
            day_counts[e["dayId"]] = day_counts.get(e["dayId"], 0) + 1
        for d, count in day_counts.items():
            self.assertLessEqual(count, 2, f"Subject exceeded maxPerDay=2 on day {d}")

    def test_mandatory_double_periods(self):
        """Test that mandatory double periods are always consecutive in the same session."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {
                    "id": 1,
                    "classId": 1,
                    "subjectId": 101,
                    "teacherId": 1,
                    "periodsPerWeek": 4,
                    "allowDouble": 1,
                    "doublePeriods": 2,
                    "doubleRequired": 1,
                },
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 4)

        # Group by day and check consecutive periods
        entries_by_day = {}
        for e in res["entries"]:
            entries_by_day.setdefault(e["dayId"], []).append(e["periodId"])

        # Since 4 periods and doublePeriods=2 mandatory, we must have 2 pairs of consecutive periods
        pair_count = 0
        for d, pids in entries_by_day.items():
            pids.sort()
            for i in range(len(pids) - 1):
                if pids[i + 1] == pids[i] + 1:
                    pair_count += 1
        self.assertGreaterEqual(pair_count, 2, "Mandatory double periods were not scheduled consecutively")

    def test_min_gap_days(self):
        """Test minGapDays prevents scheduling on consecutive days."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,  # 5 days (1, 2, 3, 4, 5)
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {
                    "id": 1,
                    "classId": 1,
                    "subjectId": 101,
                    "teacherId": 1,
                    "periodsPerWeek": 2,
                    "maxPerDay": 1,
                    "minGapDays": 1,
                },
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 2)
        days_used = sorted(e["dayId"] for e in res["entries"])
        self.assertGreater(days_used[1] - days_used[0], 1, f"Days {days_used} violated minGapDays=1")

    def test_fixed_locked_entries_preserved(self):
        """Test that locked entries in fixedEntries are strictly preserved."""
        fixed = [
            {"classId": 1, "subjectId": 101, "teacherId": 1, "roomId": None, "dayId": 1, "periodId": 1, "assignmentId": 1},
            {"classId": 1, "subjectId": 102, "teacherId": 2, "roomId": None, "dayId": 2, "periodId": 2, "assignmentId": 2},
        ]
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}, {"id": 2, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 3},
                {"id": 2, "classId": 1, "subjectId": 102, "teacherId": 2, "periodsPerWeek": 3},
            ],
            "fixedEntries": fixed,
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        # Should place 4 new entries (total 6 with fixed)
        self.assertEqual(len(res["entries"]), 4)

        # Verify no placed entry clashes with fixed entries
        fixed_slots = {(f["dayId"], f["periodId"]) for f in fixed}
        for e in res["entries"]:
            self.assertNotIn((e["dayId"], e["periodId"]), fixed_slots, "New entry collided with locked fixed entry")

    def test_infeasible_problem_and_partial_diagnosis(self):
        """Test that impossible constraints return infeasible in full mode and report missing entries in partial mode."""
        # 10 periods requested into 5 available slots
        data = {
            "mode": "full",
            "timeLimitSeconds": 5,
            "days": [{"id": 1, "weekday": 2}],
            "periods": [
                {"id": 1, "shift": "morning", "orderNo": 1},
                {"id": 2, "shift": "morning", "orderNo": 2},
                {"id": 3, "shift": "morning", "orderNo": 3},
                {"id": 4, "shift": "morning", "orderNo": 4},
                {"id": 5, "shift": "morning", "orderNo": 5},
            ],
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 10},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {},
        }
        res = build_and_solve(data)
        self.assertEqual(res["status"], "infeasible")

        # Now solve in partial mode
        data["mode"] = "partial"
        res_partial = build_and_solve(data)
        self.assertIn(res_partial["status"], ["optimal", "feasible"])
        self.assertEqual(len(res_partial["entries"]), 5)
        self.assertEqual(len(res_partial["missing"]), 1)
        self.assertEqual(res_partial["missing"][0]["missingCount"], 5)

    def test_soft_teacher_gaps(self):
        """Test that soft constraint teacherGaps reduces gaps between first and last periods."""
        # 1 teacher with 2 periods on 1 day with 5 periods available. Gaps weight = 3.
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": [{"id": 1, "weekday": 2}],
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 2},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {"teacherGaps": 3},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 2)
        pids = sorted(e["periodId"] for e in res["entries"])
        # Should be placed consecutively (gap = 0, so pids[1] == pids[0] + 1)
        self.assertEqual(pids[1], pids[0] + 1, f"Teacher gaps were not minimized: {pids}")

    def test_soft_avoid_single_period(self):
        """Test that avoidSinglePeriod favors grouping periods together on fewer days."""
        # 2 periods total over 2 days. With avoidSinglePeriod=3, solver will place 2 periods on 1 day rather than 1 period on each day.
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": [{"id": 1, "weekday": 2}, {"id": 2, "weekday": 3}],
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 2},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {"avoidSinglePeriod": 3, "teacherGaps": 1},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 2)
        # All 2 periods should be placed on the SAME day to avoid single period penalty on both days!
        days_used = {e["dayId"] for e in res["entries"]}
        self.assertEqual(len(days_used), 1, f"Expected 2 periods on 1 day, got days: {days_used}")

    def test_soft_double_pairs(self):
        """Test that softDoublePairs groups periods into pairs when allowDouble=1 even if doubleRequired=0."""
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": self.standard_days,
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {
                    "id": 1,
                    "classId": 1,
                    "subjectId": 101,
                    "teacherId": 1,
                    "periodsPerWeek": 2,
                    "allowDouble": 1,
                    "doublePeriods": 1,
                    "doubleRequired": 0,
                },
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {"softDoublePairs": 3},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 2)
        # Should be placed on the same day consecutively
        d1, d2 = res["entries"][0]["dayId"], res["entries"][1]["dayId"]
        self.assertEqual(d1, d2, "Soft double periods should be on the same day")
        p1, p2 = sorted([res["entries"][0]["periodId"], res["entries"][1]["periodId"]])
        self.assertEqual(p2, p1 + 1, "Soft double periods should be consecutive")

    def test_soft_teacher_prefer(self):
        """Test that teacherPrefer rewards assigning to preferred slot."""
        # 1 period on a day with 5 slots. Preferred slot is period 3.
        data = {
            "mode": "full",
            "timeLimitSeconds": 10,
            "days": [{"id": 1, "weekday": 2}],
            "periods": self.standard_periods_morning,
            "classes": [{"id": 1, "shift": "morning", "maxPeriodsPerDay": 5}],
            "teachers": [{"id": 1, "maxPeriodsPerDay": 5}],
            "assignments": [
                {"id": 1, "classId": 1, "subjectId": 101, "teacherId": 1, "periodsPerWeek": 1},
            ],
            "fixedEntries": [],
            "teacherBusy": [],
            "teacherPrefer": [{"teacherId": 1, "dayId": 1, "periodId": 3}],
            "classAvailabilityOff": [],
            "roomAvailabilityOff": [],
            "weights": {"teacherPrefer": 3},
        }
        res = build_and_solve(data)
        self.assertIn(res["status"], ["optimal", "feasible"])
        self.assertEqual(len(res["entries"]), 1)
        self.assertEqual(res["entries"][0]["periodId"], 3, "Teacher preferred period was not chosen")


if __name__ == "__main__":
    unittest.main()
