"""Bộ xếp thời khóa biểu tự động dùng Google OR-Tools CP-SAT.

Giao thức: đọc một khối JSON duy nhất từ stdin, in ra stdout nhiều dòng JSON
(mỗi dòng một thông điệp) theo các loại: progress, solution, done, error.
Xem thiết kế ở mục 7.7 của yeucau.md.
"""

import json
import sys
import threading
import time

from ortools.sat.python import cp_model

PARTIAL_PENALTY = 100_000
WEIGHT_LEVELS = {0: 0, 1: 1, 2: 3, 3: 8}


def emit(msg: dict) -> None:
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def build_and_solve(data: dict, force_partial: bool = False):
    mode = "partial" if force_partial else data.get("mode", "full")
    days = data["days"]  # [{id, weekday}]
    periods = data["periods"]  # [{id, shift, orderNo}]
    assignments = data["assignments"]  # [{id, classId, subjectId, teacherId, roomId, periodsPerWeek, maxPerDay, minGapDays, doublePeriods, doubleRequired}]
    classes = {c["id"]: c for c in data["classes"]}  # id -> {shift, maxPeriodsPerDay}
    teachers = {t["id"]: t for t in data["teachers"]}  # id -> {maxPeriodsPerDay}
    fixed = data.get("fixedEntries", [])  # entries that are already locked / out of scope
    teacher_busy = {(t["teacherId"], t["dayId"], t["periodId"]) for t in data.get("teacherBusy", [])}
    teacher_prefer = {(t["teacherId"], t["dayId"], t["periodId"]) for t in data.get("teacherPrefer", [])}
    class_off = {(c["classId"], c["dayId"], c["periodId"]) for c in data.get("classAvailabilityOff", [])}
    room_off = {(r["roomId"], r["dayId"], r["periodId"]) for r in data.get("roomAvailabilityOff", [])}
    weights_in = data.get("weights", {})
    w_gap = WEIGHT_LEVELS.get(weights_in.get("teacherGaps", 0), 0)
    w_spread = WEIGHT_LEVELS.get(weights_in.get("subjectSpread", 0), 0)
    w_prefer = WEIGHT_LEVELS.get(weights_in.get("teacherPrefer", 0), 0)
    w_single = WEIGHT_LEVELS.get(weights_in.get("avoidSinglePeriod", 0), 0)
    w_double = WEIGHT_LEVELS.get(weights_in.get("softDoublePairs", 0), 0)
    time_limit = float(data.get("timeLimitSeconds", 120))

    day_ids = [d["id"] for d in sorted(days, key=lambda day: day["weekday"])]
    period_by_shift = {"morning": [], "afternoon": []}
    for p in periods:
        period_by_shift[p["shift"]].append(p)
    for s in period_by_shift:
        period_by_shift[s].sort(key=lambda p: p["orderNo"])

    fixed_class_slot = {}  # (classId, dayId, periodId) -> True
    fixed_teacher_slot = {}
    fixed_room_slot = {}
    fixed_class_day_count = {}
    fixed_teacher_day_count = {}
    fixed_assignment_count = {}
    fixed_assignment_day_count = {}
    for e in fixed:
        fixed_class_slot[(e["classId"], e["dayId"], e["periodId"])] = True
        if e.get("teacherId"):
            fixed_teacher_slot[(e["teacherId"], e["dayId"], e["periodId"])] = True
        if e.get("roomId"):
            fixed_room_slot[(e["roomId"], e["dayId"], e["periodId"])] = True
        fixed_class_day_count[(e["classId"], e["dayId"])] = fixed_class_day_count.get((e["classId"], e["dayId"]), 0) + 1
        if e.get("teacherId"):
            key = (e["teacherId"], e["dayId"])
            fixed_teacher_day_count[key] = fixed_teacher_day_count.get(key, 0) + 1
        if e.get("assignmentId"):
            fixed_assignment_count[e["assignmentId"]] = fixed_assignment_count.get(e["assignmentId"], 0) + 1
            akey = (e["assignmentId"], e["dayId"])
            fixed_assignment_day_count[akey] = fixed_assignment_day_count.get(akey, 0) + 1

    model = cp_model.CpModel()
    x = {}  # (assignmentId, dayId, periodId) -> BoolVar
    candidate_periods = {}  # assignmentId -> list of (dayId, periodId)

    for a in assignments:
        aid = a["id"]
        cls = classes[a["classId"]]
        shift_list = ["morning", "afternoon"] if cls["shift"] == "full" else [cls["shift"]]
        cands = []
        for d in day_ids:
            for shift in shift_list:
                for p in period_by_shift[shift]:
                    pid = p["id"]
                    if fixed_class_slot.get((a["classId"], d, pid)):
                        continue
                    if a.get("teacherId") and (a["teacherId"], d, pid) in teacher_busy:
                        continue
                    if a.get("teacherId") and fixed_teacher_slot.get((a["teacherId"], d, pid)):
                        continue
                    if a.get("roomId") and fixed_room_slot.get((a["roomId"], d, pid)):
                        continue
                    if a.get("roomId") and (a["roomId"], d, pid) in room_off:
                        continue
                    if (a["classId"], d, pid) in class_off:
                        continue
                    cands.append((d, pid))
        candidate_periods[aid] = cands
        for d, pid in cands:
            x[(aid, d, pid)] = model.NewBoolVar(f"x_a{aid}_d{d}_p{pid}")

    missing = {}
    for a in assignments:
        aid = a["id"]
        needed = a["periodsPerWeek"] - fixed_assignment_count.get(aid, 0)
        needed = max(needed, 0)
        total = sum(x[(aid, d, pid)] for d, pid in candidate_periods[aid])
        if mode == "full":
            model.Add(total == needed)
        else:
            m = model.NewIntVar(0, needed, f"missing_a{aid}")
            model.Add(total + m == needed)
            missing[aid] = m

    # class: at most 1 assignment per free slot
    class_slot_vars = {}
    for a in assignments:
        for d, pid in candidate_periods[a["id"]]:
            class_slot_vars.setdefault((a["classId"], d, pid), []).append(x[(a["id"], d, pid)])
    for key, vars_ in class_slot_vars.items():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)

    # teacher: at most 1 assignment per free slot
    teacher_slot_vars = {}
    for a in assignments:
        if not a.get("teacherId"):
            continue
        for d, pid in candidate_periods[a["id"]]:
            teacher_slot_vars.setdefault((a["teacherId"], d, pid), []).append(x[(a["id"], d, pid)])
    for key, vars_ in teacher_slot_vars.items():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)

    # room: at most 1 assignment per free slot
    room_slot_vars = {}
    for a in assignments:
        if not a.get("roomId"):
            continue
        for d, pid in candidate_periods[a["id"]]:
            room_slot_vars.setdefault((a["roomId"], d, pid), []).append(x[(a["id"], d, pid)])
    for key, vars_ in room_slot_vars.items():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)

    # max periods/day: class, teacher, subject(=assignment)
    for cid, cls in classes.items():
        for d in day_ids:
            vars_ = [
                x[(a["id"], d, pid)]
                for a in assignments
                if a["classId"] == cid
                for (dd, pid) in candidate_periods[a["id"]]
                if dd == d
            ]
            if vars_:
                base = fixed_class_day_count.get((cid, d), 0)
                model.Add(sum(vars_) + base <= cls["maxPeriodsPerDay"])

    for tid, t in teachers.items():
        for d in day_ids:
            vars_ = [
                x[(a["id"], d, pid)]
                for a in assignments
                if a.get("teacherId") == tid
                for (dd, pid) in candidate_periods[a["id"]]
                if dd == d
            ]
            if vars_:
                base = fixed_teacher_day_count.get((tid, d), 0)
                model.Add(sum(vars_) + base <= t["maxPeriodsPerDay"])

    for a in assignments:
        max_per_day = a.get("maxPerDay")
        if not max_per_day:
            continue
        for d in day_ids:
            vars_ = [x[(a["id"], d, pid)] for (dd, pid) in candidate_periods[a["id"]] if dd == d]
            if vars_:
                base = fixed_assignment_day_count.get((a["id"], d), 0)
                model.Add(sum(vars_) + base <= max_per_day)

    # Mandatory double periods: each requested pair must be consecutive in the same session.
    for a in assignments:
        required_pairs = a.get("doublePeriods", 0) if a.get("doubleRequired", 0) else 0
        if required_pairs <= 0:
            continue
        pair_vars = []
        for d in day_ids:
            for shift, plist in period_by_shift.items():
                for index in range(len(plist) - 1):
                    first = (a["id"], d, plist[index]["id"])
                    second = (a["id"], d, plist[index + 1]["id"])
                    if first not in x or second not in x:
                        continue
                    pair = model.NewBoolVar(f"pair_a{a['id']}_d{d}_p{plist[index]['id']}")
                    model.Add(pair <= x[first])
                    model.Add(pair <= x[second])
                    pair_vars.append((pair, first, second))
        if not pair_vars:
            model.Add(0 >= required_pairs)
            continue
        for _, first, second in pair_vars:
            overlaps = [pair for pair, left, right in pair_vars if left == first or right == first or left == second or right == second]
            if len(overlaps) > 1:
                model.Add(sum(overlaps) <= 1)
        model.Add(sum(pair for pair, _, _ in pair_vars) >= required_pairs)

    # The configured minimum gap is enforced between teaching days of the same assignment.
    for a in assignments:
        gap_days = a.get("minGapDays", 0)
        if gap_days <= 0:
            continue
        used_days = {}
        for d in day_ids:
            fixed_count = fixed_assignment_day_count.get((a["id"], d), 0)
            day_vars = [x[(a["id"], d, pid)] for dd, pid in candidate_periods[a["id"]] if dd == d]
            if fixed_count:
                used_days[d] = model.NewConstant(1)
            elif day_vars:
                used_days[d] = model.NewBoolVar(f"used_a{a['id']}_d{d}")
                model.AddMaxEquality(used_days[d], day_vars)
            else:
                used_days[d] = model.NewConstant(0)
        for index, first_day in enumerate(day_ids):
            for second_day in day_ids[index + 1:index + gap_days + 1]:
                model.Add(used_days[first_day] + used_days[second_day] <= 1)

    objective_terms = []

    # teacher preferred time (reward)
    if w_prefer > 0:
        for a in assignments:
            if not a.get("teacherId"):
                continue
            for d, pid in candidate_periods[a["id"]]:
                if (a["teacherId"], d, pid) in teacher_prefer:
                    objective_terms.append(-w_prefer * x[(a["id"], d, pid)])

    # subject spread: reward using more distinct days (up to ideal) per assignment
    if w_spread > 0:
        for a in assignments:
            aid = a["id"]
            cands = candidate_periods[aid]
            days_used = sorted({d for d, _ in cands})
            if not days_used:
                continue
            needed = a["periodsPerWeek"] - fixed_assignment_count.get(aid, 0)
            ideal = max(0, min(needed, len(days_used)))
            if ideal == 0:
                continue
            used_day_vars = []
            for d in days_used:
                day_x = [x[(aid, d, pid)] for dd, pid in cands if dd == d]
                if not day_x:
                    continue
                used = model.NewBoolVar(f"usedday_a{aid}_d{d}")
                model.AddMaxEquality(used, day_x)
                used_day_vars.append(used)
            if used_day_vars:
                objective_terms.append(w_spread * (ideal - sum(used_day_vars)))

    # teacher gaps within a session (morning/afternoon) per day
    if w_gap > 0:
        for tid in teachers:
            for d in day_ids:
                for shift, plist in period_by_shift.items():
                    if not plist:
                        continue
                    work_vars = []
                    for idx, p in enumerate(plist):
                        pid = p["id"]
                        cand_vars = [
                            x[(a["id"], d, pid)]
                            for a in assignments
                            if a.get("teacherId") == tid and (a["id"], d, pid) in x
                        ]
                        is_fixed = fixed_teacher_slot.get((tid, d, pid), False)
                        if is_fixed:
                            wv = model.NewConstant(1)
                        elif cand_vars:
                            wv = model.NewBoolVar(f"work_t{tid}_d{d}_p{pid}")
                            model.Add(sum(cand_vars) == wv)
                        else:
                            wv = model.NewConstant(0)
                        work_vars.append(wv)
                    k = len(work_vars)
                    if k < 3:
                        continue
                    any_work = model.NewBoolVar(f"anywork_t{tid}_d{d}_{shift}")
                    total_work = sum(work_vars)
                    model.Add(total_work >= 1).OnlyEnforceIf(any_work)
                    model.Add(total_work == 0).OnlyEnforceIf(any_work.Not())
                    first_idx = model.NewIntVar(0, k - 1, f"first_t{tid}_d{d}_{shift}")
                    last_idx = model.NewIntVar(0, k - 1, f"last_t{tid}_d{d}_{shift}")
                    for i, wv in enumerate(work_vars):
                        model.Add(first_idx <= i).OnlyEnforceIf(wv)
                        model.Add(last_idx >= i).OnlyEnforceIf(wv)
                    gap = model.NewIntVar(0, k, f"gap_t{tid}_d{d}_{shift}")
                    model.Add(gap == last_idx - first_idx + 1 - total_work).OnlyEnforceIf(any_work)
                    model.Add(gap == 0).OnlyEnforceIf(any_work.Not())
                    objective_terms.append(w_gap * gap)

    # Avoid single period per session for teachers
    if w_single > 0:
        for tid in teachers:
            for d in day_ids:
                for shift, plist in period_by_shift.items():
                    if not plist:
                        continue
                    work_vars = []
                    for p in plist:
                        pid = p["id"]
                        cand_vars = [
                            x[(a["id"], d, pid)]
                            for a in assignments
                            if a.get("teacherId") == tid and (a["id"], d, pid) in x
                        ]
                        is_fixed = fixed_teacher_slot.get((tid, d, pid), False)
                        if is_fixed:
                            work_vars.append(model.NewConstant(1))
                        elif cand_vars:
                            wv = model.NewBoolVar(f"swork_t{tid}_d{d}_p{pid}")
                            model.Add(sum(cand_vars) == wv)
                            work_vars.append(wv)
                    if work_vars:
                        total_work = sum(work_vars)
                        is_single = model.NewBoolVar(f"single_t{tid}_d{d}_{shift}")
                        model.Add(total_work == 1).OnlyEnforceIf(is_single)
                        model.Add(total_work != 1).OnlyEnforceIf(is_single.Not())
                        objective_terms.append(w_single * is_single)

    # Soft double periods preference (when allowDouble=1 and doubleRequired=0)
    if w_double > 0:
        for a in assignments:
            if a.get("allowDouble") and not a.get("doubleRequired") and a.get("doublePeriods", 0) > 0:
                desired_pairs = a.get("doublePeriods", 0)
                pair_vars = []
                for d in day_ids:
                    for shift, plist in period_by_shift.items():
                        for index in range(len(plist) - 1):
                            first = (a["id"], d, plist[index]["id"])
                            second = (a["id"], d, plist[index + 1]["id"])
                            if first not in x or second not in x:
                                continue
                            pair = model.NewBoolVar(f"softpair_a{a['id']}_d{d}_p{plist[index]['id']}")
                            model.Add(pair <= x[first])
                            model.Add(pair <= x[second])
                            pair_vars.append(pair)
                if pair_vars:
                    pair_count = model.NewIntVar(0, len(pair_vars), f"paircount_a{a['id']}")
                    model.Add(pair_count == sum(pair_vars))
                    penalty = model.NewIntVar(0, desired_pairs, f"pen_softpair_a{a['id']}")
                    model.Add(penalty >= desired_pairs - pair_count)
                    objective_terms.append(w_double * penalty)

    if mode == "partial":
        for aid, m in missing.items():
            objective_terms.append(PARTIAL_PENALTY * m)

    objective_expr = sum(objective_terms) if objective_terms else None
    if objective_expr is not None:
        model.Minimize(objective_expr)

    start_time = time.time()
    stop_event = threading.Event()
    phase_state = {"status": "finding_feasible"}

    def heartbeat():
        while not stop_event.wait(2.0):
            emit(
                {
                    "type": "progress",
                    "elapsedSeconds": round(time.time() - start_time, 1),
                    "status": phase_state["status"],
                }
            )

    hb_thread = threading.Thread(target=heartbeat, daemon=True)
    hb_thread.start()

    def extract_entries(get_bool):
        out = []
        for a in assignments:
            for d, pid in candidate_periods[a["id"]]:
                var = x[(a["id"], d, pid)]
                if get_bool(var):
                    out.append(
                        {
                            "assignmentId": a["id"],
                            "classId": a["classId"],
                            "subjectId": a["subjectId"],
                            "teacherId": a.get("teacherId"),
                            "roomId": a.get("roomId"),
                            "dayId": d,
                            "periodId": pid,
                        }
                    )
        return out

    class Callback(cp_model.CpSolverSolutionCallback):
        def __init__(self, phase):
            super().__init__()
            self.phase = phase
            self.best_score = None
            self.last_emit_time = 0.0

        def on_solution_callback(self):
            score = self.ObjectiveValue() if objective_terms else 0
            now = time.time()
            if self.best_score is not None and score >= self.best_score:
                return
            self.best_score = score
            if self.last_emit_time and now - self.last_emit_time < 0.5:
                return
            self.last_emit_time = now
            entries = extract_entries(self.BooleanValue)
            emit(
                {
                    "type": "solution",
                    "elapsedSeconds": round(time.time() - start_time, 1),
                    "score": score,
                    "entries": entries,
                    "phase": self.phase,
                }
            )

    def configure_solver(max_seconds, *, lns_only=False):
        configured = cp_model.CpSolver()
        configured.parameters.max_time_in_seconds = max(0.1, max_seconds)
        configured.parameters.num_search_workers = 8
        configured.parameters.stop_after_first_solution = not lns_only
        configured.parameters.use_lns_only = lns_only
        return configured

    # Phase 1: CP-SAT only needs to establish a valid solution. It may use the
    # whole budget when the hard constraints are difficult; normally it returns
    # immediately after the first feasible timetable.
    emit({"type": "progress", "elapsedSeconds": 0, "status": "finding_feasible"})
    feasibility_solver = configure_solver(time_limit)
    feasibility_callback = Callback("feasibility")
    feasibility_status = feasibility_solver.Solve(model, feasibility_callback)

    if feasibility_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        stop_event.set()
        return {
            "status": "infeasible",
            "elapsedSeconds": round(time.time() - start_time, 1),
            "score": None,
            "entries": [],
            "missing": [],
            "initialScore": None,
            "lnsUsed": False,
            "lnsImproved": False,
        }

    initial_score = feasibility_solver.ObjectiveValue() if objective_terms else 0
    final_solver = feasibility_solver
    final_status = feasibility_status
    lns_used = False

    # Phase 2: use the valid timetable as a hint and let LNS destroy/rebuild
    # neighborhoods. The objective upper bound guarantees that this phase can
    # never return a worse timetable than the CP-SAT incumbent.
    remaining = max(0.0, time_limit - (time.time() - start_time))
    is_large_problem = len(x) >= 1_000 or len(assignments) >= 40 or len(classes) >= 10
    small_problem_budget = min(1.0, max(0.25, time_limit * 0.1))
    lns_budget = remaining if is_large_problem else min(remaining, small_problem_budget)
    if objective_expr is not None and lns_budget >= 0.1 and feasibility_status != cp_model.OPTIMAL:
        incumbent_bound = int(round(initial_score))
        model.Add(objective_expr <= incumbent_bound)
        model.ClearHints()
        for var in x.values():
            model.AddHint(var, int(feasibility_solver.BooleanValue(var)))
        for var in missing.values():
            model.AddHint(var, feasibility_solver.Value(var))

        phase_state["status"] = "optimizing_lns"
        emit(
            {
                "type": "progress",
                "elapsedSeconds": round(time.time() - start_time, 1),
                "status": "optimizing_lns",
                "initialScore": initial_score,
            }
        )
        lns_solver = configure_solver(lns_budget, lns_only=True)
        lns_callback = Callback("lns")
        lns_status = lns_solver.Solve(model, lns_callback)
        lns_used = True
        if lns_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            final_solver = lns_solver
            final_status = lns_status

    stop_event.set()

    elapsed = round(time.time() - start_time, 1)
    entries = extract_entries(final_solver.BooleanValue)
    missing_list = []
    for aid, m in missing.items():
        val = final_solver.Value(m)
        if val > 0:
            a = next(a for a in assignments if a["id"] == aid)
            missing_list.append(
                {"assignmentId": aid, "classId": a["classId"], "subjectId": a["subjectId"], "missingCount": val}
            )
    final_score = final_solver.ObjectiveValue() if objective_terms else 0
    return {
        "status": "optimal" if final_status == cp_model.OPTIMAL else "feasible",
        "elapsedSeconds": elapsed,
        "score": final_score,
        "entries": entries,
        "missing": missing_list,
        "initialScore": initial_score,
        "lnsUsed": lns_used,
        "lnsImproved": lns_used and final_score < initial_score,
    }


def main() -> None:
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except Exception as err:  # noqa: BLE001
        emit({"type": "error", "message": f"Dữ liệu đầu vào không hợp lệ: {err}"})
        return

    try:
        result = build_and_solve(data)
        if result["status"] == "infeasible" and data.get("mode", "full") == "full":
            emit(
                {
                    "type": "progress",
                    "elapsedSeconds": result["elapsedSeconds"],
                    "status": "retry_partial",
                }
            )
            result = build_and_solve(data, force_partial=True)
            if result["status"] in ("optimal", "feasible"):
                result["status"] = "infeasible_full_diagnosed"
        emit({"type": "done", **result})
    except Exception as err:  # noqa: BLE001
        emit({"type": "error", "message": str(err)})


if __name__ == "__main__":
    main()
